// components/calls/CallControls.tsx
import React from 'react';
import { Button } from '../ui/Button';
import { useCallStore } from '@/stores/callStore';
import { useHotkeys } from '@/hooks/useHotkeys';

export const CallControls: React.FC = () => {
  const {
    isAudioMuted,
    isVideoMuted,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    leaveCall,
    participants,
    callStatus
  } = useCallStore();
  
  // Keyboard shortcuts
  const hotkeys = [
    {key: 'm', action: toggleAudio},
    {key: 'v', action: toggleVideo},
    {key: 's', action: toggleScreenShare},
    {key: 'Escape', action: leaveCall}
  ];
  useHotkeys(hotkeys);

  const controlButtons = [
    {
      icon: isAudioMuted ? '🎤❌' : '🎤',
      label: isAudioMuted ? 'Unmute' : 'Mute',
      onClick: toggleAudio,
      variant: isAudioMuted ? 'destructive' : 'secondary',
      hotkey: 'M'
    },
    {
      icon: isVideoMuted ? '📹❌' : '📹',
      label: isVideoMuted ? 'Start Video' : 'Stop Video',
      onClick: toggleVideo,
      variant: isVideoMuted ? 'destructive' : 'secondary',
      hotkey: 'V'
    },
    {
      icon: '👥',
      label: `Participants (${participants.size + 1})`,
      onClick: () => {/* Toggle participants sidebar */},
      variant: 'secondary'
    },
    {
      icon: '⚙️',
      label: 'Settings',
      onClick: () => {/* Open settings */},
      variant: 'secondary'
    }
  ];

  return (
    <div className="call-controls">
      <div className="controls-center">
        {controlButtons.map((button, index) => (
          <Button
            key={index}
            variant={button.variant as any}
            size="lg"
            onClick={button.onClick}
            className="control-button"
            title={`${button.label} (${button.hotkey})`}
          >
            <span className="control-icon">{button.icon}</span>
            <span className="control-label">{button.label}</span>
          </Button>
        ))}
        
        <Button
          variant="destructive"
          size="lg"
          onClick={leaveCall}
          className="end-call-button"
          title="Leave call (Esc)"
        >
          <span className="control-icon">📞❌</span>
          <span className="control-label">
            {callStatus === 'ringing' ? 'Cancel' : 'Leave'}
          </span>
        </Button>
      </div>
      
      <div className="controls-right">
        <div className="call-timer">
          <span>🕒 12:34</span>
        </div>
      </div>
    </div>
  );
};