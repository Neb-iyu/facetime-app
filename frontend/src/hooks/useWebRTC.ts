// ...new file...
import { useEffect } from 'react';
import { webRTCService } from '@/api/webrtcService';
import { wsClient } from '@/api/webSocketClient';
import { useCallStore } from '@/stores/callStore';

/**
 * Hook wiring webRTCService -> callStore + wsClient(mid-map)
 * - promotes pending tracks into stable participants when mid->user mapping arrives
 * - caches previews and promotes in-place to avoid UI jank
 */
export default function useWebRTC() {
  const addTrackPreview = useCallStore(state => (state as any).addTrackPreview);
  const promoteTrackToUser = useCallStore(state => (state as any).promoteTrackToUser);
  const removeTrackPreview = useCallStore(state => (state as any).removeTrackPreview);
  const setLocalStream = useCallStore(state => (state as any).setLocalStream);

  useEffect(() => {
    // listen for tracks from webRTCService
    const offTrack = webRTCService.onTrackAdded && webRTCService.onTrackAdded((userId: number, stream: MediaStream, mid?: string) => {
      if (!stream) return;
      const track = stream.getTracks()[0];
      const trackId = track?.id ?? `t-${Date.now()}`;

      if (userId && userId > 0) {
        // promote immediately to participant (server mapping likely known)
        promoteTrackToUser(trackId, userId);
      } else {
        // store as preview keyed by trackId
        addTrackPreview(trackId, stream, mid);
      }
    });

    // listen for mid->user map messages from wsClient
    const offMid = wsClient.addMidMappingListener && wsClient.addMidMappingListener((mapping: Map<string, number> | Record<string, number>) => {
      // mapping is normalized by client to Map<string, number> but accept both
      const map: Map<string, number> = mapping instanceof Map
        ? mapping
        : new Map(Object.entries(mapping).map(([k, v]) => [String(k), Number(v)]));

      for (const [mid, uid] of map.entries()) {
        // try to resolve trackId from webRTCService
        const tid = webRTCService.getTrackIdFromMid(mid);
        if (tid) {
          promoteTrackToUser(tid, uid);
        } else {
          // if we can't resolve via transceiver scan, attempt to find a pending track by mid
          // (pending tracks store the mid on preview entries)
          // scan pending tracks
          const pending = (useCallStore.getState() as any).pendingTracks as Map<string, any>;
          for (const [trackId, p] of pending.entries()) {
            if (p.mid === mid) {
              promoteTrackToUser(trackId, uid);
              break;
            }
          }
        }
      }
    });

    // cleanup
    return () => {
      if (typeof offTrack === 'function') offTrack();
      // wsClient addMidMappingListener returns nothing in current client; no-op cleanup
    };
  }, [addTrackPreview, promoteTrackToUser, removeTrackPreview, setLocalStream]);

  return {
    // expose helpers for components
    replaceLocalVideoTrack: (newTrack: MediaStreamTrack) => {
      // try to replace sender on the peer connection
      try {
        const pc: any = (webRTCService as any).pc;
        if (pc) {
          const sender = pc.getSenders().find((s: any) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(newTrack);
        }
      } catch (e) { console.warn('replaceLocalVideoTrack failed', e); }
    },
    setLocalStream: (stream: MediaStream) => setLocalStream(stream)
  };
}