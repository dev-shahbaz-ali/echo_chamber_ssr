import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { withUserId, limit = 50, before } = req.query
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const currentUserId = decoded.userId
    
    let query = supabaseAdmin
      .from('messages')
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, username, avatar),
        receiver:users!messages_receiver_id_fkey(id, username, avatar)
      `)
      .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${withUserId}),and(sender_id.eq.${withUserId},receiver_id.eq.${currentUserId})`)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
    
    if (before) {
      query = query.lt('created_at', before)
    }
    
    const { data: messages, error } = await query
    
    if (error) {
      return res.status(500).json({ error: 'Failed to fetch messages' })
    }
    
    // Mark messages as delivered
    await supabaseAdmin
      .from('messages')
      .update({ is_delivered: true })
      .eq('receiver_id', currentUserId)
      .eq('sender_id', withUserId)
      .eq('is_delivered', false)
    
    res.status(200).json({
      success: true,
      messages: messages.reverse()
    })
    
  } catch (error) {
    console.error('Error fetching messages:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}