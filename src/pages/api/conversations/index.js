import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const token = req.headers.authorization?.replace('Bearer ', '')
  const { otherUserId } = req.body
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const currentUserId = decoded.userId
    
    // Check if conversation exists
    let { data: conversation, error: findError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .or(`and(user1_id.eq.${currentUserId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${currentUserId})`)
      .single()
    
    if (!conversation) {
      // Create new conversation
      const { data: newConversation, error: createError } = await supabaseAdmin
        .from('conversations')
        .insert([
          {
            user1_id: Math.min(currentUserId, otherUserId),
            user2_id: Math.max(currentUserId, otherUserId),
            unread_count_user1: 0,
            unread_count_user2: 0
          }
        ])
        .select()
        .single()
      
      if (createError) {
        return res.status(500).json({ error: 'Failed to create conversation' })
      }
      
      conversation = newConversation
    }
    
    res.status(200).json({
      success: true,
      conversation
    })
    
  } catch (error) {
    console.error('Error getting conversation:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}