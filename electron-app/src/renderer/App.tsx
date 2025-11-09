// import './index.css';
import Tasks from './pages/Tasks';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Meetings from './pages/Meetings';
import Communications from './pages/Communications';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <Router>
      <Navbar />
      <div id="app-container">
          <Routes>
            <Route path="/" element={<Tasks />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/communication" element={<Communications />} />
          </Routes>
      </div>      
    </Router>
  );
}