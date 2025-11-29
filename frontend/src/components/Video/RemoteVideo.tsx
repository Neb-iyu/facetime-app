import React, { JSX, useEffect, useRef } from "react";
import { webRTCService } from "@/api/webrtcService";
import { CallParticipant, User } from "@/types";

interface videoProp {
  participant?: User
  stream:       MediaStream
  isSpeaking:   boolean
  audioMuted:   boolean
  videoMuted:   boolean

}
export default function RemoteVideo({ participant, stream, isSpeaking, audioMuted,videoMuted }: videoProp): JSX.Element {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
    return () => {
      if (ref.current) {
        ref.current.srcObject = null;
      }
    };
  }, [stream]);

  return (
    <div className={`video-tile remote ${isSpeaking? 'speaking' : ''}`} >
      <video
        ref={ref}
        id={participant?.id.toString() ?? ""}
        autoPlay
        playsInline
        className="w-full h-full object-cover bg-black "
      />
      <div className="user-info-overlay">
        <span className="user-name">{participant?.name}</span>
        <div className="status-indicators">
          {audioMuted && <span className="indicator muted-audio" title="Audio muted"> </span>}
          {videoMuted && <span className="indicator muted-video" title="Video muted"> </span>}
        </div>
      </div>
      <p>{participant?.name}</p>
    </div>
  );
};

