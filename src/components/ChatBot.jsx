import { useState, useEffect, useRef, useMemo } from 'react';
import ChatMessage from './ChatMessage';
import { loadRules, matchRule } from '../chatEngine';

const TYPING_DELAY_MS = 600;
const SUGGESTION_COUNT = 3;

function getSuggestions(input, rules) {
  if (!input || input.length < 2) return [];
  const lower = input.toLowerCase();
  return rules
    .filter(r => r.question && r.question.toLowerCase().includes(lower))
    .slice(0, SUGGESTION_COUNT);
}

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
          text: 'こんにちは！TAINSカスタマーサポートへようこそ。\nご質問をそのまま入力していただくか、キーワードでお問い合わせください。',
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

  const suggestions = useMemo(
    () => rulesConfig ? getSuggestions(input, rulesConfig.rules) : [],
    [input, rulesConfig]
  );

  const submitText = (text) => {
    if (!text.trim() || isTyping) return;
    const userMsg = { id: Date.now(), sender: 'user', text: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const rule = rulesConfig ? matchRule(text.trim(), rulesConfig.rules) : null;
      const responseText = rule
        ? `**${rule.question}**\n\n${rule.response}`
        : (rulesConfig?.defaultMessage ?? 'エラーが発生しました。');

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
      submitText(input);
    }
  };

  return (
    <div className="chatbot-container">
      <header className="chat-header">
        <span className="header-icon">🤖</span>
        <div>
          <div className="header-title">TAINSカスタマーサポート</div>
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

      {suggestions.length > 0 && (
        <div className="suggestions">
          {suggestions.map(rule => (
            <button
              key={rule.id}
              className="suggestion-item"
              onClick={() => submitText(rule.question)}
            >
              {rule.question}
            </button>
          ))}
        </div>
      )}

      <div className="chat-footer">
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="質問を入力してください（例：退会方法を教えてください）"
          rows={2}
          disabled={isTyping || !rulesConfig}
        />
        <button
          className="send-button"
          onClick={() => submitText(input)}
          disabled={!input.trim() || isTyping || !rulesConfig}
        >
          送信
        </button>
      </div>
    </div>
  );
}
