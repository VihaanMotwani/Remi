import { motion } from 'motion/react';
import { AuroraBackground } from './AuroraBackground';

export function SplashScreen() {
  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <AuroraBackground />
      
      <motion.div
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: 1.3, opacity: 0 }}
        transition={{ 
          duration: 3.5, 
          ease: [0.25, 1, 0.5, 1],
          delay: 0.5
        }}
        className="relative z-10 px-8 text-center"
      >
        <h1 
          className="text-white tracking-[0.15em]"
          style={{ 
            fontSize: 'clamp(2rem, 5vw, 4rem)',
            fontWeight: 200,
            lineHeight: 1.6,
            letterSpacing: '0.15em'
          }}
        >
          What to do, <br />
          already done
        </h1>
      </motion.div>
    </div>
  );
}
