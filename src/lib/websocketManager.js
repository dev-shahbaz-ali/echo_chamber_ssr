// src/lib/wsManager.js
// CommonJS — no import/export, no Prisma, pure Supabase

const { WebSocketServer } = require("ws");
const { parse } = require("url");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// userId (string) → WebSocket
const clients = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendTo(userId, data) {
  const ws = clients.get(String(userId));
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

async function broadcastStatus(userId, isOnline) {
  try {
    const { data: rows } = await supabase
      .from("friends")
      .select("friend_id, user_id")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    (rows || []).forEach((row) => {
      const otherId =
        String(row.user_id) === String(userId)
          ? String(row.friend_id)
          : String(row.user_id);
      sendTo(otherId, {
        type: "user_status_change",
        data: { userId, isOnline, lastSeen: new Date().toISOString() },
      });
    });
  } catch (e) {
    console.error("[WS] broadcastStatus error:", e.message);
  }
}

// ─── Message handlers ─────────────────────────────────────────────────────────

async function handlePrivateMessage(userId, data) {
  const { receiverId, content, clientMessageId } = data;
  if (!receiverId || !content) return;

  const { data: saved, error } = await supabase
    .from("messages")
    .insert([
      {
        sender_id: userId,
        receiver_id: String(receiverId),
        content,
        is_read: false,
        is_delivered: false,
      },
    ])
    .select(
      `
      *,
      sender:users!messages_sender_id_fkey(id, username),
      receiver:users!messages_receiver_id_fkey(id, username)
    `,
    )
    .single();

  if (error) {
    console.error("[WS] Save message error:", error.message);
    return;
  }

  sendTo(receiverId, {
    type: "new_message",
    data: { ...saved, clientMessageId },
  });
  sendTo(userId, {
    type: "message_sent",
    data: { clientMessageId, messageId: saved.id, timestamp: saved.created_at },
  });
}

async function handleFriendRequest(userId, data) {
  const { receiverUsername } = data;
  if (!receiverUsername) {
    sendTo(userId, {
      type: "error",
      data: { message: "No username provided" },
    });
    return;
  }

  const { data: receiver, error: fe } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", receiverUsername)
    .single();

  if (fe || !receiver) {
    sendTo(userId, {
      type: "error",
      data: { message: "User not found: " + receiverUsername },
    });
    return;
  }

  if (String(receiver.id) === String(userId)) {
    sendTo(userId, { type: "error", data: { message: "Cannot add yourself" } });
    return;
  }

  // Already friends?
  const { data: ef } = await supabase
    .from("friends")
    .select("id")
    .or(
      `and(user_id.eq.${userId},friend_id.eq.${receiver.id}),and(user_id.eq.${receiver.id},friend_id.eq.${userId})`,
    )
    .maybeSingle();

  if (ef) {
    sendTo(userId, { type: "error", data: { message: "Already friends" } });
    return;
  }

  // Pending request?
  const { data: er } = await supabase
    .from("friend_requests")
    .select("id")
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${receiver.id}),and(sender_id.eq.${receiver.id},receiver_id.eq.${userId})`,
    )
    .eq("status", "pending")
    .maybeSingle();

  if (er) {
    sendTo(userId, {
      type: "error",
      data: { message: "Request already pending" },
    });
    return;
  }

  const { data: req, error: re } = await supabase
    .from("friend_requests")
    .insert([
      {
        sender_id: userId,
        receiver_id: String(receiver.id),
        status: "pending",
      },
    ])
    .select(
      `
      *,
      sender:users!friend_requests_sender_id_fkey(id, username),
      receiver:users!friend_requests_receiver_id_fkey(id, username)
    `,
    )
    .single();

  if (re) {
    console.error("[WS] Friend request DB error:", re.message);
    sendTo(userId, { type: "error", data: { message: re.message } });
    return;
  }

  console.log(`[WS] Friend request: ${userId} → ${receiver.id}`);
  sendTo(receiver.id, { type: "new_friend_request", data: req });
  sendTo(userId, { type: "friend_request_sent", data: req });
}

async function handleFriendResponse(userId, data) {
  const { requestId, accept } = data;

  const { data: req, error } = await supabase
    .from("friend_requests")
    .select(`*, sender:users!friend_requests_sender_id_fkey(id, username)`)
    .eq("id", requestId)
    .single();

  if (error || !req) {
    sendTo(userId, { type: "error", data: { message: "Request not found" } });
    return;
  }
  if (String(req.receiver_id) !== String(userId)) {
    sendTo(userId, { type: "error", data: { message: "Not authorized" } });
    return;
  }

  await supabase
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "rejected" })
    .eq("id", requestId);

  if (accept) {
    await supabase.from("friends").insert([
      {
        user_id: String(req.sender_id),
        friend_id: String(userId),
        status: "active",
      },
      {
        user_id: String(userId),
        friend_id: String(req.sender_id),
        status: "active",
      },
    ]);
    const msg = {
      type: "friend_request_accepted",
      data: { requestId, friendRequest: req },
    };
    sendTo(req.sender_id, msg);
    sendTo(userId, msg);
  } else {
    sendTo(req.sender_id, {
      type: "friend_request_rejected",
      data: { requestId },
    });
    sendTo(userId, { type: "friend_request_rejected", data: { requestId } });
  }
}

async function handleGetMessages(userId, data) {
  const { otherUserId, limit = 50 } = data;

  const { data: msgs } = await supabase
    .from("messages")
    .select(
      `
      *,
      sender:users!messages_sender_id_fkey(id, username),
      receiver:users!messages_receiver_id_fkey(id, username)
    `,
    )
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`,
    )
    .order("created_at", { ascending: true })
    .limit(limit);

  sendTo(userId, {
    type: "messages_history",
    data: { messages: msgs || [], otherUserId },
  });
}

async function handleMarkRead(userId, data) {
  const { messageIds, senderId } = data;
  if (!messageIds?.length) return;

  await supabase
    .from("messages")
    .update({ is_read: true })
    .in("id", messageIds)
    .eq("receiver_id", userId);

  sendTo(senderId, {
    type: "messages_read",
    data: { messageIds, readerId: userId },
  });
}

// ─── Initialize ───────────────────────────────────────────────────────────────

function initWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url);

    if (pathname === "/ws") {
      console.log(`[WS-UPGRADE] Intercepting chat upgrade for: ${pathname}`);
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      // Diagnostic log to confirm other paths are ignored
      console.log(`[WS-UPGRADE] Passing through upgrade for: ${pathname}`);
    }
    // Next.js handles its own upgrades (like HMR) automatically
  });

  console.log("[WS] WebSocket server initialized");

  wss.on("connection", async (ws, req) => {
    const { query } = parse(req.url, true);
    const token = query.token;

    if (!token) {
      ws.close(1008, "No token");
      return;
    }

    let userId;
    try {
      userId = String(jwt.verify(token, process.env.JWT_SECRET).userId);
    } catch (e) {
      console.error("[WS] Bad token:", e.message);
      ws.close(1008, "Invalid token");
      return;
    }

    // Mark online
    await supabase
      .from("users")
      .update({ isonline: true, last_seen: new Date().toISOString() })
      .eq("id", userId);

    clients.set(userId, ws);
    console.log(`[WS] ✓ User ${userId} connected (total: ${clients.size})`);

    ws.send(
      JSON.stringify({
        type: "connection",
        status: "connected",
        userId,
        timestamp: new Date().toISOString(),
      }),
    );

    await broadcastStatus(userId, true);

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const { type, data = {} } = msg;
      console.log(`[WS] ${userId} → ${type}`);

      try {
        switch (type) {
          case "private_message":
            await handlePrivateMessage(userId, data);
            break;
          case "friend_request":
            await handleFriendRequest(userId, data);
            break;
          case "friend_request_response":
            await handleFriendResponse(userId, data);
            break;
          case "get_messages":
            await handleGetMessages(userId, data);
            break;
          case "mark_read":
            await handleMarkRead(userId, data);
            break;
          case "typing":
            sendTo(data.receiverId, {
              type: "typing_indicator",
              data: { userId, isTyping: data.isTyping },
            });
            break;
          case "ping":
            ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
            break;
          default:
            console.log("[WS] Unknown type:", type);
        }
      } catch (e) {
        console.error(`[WS] Handler error (${type}):`, e.message);
        ws.send(
          JSON.stringify({ type: "error", data: { message: e.message } }),
        );
      }
    });

    ws.on("close", async (code) => {
      clients.delete(userId);
      console.log(`[WS] User ${userId} disconnected (code ${code})`);
      try {
        await supabase
          .from("users")
          .update({ isonline: false, last_seen: new Date().toISOString() })
          .eq("id", userId);
        await broadcastStatus(userId, false);
      } catch (e) {
        console.error("[WS] close cleanup error:", e.message);
      }
    });

    ws.on("error", (e) =>
      console.error(`[WS] socket error (${userId}):`, e.message),
    );
  });

  wss.on("error", (e) => console.error("[WS] server error:", e.message));
}

module.exports = { initWebSocket };
