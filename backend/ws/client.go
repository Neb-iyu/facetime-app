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
	PeerConn 		*webrtc.PeerConnection
	Tracks			[]chan *webrtc.TrackLocalStaticRTP
}


func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()
	
	for {
		select {
		case message, ok := <- c.Send:
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

func (c *Client) ProcessOffer(off string, callerId uint) {
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
			Type: "ice-candidate",
			Payload: candidate,
			Time: time.Now(),
		}
		select {
		case c.Send <- msg:
		default:
			log.Printf("Send channel full, dropping ICE candidate")
		}
	})
	defer func() {
		if cErr := peerConnection.Close(); cErr != nil {
			log.Printf("cannot close peerConnection: %v\n", cErr)
		}
	}()

	if _, err = peerConnection.AddTransceiverFromKind(webrtc.RTPCodecTypeVideo); err != nil {
		panic(err)
	}

	localTrackChan := make(chan *webrtc.TrackLocalStaticRTP)
	caller := c.Hub.UserClients[callerId]
	caller.Tracks = append(caller.Tracks, localTrackChan)

	peerConnection.OnTrack(func(remoteTrack *webrtc.TrackRemote, reciever *webrtc.RTPReceiver) {
		localTrack, newTrackErr := webrtc.NewTrackLocalStaticRTP(remoteTrack.Codec().RTPCodecCapability, "video", "pion")
		if newTrackErr != nil {
			panic(newTrackErr)
		}
		localTrackChan <- localTrack

		rtpBuf := make([]byte, 1400)
		for {
			i, _, readErr := remoteTrack.Read(rtpBuf)
			if readErr != nil {
				panic(readErr)
			}

			if _, err = localTrack.Write(rtpBuf[:i]); err != nil && !errors.Is(err, io.ErrClosedPipe) {
				panic(err)
			}
		}
	})

	err = peerConnection.SetRemoteDescription(offer)
	if err != nil {
		panic(err)
	}

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
		Type: "answer",
		Payload: peerConnection.LocalDescription(),
		Time: time.Now(),
	}
	<-gatherComplete

	c.Send <- msg

	c.PeerConn = peerConnection
	
	for _, trackChan := range caller.Tracks {
		localTrack := <-trackChan
		_, err := peerConnection.AddTrack(localTrack)
		if err != nil {
			panic(err)
		}
	}

}

func decode(in string, obj *webrtc.SessionDescription) {
	b, err := base64.StdEncoding.DecodeString(in)
	if err != nil {
		panic(err)
	}

	if err = json.Unmarshal(b, obj); err != nil {
		panic(err)
	}
}
