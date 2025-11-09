import { useState, useEffect } from 'react';
// import { SplashScreen } from 'src/renderer/components/SplashScreen'; // Splash screen disabled
import { HomeView } from 'src/renderer/components/HomeView';
import { MeetingsView } from 'src/renderer/components/MeetingsView';
import { CommunicationView } from 'src/renderer/components/CommunicationView';

// Removed 'splash' from view union now that splash screen is disabled
type View = 'home' | 'meetings' | 'communication';

export default function App() {
  // Start directly at home view (splash disabled)
  const [currentView, setCurrentView] = useState<View>('home');

  // Splash logic removed

  const api = (window as any).api as { platform?: string; ping?: () => Promise<string> };
  return (
    <div className="w-full h-screen overflow-hidden bg-black">
      {/* Example usage of secure preload API */}
      <div className="absolute top-8 left-0 text-white/40 px-6 text-xs tracking-wide">
        Electron Platform: {api?.platform} · Ping: <Ping api={api} />
      </div>
  {/* Splash screen disabled */}
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
