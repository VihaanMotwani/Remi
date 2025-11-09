import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import AnimatedMicBubble from './components/MicComponent';
import Navbar from './components/Navbar';
import Tasks from './pages/Tasks';
import Meetings from './pages/Meetings';
import Communications from './pages/Communications';
import './App.css'

function Dashboard() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Tasks />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="communication" element={<Communications />} />
      </Routes>
    </>
  );
}

export default function App() {
  const [micDone, setMicDone] = useState<boolean>(false);

  return (
    <Router>
      <div className="center-container">
        <AnimatedMicBubble
          isListening={!micDone}
          onComplete={() => setMicDone(true)}
        />
        {!micDone && <h1>Hi there, I'm Remi</h1>}
      </div>

      {/* Dashboard routes only shown when mic done */}
      {micDone && (
        <div style={{ paddingTop: 100, maxWidth: 900, margin: '0 auto' }}>
          <Dashboard />
        </div>
      )}
    </Router>
  );
}
