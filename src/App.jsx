import { useState, useEffect } from 'react';
import ChatBot from './components/ChatBot';
import AdminPage from './pages/AdminPage';
import './App.css';
import './admin.css';

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const handler = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const isAdmin = hash === '#/admin';

  return isAdmin ? <AdminPage /> : (
    <div className="app">
      <ChatBot />
    </div>
  );
}
