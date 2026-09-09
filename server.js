<<<<<<< HEAD
// server.js — project ROOT
// Run: node server.js

require("dotenv").config({ path: ".env.local" });

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { initWebSocket } = require("./src/lib/wsManager");

=======
// server.js — replace your existing one completely
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: ".env.local" });

>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

<<<<<<< HEAD
=======
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

// userId (string) -> WebSocket
const clients = new Map();

function sendToUser(userId, data) {
  const ws = clients.get(String(userId));
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
    return true;
  }
  return false;
}

async function broadcastOnlineStatus(userId, isOnline) {
  // Get all friends of this user
  const { data: friends } = await supabase
    .from("friends")
    .select("friend_id, user_id")
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (!friends) return;

  const statusData = {
    type: "user_status_change",
    data: { userId, isOnline, lastSeen: new Date().toISOString() },
  };

  friends.forEach((f) => {
    const friendId = f.user_id === userId ? f.friend_id : f.user_id;
    sendToUser(friendId, statusData);
  });
}

>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5
app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });

<<<<<<< HEAD
  initWebSocket(server);

  server.listen(3000, () => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  http://localhost:3000");
    console.log("  ws://localhost:3000/ws");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });
=======
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(1008, "No token");
      return;
    }

    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = String(decoded.userId);
    } catch {
      ws.close(1008, "Invalid token");
      return;
    }

    // Mark online
    await supabase
      .from("users")
      .update({
        isonline: true,
        last_seen: new Date().toISOString(),
      })
      .eq("id", userId);

    clients.set(userId, ws);
    console.log(`[WS] User ${userId} connected. Total: ${clients.size}`);

    ws.send(
      JSON.stringify({
        type: "connection",
        status: "connected",
        userId,
        timestamp: new Date().toISOString(),
      }),
    );

    await broadcastOnlineStatus(userId, true);

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const { type, data } = msg;
      console.log(`[WS] ${userId} → ${type}`);

      // ── SEND PRIVATE MESSAGE ──────────────────────────────────────
      if (type === "private_message") {
        const { receiverId, content, clientMessageId } = data;

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
          console.error("[WS] Message save error:", error);
          return;
        }

        // Deliver to receiver
        sendToUser(receiverId, {
          type: "new_message",
          data: { ...saved, clientMessageId },
        });

        // Confirm to sender
        sendToUser(userId, {
          type: "message_sent",
          data: {
            clientMessageId,
            messageId: saved.id,
            timestamp: saved.created_at,
          },
        });
      }

      // ── FRIEND REQUEST ────────────────────────────────────────────
      if (type === "friend_request") {
        const { receiverUsername } = data;

        // Look up receiver by username
        const { data: receiver } = await supabase
          .from("users")
          .select("id, username")
          .eq("username", receiverUsername)
          .single();

        if (!receiver) {
          sendToUser(userId, {
            type: "error",
            data: { message: "User not found" },
          });
          return;
        }

        if (receiver.id === userId) {
          sendToUser(userId, {
            type: "error",
            data: { message: "Cannot add yourself" },
          });
          return;
        }

        // Check already friends
        const { data: existingFriend } = await supabase
          .from("friends")
          .select("id")
          .or(
            `and(user_id.eq.${userId},friend_id.eq.${receiver.id}),and(user_id.eq.${receiver.id},friend_id.eq.${userId})`,
          )
          .maybeSingle();

        if (existingFriend) {
          sendToUser(userId, {
            type: "error",
            data: { message: "Already friends" },
          });
          return;
        }

        // Check pending request
        const { data: existingReq } = await supabase
          .from("friend_requests")
          .select("id")
          .or(
            `and(sender_id.eq.${userId},receiver_id.eq.${receiver.id}),and(sender_id.eq.${receiver.id},receiver_id.eq.${userId})`,
          )
          .eq("status", "pending")
          .maybeSingle();

        if (existingReq) {
          sendToUser(userId, {
            type: "error",
            data: { message: "Request already pending" },
          });
          return;
        }

        const { data: friendReq, error: reqErr } = await supabase
          .from("friend_requests")
          .insert([
            { sender_id: userId, receiver_id: receiver.id, status: "pending" },
          ])
          .select(
            `
            *,
            sender:users!friend_requests_sender_id_fkey(id, username),
            receiver:users!friend_requests_receiver_id_fkey(id, username)
          `,
          )
          .single();

        if (reqErr) {
          console.error("[WS] Friend request error:", reqErr);
          return;
        }

        // Notify receiver
        sendToUser(receiver.id, {
          type: "new_friend_request",
          data: friendReq,
        });

        // Confirm to sender
        sendToUser(userId, { type: "friend_request_sent", data: friendReq });
      }

      // ── ACCEPT / REJECT FRIEND REQUEST ───────────────────────────
      if (type === "friend_request_response") {
        const { requestId, accept } = data;

        const { data: friendReq } = await supabase
          .from("friend_requests")
          .select("*, sender:users!friend_requests_sender_id_fkey(id,username)")
          .eq("id", requestId)
          .single();

        if (!friendReq || friendReq.receiver_id !== userId) {
          sendToUser(userId, {
            type: "error",
            data: { message: "Not authorized" },
          });
          return;
        }

        await supabase
          .from("friend_requests")
          .update({ status: accept ? "accepted" : "rejected" })
          .eq("id", requestId);

        if (accept) {
          // Create bidirectional friendship
          await supabase.from("friends").insert([
            {
              user_id: friendReq.sender_id,
              friend_id: userId,
              status: "active",
            },
            {
              user_id: userId,
              friend_id: friendReq.sender_id,
              status: "active",
            },
          ]);

          const payload = {
            type: "friend_request_accepted",
            data: { requestId, friendId: userId },
          };
          sendToUser(friendReq.sender_id, payload);
          sendToUser(userId, payload);
        } else {
          sendToUser(friendReq.sender_id, {
            type: "friend_request_rejected",
            data: { requestId },
          });
        }
      }

      // ── TYPING ───────────────────────────────────────────────────
      if (type === "typing") {
        const { receiverId, isTyping } = data;
        sendToUser(receiverId, {
          type: "typing_indicator",
          data: { userId, isTyping },
        });
      }

      // ── MARK READ ────────────────────────────────────────────────
      if (type === "mark_read") {
        const { messageIds, senderId } = data;
        await supabase
          .from("messages")
          .update({ is_read: true })
          .in("id", messageIds)
          .eq("receiver_id", userId);

        sendToUser(senderId, {
          type: "messages_read",
          data: { messageIds, readerId: userId },
        });
      }

      // ── GET MESSAGES ─────────────────────────────────────────────
      if (type === "get_messages") {
        const { otherUserId, limit = 50 } = data;

        const { data: msgs } = await supabase
          .from("messages")
          .select(
            "*, sender:users!messages_sender_id_fkey(id,username), receiver:users!messages_receiver_id_fkey(id,username)",
          )
          .or(
            `and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`,
          )
          .order("created_at", { ascending: true })
          .limit(limit);

        sendToUser(userId, {
          type: "messages_history",
          data: { messages: msgs || [], otherUserId },
        });
      }

      // ── PING ─────────────────────────────────────────────────────
      if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }
    });

    ws.on("close", async () => {
      clients.delete(userId);
      console.log(`[WS] User ${userId} disconnected`);
      await supabase
        .from("users")
        .update({
          isonline: false,
          last_seen: new Date().toISOString(),
        })
        .eq("id", userId);
      await broadcastOnlineStatus(userId, false);
    });

    ws.on("error", (err) =>
      console.error(`[WS] Error ${userId}:`, err.message),
    );
  });

  server.listen(3000, () => {
    console.log("> App: http://localhost:3000");
    console.log("> WS:  ws://localhost:3000/ws");
  });
>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5
});
