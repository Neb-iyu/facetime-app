package ws

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"time"

	"github.com/Neb-iyu/facetime-app/backend/models"
	"github.com/gorilla/websocket"
	"github.com/pion/interceptor"
	"github.com/pion/interceptor/pkg/intervalpli"
	"github.com/pion/webrtc/v4"
)

type Client struct {
	Hub             *Hub
	Conn            *websocket.Conn
	Send            chan models.WebSocketMessage
	UserID          uint
	Username        string
	SessionID       string
	IsAuthenticated bool
	PeerConn        *webrtc.PeerConnection
}

func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			err := c.Conn.WriteJSON(message)
			if err != nil {
				log.Printf("WebSocket write error: %v", err)
				return
			}
		}
	}

}

func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	for {
		var msg models.WebSocketMessage
		err := c.Conn.ReadJSON(&msg)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
		c.Hub.HandleMessage <- msg
		log.Printf("Received message from client %s: %v", c.Username, msg)

	}
}

func (c *Client) ProcessOffer(off json.RawMessage, callId uint) {
	pcConfig := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.l.google.com:19302"},
			},
		},
	}

	offer := webrtc.SessionDescription{}
	decode(off, &offer)
	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		panic(err)
	}

	interceptorRegistry := &interceptor.Registry{}

	if err := webrtc.RegisterDefaultInterceptors(mediaEngine, interceptorRegistry); err != nil {
		panic(err)
	}
	intervalPliFactory, err := intervalpli.NewReceiverInterceptor()
	if err != nil {
		panic(err)
	}
	interceptorRegistry.Add(intervalPliFactory)

	peerConnection, err := webrtc.NewAPI(
		webrtc.WithMediaEngine(mediaEngine),
		webrtc.WithInterceptorRegistry(interceptorRegistry),
	).NewPeerConnection(pcConfig)
	if err != nil {
		panic(err)
	}
	peerConnection.OnICECandidate(func(ic *webrtc.ICECandidate) {
		if ic == nil {
			return
		}
		candidate := ic.ToJSON()
		msg := models.WebSocketMessage{
			Type:    "ice-candidate",
			Payload: candidate,
			Time:    time.Now(),
		}
		select {
		case c.Send <- msg:
		default:
			log.Printf("Send channel full, dropping ICE candidate")
		}
	})

	if _, err = peerConnection.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo); err != nil {
		panic(err)
	}

	session := c.Hub.CallSessions[callId]

	rTrack := ""
	peerConnection.OnTrack(func(remoteTrack *webrtc.TrackRemote, reciever *webrtc.RTPReceiver) {
		localTrack, newTrackErr := webrtc.NewTrackLocalStaticRTP(remoteTrack.Codec().RTPCodecCapability, "video", "pion")
		if newTrackErr != nil {
			panic(newTrackErr)
		}

		// publish the local track to Hub (key by remoteTrack.ID())
		session.PublishTrack(c.UserID, remoteTrack.ID(), localTrack, true)
		rTrack = remoteTrack.ID()
		rtpBuf := make([]byte, 1400)
		for {
			i, _, readErr := remoteTrack.Read(rtpBuf)
			if readErr != nil {
				// stop forwarding on read error
				if !errors.Is(readErr, io.EOF) {
					log.Printf("remoteTrack read error: %v", readErr)
				}
				return
			}

			if _, err = localTrack.Write(rtpBuf[:i]); err != nil && !errors.Is(err, io.ErrClosedPipe) {
				log.Printf("localTrack write error: %v", err)
				return
			}
		}
	})

	err = peerConnection.SetRemoteDescription(offer)
	if err != nil {
		panic(err)
	}

	session.AddPublishedTracksToPeer(peerConnection, rTrack)

	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		panic(err)
	}

	gatherComplete := webrtc.GatheringCompletePromise(peerConnection)

	err = peerConnection.SetLocalDescription(answer)
	if err != nil {
		panic(err)
	}

	msg := models.WebSocketMessage{
		Type:    "answer",
		Payload: peerConnection.LocalDescription(),
		Time:    time.Now(),
	}
	<-gatherComplete

	c.Send <- msg

	// keep the peerConnection for call lifecycle
	c.PeerConn = peerConnection
	session.MapMIDsForParticipant(c)

	// Optionally add already published tracks from this caller to this peer (if needed)
	//_ = c.Hub.AddPublishedTracksToPeer(peerConnection, callerId)
}

func decode(in json.RawMessage, obj *webrtc.SessionDescription) {
	// try direct JSON first (expected)
	if err := json.Unmarshal(in, obj); err == nil {
		return
	}

	// fallback: maybe it's a quoted base64 string -> decode to string then base64-decode
	var s string
	if err := json.Unmarshal(in, &s); err != nil {
		panic(err)
	}
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		panic(err)
	}
	if err := json.Unmarshal(b, obj); err != nil {
		panic(err)
	}
}
