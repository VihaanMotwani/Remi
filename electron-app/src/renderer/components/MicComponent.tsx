import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Orb from './Orb';
import {BlobAvatar} from './BlobAvatar';
import VoiceAgentBlob from './ClaudeAvatar';

interface AnimatedMicBubbleProps {
  isListening: boolean;
  onComplete: () => void;
}

const AnimatedMicBubble: React.FC<AnimatedMicBubbleProps> = ({ isListening, onComplete }) => {
  const [agentState, setAgentState] = useState<"idle" | "listening" | "speaking">("idle");

  useEffect(() => {
    const ws = new WebSocket('ws://127.0.0.1:5000/ws/state'); // matches your backend

    ws.onopen = () => console.log('✅ Connected to Remi WebSocket');
    ws.onmessage = (event) => {
      const state = event.data as 'idle' | 'listening' | 'speaking';
      console.log('🎧 State update from backend:', state);
      setAgentState(state);
    };
    ws.onerror = (e) => console.error('⚠ WebSocket error:', e);
    ws.onclose = () => console.log('❌ WebSocket closed');

    return () => ws.close();
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