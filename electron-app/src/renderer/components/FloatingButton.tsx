import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface FloatingButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  delay?: number;
}

export function FloatingButton({ icon: Icon, label, onClick, delay = 0 }: FloatingButtonProps) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 1, 0.5, 1] }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="group relative flex flex-col items-center gap-3"
    >
      {/* Button circle */}
      <div
        className="relative w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-xl border border-white/20"
        style={{
          background: 'rgba(59, 130, 246, 0.15)',
        }}
      >
        <Icon className="w-6 h-6 text-white/80" strokeWidth={1.5} />
      </div>

      {/* Label */}
      <span 
        className="text-white/70 tracking-wider"
        style={{ fontWeight: 200, fontSize: '0.9rem' }}
      >
        {label}
      </span>
    </motion.button>
  );
}
