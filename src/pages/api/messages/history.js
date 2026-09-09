import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.replace("Bearer ", ""); 
  const { userId: otherUserId, limit = 50 } = req.query;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const currentUserId = decoded.userId;

    const { data: messages, error } = await supabaseAdmin
      .from("messages")
      .select(
        `
        *,
        sender:users!messages_sender_id_fkey(id, username),
        receiver:users!messages_receiver_id_fkey(id, username)
      `,
      )
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`,
      )
      .order("created_at", { ascending: true })
      .limit(parseInt(limit));

    if (error) throw error;

    res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
