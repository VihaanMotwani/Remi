import { motion } from 'motion/react';
import '../styles/claude-serif.css';
import { LiquidBlob } from './LiquidBlob';
import { TodoList } from './TodoList';
import { FloatingButton } from './FloatingButton';
import { Calendar, Mail } from 'lucide-react';

interface HomeViewProps {
  onNavigate: (view: 'meetings' | 'communication') => void;
}

export function HomeView({ onNavigate }: HomeViewProps) {
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Solid black background */}
      <div className="absolute inset-0 bg-black" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-4xl px-8 flex flex-col items-center">
        
        {/* Heading above the blob */}
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="claude-serif text-white mb-6"
        >
          Hi, it&apos;s Remi
        </motion.h1>

        {/* Liquid Blob */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.25, 1, 0.5, 1] }}
        >
          <LiquidBlob />
        </motion.div>

        {/* Date */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-white/70 mt-8 tracking-[0.1em]"
          style={{ fontWeight: 200, fontSize: '1.1rem' }}
        >
          {dateString}
        </motion.p>

        {/* Todo List */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="mt-12 w-full"
        >
          <TodoList />
        </motion.div>
      </div>

      {/* Floating Buttons - Aligned with center vertically */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-8 pointer-events-none">
        <div className="pointer-events-auto">
          <FloatingButton 
            icon={Calendar} 
            label="Meetings" 
            onClick={() => onNavigate('meetings')}
            delay={1.2}
          />
        </div>
        <div className="pointer-events-auto">
          <FloatingButton 
            icon={Mail} 
            label="Communication" 
            onClick={() => onNavigate('communication')}
            delay={1.4}
          />
        </div>
      </div>
    </motion.div>
  );
}
