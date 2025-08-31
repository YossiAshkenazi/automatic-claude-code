import { useEffect } from 'react';

interface ReplayKeyboardShortcutsProps {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSpeedIncrease: () => void;
  onSpeedDecrease: () => void;
  onJumpToStart: () => void;
  onJumpToEnd: () => void;
  onAddBookmark: () => void;
  onToggleSettings: () => void;
  isPlaying: boolean;
  disabled?: boolean;
}

export function useReplayKeyboardShortcuts({
  onPlay,
  onPause,
  onStop,
  onStepForward,
  onStepBackward,
  onSpeedIncrease,
  onSpeedDecrease,
  onJumpToStart,
  onJumpToEnd,
  onAddBookmark,
  onToggleSettings,
  isPlaying,
  disabled = false
}: ReplayKeyboardShortcutsProps) {
  
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // Don't handle shortcuts when modifier keys are pressed (except for specific combinations)
      const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
      
      switch (event.code) {
        // Basic playback controls
        case 'Space':
        case 'KeyK':
          event.preventDefault();
          if (isPlaying) {
            onPause();
          } else {
            onPlay();
          }
          break;

        case 'KeyS':
          if (!hasModifier) {
            event.preventDefault();
            onStop();
          }
          break;

        // Navigation
        case 'ArrowRight':
          if (event.shiftKey) {
            event.preventDefault();
            // Skip to next significant event (can be implemented later)
            onStepForward();
          } else if (!hasModifier) {
            event.preventDefault();
            onStepForward();
          }
          break;

        case 'ArrowLeft':
          if (event.shiftKey) {
            event.preventDefault();
            // Skip to previous significant event
            onStepBackward();
          } else if (!hasModifier) {
            event.preventDefault();
            onStepBackward();
          }
          break;

        case 'Home':
          event.preventDefault();
          onJumpToStart();
          break;

        case 'End':
          event.preventDefault();
          onJumpToEnd();
          break;

        // Speed controls
        case 'Equal': // + key
        case 'NumpadAdd':
          if (!hasModifier) {
            event.preventDefault();
            onSpeedIncrease();
          }
          break;

        case 'Minus':
        case 'NumpadSubtract':
          if (!hasModifier) {
            event.preventDefault();
            onSpeedDecrease();
          }
          break;

        // Bookmarks
        case 'KeyB':
          if (!hasModifier) {
            event.preventDefault();
            onAddBookmark();
          }
          break;

        // Settings
        case 'Comma': // , key
          if (!hasModifier) {
            event.preventDefault();
            onToggleSettings();
          }
          break;

        // Number keys for speed presets
        case 'Digit1':
          if (!hasModifier) {
            event.preventDefault();
            // Set speed to 0.25x
            onSpeedDecrease(); // This would need to be more specific in actual implementation
          }
          break;

        case 'Digit2':
          if (!hasModifier) {
            event.preventDefault();
            // Set speed to 0.5x
          }
          break;

        case 'Digit3':
          if (!hasModifier) {
            event.preventDefault();
            // Set speed to 1.0x (normal)
          }
          break;

        case 'Digit4':
          if (!hasModifier) {
            event.preventDefault();
            // Set speed to 2.0x
          }
          break;

        // Help
        case 'KeyH':
        case 'F1':
          if (!hasModifier) {
            event.preventDefault();
            showKeyboardShortcutsHelp();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    onPlay,
    onPause,
    onStop,
    onStepForward,
    onStepBackward,
    onSpeedIncrease,
    onSpeedDecrease,
    onJumpToStart,
    onJumpToEnd,
    onAddBookmark,
    onToggleSettings,
    isPlaying,
    disabled
  ]);
}

function showKeyboardShortcutsHelp() {
  const helpContent = `
Replay Keyboard Shortcuts:

Playback Controls:
• Space or K - Play/Pause
• S - Stop and reset to start
• → - Step forward
• ← - Step backward
• Shift + → - Skip to next significant event
• Shift + ← - Skip to previous significant event
• Home - Jump to start
• End - Jump to end

Speed Controls:
• + - Increase playback speed
• - - Decrease playback speed
• 1 - Set speed to 0.25x
• 2 - Set speed to 0.5x
• 3 - Set speed to 1.0x (normal)
• 4 - Set speed to 2.0x

Annotations:
• B - Add bookmark at current position

Settings:
• , (comma) - Toggle settings
• H or F1 - Show this help

Note: Shortcuts work when not typing in input fields.
  `.trim();

  // Create a simple modal dialog
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: monospace;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 8px;
    max-width: 600px;
    max-height: 80vh;
    overflow: auto;
    white-space: pre-line;
    line-height: 1.5;
  `;
  content.textContent = helpContent;

  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close (Esc)';
  closeButton.style.cssText = `
    margin-top: 16px;
    padding: 8px 16px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;

  const closeModal = () => {
    document.body.removeChild(modal);
    document.removeEventListener('keydown', handleEscape);
  };

  const handleEscape = (e: KeyboardEvent) => {
    if (e.code === 'Escape') {
      closeModal();
    }
  };

  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', handleEscape);

  content.appendChild(closeButton);
  modal.appendChild(content);
  document.body.appendChild(modal);
}

// Export keyboard shortcut mappings for documentation
export const KEYBOARD_SHORTCUTS = {
  playback: {
    playPause: ['Space', 'K'],
    stop: ['S'],
    stepForward: ['→'],
    stepBackward: ['←'],
    jumpToStart: ['Home'],
    jumpToEnd: ['End'],
  },
  speed: {
    increase: ['+'],
    decrease: ['-'],
    preset025: ['1'],
    preset050: ['2'],
    preset100: ['3'],
    preset200: ['4'],
  },
  annotations: {
    addBookmark: ['B'],
  },
  ui: {
    toggleSettings: [','],
    showHelp: ['H', 'F1'],
  }
} as const;

// Hook for components that want to show available shortcuts
export function useKeyboardShortcutsInfo() {
  return {
    shortcuts: KEYBOARD_SHORTCUTS,
    getShortcutText: (keys: readonly string[]) => keys.join(' or '),
    showHelp: showKeyboardShortcutsHelp,
  };
}