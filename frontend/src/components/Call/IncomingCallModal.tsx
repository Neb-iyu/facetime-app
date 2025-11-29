// components/calls/IncomingCallModal.tsx
import React, { useEffect, useState } from 'react';
import { useCallStore } from '@/stores/callStore';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export const IncomingCallModal: React.FC = () => {
  const { incomingCall, acceptCall, rejectCall, users, playNotificationSound, stopNotificationSound } = useCallStore();
  const [callDuration, setCallDuration] = useState(0);
  const [isRinging, setIsRinging] = useState(false);

  useEffect(() => {
    if (incomingCall) {
      setIsRinging(true);
      const startTime = Date.now();
      const timer = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      // Play ringtone
      playRingtone();

      return () => {
        clearInterval(timer);
        stopRingtone();
      };
    } else {
      setCallDuration(0);
      setIsRinging(false);
    }
  }, [incomingCall]);

  const playRingtone = () => {
    // Implement ringtone playback
    playNotificationSound;
    console.log('Playing ringtone...');
  };

  const stopRingtone = () => {
    // Implement ringtone stop
    stopNotificationSound;
    console.log('Stopping ringtone...');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!incomingCall) return null;

  const callerInfo = users.get(incomingCall.callerId);
  const otherParticipants = incomingCall.calleeIds.filter(id => id !== incomingCall.callerId);

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        {/* Header with call info */}
        <div className="call-header">
          <div className="call-status">
            <Badge variant="secondary">
              {isRinging ? 'Ringing' : 'Incoming Call'}
            </Badge>
            <span className="call-timer">🕒 {formatDuration(callDuration)}</span>
          </div>
        </div>

        {/* Caller Information */}
        <div className="caller-section">
          <Avatar 
            name={callerInfo?.username || `User ${incomingCall.callerId}`}
            size="xxl"
            className="caller-avatar"
          />
          
          <div className="caller-details">
            <h1 className="caller-name">
              {callerInfo?.username || `User ${incomingCall.callerId}`}
            </h1>
            <p className="call-type">Incoming Video Call</p>
            <div className="call-participants">
              <span className="participants-count">
                👥 {otherParticipants.length + 1} people in call
              </span>
            </div>
          </div>
        </div>

        {/* Other Participants Preview */}
        {otherParticipants.length > 0 && (
          <div className="participants-preview">
            <h3 className="preview-title">Already in call:</h3>
            <div className="preview-avatars">
              {otherParticipants.slice(0, 3).map(participantId => {
                const participant = users.get(participantId);
                return (
                  <Avatar
                    key={participantId}
                    name={participant?.username || `User ${participantId}`}
                    size="sm"
                    className="preview-avatar"
                  />
                );
              })}
              {otherParticipants.length > 3 && (
                <div className="more-participants">
                  +{otherParticipants.length - 3}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Call Actions */}
        <div className="call-actions">
          <Button
            variant="destructive"
            size="lg"
            onClick={() => rejectCall(incomingCall)}
            className="action-button decline-button"
          >
            <span className="button-icon">📞❌</span>
            <span className="button-text">Decline</span>
          </Button>

          <Button
            variant="default"
            size="lg"
            onClick={() => acceptCall(incomingCall)}
            className="action-button accept-button"
          >
            <span className="button-icon">📞</span>
            <span className="button-text">Accept</span>
          </Button>
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="shortcut-hints">
          <div className="shortcut-item">
            <kbd>Esc</kbd>
            <span>Decline</span>
          </div>
          <div className="shortcut-item">
            <kbd>Enter</kbd>
            <span>Accept</span>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      <div className="modal-backdrop" onClick={() => rejectCall(incomingCall)} />
    </div>
  );
};