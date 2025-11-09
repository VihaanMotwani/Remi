import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Orb from './Orb';

const AnimatedMicBubble = () => {
  const [isListening, setIsListening] = useState(true);

  const toggleState = () => {
    setIsListening(prev => !prev);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
      <motion.div
        className="absolute"
        initial={{ x: 0, y: 0, scale: 1 }}
        animate={isListening ? {
          x: 0,
          y: 0,
          scale: 1
        } : {
          x: 'calc(50vw - 150px)',
          y: 'calc(-50vh + 150px)',
          scale: 0.4
        }}
        transition={{
          type: "spring",
          stiffness: 80,
          damping: 20,
          mass: 1
        }}
        onClick={toggleState}
        style={{ cursor: 'pointer', width: '300px', height: '300px', position: 'relative' }}
      >
        {/* Orb background */}
        <div style={{ 
          width: '100%', 
          height: '100%', 
          position: 'absolute',
          top: 0,
          left: 0,
          filter: isListening ? 'none' : 'invert(1) hue-rotate(180deg)',
          transition: 'filter 700ms ease-in-out'
        }}>
          <Orb
            hoverIntensity={0}
            rotateOnHover={false}
            hue={0}
            forceHoverState={false}
          />
        </div>

        {/* Microphone icon centered */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10
        }}>
          <svg 
            width="80" 
            height="80" 
            viewBox="-40 -40 80 80"
          >
            <g>
              {/* Mic capsule */}
              <rect
                x="-15"
                y="-25"
                width="30"
                height="40"
                rx="15"
                fill={isListening ? '#ffffff' : '#1e293b'}
                style={{ transition: 'fill 700ms ease-in-out' }}
              />
              
              {/* Mic stand */}
              <path
                d="M 0 15 L 0 30 M -15 30 L 15 30"
                stroke={isListening ? '#ffffff' : '#1e293b'}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                style={{ transition: 'stroke 700ms ease-in-out' }}
              />
              
              {/* Mic arc */}
              <path
                d="M -25 0 Q -25 25 0 25 Q 25 25 25 0"
                stroke={isListening ? '#ffffff' : '#1e293b'}
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                style={{ transition: 'stroke 700ms ease-in-out' }}
              />
              
              {/* Mic details */}
              <line
                x1="-10"
                y1="-15"
                x2="10"
                y2="-15"
                stroke={isListening ? '#3b82f6' : '#f8fafc'}
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transition: 'stroke 700ms ease-in-out' }}
              />
              <line
                x1="-10"
                y1="-5"
                x2="10"
                y2="-5"
                stroke={isListening ? '#3b82f6' : '#f8fafc'}
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transition: 'stroke 700ms ease-in-out' }}
              />
              <line
                x1="-10"
                y1="5"
                x2="10"
                y2="5"
                stroke={isListening ? '#3b82f6' : '#f8fafc'}
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transition: 'stroke 700ms ease-in-out' }}
              />
            </g>
          </svg>
        </div>
      </motion.div>

      {/* Status indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center">
        <div className={`px-6 py-3 rounded-full font-medium transition-all duration-300 ${
          isListening 
            ? 'bg-blue-500 text-white' 
            : 'bg-slate-100 text-slate-900'
        }`}>
          {isListening ? '🎤 Listening...' : '💬 Speaking...'}
        </div>
        <p className="mt-4 text-slate-400 text-sm">Click the orb to toggle state</p>
      </div>
    </div>
  );
};

export default AnimatedMicBubble;