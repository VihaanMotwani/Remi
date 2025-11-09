import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';

const VoiceInterface = () => {
  const [state, setState] = useState('idle'); // idle, listening, speaking

  const handleClick = () => {
    if (state === 'idle') {
      setState('listening');
      setTimeout(() => setState('speaking'), 2000);
      setTimeout(() => setState('idle'), 5000);
    } else if (state === 'listening') {
      setState('idle');
    } else if (state === 'speaking') {
      setState('idle');
    }
  };

  const circleVariants = {
    idle: {
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 50,
        damping: 20,
        duration: 1.2
      }
    },
    listening: {
      scale: [1, 1.05, 1],
      transition: {
        scale: {
          repeat: Infinity as number,
          duration: 1.5,
          ease: 'easeInOut' as const
        }
      }
    },
    speaking: {
      x: 'calc(50vw - 80px)',
      y: 'calc(-50vh + 80px)',
      scale: 0.7,
      transition: {
        type: 'spring',
        stiffness: 40,
        damping: 25,
        duration: 1.5
      }
    }
  };

  const glowVariants = {
    idle: {
      opacity: 0,
      scale: 1
    },
    listening: {
      opacity: [0.3, 0.6, 0.3],
      scale: [1, 1.3, 1],
      transition: {
        repeat: Infinity as number,
        duration: 1.5,
        ease: 'easeInOut' as const
      }
    },
    speaking: {
      opacity: [0.2, 0.4, 0.2],
      scale: [1, 1.2, 1],
      transition: {
        repeat: Infinity as number,
        duration: 2,
        ease: 'easeInOut' as const
      }
    }
  };

  const pulseVariants = {
    idle: {
      scale: 0,
      opacity: 0
    },
    listening: {
      scale: [1, 1.5, 1.8],
      opacity: [0.4, 0.2, 0],
      transition: {
        repeat: Infinity as number,
        duration: 1.5,
        ease: 'easeOut' as const
      }
    },
    speaking: {
      scale: [1, 1.3, 1.6],
      opacity: [0.3, 0.15, 0],
      transition: {
        repeat: Infinity as number,
        duration: 2,
        ease: 'easeOut' as const
      }
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative'
    }}>
      <motion.div
        animate={state}
        // variants={circleVariants}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer'
        }}
        onClick={handleClick}
      >
        {/* Outer pulse rings */}
        <motion.div
          animate={state}
          variants={pulseVariants}
          style={{
            position: 'absolute',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            border: '2px solid rgba(139, 92, 246, 0.5)',
            pointerEvents: 'none'
          }}
        />
        
        {/* Glow effect */}
        <motion.div
          animate={state}
          variants={glowVariants}
          style={{
            position: 'absolute',
            width: '160px',
            height: '160px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
            filter: 'blur(20px)',
            pointerEvents: 'none'
          }}
        />

        {/* Main circle */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
            border: '2px solid rgba(139, 92, 246, 0.3)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            boxShadow: state === 'listening' 
              ? '0 0 40px rgba(139, 92, 246, 0.4)' 
              : state === 'speaking'
              ? '0 0 30px rgba(139, 92, 246, 0.3)'
              : '0 0 20px rgba(139, 92, 246, 0.2)',
            transition: 'box-shadow 0.3s ease'
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={state}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              {state === 'listening' ? (
                <Mic size={40} color="#a78bfa" strokeWidth={1.5} />
              ) : (
                <Mic size={40} color="#8b5cf6" strokeWidth={1.5} />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Listening indicator bars */}
        <AnimatePresence>
          {state === 'listening' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                display: 'flex',
                gap: '4px',
                bottom: '-40px'
              }}
            >
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  animate={{
                    height: ['8px', '20px', '8px'],
                  }}
                  transition={{
                    repeat: Infinity as number,
                    duration: 1,
                    delay: i * 0.1,
                    ease: 'easeInOut' as const
                  }}
                  style={{
                    width: '3px',
                    backgroundColor: '#8b5cf6',
                    borderRadius: '2px',
                    opacity: 0.7
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Status text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: state === 'idle' ? 0 : 0.5 }}
        style={{
          position: 'absolute',
          bottom: '40px',
          fontSize: '14px',
          color: '#a78bfa',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: '300'
        }}
      >
        {state === 'listening' && 'Listening...'}
        {state === 'speaking' && 'Speaking...'}
      </motion.div>
    </div>
  );
};

export default VoiceInterface;