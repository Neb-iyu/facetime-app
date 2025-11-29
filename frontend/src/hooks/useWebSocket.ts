// hooks/useWebSocket.ts
import { useEffect } from 'react';
import { useCallStore } from '@/stores/callStore';
import { useUserStore } from '@/stores/userStore';
import { webRTCService } from '@/api/webrtcService';
import { wsClient } from '@/api/webSocketClient';
import { UserStatusMessage } from '@/types';

export const useWebSocket = (token?: string) => {
  const { 
    handleIncomingCall,
    handleCallAccepted,
    handleCallRejected,
    handleUserLeft,
    handleUserJoined,
    handleTrackStateChange,
    users,
    setUserStatus,
    addUser
  } = useCallStore();

  // include user from user store
  const { setUser, user } = useUserStore();

  useEffect(() => {
    // Setup WebSocket message handlers
    const setupWebSocketHandlers = () => {
      // Call-related messages
      wsClient.addIncomingCallListener(handleIncomingCall);
      wsClient.addCallAcceptedListener(handleCallAccepted);
      wsClient.addCallRejectedListeners(handleCallRejected);
      
      // User presence messages
      wsClient.addUserListListener(setUserStatus);
      wsClient.addPresenceListener(addUser);

      // User join/leave call messages
      wsClient.addUserJoinListener((payload) => {
        handleUserJoined(payload.userId, payload.userName);
      });
      
      wsClient.addUserLeaveListener((payload) => {
        handleUserLeft(payload.userId);
      });

      // Track state messages
      wsClient.addTrackUpdateListener((update) => {
        // Handle audio/video mute updates from other participants
        handleTrackStateChange(update.userId, update.trackType, update.muted);
        // TODO: redundent, clear all usage
        document.dispatchEvent(new CustomEvent('trackStateChanged', {
          detail: update
        }));
      });

      // MID mapping messages
      wsClient.addMidMappingListener((mapping: Map<string, number> | Record<string, number>) => {
        // webRTCService expects a Map<string, number> — client already normalizes,
        // but accept either shape defensively
        if (mapping instanceof Map) {
          webRTCService.setMidMap && webRTCService.setMidMap(mapping);
        } else {
          const m = new Map<string, number>();
          for (const [k, v] of Object.entries(mapping as Record<string, any>)) {
            m.set(String(k), Number(v));
          }
          webRTCService.setMidMap && webRTCService.setMidMap(m);
        }
      });
    };

    // Connect WebSocket
    const connectWebSocket = (token?: string) => {
      try {
        wsClient.connect(token);
        setupWebSocketHandlers();
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        // Implement retry logic here
      }
    };

    connectWebSocket(token);

    return () => {
      // Cleanup handlers
      wsClient.removeAllListeners();
    };
  }, [
    handleIncomingCall,
    handleCallAccepted,
    handleCallRejected,
    handleUserJoined,
    handleUserLeft,
    handleTrackStateChange,
    setUserStatus
  ]);

  const updateUserStatus = (status: 'online' | 'busy' | 'offline') => {
    const userId = sessionStorage.getItem('userId');
    if (!userId) return;

    // preferred: use in-memory user from user store
    let username: string | null = (user as any)?.username ?? (user as any)?.name ?? null;
    let userID: number | null = (user as any)?.id ?? null;
    
    // fallback: parse auth blob stored in localStorage by AuthProvider
    if (!username) {
      const raw = localStorage.getItem('facetime_auth');
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { user?: any };
          username = parsed?.user?.username ?? parsed?.user?.name ?? null;
          if (!userID) {
            userID = parsed?.user?.id ?? null;
          }
        } catch {
          username = null;
        }
      }
    }

    // final fallback: sessionStorage or placeholder
    username = username ?? sessionStorage.getItem('username') ?? `user-${userId}`;
    userID = userID ?? Number(sessionStorage.getItem('userId'))
    const payload: UserStatusMessage = {
      userID,
      username,
      status,
      LastSeen: new Date()
    };

    wsClient.sendMessage('status', payload);
  };

  return {
    updateUserStatus,
    isConnected: wsClient.isConnected()
  };
};