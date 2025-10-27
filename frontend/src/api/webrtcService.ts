import { log } from "console";
import { BIZ_UDGothic } from "next/font/google";
import { WebSocketMessage } from "../types";
import { wsClient } from "./webSocketClient";
import { resolve } from "path";

class WebRTCService{
    private pc!:    RTCPeerConnection | null;
    private userId: Map<number, number> = new Map();

    constructor() {}

    createPeerConnection(videoNode: HTMLVideoElement): Promise<RTCSessionDescriptionInit> {
        return new Promise((resolve, reject) => {
            if (this.pc == null) {
                this.pc = new RTCPeerConnection({
                    iceServers: [
                        {
                            urls: 'stun:stun.l.google.com:19302'
                        }
                    ]
                });

                navigator.mediaDevices.getUserMedia({ video: true, audio: true})
                .then(stream => {
                    stream.getTracks().forEach(track => this.pc!.addTrack(track, stream))
                    videoNode.srcObject = stream
                    return this.pc!.createOffer();
                })
                .then(offer => {
                    return this.pc!.setLocalDescription(offer);
                })
                .then(() => {
                    return new Promise<void>(resolve => {
                        if (this.pc!.iceGatheringState === 'complete') {
                            resolve();
                        } else {
                            this.pc!.onicegatheringstatechange = () => {
                                if (this.pc!.iceGatheringState === 'complete') {
                                    resolve();
                                }
                            };
                            setTimeout(resolve, 5000);
                        }
                    });
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
    
    getUserIdFromMid(id: number) {
        return this.userId.get(id);
    }

    addUserId(bId: number, mid: number) {
        this.userId.set(mid, bId);
    }

    endSession() {
        this.pc?.getSenders().forEach(sender => sender.track?.stop());
        this.pc?.close();
        this.pc = null;
    }
}

export const webRTCService = new WebRTCService()