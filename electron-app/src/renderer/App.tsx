import { useState, useEffect } from 'react';
import { SplashScreen } from 'src/renderer/components/SplashScreen';
import { HomeView } from 'src/renderer/components/HomeView';
import { MeetingsView } from 'src/renderer/components/MeetingsView';
import { CommunicationView } from 'src/renderer/components/CommunicationView';
import { LiquidBlob } from 'src/renderer/components/LiquidBlob'; // ⬅️ add this import

type View = 'splash' | 'home' | 'meetings' | 'communication';
type RemiState = 'idle' | 'talking' | 'listening';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('splash');
  const [remiState, setRemiState] = useState<RemiState>('idle');

  useEffect(() => {
    // Auto-transition from splash to home after 3.5 seconds
    if (currentView === 'splash') {
      const timer = setTimeout(() => {
        setCurrentView('home');
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [currentView]);

  // 🔌 Connect to your Remi WebSocket for live state updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:5050'); // change to your actual Remi socket URL

    ws.onopen = () => console.log('✅ Connected to Remi WebSocket');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (['idle', 'talking', 'listening'].includes(data.state)) {
          setRemiState(data.state);
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    ws.onclose = () => console.log('❌ Disconnected from Remi WebSocket');
    return () => ws.close();
  }, []);

  const api = (window as any).api as { platform?: string; ping?: () => Promise<string> };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* Electron platform info */}
      <div className="absolute top-8 left-0 text-white/40 px-6 text-xs tracking-wide z-50">
        Electron Platform: {api?.platform} · Ping: <Ping api={api} />
      </div>

      {/* Main views */}
      {currentView === 'splash' && <SplashScreen />}
      {currentView === 'home' && <HomeView onNavigate={setCurrentView} />}
      {currentView === 'meetings' && <MeetingsView onBack={() => setCurrentView('home')} />}
      {currentView === 'communication' && <CommunicationView onBack={() => setCurrentView('home')} />}

      {/* 🧠 Remi Blob Overlay */}
      <div className="absolute bottom-16 right-16 z-40">
        <LiquidBlob state={remiState} />
      </div>

      {/* Optional text indicator */}
      <div className="absolute bottom-8 right-16 text-white/70 text-sm tracking-wide">
        {remiState.toUpperCase()}
      </div>
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
