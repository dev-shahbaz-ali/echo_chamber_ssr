// Environment variables load karein
require('dotenv').config({ path: '.env.local' });

const { createServer } = require('http');
const next = require('next');
const { parse } = require('url');
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Debug: Check if env variables are loaded
console.log('✅ Environment variables loaded:');
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Found' : '❌ Missing');
console.log('Supabase Anon Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Found' : '❌ Missing');
console.log('Supabase Service Key:', process.env.SUPABASE_SERVICE_KEY ? '✅ Found' : '❌ Missing');

// Initialize Supabase admin for backend
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Store connected clients
const clients = new Map();

// Handle private messages
async function handlePrivateMessage(senderId, data) {
  const { receiverId, message, clientMessageId, messageType = 'text', fileUrl, voiceDuration } = data;
  
  try {
    // Save message to database
    const { data: savedMessage, error } = await supabaseAdmin
      .from('messages')
      .insert([
        {
          sender_id: senderId,
          receiver_id: receiverId,
          message: message,
          client_message_id: clientMessageId,
          message_type: messageType,
          file_url: fileUrl,
          voice_duration: voiceDuration,
          is_read: false,
          is_delivered: false
        }
      ])
      .select(`
        *,
        sender:users!messages_sender_id_fkey(id, username, avatar),
        receiver:users!messages_receiver_id_fkey(id, username, avatar)
      `)
      .single();
    
    if (error) throw error;
    
    // Update or create conversation
    const user1Id = Math.min(senderId, receiverId);
    const user2Id = Math.max(senderId, receiverId);
    
    // Check if conversation exists
    let { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('user1_id', user1Id)
      .eq('user2_id', user2Id)
      .single();
    
    if (!conversation) {
      const { data: newConversation } = await supabaseAdmin
        .from('conversations')
        .insert([
          {
            user1_id: user1Id,
            user2_id: user2Id,
            last_message: message,
            last_message_time: new Date().toISOString(),
            last_message_sender: senderId
          }
        ])
        .select()
        .single();
      
      conversation = newConversation;
    } else {
      // Update conversation
      await supabaseAdmin
        .from('conversations')
        .update({
          last_message: message,
          last_message_time: new Date().toISOString(),
          last_message_sender: senderId
        })
        .eq('id', conversation.id);
      
      // Increment unread count for receiver
      const unreadField = receiverId === conversation.user1_id ? 'unread_count_user1' : 'unread_count_user2';
      await supabaseAdmin
        .from('conversations')
        .update({ [unreadField]: supabaseAdmin.raw(`${unreadField} + 1`) })
        .eq('id', conversation.id);
    }
    
    // Send to receiver if online
    const receiverClient = clients.get(receiverId);
    if (receiverClient && receiverClient.ws.readyState === 1) {
      receiverClient.ws.send(JSON.stringify({
        type: 'new_message',
        data: savedMessage
      }));
    }
    
    // Confirm to sender
    const senderClient = clients.get(senderId);
    if (senderClient && senderClient.ws.readyState === 1) {
      senderClient.ws.send(JSON.stringify({
        type: 'message_sent',
        data: {
          clientMessageId,
          messageId: savedMessage.id,
          timestamp: savedMessage.created_at
        }
      }));
    }
    
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// Handle mark as read
async function handleMarkAsRead(userId, data) {
  const { messageIds, conversationId } = data;
  
  try {
    await supabaseAdmin
      .from('messages')
      .update({ is_read: true })
      .in('id', messageIds);
    
    // Reset unread count in conversation
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    if (conversation) {
      const unreadField = userId === conversation.user1_id ? 'unread_count_user1' : 'unread_count_user2';
      await supabaseAdmin
        .from('conversations')
        .update({ [unreadField]: 0 })
        .eq('id', conversationId);
    }
    
  } catch (error) {
    console.error('Error marking messages as read:', error);
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });
  
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.close(1008, 'No token provided');
      return;
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      
      // Update user online status
      await supabaseAdmin
        .from('users')
        .update({ isonline: true, last_seen: new Date().toISOString() })
        .eq('id', userId);
      
      clients.set(userId, { ws, userId });
      console.log(`✅ User ${userId} connected. Total clients: ${clients.size}`);
      
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        userId
      }));
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch(message.type) {
            case 'private_message':
              await handlePrivateMessage(userId, message.data);
              break;
            case 'mark_read':
              await handleMarkAsRead(userId, message.data);
              break;
            default:
              console.log('Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });
      
      ws.on('close', async () => {
        await supabaseAdmin
          .from('users')
          .update({ isonline: false, last_seen: new Date().toISOString() })
          .eq('id', userId);
        
        clients.delete(userId);
        console.log(`❌ User ${userId} disconnected`);
      });
      
    } catch (error) {
      console.error('Auth error:', error);
      ws.close(1008, 'Invalid token');
    }
  });
  
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket running on ws://localhost:${PORT}/ws\n`);
  });
});