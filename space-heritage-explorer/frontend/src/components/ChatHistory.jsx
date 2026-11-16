import "./ChatHistory.css";

const when = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, sameYear ? { month: "short", day: "numeric" } : { year: "numeric", month: "short", day: "numeric" });
};

export default function ChatHistory({ conversations = [], activeId, error, onSelect, onNew, onDelete }) {
  return (
    <aside className="ch-side" aria-label="Your chats">
      <button type="button" className="ch-new" onClick={onNew}>
        New chat
      </button>

      {error && <p className="ch-error" role="alert">{error}</p>}

      {conversations.length === 0 && !error ? (
        <p className="ch-empty">Your chats will appear here after you ask a question.</p>
      ) : (
        <ul className="ch-list">
          {conversations.map((c) => (
            <li key={c.id} className={c.id === activeId ? "on" : ""}>
              <button
                type="button"
                className="ch-open"
                onClick={() => onSelect(c.id)}
                title={c.title}
                aria-current={c.id === activeId ? "true" : undefined}
              >
                <span className="ch-title">{c.title}</span>
                <span className="ch-date">{when(c.updated_at)}</span>
              </button>
              <button
                type="button"
                className="ch-del"
                aria-label={`Delete chat: ${c.title}`}
                onClick={() => {
                  if (window.confirm("Delete this chat? This can't be undone.")) onDelete(c.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}