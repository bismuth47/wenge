import { createClient } from "@libsql/client";
import Pusher from "pusher";

type Message = { id: string; user: string; text: string; createdAt: string };

function getTurso() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) return null;
  return createClient({ url, authToken });
}

function getPusher() {
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER || "ap3";
  if (!appId || !key || !secret) return null;
  return new Pusher({ appId, key, secret, cluster, useTLS: true });
}

export default async function handler(req: any, res: any) {
  const turso = getTurso();
  const pusher = getPusher();

  // ensure table exists (idempotent)
  if (turso) {
    try {
      await turso.execute(`CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user TEXT, text TEXT, createdAt TEXT)`);
    } catch {}
  }

  if (req.method === "GET") {
    if (!turso) {
      return res.status(200).json({ messages: [], note: "Turso not configured, using client fallback" });
    }
    const r = await turso.execute("SELECT id, user, text, createdAt FROM messages ORDER BY createdAt ASC LIMIT 100");
    const messages = r.rows as unknown as Message[];
    return res.status(200).json({ messages });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const msg: Message = {
      id: body.id || Date.now().toString(),
      user: (body.user || "Anonymous").slice(0, 32),
      text: (body.text || "").slice(0, 2000),
      createdAt: body.createdAt || new Date().toISOString(),
    };
    if (!msg.text) return res.status(400).json({ error: "text required" });

    if (turso) {
      await turso.execute({ sql: "INSERT INTO messages (id, user, text, createdAt) VALUES (?,?,?,?)", args: [msg.id, msg.user, msg.text, msg.createdAt] });
    }
    if (pusher) {
      await pusher.trigger("wenge-chat", "new-message", msg);
    }
    return res.status(200).json({ ok: true, message: msg });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
