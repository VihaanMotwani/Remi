import { motion } from 'motion/react';

export function AuroraBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base solid background */}
      <div className="absolute inset-0 bg-black" />
      
      {/* Subtle light effects */}
      <motion.div
        className="absolute top-[-50%] left-[-25%] w-[150%] h-[150%] opacity-10"
        style={{
          background: 'radial-gradient(circle at center, rgba(255, 255, 255, 0.05) 0%, transparent 50%)',
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, 100, -100, 0],
          y: [0, -50, 50, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    </div>
  );
}
