function renderText(text) {
  return text.split('\n').map((line, i, arr) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : part
        )}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
}

export default function ChatMessage({ message }) {
  const isBot = message.sender === 'bot';

  return (
    <div className={`message-row ${isBot ? 'bot' : 'user'}`}>
      {isBot && <div className="avatar bot-avatar">🤖</div>}
      <div className={`bubble ${isBot ? 'bot-bubble' : 'user-bubble'}`}>
        {renderText(message.text)}
        <span className="timestamp">
          {new Date(message.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {!isBot && <div className="avatar user-avatar">👤</div>}
    </div>
  );
}
