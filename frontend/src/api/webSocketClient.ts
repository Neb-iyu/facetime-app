import {User, Call, UserStatusMessage, WebSocketMessage, WSMessage, CallAcceptedPayload, CallRejectedPayload, UserLeftPayload, CallEndedPayload, ICECandidatePayload, WSMessageType, AddCalleePayload, TrackUpdatePayload}from "@/types/index"
import { webRTCService } from "./webrtcService";
import { use } from "react";
import { time } from "console";

class WebSocketClient{
    private ws: WebSocket | null = null;
    private wsUrl = '' 
    // store token for use across reconnects/connects
    private token: string | null = null;
    private statusListeners:        ((status: UserStatusMessage) => void)[] = []
    private presenceListeners:      ((status: UserStatusMessage) => void)[] = []
    private userListListeners:      ((users: UserStatusMessage[]) => void)[] = []
    private incomingCallListeners:  ((call: Call) => void)[] = []
    private callAcceptedListeners:  ((callAccepted: CallAcceptedPayload) => void)[] = []
    private callRejectedListeners:  ((callRejected: CallRejectedPayload) => void)[] = []
    private UserLeaveListeners:     ((UserLeft: UserLeftPayload) => void)[] = []
    private callEndedListeners:     ((callEnded: CallEndedPayload) => void)[] = []
    private userJoinListeners:      ((payload: any) => void)[] = []
    private userLeaveListeners:     ((payload: any) => void)[] = []
    private trackUpdateListeners:   ((update: TrackUpdatePayload) => void)[] = []
    private midMappingListeners:    ((mapping: Map<string, number> | Record<string, number>) => void)[] = []
    private usersStatus:            Map<number, "online" | "offline" | "busy"> = new Map() 
    private call:                   Call | null = null;

    // reconnect state
    private reconnectAttempts = 0;
    private reconnectTimer: number | null = null;
    private maxReconnectDelay = 30000; // 30s
    private pendingMessages: WebSocketMessage[] = []; // queue while disconnected
    private shouldReconnect = true; // toggle to stop reconnect attempts

    constructor(){
        // load persisted token if present so connect() can use it
        try { this.token = localStorage.getItem("token"); } catch {}
    }

    setToken(token: string | null) {
        this.token = token;
        try {
            if (token) localStorage.setItem("token", token);
            else localStorage.removeItem("token");
        } catch {}
    }

    setWsUrl(url: string) {
        this.wsUrl = url;
    }

    // call to start connection (optionally pass token param)
    connect(token?: string) {
        if (!this.wsUrl) throw new Error("wsUrl not set");
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

        // prefer explicit token param, else stored token, else localStorage fallback
        const t = token ?? this.token ?? (typeof localStorage !== "undefined" ? localStorage.getItem("token") : null);
        const url = t ? `${this.wsUrl}?token=${encodeURIComponent(t)}` : this.wsUrl;
        try {
            this.ws = new WebSocket(url);
        } catch (e) {
            // schedule reconnect if creation failed
            this.scheduleReconnect();
            return;
        }

        this.ws.addEventListener("open", () => {
            this.reconnectAttempts = 0;
            if (this.reconnectTimer) {
                window.clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            // flush pending messages
            this.flushPending();
            console.info("WebSocket connected");
            // notify presence/status if needed
        });

        this.ws.addEventListener("close", () => {
            console.warn("WebSocket closed");
            if (this.shouldReconnect) this.scheduleReconnect();
        });

        this.ws.addEventListener("error", (e) => {
            console.warn("WebSocket error", e);
            // close socket to trigger close handler and reconnect
            try { this.ws?.close(); } catch {}
        });

        this.ws.addEventListener("message", (e) => {
            try {
                const message = JSON.parse(e.data);
                this.handleMessage(message);
            } catch (err) {
                console.warn("Failed to parse ws message", err);
            }
        });
    }

    disconnect() {
        this.shouldReconnect = false;
        if (this.reconnectTimer) {
            window.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            try { this.ws.close(); } catch {}
            this.ws = null;
        }
    }

    private scheduleReconnect() {
        if (!this.shouldReconnect) return;
        this.reconnectAttempts++;
        const delay = Math.min(this.maxReconnectDelay, 1000 * Math.pow(2, Math.min(this.reconnectAttempts, 6)));
        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            // try to reuse same token from localStorage if present
            const token = this.token ?? (typeof localStorage !== "undefined" ? localStorage.getItem("token") : null) ?? undefined;
            this.connect(token);
            if (this.ws?.readyState == WebSocket.OPEN && this.call) {
                const payload = {
                    callId: this.call.id,
                    userId: Number(localStorage.getItem("userId")),
                    pcAlive: webRTCService.chatAmImuted()
                }
                this.sendMessage("reconnect", payload);
                if (webRTCService.chatAmImuted()) {
                    webRTCService.ReconnectPeerConnection(this.call.id)
                    .then(completeOffer => {
                        this.sendMessage("call_offer", {
                            userId: Number(localStorage.getItem("userId")),
                            callId: this.call?.id,
                            offer:  completeOffer
                        })
                    })
                    .catch(error => console.log(error));
                }
            }
        }, delay);
        console.info(`WebSocket reconnect scheduled in ${delay}ms`);
    }
    
    private flushPending() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        while (this.pendingMessages.length) {
            const msg = this.pendingMessages.shift()!;
            this.ws.send(JSON.stringify(msg));
        }
    }

    isConnected(): Boolean {
        return (this.ws?.readyState == WebSocket.OPEN)
    }
    sendMessage(type: WSMessageType, payload: any) {
        const message: WebSocketMessage = {
            type,
            payload,
            time: new Date().toISOString()
        };
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            return;
        }
        // queue while disconnected
        this.pendingMessages.push(message);
        // ensure a reconnect attempt is scheduled
        if (!this.reconnectTimer && this.shouldReconnect) this.scheduleReconnect();
    }

    handleMessage(message: any) {
        switch (message.type) {
            case "user_online":
            case "user_offline":
                this.handleUserStatus(message);
                break;
            case "status":
                this.handleUserList(message);
                break;
            case "incoming_call":
                this.handleIncomingCall(message);
                break;
            case "call_accepted":
                this.handleCallAccepted(message);
                break;
            case "call_rejected":
                this.handleCallRejected(message);
                break;
            case "call_ended":
                this.handleCallEnded(message);
                break;
            case "user_leave":
                this.handleUserLeft(message);
                break;
            case "add_callee":
                this.handleAddCallee(message);
                break;
            case "ice-candidate":
                this.handleICECandidate(message);
                break;
            case "offer":
                this.handleOffer(message);
                break;
            case "answer":
                this.handleAnswer(message);
                break;
            case "user_join":
                // generic user join in call (payload should contain userId, userName)
                this.handleUserJoin(message);
                break;
            case "track_update":
                this.handleTrackUpdate(message);
                break;
            case "mid-map":
                this.handleMidMap(message);
                break;
            default:
                // unknown - ignore
                break;
        }
    }

    handleUserStatus(message: any) {
        const userStatus = message.payload as UserStatusMessage
        this.usersStatus.set(userStatus.userID, userStatus.status)
        this.presenceListeners.forEach(listener => listener(userStatus))
        console.log("User " + userStatus.userID + " is " + userStatus.status)
    }

    handleUserList(message: WebSocketMessage) {
        const users = message.payload as UserStatusMessage[]
        users.forEach(user => {
            this.usersStatus.set(user.userID, user.status)
        })
        this.userListListeners.forEach(listener => listener(users))
        console.log("Recieved " + users.length + " amount of users")
    }

    handleIncomingCall(message: WebSocketMessage) {
        this.call = message.payload as Call
        if (this.call) {
            this.incomingCallListeners.forEach(listener => listener(this.call!))
            console.log("Incoming call recieved from user " + this.call.callerId)
        }
    }

    handleCallAccepted(message: WebSocketMessage) {
        const callAccepted = message.payload as CallAcceptedPayload
        this.callAcceptedListeners.forEach(listener => listener(callAccepted))
        console.log("User " + callAccepted.userId + " has accepted our call")
    }

    handleCallRejected(message: WebSocketMessage) {
        const callRejected = message.payload as CallRejectedPayload
        this.callRejectedListeners.forEach(listener => listener(callRejected))
        if (this.call) {
            const index = this.call.calleeIds.indexOf(callRejected.userId)
            if (index !== -1) {
                this.call.calleeIds.splice(index, 1);
            }
        }
        console.log("User " + callRejected.userId + " has rejected our call")
    }

    handleUserLeft(message: WebSocketMessage) {
        const payload = message.payload as UserLeftPayload
        this.UserLeaveListeners.forEach(listener => listener(payload))
        this.userLeaveListeners.forEach(listener => listener(payload))
        console.log("User " + payload.userId + " has left call.");
    }

    handleUserJoin(message: WebSocketMessage) {
        const payload = message.payload;
        this.userJoinListeners.forEach(listener => listener(payload));
        // also emit as presence if needed
        if (payload && payload.userId) {
            const status: UserStatusMessage = {
                userID: payload.userId,
                username: payload.userName ?? '',
                status: 'online',
                LastSeen: new Date()
            };
            this.presenceListeners.forEach(l => l(status));
        }
    }
 
    handleTrackUpdate(message: WebSocketMessage) {
        const update = message.payload as TrackUpdatePayload;
        this.trackUpdateListeners.forEach(listener => listener(update));
    }

    handleCallEnded(message: WebSocketMessage) {
        const payload = message.payload as CallEndedPayload
        this.call = null
        this.callEndedListeners.forEach(listener => listener(payload))
        console.log("Call " + payload.callId + "has ended.")
    }

    handleAddCallee(message: WebSocketMessage) {
        const payload = message.payload as AddCalleePayload
        this.call?.calleeIds.push(payload.userId)
    }
    
    handleOffer(message: WebSocketMessage) {
        const offer = message.payload as RTCSessionDescriptionInit
        webRTCService.handleOffer(offer)
    }
    handleAnswer(message: WebSocketMessage) {
        const answer = message.payload as RTCSessionDescriptionInit
        webRTCService.startSession(answer)
    }
    
    handleICECandidate(message: WebSocketMessage) {
        const payload = message.payload as ICECandidatePayload
        webRTCService.addIceCandidate(payload.candidate);
    }

    handleMidMap(message: WebSocketMessage) {
        const payload = message.payload as any;
        // Normalize to Map<string, number>
        const midMap = new Map<string, number>();
        if (payload) {
            if (payload instanceof Map) {
                for (const [k, v] of (payload as any).entries()) {
                    midMap.set(String(k), Number(v));
                }
            } else if (typeof payload === 'object') {
                for (const [k, v] of Object.entries(payload)) {
                    // convert numeric user ids (may be number or string)
                    midMap.set(String(k), Number(v));
                }
            }
        }
        // Inform webrtc service with a normalized Map
        try {
            webRTCService.setMidMap && webRTCService.setMidMap(midMap);
        } catch (e) {
            console.warn("webrtcService.setMidMap error", e);
        }
        // notify listeners with the normalized Map
        this.midMappingListeners.forEach(listener => listener(midMap));
    }
    
    handleTrackState(message: WebSocketMessage) {
        // optional: handle track mute/unmute messages (not used here)
    }

    addStatusListener(listener: (status: UserStatusMessage) => void) {
        this.statusListeners.push(listener);
    }

    addPresenceListener(listener: (status: UserStatusMessage) => void) {
        this.presenceListeners.push(listener)
    }

    addUserListListener(listener: (users: UserStatusMessage[]) => void) {
        this.userListListeners.push(listener)
    }

    addIncomingCallListener(listener: (call: Call) => void) {
        this.incomingCallListeners.push(listener)
    }


     // plural aliases for consistency with caller code
    addCallAcceptedListener(listener: (callAccepted: CallAcceptedPayload) => void) {
        this.callAcceptedListeners.push(listener)
    }
    addCallRejectedListeners(listener: (callRejected: CallRejectedPayload) => void) {
        this.callRejectedListeners.push(listener)
    }
    addCallEndedListeners(listener: (callEnded: CallEndedPayload) => void) {
        this.callEndedListeners.push(listener)
    }

    addUserLeaveListener(listener: (UserLeft: UserLeftPayload) => void) {
        this.UserLeaveListeners.push(listener)
    }

     // user join/leave (call-level) listeners
    addUserJoinListener(listener: (payload: any) => void) {
        this.userJoinListeners.push(listener);
    }
    addUserLeaveListenerGeneric(listener: (payload: any) => void) {
        this.userLeaveListeners.push(listener);
    }

     // track updates (mute/unmute etc.)
    addTrackUpdateListener(listener: (update: TrackUpdatePayload) => void) {
        this.trackUpdateListeners.push(listener);
    }

     // mid mapping listener
    addMidMappingListener(listener: (mapping: Map<string, number> | Record<string, number>) => void) {
        this.midMappingListeners.push(listener);
    }



    addCallRejectedListener(listener: (callRejected: CallRejectedPayload) => void) {
        this.callRejectedListeners.push(listener)
    }

    addCallEndedListener(listener: (callEnded: CallEndedPayload) => void) {
        this.callEndedListeners.push(listener)
    }

    removeAllListeners() {
        this.statusListeners = []
        this.presenceListeners = []
        this.userListListeners = []
        this.incomingCallListeners = []
        this.callAcceptedListeners = []
        this.UserLeaveListeners = []
        this.callRejectedListeners = []
        this.callEndedListeners = []
        this.userJoinListeners = []
        this.userLeaveListeners = []
        this.trackUpdateListeners = []
        this.midMappingListeners = []
    }
    
}

export const wsClient = new WebSocketClient()
wsClient.connect()