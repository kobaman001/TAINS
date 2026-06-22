export default function ChatMessage({ message }) {
  const isBot = message.sender === 'bot';

  return (
    <div className={`message-row ${isBot ? 'bot' : 'user'}`}>
      {isBot && (
        <div className="avatar bot-avatar">🤖</div>
      )}
      <div className={`bubble ${isBot ? 'bot-bubble' : 'user-bubble'}`}>
        {message.text.split('\n').map((line, i) => (
          <span key={i}>
            {line.replace(/\*\*(.*?)\*\*/g, (_, t) => t)}
            {i < message.text.split('\n').length - 1 && <br />}
          </span>
        ))}
        <span className="timestamp">
          {new Date(message.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {!isBot && (
        <div className="avatar user-avatar">👤</div>
      )}
    </div>
  );
}
