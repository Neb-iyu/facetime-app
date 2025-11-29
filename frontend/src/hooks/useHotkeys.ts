// hooks/useHotkeys.ts
import { useCallStore } from '@/stores/callStore';
import { useEffect, useRef } from 'react';

type HotkeyAction = (event: KeyboardEvent) => void;

interface HotkeyConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: HotkeyAction;
  preventDefault?: boolean;
  description?: string;
}

export const useHotkeys = (hotkeys: HotkeyConfig[]) => {
  const hotkeysRef = useRef(hotkeys);
  
  // Update hotkeys ref when hotkeys change
  useEffect(() => {
    hotkeysRef.current = hotkeys;
  }, [hotkeys]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const matchingHotkey = hotkeysRef.current.find(hotkey => {
        const keyMatch = hotkey.key.toLowerCase() === event.key.toLowerCase();
        const ctrlMatch = hotkey.ctrl === undefined || hotkey.ctrl === event.ctrlKey;
        const shiftMatch = hotkey.shift === undefined || hotkey.shift === event.shiftKey;
        const altMatch = hotkey.alt === undefined || hotkey.alt === event.altKey;
        const metaMatch = hotkey.meta === undefined || hotkey.meta === event.metaKey;

        return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch;
      });

      if (matchingHotkey) {
        if (matchingHotkey.preventDefault !== false) {
          event.preventDefault();
        }
        matchingHotkey.action(event);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
};

// Predefined hotkey sets for common actions
export const useCallHotkeys = () => {
  const { 
    toggleAudio, 
    toggleVideo, 
    toggleScreenShare, 
    leaveCall 
  } = useCallStore();
  useHotkeys([
    {
      key: 'm',
      action: () => toggleAudio(),
      description: 'Toggle microphone mute'
    },
    {
      key: 'v',
      action: () => toggleVideo(),
      description: 'Toggle video'
    },
    {
      key: 'Escape',
      action: () => leaveCall(),
      description: 'Leave call'
    },
    {
      key: 'f',
      action: (event) => {
        event.preventDefault();
        // Toggle fullscreen for video grid
        const videoGrid = document.querySelector('.video-grid');
        if (videoGrid) {
          // You would integrate with useFullscreen hook here
        }
      },
      description: 'Toggle fullscreen'
    }
  ]);
};

export const useGlobalHotkeys = () => {
  useHotkeys([
    {
      key: '?',
      action: () => {
        // Show keyboard shortcuts help
        document.dispatchEvent(new CustomEvent('showKeyboardHelp'));
      },
      description: 'Show keyboard shortcuts'
    },
    {
      key: 'k',
      ctrl: true,
      action: () => {
        // Quick call shortcut (if implemented)
        console.log('Quick call shortcut');
      },
      description: 'Start quick call'
    }
  ]);
};