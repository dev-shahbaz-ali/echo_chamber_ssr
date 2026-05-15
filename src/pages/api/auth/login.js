import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { identifier, password } = req.body
  
  console.log('Login attempt for:', identifier)
  
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Username/email/phone and password are required' })
  }
  
  try {
    // Find user by username, email, or phone
    const { data: users, error: findError } = await supabaseAdmin
      .from('users')
      .select('id, username, email, phone, password, isonline, status, avatar, last_seen')
      .or(`username.eq.${identifier},email.eq.${identifier},phone.eq.${identifier}`)
    
    if (findError) {
      console.error('Find error:', findError)
      return res.status(500).json({ error: 'Database error' })
    }
    
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    const user = users[0]
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password)
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    
    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        email: user.email,
        phone: user.phone
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    
    // Remove password from response
    delete user.password
    
    res.status(200).json({
      success: true,
      token,
      user
    })
    
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}