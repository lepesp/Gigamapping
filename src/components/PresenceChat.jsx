import { useState, useRef, useEffect, useCallback } from "react";
import useGigaStore from "../store/useGigaStore";

function getRelativeTime(timestamp) {
  if (!timestamp) return "";
  const seconds = timestamp.seconds
    ? timestamp.seconds
    : Math.floor(timestamp / 1000);
  const now = Math.floor(Date.now() / 1000);
  const diff = now - seconds;
  if (diff < 60) return "nå";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} t`;
  return `${Math.floor(diff / 86400)} d`;
}

function getInitial(name) {
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

export default function PresenceChat() {
  const user = useGigaStore((s) => s.user);
  const onlineUsers = useGigaStore((s) => s.onlineUsers) || [];
  const chatMessages = useGigaStore((s) => s.chatMessages) || [];
  const sendChatMessage = useGigaStore((s) => s.sendChatMessage);

  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [hasUnread, setHasUnread] = useState(false);

  const messagesContainerRef = useRef(null);
  const prevMessageCount = useRef(chatMessages.length);

  // Auto-scroll to bottom on new messages (only within chat container)
  useEffect(() => {
    if (!collapsed && messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
    // Track unread when collapsed
    if (collapsed && chatMessages.length > prevMessageCount.current) {
      setHasUnread(true);
    }
    prevMessageCount.current = chatMessages.length;
  }, [chatMessages, collapsed]);

  // Uleste nullstilles der panelet faktisk åpnes, ikke i en effekt som
  // kjører etter render (som ga en unødvendig ekstra renderrunde)
  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      if (prev) setHasUnread(false); // åpner nå
      return !prev;
    });
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !sendChatMessage) return;
    await sendChatMessage(input.trim());
    setInput("");
  }, [input, sendChatMessage]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Always show the chat panel
  // (previously hidden when alone, but users want to see it)

  return (
    <div
      style={{
        position: "absolute",
        left: 20,
        top: 20,
        ...(collapsed ? {} : { bottom: 170 }),
        width: 220,
        display: collapsed ? "block" : "flex",
        flexDirection: "column",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        boxShadow: "var(--shadow)",
        zIndex: 50,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px 8px",
          borderBottom: collapsed ? "none" : "1px solid var(--border)",
          cursor: "pointer",
          flexShrink: 0,
        }}
        onClick={toggleCollapsed}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1px",
            color: "var(--text-muted)",
            position: "relative",
          }}
        >
          💬 Chat{" "}
          <span style={{ color: "var(--accent)" }}>
            ({onlineUsers.length})
          </span>
          {/* Unread dot */}
          {hasUnread && collapsed && (
            <span
              style={{
                position: "absolute",
                top: -2,
                right: -10,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--accent)",
                boxShadow: "0 0 6px var(--accent-glow)",
              }}
            />
          )}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            transform: collapsed ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          ▼
        </span>
      </div>

      {!collapsed && (
        <>
          {/* Online users */}
          {onlineUsers.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 6,
                padding: "8px 12px 6px",
                flexShrink: 0,
                flexWrap: "wrap",
              }}
            >
              {onlineUsers.map((u) => (
                <div
                  key={u.uid}
                  title={u.displayName || u.email}
                  style={{ position: "relative" }}
                >
                  {u.photoURL ? (
                    <img
                      src={u.photoURL}
                      alt={u.displayName}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1.5px solid var(--border)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "var(--accent-glow)",
                        border: "1.5px solid var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--accent)",
                      }}
                    >
                      {getInitial(u.displayName)}
                    </div>
                  )}
                  {/* Green online dot */}
                  <span
                    style={{
                      position: "absolute",
                      bottom: -1,
                      right: -1,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#22c55e",
                      border: "1.5px solid var(--bg-card)",
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Chat messages */}
          <div
            ref={messagesContainerRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "6px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {chatMessages.length === 0 && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  padding: "16px 4px",
                  lineHeight: 1.6,
                }}
              >
                Ingen meldinger ennå.
                <br />
                Start en samtale!
              </div>
            )}
            {chatMessages.map((msg) => {
              const isOwn = msg.userId === user?.uid;
              return (
                <div key={msg.id} style={{ maxWidth: "100%" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 5,
                      marginBottom: 1,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: isOwn ? "var(--accent)" : "var(--text-muted)",
                      }}
                    >
                      {isOwn ? "Du" : msg.displayName || "Ukjent"}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: "var(--text-muted)",
                        opacity: 0.7,
                      }}
                    >
                      {getRelativeTime(msg.createdAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-primary)",
                      lineHeight: 1.45,
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div
            style={{
              padding: "8px 10px",
              flexShrink: 0,
              display: "flex",
              gap: 6,
              borderTop: "1px solid var(--border)",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Skriv melding..."
              style={{
                flex: 1,
                fontSize: 12,
                padding: "7px 10px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--bg-card-hover)",
                color: "var(--text-primary)",
                outline: "none",
                fontFamily: "Inter, sans-serif",
                minWidth: 0,
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              style={{
                background: input.trim() ? "var(--accent)" : "var(--bg-card-hover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: input.trim() ? "#fff" : "var(--text-muted)",
                cursor: input.trim() ? "pointer" : "default",
                fontSize: 14,
                padding: "0 10px",
                flexShrink: 0,
                transition: "all 0.15s",
              }}
              title="Send melding"
            >
              ➤
            </button>
          </div>
        </>
      )}
    </div>
  );
}
