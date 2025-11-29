export interface User {
    id:         number;
    name:       string;
    email:      string;
    password:   string;
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
export interface CallParticipant {
    userId: number;
    name?:   string;
    trackId?: string;
    mid?:     string | null;
    stream?:  MediaStream | null;
    audioMuted: boolean;
    videoMuted: boolean;
    isSpeaking: boolean;
}

export type WSMessageType = "user_online" | "user_offline" | "status" | "incoming_call" | "call_accepted" | "call_rejected" | "call_ended" | "user_leave" | "add_callee" | "ice-candidate" | "answer" | "call_offer" | "reconnect" | "mid-map";
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
export interface UserLeftPayload {
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
export interface TrackUpdatePayload {
    callId: number,
    userId: number,
    trackType: string,
    muted: boolean
}
export interface WebSocketMessage {
    type:    WSMessageType
    payload: any
    time:    string
}
