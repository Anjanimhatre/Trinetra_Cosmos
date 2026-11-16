import { useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
import "./NasaChat.css";

const WELCOME = {
  role: "bot",
  text: "Ask me anything about the Moon or Mars. I answer only from NASA, ISRO and ESA sources.",
  sources: [],
};

const SUGGESTIONS = [
  "What did Apollo 11 leave on the Moon?",
  "Has life been found on Mars?",
  "What did Perseverance discover?",
  "Compare Chandrayaan-3 and Apollo 11",
];

// The backend adds markers like [SOURCE 1]. The sources are listed under the answer, so hide the markers.
const clean = (text) =>
  (text || "")
    .replace(/\s*\[SOURCE\s*\d+(?:\s*[,;]\s*(?:SOURCE\s*)?\d+)*\]/gi, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^\s*[*-]\s+/gm, "• ")
    .trim();

/**
 * conversationId: open this saved chat (null starts a new one).
 * onActivity(id): called after each answer so the history list can refresh.
 * The parent remounts this component (via `key`) when the person picks another chat.
 */
export default function NasaChat({ conversationId: initialId = null, onActivity }) {
  const [conversationId, setConversationId] = useState(initialId);
  const [messages, setMessages] = useState(initialId ? [] : [WELCOME]);
  const [loading, setLoading] = useState(Boolean(initialId));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useRef(null);

  // Load the saved messages when opening an existing chat.
  useEffect(() => {
    if (!initialId) return undefined;
    let cancelled = false;
    api(`/api/nasa-rag/conversations/${initialId}`)
      .then((conv) => {
        if (cancelled) return;
        setMessages(
          conv.messages.map((m) =>
            m.role === "assistant"
              ? { role: "bot", text: clean(m.content), sources: m.sources || [] }
              : { role: "user", text: m.content },
          ),
        );
      })
      .catch((e) => {
        if (!cancelled) {
          setMessages([{ role: "bot", error: true, text: `I couldn't open this chat. ${e.message}`, sources: [] }]);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [initialId]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, loading]);

  async function ask(q) {
    const question = q.trim();
    if (question.length < 2 || busy || loading) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const data = await api("/api/nasa-rag/chat", {
        method: "POST",
        body: { question, conversation_id: conversationId },
      });
      setMessages((m) => [...m, { role: "bot", text: clean(data.answer), sources: data.sources || [] }]);
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
        onActivity?.(data.conversation_id);
      }
    } catch (e) {
      const text =
        e.status === 429
          ? "You're asking too quickly. Wait a moment and try again."
          : `I couldn't get an answer. ${e.message}`;
      setMessages((m) => [...m, { role: "bot", error: true, text, sources: [] }]);
    } finally {
      setBusy(false);
    }
  }

  const onSubmit = (e) => {
    e.preventDefault();
    ask(input);
  };

  const showSuggestions = !loading && messages.length === 1 && messages[0] === WELCOME;

  return (
    <section className="nasachat" aria-label="Ask about space">
      <div className="nc-head">
        <h2>Ask about the Moon and Mars</h2>
        <p>Answers come from NASA, ISRO and ESA pages and the NASA image library.</p>
      </div>

      <div className="nc-list" ref={list} aria-live="polite">
        {loading && (
          <div className="nc-msg bot">
            <p className="nc-typing">Opening chat…</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"nc-msg " + m.role + (m.error ? " error" : "")}>
            <p>{m.text}</p>
            {m.sources?.length > 0 && (
              <div className="nc-sources">
                <span>Sources</span>
                {m.sources
                  .filter((s) => /^https?:\/\//.test(s.url))
                  .map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" title={s.title}>
                      {s.title.length > 42 ? s.title.slice(0, 42) + "…" : s.title}
                    </a>
                  ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="nc-msg bot">
            <p className="nc-typing">Searching space-agency sources…</p>
          </div>
        )}
      </div>

      {showSuggestions && (
        <div className="nc-suggest">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <form className="nc-form" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          maxLength={1500}
          aria-label="Your question"
          disabled={loading}
        />
        <button type="submit" disabled={busy || loading || input.trim().length < 2}>
          Ask
        </button>
      </form>
    </section>
  );
}