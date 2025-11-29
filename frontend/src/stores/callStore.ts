import {create} from 'zustand';
import {useState} from 'react';
import { Call, CallAcceptedPayload, CallEndedPayload, CallRejectedPayload, UserLeftPayload, AddCalleePayload, CallParticipant, UserStatusMessage } from '../types';
import { webRTCService } from '../api/webrtcService';
import { wsClient } from '../api/webSocketClient';
import { apiService } from '@/api/apiService';

interface CallState {
    // call state
    call:           Call | null;
    incomingCall:   Call | null;

    // participants
    participants:   Map<number, CallParticipant>; // userId -> Participant (stable)
    pendingTracks:  Map<string, CallParticipant>; // trackId -> transient preview participant
    users:    Map<number, UserStatusMessage>;

    // Local media state
    localStream:    MediaStream | null;
    isAudioMuted:   boolean;
    isVideoMuted:   boolean;

    // UI state
    loading:        boolean;
    error:          string | null;
    callStatus: 'idle' | 'ringing' | 'connecting' | 'active' | 'ending';

    autoRejectTimeout: NodeJS.Timeout | null;
    audio:             HTMLAudioElement;

}

interface CallActions { 

    // Call lifecycle
    makeCall: (calleeIds: number[]) => Promise<void>;
    acceptCall: (call: Call) => Promise<void>;
    rejectCall: (call: Call) => void;
    leaveCall: () => void;
    endCall: () => void;
    
    // Media controls
    toggleAudio: () => void;
    toggleVideo: () => void;
    toggleScreenShare: () => void;
    
    // Participant management
    setUserStatus: (users: UserStatusMessage[]) => void;
    addUser: (users: UserStatusMessage) => void;
    addPlaya: (participant: CallParticipant) => void;
    rmvPlaya: (userId: number) => void;
    invitePlaya: (userId: number) => void;
    updateParticipant: (userId: number, updates: Partial<CallParticipant>) => void;

    // Track / promotion helpers
    addTrackPreview: (trackId: string, stream: MediaStream, mid?: string) => void;
    promoteTrackToUser: (trackId: string, userId: number, userName?: string) => void;
    removeTrackPreview: (trackId: string) => void;
    setLocalStream: (stream: MediaStream | null) => void;
    
    // Call management
    //addCallee: (userId: number) => void;
    setIncomingCall: (call: Call | null) => void;
    setCallStatus: (status: CallState['callStatus']) => void;
    setError: (error: string | null) => void;
    clearError: () => void;
    
    // WebSocket message handlers
    handleIncomingCall: (call: Call) => void;
    handleCallAccepted: (payload: CallAcceptedPayload) => void;
    handleCallRejected: (payload: CallRejectedPayload) => void;
    handleUserLeft: (userId: number) => void;
    handleUserJoined: (userId: number, userName: string) => void;

    // Callstate handlers
    handleTrackAdded: (userId: number, stream: MediaStream, mid?: string) => void;
    handleTrackRemoved: (userId: number) => void;
    handleTrackStateChange: (userId: number, trackType: string, muted: boolean) => void;

    setAutoRejectTimeout: (timeout: NodeJS.Timeout | null) => void;
    clearIncomingCall: () => void;
    playNotificationSound: () => void;
    stopNotificationSound: () => void;
    
    // Utility
    cleanup: () => void;
}


export const useCallStore = create<CallState & CallActions>((set, get) => ({
    call: null,
    incomingCall: null,
    loading: false,
    participants: new Map(), // userId -> CallParticipant (promoted)
    pendingTracks: new Map(), // trackId -> CallParticipant (preview)
    users: new Map(),
    localStream: new MediaStream,
    isAudioMuted: false,
    isVideoMuted: false,
    error: null,
    callStatus: 'idle',
    autoRejectTimeout: null,
    audio: new Audio("/sounds/ringtone.mp3"),
    setLocalStream: (stream: MediaStream | null) => {
        // persist using set so subscribers are notified
        set({ localStream: stream });
    },
 
    // add a transient preview tile keyed by trackId (no userId yet)
    addTrackPreview: (trackId: string, stream: MediaStream, mid?: string) => {
        set((state) => {
            const next = new Map(state.pendingTracks);
            next.set(trackId, { userId: undefined as any, trackId, stream, mid } as CallParticipant);
            return { pendingTracks: next };
        });
    },
 
    // remove a pending preview
    removeTrackPreview: (trackId: string) => {
        set((state) => {
            const next = new Map(state.pendingTracks);
            const p = next.get(trackId);
            if (p) {
                // do not stop remote stream here; cleanup is handled on promotion/removal
                next.delete(trackId);
            }
            return { pendingTracks: next };
        });
    },
 
    // promote a pending track to a stable participant keyed by userId
    promoteTrackToUser: (trackId: string, userId: number, userName?: string) => {
        set((state) => {
            const pending = new Map(state.pendingTracks);
            const prom = pending.get(trackId);
            const participants = new Map(state.participants);
            if (!prom) return { pendingTracks: pending, participants };
 
            // stop and remove any existing stream for that user
            const existing = participants.get(userId);
            if (existing && existing.stream) {
                try { existing.stream.getTracks().forEach(t => t.stop()); } catch {}
            }
 
            const promoted: CallParticipant = {
                userId,
                trackId,
                stream: prom.stream,
                mid: prom.mid
            } as CallParticipant;
 
            participants.set(userId, promoted);
            pending.delete(trackId);
 
            return { pendingTracks: pending, participants };
        });
    },

    addToCall: (id: number) => {
        set((state) => ({
            call: state.call
                ? { ...state.call, calleeIds: [...state.call.calleeIds, id] }
                : null
        }));
    },
    makeCall: async (ids: number[]) => {
        const store = get();
        store.setError(null);
        store.setCallStatus('ringing');
        set({loading: true });
        return new Promise((resolve, reject) => {
        const tempCall: Call = {
            id: 0, // Temporary
            callerId: Number(sessionStorage.getItem("userId")),
            calleeIds: ids,
            startTime: Date.now(),
            status: 'ringing',
        };
        apiService.createCall(Number(sessionStorage.getItem("userId")), ids)
        .then(createdCall => {
            set({ call: tempCall });
            const callId = createdCall ? createdCall.id : undefined;
            if (!callId) {
                //TODO: when creating call fails try again
                return
            }
            webRTCService.createPeerConnection(callId)
            .then(completeOffer => {
                const updatedCall: Call = {
                    ...tempCall,
                    id: callId,
                    offer: completeOffer
                };
                
                set({ call: updatedCall });
                wsClient.sendMessage('call_offer', {
                    callId: callId,
                    userId: Number(localStorage.getItem("userId")),
                    offer: completeOffer
                });
                resolve();
            })
            .catch(error => {
                console.error("Failed to create call: ", error);
                reject();
            });
        })
        .catch(error => {
            console.error("Failed to create call on server: ", error);
            reject();
        });
    });
    },
    acceptCall: (call: Call) => {
        return new Promise((resolve, reject) => {
            set({ call });
            const previousState = get().call;
            webRTCService.createPeerConnection(call.id)
            .then(offer => {
                const payload: CallAcceptedPayload = {
                    callId: call.id,
                    userId: Number(sessionStorage.getItem("userId")),
                    offer: offer
                }
                wsClient.sendMessage("call_accepted", payload);
                resolve();
            })
            .catch(error => {
                set({ call: previousState })
                console.error("Failed accepting the call", error);
                reject();
            })
        });
    },
    rejectCall: (call: Call) => {
        const payload: CallRejectedPayload = {
            callId: call.id,
            userId: Number(sessionStorage.getItem("userId"))
        }
        wsClient.sendMessage("call_rejected", payload);
    },
    leaveCall: () => {
        const currentCall = get().call;
        if (!currentCall) {
            return;
        }
        if (currentCall.id == null) {
            set({ call: null });
            return;
        }
        const payload: UserLeftPayload = {
            callId: currentCall.id,
            userId: Number(sessionStorage.getItem("userId"))
        };
        wsClient.sendMessage('user_leave', payload);
        webRTCService.endSession()
        set({ call: null });
    },
    endCall: () => {
        const call = get().call
        if (!call) {
            return
        }
        const payload: CallEndedPayload = {
            callId: call.id
        }
        set({ call: null});
        wsClient.sendMessage("call_ended", payload);
        webRTCService.endSession()
    },
    addPlaya: (participant: CallParticipant) => {
        // Use set with a copied Map so zustand subscribers detect the change
        set((state) => {
            const participants = new Map(state.participants);
            participants.set(participant.userId, participant);
            const call = state.call
                ? { ...state.call, calleeIds: [...state.call.calleeIds, participant.userId] }
                : state.call;
            return { participants, call };
        });
    },
    rmvPlaya: (userId: number) => {
        const participant = get().participants.get(userId);
        if (!participant) return;
        // stop and remove participant stream
        set((state) => {
            const participants = new Map(state.participants);
            const p = participants.get(userId);
            if (p && p.stream) {
                try { p.stream.getTracks().forEach(t => t.stop()); } catch {}
            }
            participants.delete(userId);
            return { participants };
        });
    },
    invitePlaya: (id: number) => {
        set((state) => ({
            call: state.call
                ? { ...state.call, calleeIds: [...state.call.calleeIds, id] }
                : null
        }));
        const call = get().call;
        if (!call) {
            return
        }
        const payload: AddCalleePayload = {
            callId: call.id,
            userId: Number(sessionStorage.getItem("userId"))
        }
        wsClient.sendMessage("add_callee", payload)
    },
    setUserStatus: (us: UserStatusMessage[]) => {
        // create a fresh Map copy and set via set()
        set((state) => {
            const users = new Map(state.users);
            for (const u of us) {
                users.set(u.userID, u);
            }
            return { users };
        });
    },
    addUser: (user: UserStatusMessage) => {
        set((state) => {
            const users = new Map(state.users);
            users.set(user.userID, user);
            return { users };
        });
    },
    setIncomingCall: (call) => {
        set({incomingCall: call})
    },
    handleIncomingCall: (call) => {
        const store = get();

        if (store.call) {
            console.log("Alreading in  a call, auto-rejecting incoming call");
            store.rejectCall(call);
            return;
        }

        if (store.autoRejectTimeout) {
            clearTimeout(store.autoRejectTimeout);
        }
        
        store.setIncomingCall(call);

        const timeout = setTimeout(() => {
            console.log("Auto rejecting after timeout");
            store.rejectCall(call);
        }, 30000);

        store.setAutoRejectTimeout(timeout);


    },
    handleTrackAdded: (userId: number, stream: MediaStream, mid?: string) => {
        const store = get()
        if (store.participants.get(userId)) {
            store.updateParticipant(userId, {stream, mid});
        } else {
            // create participant object and add via addPlaya (which uses set())
            store.addPlaya({userId, stream, mid, audioMuted: false, videoMuted: false, isSpeaking: false} as CallParticipant)
        }
    },
    setAutoRejectTimeout: (timeout: NodeJS.Timeout | null) => {
        set({ autoRejectTimeout: timeout });
    },
    clearIncomingCall: () => {
        const store = get();
        if (store.autoRejectTimeout) {
            clearTimeout(store.autoRejectTimeout);
        }
        store.stopNotificationSound();
        set({ incomingCall: null, autoRejectTimeout: null });
    },
    playNotificationSound: () => {
        try {
            const audio = get().audio;
            audio.loop = true;
            audio.play().catch(console.error);
        } catch (error) {
            console.error('Failed to play ringtone:', error);
        }
    },
    stopNotificationSound: () => {
        try {
            const audio = get().audio;
            audio.pause();
            audio.currentTime = 0;
        } catch (error) {
            console.error('Failed to stop ringtone:', error);
        }
    },

    // Missing action implementations to satisfy CallActions interface
    toggleAudio: () => {
        const store = get();
        const muted = !store.isAudioMuted;
        set({ isAudioMuted: muted });
        try {
            const stream = store.localStream;
            if (stream) {
                stream.getAudioTracks().forEach(t => t.enabled = !muted);
            }
        } catch (err) {
            console.error('toggleAudio error', err);
        }
    },
    toggleVideo: () => {
        const store = get();
        const muted = !store.isVideoMuted;
        set({ isVideoMuted: muted });
        try {
            const stream = store.localStream;
            if (stream) {
                stream.getVideoTracks().forEach(t => t.enabled = !muted);
            }
        } catch (err) {
            console.error('toggleVideo error', err);
        }
    },
    toggleScreenShare: () => {
        // Basic stub: actual screen share handling is app-specific
        console.warn('toggleScreenShare not implemented');
    },
    updateParticipant: (userId: number, updates: Partial<CallParticipant>) => {
        set((state) => {
            const participants = new Map(state.participants);
            const existing = participants.get(userId);
            if (!existing) return { participants };
            participants.set(userId, { ...existing, ...updates });
            return { participants };
        });
    },
    setCallStatus: (status: CallState['callStatus']) => {
        set({ callStatus: status });
    },
    setError: (error: string | null) => {
        set({ error });
    },
    clearError: () => {
        set({ error: null });
    },
    handleCallAccepted: (payload: CallAcceptedPayload) => {
        // minimal handling: log and set status; full behavior handled elsewhere
        console.log('handleCallAccepted', payload);
        set({ callStatus: 'connecting' });
    },
    handleCallRejected: (payload: CallRejectedPayload) => {
        console.log('handleCallRejected', payload);
        // If this client initiated the call and was rejected, clear call
        const call = get().call;
        if (call && call.id === payload.callId) {
            set({ call: null, callStatus: 'idle' });
        }
    },
    handleUserLeft: (userId: number) => {
        // remove participant when user leaves
        get().rmvPlaya(userId);
    },
    handleUserJoined: (userId: number, userName: string) => {
        // add a placeholder participant slot (no stream yet)
        set((state) => {
            const participants = new Map(state.participants);
            if (!participants.has(userId)) {
                participants.set(userId, { userId, stream: undefined as any, trackId: undefined, mid: undefined, audioMuted: false, videoMuted: false, isSpeaking: false } as CallParticipant);
            }
            return { participants };
        });
    },
    handleTrackRemoved: (userId: number) => {
        // clear participant stream for user
        set((state) => {
            const participants = new Map(state.participants);
            const p = participants.get(userId);
            if (p && p.stream) {
                try { p.stream.getTracks().forEach(t => t.stop()); } catch {}
                p.stream = undefined as any;
                participants.set(userId, p);
            }
            return { participants };
        });
    },
    handleTrackStateChange: (userId: number, trackType: string, muted: boolean) => {
        const store = get();
        const p = store.participants.get(userId);
        const audioMuted = trackType === 'audio' ? muted : p?.audioMuted;
        const videoMuted = trackType === 'video' ? muted : p?.videoMuted;
        store.updateParticipant(userId, {audioMuted, videoMuted});
    },
    cleanup: () => {
        const store = get();
        try {
            // stop local stream
            if (store.localStream) {
                try { store.localStream.getTracks().forEach(t => t.stop()); } catch {}
            }
            // stop participant streams
            store.participants.forEach(p => {
                if (p.stream) {
                    try { p.stream.getTracks().forEach(t => t.stop()); } catch {}
                }
            });
            // stop pending preview streams
            store.pendingTracks.forEach(p => {
                if (p.stream) {
                    try { p.stream.getTracks().forEach(t => t.stop()); } catch {}
                }
            });
            store.stopNotificationSound();
            webRTCService.endSession();
        } catch (err) {
            console.error('cleanup error', err);
        } finally {
            set({
                call: null,
                participants: new Map(),
                pendingTracks: new Map(),
                localStream: new MediaStream(),
                incomingCall: null,
                autoRejectTimeout: null,
                callStatus: 'idle',
                loading: false,
                error: null
            });
        }
    }

}));