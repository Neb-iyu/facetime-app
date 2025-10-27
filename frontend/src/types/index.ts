export interface User {
    id:         number;
    name:       string;
    email:      string;
    status:     'online' | 'offline' | 'busy';
    avatarUrl?: string;
    lastSeen:   Date;
}

export interface Call {
    id:         number;
    callerId:   number;
    calleeIds:  number[];
    startTime:  number;
    endTime?:   Date;
    status:     'ringing' | 'ongoing' | 'ended' | 'missed';
    offer?:     RTCSessionDescriptionInit;
    answer?:    RTCSessionDescriptionInit;
}
export type WSMessageType = "user_online" | "user_offline" | "status" | "incoming_call" | "call_accepted" | "call_rejected" | "call_ended" | "call_leave" | "add_callee" | "ice-candidate" | "answer";
export type WSMessage = 
    | {type: 'offer', callId: string, offer: RTCSessionDescriptionInit}
    | {type: 'answer', callId: string, answer: RTCSessionDescriptionInit}
    | {type: 'ice', callId: string, candidate: RTCIceCandidateInit}
    | {type: 'incoming_call', call: Call}
    | {type: 'call_accepted', callId: string}
    | {type: 'call_rejected', callId: string}
    | {type: 'call_ended', callId: string}

export interface UserStatusMessage {
    userID:     number
    username:   string
    status:     'online' | 'offline'| 'busy'
    LastSeen:   Date
}
export interface CallAcceptedPayload {
    callId: number
    userId: number
    offer:  RTCSessionDescriptionInit
}
export interface CallRejectedPayload {
    callId: number
    userId: number
}
export interface CallLeavePayload {
    callId: number
    userId: number
}
export interface CallEndedPayload {
    callId: number
}
export interface ICECandidatePayload {
    userId: number
    candidate: RTCIceCandidate
}
export interface AddCalleePayload {
    callId: number
    userId: number
}
export interface WebSocketMessage {
    type:    WSMessageType
    payload: any
    time:    string
}
