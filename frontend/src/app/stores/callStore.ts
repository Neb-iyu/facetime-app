import {create} from 'zustand';
import { Call, CallAcceptedPayload, CallEndedPayload, CallRejectedPayload } from '../types';

import { wsClient } from '../api/webSocketClient';


interface CallStore {
    call: Call | null;
    loading: boolean;
    addToCall: (id: number) => void;
    makeCall: (ids: number[]) => void;
    acceptCall: (call: Call) => void;
    rejectCall: (call: Call) => void;
    endCall: () => void;
    addPlaya: (id: number) => void;
    rmvPlaya: (id: number) => void;
}

const useCallStore = create<CallStore>((set, get) => ({
    call: null,
    loading: false,
    addToCall: (id: number) => {
        set((state) => ({
            call: state.call
                ? { ...state.call, calleeIds: [...state.call.calleeIds, id] }
                : null
        }));
    },
    makeCall: (ids: number[]) => {
        const newCall: Call = {
            id: null as any,
            callerId: Number(sessionStorage.getItem("userId")),
            calleeIds: ids,
            startTime: Date.now(),
            status: 'ringing'
        };
        set({ call: newCall });
        wsClient.sendMessage('incoming_call', get().call);
    },
    acceptCall: (call: Call) => {
        set({ call });
        
    },
    rejectCall: (call: Call) => {

    },
    endCall: () => {
        const currentCall = get().call;
        if (!currentCall) {
            return;
        }
        if (currentCall.id == null) {
            set({ call: null });
            return;
        }
        const payload: CallEndedPayload = {
            callId: currentCall.id,
            userId: Number(sessionStorage.getItem("userId"))
        };
        wsClient.sendMessage('call_ended', payload);
        set({ call: null });
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
    }
}));