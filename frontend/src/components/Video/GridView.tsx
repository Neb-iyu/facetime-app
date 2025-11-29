// components/VideoGrid.tsx
import React, { useEffect, useState, useRef, useId } from 'react';
import { useCallStore } from '@/stores/callStore';
import { webRTCService } from '@/api/webrtcService';
import RemoteVideo from './RemoteVideo';
import { VideoTile } from './VideoTile';

interface RemoteUser {
  id: number;
  name: string;
  stream: MediaStream | null;
  audioMuted: boolean;
  videoMuted: boolean;
  isSpeaking: boolean;
}

export const VideoGrid: React.FC = () => {
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const { localStream, isAudioMuted, isVideoMuted, participants, pendingTracks, setLocalStream, users } = useCallStore();
  const videoGridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Listen for track events

    const handleUserTrackAdded = (event: any) => {
      const { userId, stream } = event.detail;
      
      setRemoteUsers(prev => {
        // Check if user already exists
        const existingUser = prev.find(user => user.id === userId);
        if (existingUser) {
          // Update existing user's stream
          return prev.map(user => 
            user.id === userId ? { ...user, stream } : user
          );
        } else {
          // Add new user
          return [...prev, {
            id: userId,
            name: `User ${userId}`,
            stream,
            audioMuted: false,
            videoMuted: false,
            isSpeaking: false
          }];
        }
      });
    };

    const handleUserLeftCall = (event: any) => {
      const { userId } = event.detail;
      
      setRemoteUsers(prev => prev.filter(user => user.id !== userId));
    };

    const handleTrackStateChanged = (event: any) => {
      const { userId, trackType, muted } = event.detail;
      
      setRemoteUsers(prev => prev.map(user => {
        if (user.id === userId) {
          return {
            ...user,
            audioMuted: trackType === 'audio' ? muted : user.audioMuted,
            videoMuted: trackType === 'video' ? muted : user.videoMuted
          };
        }
        return user;
      }));
    };

    // Setup event listeners
    document.addEventListener('userTrackAdded', handleUserTrackAdded);
    document.addEventListener('userLeftCall', handleUserLeftCall);
    document.addEventListener('trackStateChanged', handleTrackStateChanged);

    // Setup WebRTC service callbacks
    webRTCService.onTrackAdded((userId, stream, mid) => {
      document.dispatchEvent(new CustomEvent('userTrackAdded', {
        detail: { userId, stream, mid }
      }));
    });

    return () => {
      document.removeEventListener('userTrackAdded', handleUserTrackAdded);
      document.removeEventListener('userLeftCall', handleUserLeftCall);
      document.removeEventListener('trackStateChanged', handleTrackStateChanged);
    };
  }, []);

  const pArray = Array.from(participants.entries()).map(([userId, p]) => ({
    key: `user-${userId}`,
    stream: p?.stream ?? null,
    user: { id: userId, name: users.get(userId)?.username ?? `User ${userId}` },
    audioMuted: p.audioMuted,
    videoMuted: p.videoMuted,
    isSpeaking: p.isSpeaking
  }));
  return (
    <div ref={videoGridRef} className="video-grid">
      {/* Local Video */}
      {localStream && (
        <VideoTile
          stream={localStream}
          user={{ id: 'local', name: 'You' }}
          isLocal={true}
          audioMuted={isAudioMuted}
          videoMuted={isVideoMuted}
          isSpeaking={false}
        />
      )}
      
      {/* Remote Users */}
      {pArray.map(item => (
        <VideoTile
          key={item.key}
          stream={item.stream}
          user={item.user}
          isLocal={false}
          audioMuted={item.audioMuted}
          videoMuted={item.videoMuted}
          isSpeaking={item.isSpeaking}
        />
      ))}
      
      {/* Empty State */}
      {pArray.length === 0 && !localStream && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>No one is here yet</h3>
          <p>Wait for others to join or start inviting people</p>
        </div>
      )}
    </div>
  );
};