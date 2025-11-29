import React, { JSX, useEffect, useRef } from "react";
import { webRTCService } from "@/api/webrtcService";

export default function LocalVideo(): JSX.Element {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    webRTCService.setLocalVideoElement(ref.current);
    return () => {
      webRTCService.setLocalVideoElement(null);
    };
  }, []);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover bg-black"
    />
  );
}