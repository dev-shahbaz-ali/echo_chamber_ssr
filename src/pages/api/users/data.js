import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }
  
  try {
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Get user info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, email, phone, avatar, status, isonline, last_seen, created_at')
      .eq('id', userId)
      .single()
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Get friends
    const { data: friends, error: friendsError } = await supabaseAdmin
      .from('friends')
      .select(`
        id,
        user_id,
        friend_id,
        status,
        created_at,
        friend:users!friends_friend_id_fkey(id, username, email, avatar, isonline, status, last_seen)
      `)
      .eq('user_id', userId)
    
    // Get friend requests (received)
    const { data: friendRequests, error: requestsError } = await supabaseAdmin
      .from('friend_requests')
      .select(`
        id,
        sender_id,
        receiver_id,
        status,
        message,
        created_at,
        sender:users!friend_requests_sender_id_fkey(id, username, email, avatar, status)
      `)
      .eq('receiver_id', userId)
      .eq('status', 'pending')
    
    // Get conversations
    const { data: conversations, error: convError } = await supabaseAdmin
      .from('conversations')
      .select(`
        *,
        user1:users!conversations_user1_id_fkey(id, username, avatar, isonline),
        user2:users!conversations_user2_id_fkey(id, username, avatar, isonline)
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('last_message_time', { ascending: false })
    
    res.status(200).json({
      user,
      friends: friends || [],
      friendRequests: friendRequests || [],
      conversations: conversations || []
    })
    
  } catch (error) {
    console.error('Error fetching user data:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}