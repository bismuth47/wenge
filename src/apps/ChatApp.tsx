import { useEffect, useRef, useState } from "react";
import { Button, TextInput, Fieldset } from "react95";
import Pusher from "pusher-js";

type Message = { id: string; user: string; text: string; createdAt: string };

export function ChatApp() {
  const [user, setUser] = useState(() => localStorage.getItem("wenge_user") || `Guest${Math.floor(Math.random() * 9000) + 1000}`);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages ?? []);
        return;
      }
      throw new Error("no api");
    } catch {
      const raw = localStorage.getItem("wenge_chat");
      if (raw) setMessages(JSON.parse(raw));
    }
  };

  useEffect(() => {
    fetchHistory();
    // Pusher realtime
    const key = import.meta.env.VITE_PUSHER_KEY;
    const cluster = import.meta.env.VITE_PUSHER_CLUSTER || "ap3";
    if (!key) return;
    const pusher = new Pusher(key, { cluster });
    const ch = pusher.subscribe("wenge-chat");
    ch.bind("new-message", (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev.slice(-99), msg];
      });
    });
    return () => {
      ch.unbind_all();
      ch.unsubscribe();
      pusher.disconnect();
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    const msg: Message = { id: Date.now().toString(), user, text: text.trim(), createdAt: new Date().toISOString() };
    setText("");
    // optimistic (deduplicated on Pusher echo via id check)
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev.slice(-99), msg];
    });
    localStorage.setItem("wenge_user", user);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
      if (!res.ok) throw new Error("api failed");
    } catch {
      // local fallback: also push to local storage
      const raw = localStorage.getItem("wenge_chat");
      const arr: Message[] = raw ? JSON.parse(raw) : [];
      const next = [...arr, msg].slice(-100);
      localStorage.setItem("wenge_chat", JSON.stringify(next));
      // simulate Pusher broadcast locally via storage event? already optimistic
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "100%", minHeight: 0, flex: 1, boxSizing: "border-box" }}>
      <Fieldset label="Wenge Chat - Vercel + Turso + Pusher" style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 10, lineHeight: 1.4, color: "#333" }}>
          Send → Vercel API → Turso save + Pusher notify → Broadcast to all clients
          <br />
          Env vars: <code>TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER</code>
        </div>
      </Fieldset>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <TextInput value={user} onChange={(e) => setUser(e.target.value)} placeholder="Name" width={120} />
        <span style={{ fontSize: 11, alignSelf: "center" }}>online</span>
      </div>
      <div
        ref={listRef}
        style={{
          border: "2px inset #fff",
          background: "#fff",
          flex: 1,
          minHeight: 120,
          overflow: "auto",
          padding: 6,
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: "#888", textAlign: "center", marginTop: 40 }}>No messages yet. Be the first!</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 4 }}>
              <span style={{ color: "#000080", fontWeight: "bold" }}>{m.user}</span>
              <span style={{ color: "#888", fontSize: 10, marginLeft: 6 }}>{new Date(m.createdAt).toLocaleTimeString()}</span>
              <div style={{ wordBreak: "break-all" }}>{m.text}</div>
            </div>
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <TextInput value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." style={{ flex: 1 }} />
        <Button onClick={send}>Send</Button>
      </div>
    </div>
  );
}
