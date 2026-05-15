import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import bcrypt from 'bcryptjs'

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  const { username, email, phone, password } = req.body
  
  console.log('Registration attempt:', { username, email, phone })
  
  // Validate
  if (!username || !email || !phone || !password) {
    return res.status(400).json({ error: 'All fields are required' })
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }
  
  try {
    // Check if user exists
    const { data: existingUsers, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email},phone.eq.${phone}`)
    
    if (checkError) {
      console.error('Check error:', checkError)
      return res.status(500).json({ error: 'Database error: ' + checkError.message })
    }
    
    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ error: 'Username, email, or phone already exists' })
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Insert new user
    const { data: newUser, error: insertError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          username,
          email,
          phone,
          password: hashedPassword,
          isonline: false,
          status: 'Hey there! I am using Echo Chamber',
          last_seen: new Date().toISOString()
        }
      ])
      .select('id, username, email, phone')
    
    if (insertError) {
      console.error('Insert error:', insertError)
      return res.status(500).json({ error: 'Failed to create user: ' + insertError.message })
    }
    
    console.log('User created:', newUser[0])
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser[0]
    })
    
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ error: 'Internal server error: ' + error.message })
  }
}