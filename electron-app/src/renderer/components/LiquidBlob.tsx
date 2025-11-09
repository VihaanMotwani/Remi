import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

export interface LiquidBlobProps {
  state: 'idle' | 'listening' | 'speaking';
}

export function LiquidBlob({ state }: LiquidBlobProps) {
  const [amplitude, setAmplitude] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'speaking') {
      interval = setInterval(() => {
        setAmplitude(Math.random() * 0.5 + 0.2); // more dynamic
      }, 150);
    } else if (state === 'listening') {
      interval = setInterval(() => {
        setAmplitude(Math.sin(Date.now() / 400) * 0.15 + 0.2); // smooth pulse
      }, 60);
    } else {
      setAmplitude(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  // Color and glow based on state
  let mainColor = 'linear-gradient(135deg, rgba(59, 130, 246, 0.6), rgba(147, 197, 253, 0.4))';
  let glowColor = 'rgba(59, 130, 246, 0.3)';
  if (state === 'listening') {
    mainColor = 'linear-gradient(135deg, rgba(34, 197, 94, 0.7), rgba(147, 253, 197, 0.4))'; // greenish
    glowColor = 'rgba(34, 197, 94, 0.3)';
  } else if (state === 'speaking') {
    mainColor = 'linear-gradient(135deg, rgba(251, 191, 36, 0.7), rgba(253, 197, 147, 0.4))'; // yellow/orange
    glowColor = 'rgba(251, 191, 36, 0.3)';
  }

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer glow layers */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
          filter: 'blur(30px)',
        }}
        animate={{
          scale: [1, 1.1 + amplitude, 1],
          opacity: [0.3, 0.5 + amplitude, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Main blob */}
      <motion.div
        className="absolute w-48 h-48"
        style={{
          background: mainColor,
          borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%',
          filter: 'blur(1px)',
          backdropFilter: 'blur(20px)',
        }}
        animate={{
          borderRadius: [
            '40% 60% 70% 30% / 40% 50% 60% 50%',
            '60% 40% 30% 70% / 60% 30% 70% 40%',
            '50% 50% 50% 50% / 50% 50% 50% 50%',
            '40% 60% 70% 30% / 40% 50% 60% 50%',
          ],
          scale: [1, 1.05 + amplitude, 0.98, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Inner highlight */}
      <motion.div
        className="absolute w-32 h-32"
        style={{
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(10px)',
        }}
        animate={{
          x: [-10, 10, -10],
          y: [-10, 5, -10],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Ripple effect for voice */}
      <motion.div
        className="absolute w-56 h-56 border border-white/20 rounded-full"
        animate={{
          scale: [1, 1.2 + amplitude * 2],
          opacity: [0.4, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    </div>
  );
}
