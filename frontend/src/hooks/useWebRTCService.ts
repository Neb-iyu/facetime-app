// hooks/useWebRTC.ts
import { useEffect, useRef, useState } from 'react';
import { useCallStore } from '@/stores/callStore';
import { webRTCService } from '@/api/webrtcService';

export const useWebRTC = () => {
  const { 
    localStream, 
    setLocalStream,
    addPlaya,
    rmvPlaya,
    handleTrackAdded
  } = useCallStore();
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {

    // Register callbacks
    webRTCService.onTrackAdded(handleTrackAdded);
    webRTCService.onLocalStreamStart(setLocalStream);

    setIsInitialized(true);

    return () => {
      // Cleanup
      webRTCService.removeAllListeners();
    };
  }, [addPlaya, rmvPlaya]);

  const initializeLocalStream = async (constraints: MediaStreamConstraints = { 
    video: true, 
    audio: true 
  }) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Failed to get local media stream:', error);
      throw error;
    }
  };

  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  };

  const switchCamera = async () => {
    try {
      const currentStream = localStream;
      const videoTrack = currentStream?.getVideoTracks()[0];
      
      if (!videoTrack) return;

      // Get all video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length <= 1) {
        console.log('Only one camera available');
        return;
      }

      // Get current camera label
      const currentLabel = videoTrack.label;
      
      // Find alternative camera
      const alternativeDevice = videoDevices.find(device => device.label !== currentLabel);
      
      if (!alternativeDevice) return;

      // Create new stream with alternative camera
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: alternativeDevice.deviceId } },
        audio: true
      });

      // Replace local stream
      stopLocalStream();
      setLocalStream(newStream);

      // TODO: Replace track in existing peer connection
      // webRTCService.replaceVideoTrack(newStream.getVideoTracks()[0]);

    } catch (error) {
      console.error('Failed to switch camera:', error);
    }
  };

  return {
    isInitialized,
    initializeLocalStream,
    stopLocalStream,
    switchCamera,
    hasCamera: !!localStream?.getVideoTracks().length,
    hasMicrophone: !!localStream?.getAudioTracks().length
  };
};