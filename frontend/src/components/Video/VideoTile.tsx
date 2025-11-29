// components/VideoTile.tsx
import React, { useRef, useEffect, useState } from 'react';

interface VideoTileProps {
  stream: MediaStream | null;
  user: { id: number | string; name: string };
  isLocal: boolean;
  audioMuted: boolean;
  videoMuted: boolean;
  isSpeaking: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  user,
  isLocal,
  audioMuted,
  videoMuted,
  isSpeaking,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  useEffect(() => {
    if (videoRef.current && stream) {
      const video = videoRef.current;
      
      const handleLoadStart = () => setIsVideoLoading(true);
      const handleLoadedData = () => setIsVideoLoading(false);
      const handleError = () => setIsVideoLoading(false);
      
      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('error', handleError);
      
      video.srcObject = stream;
      
      return () => {
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
      };
    }
  }, [stream]);

  return (
    <div className={`video-tile ${isLocal ? 'local' : 'remote'} ${isSpeaking ? 'speaking' : ''}`}>
      {/* Video Element or Placeholder */}
      {!videoMuted && stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted={isLocal}
          playsInline
          className={`video-element ${isVideoLoading ? 'loading' : ''}`}
        />
      ) : (
        <div className="video-placeholder">
          <div className="user-avatar">
            {user.name.charAt(0).toUpperCase()}
          </div>
          {isVideoLoading && <div className="video-loading">Loading...</div>}
        </div>
      )}
      
      {/* User Info Overlay */}
      <div className="user-info-overlay">
        <span className="user-name">{user.name}</span>
        <div className="status-indicators">
          {audioMuted && <span className="indicator muted-audio" title="Audio muted">🎤❌</span>}
          {videoMuted && <span className="indicator muted-video" title="Video muted">📹❌</span>}
          {isLocal && <span className="indicator you-badge">You</span>}
          {isSpeaking && <span className="indicator speaking" title="Speaking">🎙️</span>}
        </div>
      </div>
      
      {/* Connection Quality */}
      <div className="connection-quality">
        <div className="quality-indicator excellent"></div>
      </div>
    </div>
  );
};