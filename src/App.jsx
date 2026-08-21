import { useState, useEffect } from 'react';
import ChatBot from './components/ChatBot';
import AdminPage from './pages/AdminPage';
import LinePostPage from './pages/LinePostPage';
import './App.css';
import './admin.css';
import './linePost.css';

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

  if (hash === '#/admin') return <AdminPage />;
  if (hash === '#/line-post') return <LinePostPage />;

  return (
    <div className="app">
      <ChatBot />
    </div>
  );
}
