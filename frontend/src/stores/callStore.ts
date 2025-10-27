import {create} from 'zustand';
import { Call, CallAcceptedPayload, CallEndedPayload, CallRejectedPayload, CallLeavePayload, AddCalleePayload } from '../types';
import { webRTCService } from '../api/webrtcService';
import { wsClient } from '../api/webSocketClient';


export interface CallStore {
    call:       Call | null;
    loading:    boolean;
    addToCall:  (id: number) => void;
    makeCall:   (ids: number[], localVideoNode: HTMLVideoElement) => Promise<void>;
    acceptCall: (call: Call, localVideoNode: HTMLVideoElement) => Promise<void>;
    rejectCall: (call: Call) => void;
    leaveCall:  () => void;
    endCall:    () => void;
    addPlaya:   (id: number) => void;
    rmvPlaya:   (id: number) => void;
    addPlayaMiSelf: (id: number) => void;
}

export const useCallStore = create<CallStore>((set, get) => ({
    call: null,
    loading: false,
    addToCall: (id: number) => {
        set((state) => ({
            call: state.call
                ? { ...state.call, calleeIds: [...state.call.calleeIds, id] }
                : null
        }));
    },
    makeCall: (ids: number[], videoNode: HTMLVideoElement) => {
        return new Promise((resolve, reject) => {
        const tempCall: Call = {
            id: 0, // Temporary
            callerId: Number(sessionStorage.getItem("userId")),
            calleeIds: ids,
            startTime: Date.now(),
            status: 'ringing',
        };
        
        set({ call: tempCall });
        
        webRTCService.createPeerConnection(videoNode)
        .then(completeOffer => {
            const updatedCall: Call = {
                ...tempCall,
                offer: completeOffer
            };
            
            set({ call: updatedCall });
            wsClient.sendMessage('incoming_call', updatedCall);
            resolve();
        })
        .catch(error => {
            console.error("Failed to create call: ", error);
            reject();
        });
    });
    },
    acceptCall: (call: Call, localVideoNode: HTMLVideoElement) => {
        return new Promise((resolve, reject) => {
            set({ call });
            webRTCService.createPeerConnection(localVideoNode)
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
        const payload: CallLeavePayload = {
            callId: currentCall.id,
            userId: Number(sessionStorage.getItem("userId"))
        };
        wsClient.sendMessage('call_leave', payload);
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
    addPlaya: (id: number) => {
        set((state) => ({
            call: state.call
                ? { ...state.call, calleeIds: [...state.call.calleeIds, id] }
                : null
        }));
    },
    rmvPlaya: (id: number) => {
        set((state) => ({
            call: state.call
                ? { ...state.call, calleeIds: state.call.calleeIds.filter(i => i !== id) }
                : null
        }));
    },
    addPlayaMiSelf: (id: number) => {
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
    }
}));