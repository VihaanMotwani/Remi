import { useState, useEffect } from 'react';
import { SplashScreen } from 'src/renderer/components/SplashScreen';
import { HomeView } from 'src/renderer/components/HomeView';
import { MeetingsView } from 'src/renderer/components/MeetingsView';
import { CommunicationView } from 'src/renderer/components/CommunicationView';

type View = 'splash' | 'home' | 'meetings' | 'communication';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('splash');

  useEffect(() => {
    // Auto-transition from splash to home after 3.5 seconds
    if (currentView === 'splash') {
      const timer = setTimeout(() => {
        setCurrentView('home');
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [currentView]);

  const api = (window as any).api as { platform?: string; ping?: () => Promise<string> };
  return (
    <div className="w-full h-screen overflow-hidden bg-black">
      {/* Example usage of secure preload API */}
      <div className="absolute top-8 left-0 text-white/40 px-6 text-xs tracking-wide">
        Electron Platform: {api?.platform} · Ping: <Ping api={api} />
      </div>
      {currentView === 'splash' && <SplashScreen />}
      {currentView === 'home' && <HomeView onNavigate={setCurrentView} />}
      {currentView === 'meetings' && <MeetingsView onBack={() => setCurrentView('home')} />}
      {currentView === 'communication' && <CommunicationView onBack={() => setCurrentView('home')} />}
    </div>
  );
}

function Ping({ api }: { api: { ping?: () => Promise<string> } }) {
  const [val, setVal] = useState<string>('…');
  useEffect(() => {
    api?.ping?.().then(setVal).catch(() => setVal('error'));
  }, []);
  return <span>{val}</span>;
}
