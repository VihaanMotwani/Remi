import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import VoiceAgentBlob from './ClaudeAvatar';

const { ipcRenderer } = window.require('electron');

interface AnimatedMicBubbleProps {
  isListening: boolean;
  onComplete: () => void;
}

const AnimatedMicBubble: React.FC<AnimatedMicBubbleProps> = ({ isListening, onComplete }) => {
  // State: 'idle', 'listening', or 'speaking'
  const [agentState, setAgentState] = useState<'idle' | 'listening' | 'speaking'>('idle');

  // 🔹 Listen for messages from Electron (main.ts)
  useEffect(() => {
    const handler = (_: any, msg: string) => {
      try {
        const { state } = JSON.parse(msg);
        console.log('🎧 Remi State Update:', state);
        setAgentState(state);
      } catch {
        console.warn('⚠️ Invalid state message received:', msg);
      }
    };

    ipcRenderer.on('remi-state', handler);

    return () => {
      ipcRenderer.removeListener('remi-state', handler);
    };
  }, []);

  return (
    <>
      {/* Fixed mic bubble top-right */}
      <motion.div
        onClick={onComplete}
        style={{
          cursor: 'pointer',
          position: 'fixed',
          zIndex: 9,
        }}
        initial={{
          top: '50%',
          left: '50%',
          right: 'auto',
          x: '-50%',
          y: '-50%',
          scale: 1,
        }}
        animate={
          isListening
            ? {
                top: '50%',
                left: '50%',
                right: 'auto',
                x: '-50%',
                y: '-50%',
                scale: 1,
              }
            : {
                top: 20,
                right: 20,
                left: 'auto',
                x: 0,
                y: 0,
                scale: 0.4,
              }
        }
      >
        <div className="styles.container">
          <VoiceAgentBlob state={agentState} />
        </div>
      </motion.div>
    </>
  );
};

export default AnimatedMicBubble;
