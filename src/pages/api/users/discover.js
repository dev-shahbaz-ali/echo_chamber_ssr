import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

export default async function handler(req, res) {
<<<<<<< HEAD
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  let currentUserId;
  try {
    currentUserId = String(jwt.verify(token, process.env.JWT_SECRET).userId);
=======
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token provided" });

  let currentUserId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    currentUserId = String(decoded.userId);
>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  try {
<<<<<<< HEAD
    const { data: allUsers, error } = await supabase
      .from("users")
      .select("id, username, status, isonline, avatar")
      .neq("id", currentUserId)
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    if (!allUsers?.length)
      return res.status(200).json({ success: true, users: [] });
=======
    const { data: allUsers, error: usersError } = await supabase
      .from("users")
      .select("id, username, email, avatar, status, isonline")
      .neq("id", currentUserId)
      .limit(50);

    if (usersError) {
      console.error("Users fetch error:", usersError);
      return res
        .status(500)
        .json({ error: "Failed to fetch users: " + usersError.message });
    }

    if (!allUsers || allUsers.length === 0) {
      return res.status(200).json({ success: true, users: [] });
    }
>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5

    const { data: friends } = await supabase
      .from("friends")
      .select("friend_id, user_id")
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

    const friendIds = new Set();
    (friends || []).forEach((f) => {
      friendIds.add(String(f.friend_id));
      friendIds.add(String(f.user_id));
    });
    friendIds.delete(currentUserId);

<<<<<<< HEAD
    const { data: pending } = await supabase
=======
    const { data: pendingRequests } = await supabase
>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5
      .from("friend_requests")
      .select("sender_id, receiver_id")
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .eq("status", "pending");

    const pendingIds = new Set();
<<<<<<< HEAD
    (pending || []).forEach((r) => {
      pendingIds.add(String(r.sender_id));
      pendingIds.add(String(r.receiver_id));
    });
    pendingIds.delete(currentUserId);

    const users = allUsers
=======
    (pendingRequests || []).forEach((r) => {
      if (String(r.sender_id) === currentUserId)
        pendingIds.add(String(r.receiver_id));
      if (String(r.receiver_id) === currentUserId)
        pendingIds.add(String(r.sender_id));
    });

    const availableUsers = allUsers
>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5
      .map((u) => ({ ...u, id: String(u.id) }))
      .filter((u) => !friendIds.has(u.id) && !pendingIds.has(u.id))
      .map((u) => ({
        ...u,
        friendStatus: "none",
        status: u.status || "Hey there!",
      }));

<<<<<<< HEAD
    return res.status(200).json({ success: true, users });
  } catch (e) {
    return res.status(500).json({ error: e.message });
=======
    return res.status(200).json({ success: true, users: availableUsers });
  } catch (error) {
    console.error("Discover error:", error);
    return res
      .status(500)
      .json({ error: "Internal server error: " + error.message });
>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5
  }
}
