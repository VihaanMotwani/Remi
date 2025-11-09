import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

export function LiquidBlob() {
  const [amplitude, setAmplitude] = useState(0);

  // Simulate voice amplitude changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAmplitude(Math.random() * 0.3);
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer glow layers */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
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
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.6), rgba(147, 197, 253, 0.4))',
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
