import { log } from "console";
import { BIZ_UDGothic } from "next/font/google";

class WebRTCService{
    private pc!: RTCPeerConnection | null;
    private broadcasterId: Map<number, number> = new Map();

    constructor() {}

    createPeerConnection(videoNode: HTMLVideoElement) {
        if (this.pc == null) {
            const pc = new RTCPeerConnection({
                iceServers: [
                    {
                        urls: 'stun:stun.l.google.com:19302'
                    }
                ]
            });
                pc.oniceconnectionstatechange = e => log(pc.iceConnectionState)
            navigator.mediaDevices.getUserMedia({ video: true, audio: true})
            .then(stream => {
                stream.getTracks().forEach(track => pc.addTrack(track, stream))
                videoNode.srcObject = stream
                pc.createOffer()
                .then(d => pc.setLocalDescription(d))
                .catch(log)
            });
            this.pc = pc;
        }
    }

    startSession(sd: RTCSessionDescription) {
        if (this.pc) {
            try {
                this.pc.setRemoteDescription(sd)
            } catch (e) {
                alert(e)
            }
        }
    }

    getUserIdFromMid(id: number) {
        return this.broadcasterId.get(id);
    }

    addUserId(bId: number, mid: number) {
        this.broadcasterId.set(mid, bId);
    }
}