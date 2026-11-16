import { useEffect, useRef, useState } from "react";
import "./NasaChatbot.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const STARTER_QUESTIONS = [
  "What did the Viking missions discover on Mars?",
  "How are Perseverance and Curiosity different?",
  "What evidence of ancient water has NASA found on Mars?",
];

export default function NasaChatbot() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello! I'm your NASA research assistant. Ask me about NASA's Moon and Mars missions, discoveries, rovers, landers and exploration history. My answers are grounded in the NASA sources indexed by this project.",
      sources: [],
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [health, setHealth] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    inputRef.current?.focus();
  }, [messages, open]);

  useEffect(() => {
    fetch(`${API_BASE}/api/nasa-rag/health`)
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "offline" }));
  }, []);

  async function sendQuestion(value = question) {
    const cleanQuestion = value.trim();
    if (!cleanQuestion || loading) return;

    setQuestion("");
    setError("");
    setMessages((current) => [
      ...current,
      { role: "user", content: cleanQuestion, sources: [] },
    ]);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/nasa-rag/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "The NASA chatbot could not answer right now.");
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer || "No answer was returned.",
          sources: data.sources || [],
        },
      ]);
    } catch (err) {
      setError(err.message || "Unable to connect to the NASA chatbot.");
    } finally {
      setLoading(false);
    }
  }

  async function syncSources() {
    setSyncing(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/nasa-rag/sync`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "NASA source sync failed.");
      setHealth((current) => ({ ...current, status: "ok", lastSyncMessage: data.message }));
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.message, sources: [] },
      ]);
    } catch (err) {
      setError(err.message || "NASA source sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="nasa-chat-launcher"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close NASA assistant" : "Open NASA assistant"}
      >
        <span className="nasa-chat-launcher-icon">✦</span>
        <span>Ask NASA AI</span>
      </button>

      {open && (
        <section className="nasa-chat-panel" aria-label="NASA RAG chatbot">
          <header className="nasa-chat-header">
            <div className="nasa-chat-avatar">✦</div>
            <div className="nasa-chat-heading">
              <strong>NASA Research Assistant</strong>
              <span>
                <i className={health?.status === "ok" ? "status-dot online" : "status-dot"} />
                {health?.status === "ok"
                  ? `${health.indexed_chunks ?? 0} NASA passages indexed`
                  : "Connecting to NASA knowledge base"}
              </span>
            </div>
            <button className="nasa-chat-close" onClick={() => setOpen(false)} aria-label="Close chat">
              ×
            </button>
          </header>

          <div className="nasa-chat-messages">
            {messages.map((message, index) => (
              <article className={`nasa-chat-message ${message.role}`} key={`${message.role}-${index}`}>
                <div className="nasa-chat-bubble">
                  <p>{message.content}</p>
                  {message.sources?.length > 0 && (
                    <div className="nasa-chat-sources">
                      <strong>NASA sources</strong>
                      {message.sources.map((source) => (
                        <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                          {source.title || source.url}
                          <span> ↗</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {loading && (
              <div className="nasa-chat-message assistant">
                <div className="nasa-chat-bubble nasa-chat-typing"><span /><span /><span /></div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length === 1 && (
            <div className="nasa-chat-suggestions">
              {STARTER_QUESTIONS.map((item) => (
                <button key={item} onClick={() => sendQuestion(item)} disabled={loading}>{item}</button>
              ))}
            </div>
          )}

          {error && <div className="nasa-chat-error">{error}</div>}

          <form
            className="nasa-chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              sendQuestion();
            }}
          >
            <input
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about NASA missions..."
              maxLength={1500}
              disabled={loading}
            />
            <button type="submit" disabled={loading || !question.trim()} aria-label="Send question">➤</button>
          </form>
          <footer className="nasa-chat-footer">
            <span>Answers grounded in indexed NASA sources</span>
            <button type="button" onClick={syncSources} disabled={syncing}>
              {syncing ? "Syncing..." : "↻ Sync NASA"}
            </button>
          </footer>
        </section>
      )}
    </>
  );
}
