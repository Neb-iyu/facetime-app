import { log } from "console";
import { BIZ_UDGothic } from "next/font/google";
import { CallParticipant, WebSocketMessage } from "../types";
import { wsClient } from "./webSocketClient";

class WebRTCService{
    private pc!:    RTCPeerConnection | null;
    private midToUser: Map<string, number> = new Map();
    private midToTid: Map<string, string> = new Map();
    private unmappedStreams: Map<string, MediaStream> = new Map();

    // event listeners
    private trackAddedListeners: ((userId: number, stream: MediaStream, mid?: string) => void)[] = [];
    private userLeftListeners: ((userId: number) => void)[] = [];
    private localStreamListeners: ((stream: MediaStream) => void)[] = [];

    // registered DOM video elements (set by LocalVideo / RemoteVideo components)
    private remoteStreams: Map<MediaStream, number> = new Map();



    constructor() {}

    // videoNode optional — if omitted the registered localVideoEl will be used
    createPeerConnection(callId?: Number): Promise<RTCSessionDescriptionInit> {
        return new Promise((resolve, reject) => {
            if (this.pc == null) {
                this.pc = new RTCPeerConnection({
                    iceServers: [
                        {
                            urls: 'stun:stun.l.google.com:19302'
                        }
                    ]
                });
                // attach remote track handler
                this.pc.ontrack = (ev) => {
                    const stream = ev.streams && ev.streams[0];
                    const mid = ev.transceiver?.mid
                    if (stream) {
                        this.unmappedStreams.set(ev.track.id, stream);
                        if (mid) this.midToTid.set(mid, ev.track.id)

                        // if we already know userId for this mid -> promote and emit
                        const uid = mid ? this.midToUser.get(mid) : undefined;
                        if (uid) {
                            this.emitTrackAdded(uid, stream, mid!);
                        } else {
                            // notify listeners with temporary id 0 (UI can treat as preview)
                            //this.emitTrackAdded(0, stream, mid!);
                            // try to resolve mid via transceivers / events
                            this.awaitMidAssignment(ev.track.id, ev.track.id);
                        }
                    }
                };

                this.pc.onicecandidate = (event) => {
                    if (event.candidate) {
                    const payload = {
                        userId: Number(sessionStorage.getItem("userId")),
                        candidate: event.candidate,
                        callId: callId,
                    };
                    wsClient.sendMessage("ice-candidate", payload);
                    }
                };

                navigator.mediaDevices.getUserMedia({ video: true, audio: true})
                .then(stream => {
                    stream.getTracks().forEach(track => this.pc!.addTrack(track, stream))
                    // prefer provided videoNode, else use registered localVideoEl
                    this.emitLocalStream(stream);
                     return this.pc!.createOffer();
                })
                .then(offer => {
                    return this.pc!.setLocalDescription(offer);
                })
                .then(() => {
                    return this.waitForICEGathering();
                })
                .then(() => {
                    const completeOffer = this.pc!.localDescription!;
                    resolve(completeOffer.toJSON());
                })
            .catch(reject);
         } else {
             reject(new Error("Peer connection already exists"));
         }

     });
    }


    ReconnectPeerConnection(callId: number): Promise<RTCSessionDescriptionInit> {
        return new Promise((resolve, reject) => {
            this.createPeerConnection(callId)
            .then(offer => {
                resolve(offer);
            })
            .catch(reject);
        });
    }
 
    private waitForICEGathering(): Promise<void> {
         return new Promise((resolve) => {
             if (this.pc!.iceGatheringState === 'complete') {
                 resolve();
             } else {
                 const checkState = () => {
                     if (this.pc!.iceGatheringState === 'complete') {
                         resolve();
                     }
                 };
                 this.pc!.onicegatheringstatechange = checkState;
                 
                 // Fallback timeout
                 setTimeout(() => {
                     console.warn("ICE gathering timeout, proceeding with available candidates");
                     resolve();
                 }, 5000); // 5 second timeout
             }
         });
    }

    addIceCandidate(IC: RTCIceCandidate) {
        this.pc?.addIceCandidate(new RTCIceCandidate(IC))
    }

    handleOffer(sd: RTCSessionDescriptionInit) {
        this.pc?.setRemoteDescription(new RTCSessionDescription(sd));
        this.pc?.createAnswer().then(answer => this.pc?.setLocalDescription(answer));
    }

    startSession(sd: RTCSessionDescriptionInit) {
        try {
            this.pc?.setRemoteDescription(new RTCSessionDescription(sd))
        } catch (e) {
            alert(e)
        }
    }
     
    setMidMap(map: Map<string, number>) {
        for (const [mid, uid] of map.entries()) {
            this.midToUser.set(mid, uid);
            var tid = this.midToTid.get(mid)
            if (!tid) {
                tid = this.getTrackIdFromMid(mid);
            }
            if (tid) {
                const participant: CallParticipant = {
                    userId: uid,
                    trackId: tid,
                    stream: this.unmappedStreams.get(tid)!,
                    mid,
                    audioMuted: false,
                    videoMuted: false,
                    isSpeaking: false
                }
                const stream = this.unmappedStreams.get(tid);
                if (stream) {
                    // promote the stream into a user slot and emit a proper track-added for UI
                    this.emitTrackAdded(uid, stream, mid);
                    // remove unmapped cache entry (we keep participants map)
                    this.unmappedStreams.delete(tid);
                }
            }
        }
    }

    getUserIdFromMid(id: string) {
        return this.midToUser.get(id);
    }

    addUserId(bId: number, mid: string) {
        this.midToUser.set(mid, bId);
    }

    endSession() {
        this.pc?.getSenders().forEach(sender => sender.track?.stop());
        this.pc?.close();
        this.pc = null;
    }
     
    chatAmImuted(): boolean {
        return this.pc? false:true;;
    }

    findMidForTrack(trackId?: string): string | undefined {
        if (!trackId || !this.pc) return undefined;
        const transceivers = this.pc.getTransceivers();
        for (const t of transceivers) {
            const r = t.receiver;
            if (r && r.track && r.track.id === trackId && t.mid) {
                return t.mid;
            }
        }
        return undefined;
    }

    getTrackIdFromMid(mid: string): string| undefined{
        if (!this.pc) return undefined;
        for (const t of this.pc.getTransceivers()) {
            if (t.mid === mid && t.receiver?.track) {
                return t.receiver.track.id
            }
        }
    }

    private awaitMidAssignment(trackId: string | undefined, streamId: string) {
        if (!this.pc || !trackId) return;
        const tryResolve = () => {
            const mid = this.findMidForTrack(trackId);
            if (mid) {
                this.midToTid.set(mid, trackId);
                cleanup();
            }
        };
        const onEvent = () => tryResolve();
        const cleanup = () => {
            this.pc?.removeEventListener("signalingstatechange", onEvent);
            this.pc?.removeEventListener("connectionstatechange", onEvent);
            clearTimeout(timeout);
        };
        this.pc.addEventListener("signalingstatechange", onEvent);
        this.pc.addEventListener("connectionstatechange", onEvent);
        tryResolve();
        const timeout = setTimeout(cleanup, 3000);
    }
     
    onTrackAdded(cb: (userId: number, stream: MediaStream, mid?: string) => void) {
        this.trackAddedListeners.push(cb);
        return () => { this.trackAddedListeners = this.trackAddedListeners.filter(fn => fn !== cb); };
    }

    onLocalStreamStart(listener: (stream: MediaStream) => void) {
        this.localStreamListeners.push(listener)
    } 

    onUserLeft(cb: (userId: number) => void) {
        this.userLeftListeners.push(cb);
        return () => { this.userLeftListeners = this.userLeftListeners.filter(fn => fn !== cb); };
    }

    private emitTrackAdded(userId: number, stream: MediaStream, mid?: string) {
        for (const cb of this.trackAddedListeners) try { cb(userId, stream, mid); } catch {}
        // DOM event for legacy components that use document events
        try {
            document.dispatchEvent(new CustomEvent('userTrackAdded', { detail: { userId, stream, mid } }));
        } catch {}
    }

    private emitLocalStream(stream: MediaStream) {
        this.localStreamListeners.forEach(l => l(stream));
    }

    private emitUserLeft(userId: number) {
        for (const cb of this.userLeftListeners) try { cb(userId); } catch {}
        try { document.dispatchEvent(new CustomEvent('userLeftCall', { detail: { userId } })); } catch {}
    }

    removeAllListeners() {
        this.trackAddedListeners = [];
        this.userLeftListeners = [];
        this.localStreamListeners = [];
    }
}

export const webRTCService = new WebRTCService()