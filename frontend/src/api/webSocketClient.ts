import {User, Call, UserStatusMessage, WebSocketMessage, WSMessage, CallAcceptedPayload, CallRejectedPayload, CallLeavePayload, CallEndedPayload, ICECandidatePayload, WSMessageType} from "@/types/index"
import { webRTCService } from "./webrtcService";
import { use } from "react";
class WebSocketClient{
    private ws: WebSocket;
    private wsUrl = ''
    private statusListeners:        ((status: UserStatusMessage) => void)[] = []
    private presenceListeners:      ((status: UserStatusMessage) => void)[] = []
    private userListListeners:      ((users: UserStatusMessage[]) => void)[] = []
    private incomingCallListeners:  ((call: Call) => void)[] = []
    private callAcceptedListeners:  ((callAccepted: CallAcceptedPayload) => void)[] = []
    private callRejectedListeners:  ((callRejected: CallRejectedPayload) => void)[] = []
    private callLeaveListeners:     ((callLeave: CallLeavePayload) => void)[] = []
    private callEndedListeners:     ((callEnded: CallEndedPayload) => void)[] = []
    private usersStatus:            Map<number, "online" | "offline" | "busy"> = new Map() 
    private call:                   Call | null = null;
    constructor(){
        this.ws = new WebSocket(this.wsUrl)
    }

    setupEventListener() {
        this.ws.addEventListener("message", (e) => {
            const message = JSON.parse(e.data)
            this.handleMessage(message)
        })
    }

    sendMessage(type: WSMessageType, payload: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message: WebSocketMessage = {
                type,
                payload,
                time: new Date().toISOString()
            };
            this.ws.send(JSON.stringify(message));
        }
    }
    handleMessage(message: any) {
        switch (message.type) {
            case "user_online":
            case "user_offline":
                this.handleUserStatus(message);
            case "status":
                this.handleUserList(message);
            case "incoming_call":
                this.handleIncomingCall(message);
            case "call_accepted":
                this.handleCallAccepted(message);
            case "call_rejected":
                this.handleCallRejected(message);
            case "call_ended":
                this.handleCallEnded(message);
            case "call_leave":
                this.handleCallLeave(message);
            case "add_callee":
                this.handleAddCallee(message);
            case "ice-candidate":
                this.handleICECandidate(message);
            case "answer":
                this.handleAnswer;
            default:

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

    handleCallLeave(message: WebSocketMessage) {
        const payload = message.payload as CallLeavePayload
        this.callLeaveListeners.forEach(listener => listener(payload))
        console.log("User " + payload.userId + " has left call.");
    }

    handleCallEnded(message: WebSocketMessage) {
        const payload = message.payload as CallEndedPayload
        this.call = null
        this.callEndedListeners.forEach(listener => listener(payload))
        console.log("Call " + payload.callId + "has ended.")
    }

    handleAnswer(message: WebSocketMessage) {
        const answer = message.payload as RTCSessionDescriptionInit
        webRTCService.startSession(answer)
    }
    
    handleICECandidate(message: WebSocketMessage) {
        const payload = message.payload as ICECandidatePayload
        webRTCService.addIceCandidate(payload.candidate);
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

    addIncomingCallListeners(listener: (call: Call) => void) {
        this.incomingCallListeners.push(listener)
    }

    addCallAcceptedListeners(listener: (callAccepted: CallAcceptedPayload) => void) {
        this.callAcceptedListeners.push(listener)
    }

    addCallRejectedListeners(listener: (callRejected: CallRejectedPayload) => void) {
        this.callRejectedListeners.push(listener)
    }

    addCallEndedListeners(listener: (callEnded: CallEndedPayload) => void) {
        this.callEndedListeners.push(listener)
    }
    
}

export const wsClient = new WebSocketClient()