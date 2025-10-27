import { useCallStore } from './callStore';
import type { Call } from '../types';

// simple alias if you ever need the hook directly in components
export const callStore = useCallStore;

// getters/setters for non-react code
export function getCall(): Call | null {
    return useCallStore.getState().call;
}

export function setCall(call: Call | null) {
    useCallStore.setState({ call });
}

export function isLoading(): boolean {
    return useCallStore.getState().loading;
}

// action wrappers (forward to store actions)
export function makeCall(ids: number[], videoNode: HTMLVideoElement) {
    return useCallStore.getState().makeCall(ids, videoNode);
}

export function acceptCall(call: Call, localVideoNode: HTMLVideoElement) {
    return useCallStore.getState().acceptCall(call, localVideoNode);
}

export function rejectCall(call: Call) {
    return useCallStore.getState().rejectCall(call);
}

export function leaveCall() {
    return useCallStore.getState().leaveCall();
}

export function endCall() {
    return useCallStore.getState().endCall();
}

export function addToCall(id: number) {
    return useCallStore.getState().addToCall(id);
}

export function addPlayaMiSelf(id: number) {
    return useCallStore.getState().addPlayaMiSelf(id);
}

// subscribe helper: selector -> listener, returns unsubscribe
export function subscribeToCall(listener: (call: Call | null) => void) {
    return useCallStore.subscribe(state => listener(state.call));
}