import { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import { loadRules, matchRule } from '../chatEngine';

const TYPING_DELAY_MS = 600;

export default function ChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [rulesConfig, setRulesConfig] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    loadRules()
      .then(config => {
        setRulesConfig(config);
        setMessages([{
          id: 1,
          sender: 'bot',
          text: 'こんにちは！カスタマーサポートへようこそ。どのようなことでお困りですか？',
          timestamp: Date.now(),
        }]);
      })
      .catch(err => {
        console.error(err);
        setMessages([{
          id: 1,
          sender: 'bot',
          text: 'システムエラーが発生しました。しばらくしてからお試しください。',
          timestamp: Date.now(),
        }]);
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg = { id: Date.now(), sender: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const rule = rulesConfig ? matchRule(text, rulesConfig.rules) : null;
      const responseText = rule ? rule.response : (rulesConfig?.defaultMessage ?? 'エラーが発生しました。');

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'bot',
        text: responseText,
        timestamp: Date.now(),
      }]);
      setIsTyping(false);
    }, TYPING_DELAY_MS);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chatbot-container">
      <header className="chat-header">
        <span className="header-icon">🤖</span>
        <div>
          <div className="header-title">カスタマーサポート</div>
          <div className="header-status">オンライン</div>
        </div>
      </header>

      <div className="chat-body">
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isTyping && (
          <div className="message-row bot">
            <div className="avatar bot-avatar">🤖</div>
            <div className="bubble bot-bubble typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-footer">
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力してください..."
          rows={2}
          disabled={isTyping || !rulesConfig}
        />
        <button
          className="send-button"
          onClick={sendMessage}
          disabled={!input.trim() || isTyping || !rulesConfig}
        >
          送信
        </button>
      </div>
    </div>
  );
}
