import { useCallback, useEffect, useRef, useState } from "react";
import ChatHistory from "../components/ChatHistory.jsx";
import NasaChat from "../components/NasaChat.jsx";
import { api } from "../services/api.js";

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState(null);
  // `key` changes only when the person opens a chat or starts a new one, which resets NasaChat.
  const [view, setView] = useState({ key: 0, id: null });
  const deletedIds = useRef(new Set());

  const refresh = useCallback(
    () =>
      api("/api/nasa-rag/conversations")
        .then((d) => {
          const list = Array.isArray(d?.conversations) ? d.conversations : [];
          // ignore chats deleted while this request was in flight
          setConversations(list.filter((c) => !deletedIds.current.has(c.id)));
          setError("");
        })
        .catch((e) => setError(e.message)),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const open = (id) => {
    setActiveId(id);
    setView((v) => ({ key: v.key + 1, id }));
  };

  const remove = async (id) => {
    try {
      await api(`/api/nasa-rag/conversations/${id}`, { method: "DELETE" });
      deletedIds.current.add(id);
      setConversations((list) => list.filter((c) => c.id !== id));
      if (id === activeId) open(null);
    } catch (e) {
      setError(e.message);
    }
  };

  // A new chat just got its id from the server: highlight it and refresh the list without resetting the chat.
  const onActivity = (id) => {
    if (id) setActiveId(id);
    refresh();
  };

  return (
    <div className="chatpage">
      <div className="chat-layout">
        <ChatHistory
          conversations={conversations}
          activeId={activeId}
          error={error}
          onSelect={open}
          onNew={() => open(null)}
          onDelete={remove}
        />
        <NasaChat key={view.key} conversationId={view.id} onActivity={onActivity} />
      </div>
    </div>
  );
}