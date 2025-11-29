package ws

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/Neb-iyu/facetime-app/backend/models"

	"github.com/pion/webrtc/v4"
)

// CallSession manages per-call participants and session state.
type CallSession struct {
	ID              uint
	Call            models.Call
	Participants    map[uint]*Client // userID -> client
	Mu              sync.RWMutex
	PublishedTracks map[string]*webrtc.TrackLocalStaticRTP // trackID -> track
	PublishedOwners map[string]uint                        // trackID -> publisherID
	TrackPublishers map[string]uint                        // mid -> userId
}

// NewCallSession constructs a CallSession.
func NewCallSession(call models.Call) *CallSession {
	return &CallSession{
		ID:              call.Id,
		Call:			 call,
		Participants:    make(map[uint]*Client),
		PublishedTracks: make(map[string]*webrtc.TrackLocalStaticRTP),
		PublishedOwners: make(map[string]uint),
		TrackPublishers: make(map[string]uint),
	}
}

func (s *CallSession) AddParticipant(c *Client) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	if c != nil {
		s.Participants[c.UserID] = c
	}
}

// RemoveParticipant removes a participant from the call session
func (s *CallSession) RemoveParticipant(userID uint, msg *models.WebSocketMessage) {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	if c, ok := s.Participants[userID]; ok {
		if c.PeerConn != nil {
			c.PeerConn.Close()
		}
		delete(s.Participants, userID)

		if msg != nil {
			for _, p := range s.Participants {
				select {
				case p.Send <- *msg:
				default:
				}
			}
		}
	}
}

// Close closes all the participants peer connection and remove all particpiants
func (s *CallSession) Close() {
	s.Mu.Lock()
	defer s.Mu.Unlock()
	for _, p := range s.Participants {
		if p.PeerConn != nil {
			p.PeerConn.Close()
		}
	}
	s.Participants = make(map[uint]*Client)
}

// PublishTrack stores a publisher's local track in call session
func (s *CallSession) PublishTrack(publisherID uint, trackID string, track *webrtc.TrackLocalStaticRTP, renegotiate bool) {
	// record ownership
	s.Mu.Lock()
	s.PublishedTracks[trackID] = track
	s.PublishedOwners[trackID] = publisherID

	// snapshot participants to avoid holding lock while doing AddTrack
	parts := make(map[uint]*Client, len(s.Participants))
	for uid, cl := range s.Participants {
		parts[uid] = cl
	}
	s.Mu.Unlock()
	needRenego := make(map[uint]*Client)

	// Add to all viewers (except publisher). Note: if participant already negotiated,
	// adding track will require renegotiation on that participant. Batch renegos in production.
	for uid, cl := range parts {
		if cl == nil || cl.PeerConn == nil || uid == publisherID {
			continue
		}
		if _, err := cl.PeerConn.AddTrack(track); err != nil {
			log.Printf("AddTrack error for participant %d: %v", uid, err)
			continue
		}
		needRenego[uid] = cl
	}
	// caller/flow should trigger renegotiation for affected participants when needed
	if renegotiate {
		for _, p := range needRenego {
			go func(part *Client) {
				if err := s.RenegotiateParticipant(part); err != nil {
					log.Printf("renegotiate error for %d: %v", part.UserID, err)
					return
				}

				time.Sleep(200 * time.Millisecond)
				s.MapMIDsForParticipant(part)
			}(p)
		}
	}
}

// AddPublishedTracksToPeer adds all published tracks to the provided peer connection.
func (s *CallSession) AddPublishedTracksToPeer(pc *webrtc.PeerConnection, trackID string) error {
	s.Mu.RLock()
	defer s.Mu.RUnlock()

	for id, t := range s.PublishedTracks {
		// skip the track that is currently being processed (trackID param)
		if id != trackID {
			if _, err := pc.AddTrack(t); err != nil {
				return err
			}
		}
	}
	return nil
}

// MapMIDsForParticipant scans a participant PeerConnection's transceivers after negotiation,
// matches sender.Track() pointers to PublishedTracks and builds a mid -> publisherId map.
// It persists the mapping in session.TrackPublishers and sends one "mid-map" WS message to the participant.
func (s *CallSession) MapMIDsForParticipant(participant *Client) {
	pc := participant.PeerConn
	if pc == nil || participant == nil {
		return
	}

	// build pointer -> trackID and trackID -> owner maps
	s.Mu.RLock()
	ptrToTrackID := make(map[string]string, len(s.PublishedTracks))
	trackOwners := make(map[string]uint, len(s.PublishedTracks))
	for id, tr := range s.PublishedTracks {
		ptrToTrackID[fmt.Sprintf("%p", tr)] = id
		trackOwners[id] = s.PublishedOwners[id]
	}
	s.Mu.RUnlock()

	collectMidMap := func() map[string]uint {
		midMap := make(map[string]uint)
		for _, t := range pc.GetTransceivers() {
			if t == nil || t.Sender() == nil || t.Sender().Track() == nil {
				continue
			}
			trPtr := fmt.Sprintf("%p", t.Sender().Track())
			if trackID, ok := ptrToTrackID[trPtr]; ok {
				if mid := t.Mid(); mid != "" {
					midMap[mid] = trackOwners[trackID]
				}
			}
		}
		return midMap
	}

	// try immediate collect, retry once after short sleep in case MID assignment is slightly delayed
	midMap := collectMidMap()
	if len(midMap) == 0 {
		time.Sleep(80 * time.Millisecond)
		midMap = collectMidMap()
	}

	if len(midMap) == 0 {
		// nothing to map now
		return
	}

	// persist mapping
	s.Mu.Lock()
	for mid, uid := range midMap {
		s.TrackPublishers[mid] = uid
	}
	s.Mu.Unlock()

	// send consolidated mid map to participant
	msg := models.WebSocketMessage{
		Type:    "mid-map",
		Payload: midMap,
		Time:    time.Now(),
	}
	select {
	case participant.Send <- msg:
	default:
		log.Printf("MapMIDsForParticipant: send channel full for user %d", participant.UserID)
	}
}

func (s *CallSession) RenegotiateParticipant(p *Client) error {
    if p == nil || p.PeerConn == nil {
        return nil
    }

    offer, err := p.PeerConn.CreateOffer(nil)
    if err != nil {
        return err
    }
    if err = p.PeerConn.SetLocalDescription(offer); err != nil {
        return err
    }

    // wait for ICE gather or timeout (use trickle in prod)
    gatherComplete := webrtc.GatheringCompletePromise(p.PeerConn)
    select {
    case <-gatherComplete:
    case <-time.After(5 * time.Second):
    }

    ld := p.PeerConn.LocalDescription()
    // b, _ := json.Marshal(ld)
    // encoded := base64.StdEncoding.EncodeToString(b)

    msg := models.WebSocketMessage{
        Type: "offer",
        Payload: ld,
        Time: time.Now(),
    }

    select {
    case p.Send <- msg:
    default:
        log.Printf("RenegotiateParticipant: send channel full for user %d", p.UserID)
    }
    return nil
}