import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { fetchTodaysTasks } from 'src/api/googleCalendarClient';
import { updateEvent } from 'src/api/googleCalendarClient';
import type { EventType } from 'src/types';

export function TodoList() {
  const [todos, setTodos] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const tasks = await fetchTodaysTasks();
        if (mounted) setTodos(tasks);
      } catch (e) {
        console.error('Failed to load tasks:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleToggleComplete = async (task: EventType) => {
    const updatedCompleted = !task.completed;
    
    // Optimistic update
    setTodos(prev => prev.map(t => 
      t.id === task.id ? { ...t, completed: updatedCompleted } : t
    ));

    try {
      await updateEvent({
        id: task.id,
        title: task.title,
        is_task: true,
        action_items: { 
          ...(task as any).action_items,
          completed: updatedCompleted 
        },
      });
    } catch (e) {
      console.error('Failed to update task:', e);
      // Revert on error
      setTodos(prev => prev.map(t => 
        t.id === task.id ? { ...t, completed: task.completed } : t
      ));
    }
  };

  if (loading) {
    return (
      <div className="text-white/50 tracking-wide text-center py-4" style={{ fontWeight: 200 }}>
        Loading tasks…
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className="text-white/50 tracking-wide text-center py-4" style={{ fontWeight: 200 }}>
        No tasks for today
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {todos.map((todo, index) => (
        <motion.div
          key={todo.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ 
            duration: 0.6, 
            delay: index * 0.1,
            ease: [0.25, 1, 0.5, 1]
          }}
          whileHover={{ 
            scale: 1.02,
            backgroundColor: 'rgba(59, 130, 246, 0.05)',
          }}
          className="px-6 py-4 rounded-2xl backdrop-blur-xl border border-white/10 cursor-pointer"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            transition: 'background-color 0.3s ease',
            opacity: todo.completed ? 0.5 : 1,
          }}
          onClick={() => handleToggleComplete(todo)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span 
                className="text-white/50 tracking-wider"
                style={{ fontWeight: 200, fontSize: '0.9rem' }}
              >
                {todo.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="h-8 w-px bg-white/10" />
              <span 
                className="text-white/90 tracking-wide"
                style={{ 
                  fontWeight: 200, 
                  fontSize: '1rem',
                  textDecoration: todo.completed ? 'line-through' : 'none',
                }}
              >
                {todo.title}
              </span>
            </div>
            <motion.div 
              className="w-5 h-5 rounded-full border-2"
              style={{
                borderColor: todo.completed ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.3)',
                backgroundColor: todo.completed ? 'rgba(59, 130, 246, 0.8)' : 'transparent',
              }}
              whileHover={{ scale: 1.2, borderColor: 'rgba(59, 130, 246, 0.8)' }}
            >
              {todo.completed && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-full h-full"
                  viewBox="0 0 20 20"
                  fill="none"
                >
                  <path
                    d="M4 10l4 4 8-8"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </motion.svg>
              )}
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
