import { WebSocketServer } from 'ws'
import { prisma } from './prisma.js'
import jwt from 'jsonwebtoken'

class WebSocketManager {
  constructor() {
    this.clients = new Map() // userId -> { ws, userId }
    this.wss = null
  }

  initialize(server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    })
    
    console.log('WebSocket server initialized on path: /ws')
    
    this.wss.on('connection', async (ws, req) => {
      console.log('New WebSocket connection attempt')
      
      // Extract token from URL query string
      const url = new URL(req.url, `http://${req.headers.host}`)
      const token = url.searchParams.get('token')
      
      console.log('Token received:', token ? 'Yes' : 'No')
      
      if (!token) {
        console.log('No token provided, closing connection')
        ws.close(1008, 'No token provided')
        return
      }
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const userId = decoded.userId
        
        console.log(`User ${userId} authenticated`)
        
        // Update user online status
        await prisma.user.update({
          where: { id: userId },
          data: { isOnline: true, lastSeen: new Date() }
        })
        
        // Store client connection
        this.clients.set(userId, { ws, userId })
        
        console.log(`User ${userId} connected. Total clients: ${this.clients.size}`)
        
        // Send initial connection confirmation
        ws.send(JSON.stringify({
          type: 'connection',
          status: 'connected',
          userId: userId,
          timestamp: new Date().toISOString()
        }))
        
        // Broadcast online status to friends
        await this.broadcastOnlineStatus(userId, true)
        
        // Setup message handlers
        ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString())
            console.log(`Message received from ${userId}:`, message.type)
            await this.handleMessage(userId, message, ws)
          } catch (error) {
            console.error('Error handling message:', error)
            ws.send(JSON.stringify({
              type: 'error',
              data: { message: 'Failed to process message' }
            }))
          }
        })
        
        ws.on('close', async () => {
          console.log(`User ${userId} disconnected`)
          
          // Update user offline status
          await prisma.user.update({
            where: { id: userId },
            data: { isOnline: false, lastSeen: new Date() }
          })
          
          this.clients.delete(userId)
          
          // Broadcast offline status to friends
          await this.broadcastOnlineStatus(userId, false)
        })
        
        ws.on('error', (error) => {
          console.error(`WebSocket error for user ${userId}:`, error)
        })
        
      } catch (error) {
        console.error('Authentication error:', error)
        ws.close(1008, 'Invalid token')
      }
    })
    
    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error)
    })
  }
  
  async handleMessage(userId, message, ws) {
    switch(message.type) {
      case 'private_message':
        await this.handlePrivateMessage(userId, message)
        break
      case 'friend_request':
        await this.handleFriendRequest(userId, message)
        break
      case 'friend_request_response':
        await this.handleFriendRequestResponse(userId, message)
        break
      case 'typing':
        await this.handleTypingIndicator(userId, message)
        break
      case 'mark_read':
        await this.handleMarkRead(userId, message)
        break
      case 'get_messages':
        await this.handleGetMessages(userId, message)
        break
      default:
        console.log('Unknown message type:', message.type)
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` }
        }))
    }
  }
  
  async handlePrivateMessage(senderId, message) {
    try {
      const { receiverId, content, tempId } = message.data
      
      console.log(`Private message from ${senderId} to ${receiverId}: ${content}`)
      
      // Save message to database
      const savedMessage = await prisma.message.create({
        data: {
          content,
          senderId,
          receiverId,
          isRead: false
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              isOnline: true
            }
          },
          receiver: {
            select: {
              id: true,
              username: true,
              isOnline: true
            }
          }
        }
      })
      
      console.log(`Message saved with ID: ${savedMessage.id}`)
      
      // Send to receiver if online
      const receiverClient = this.clients.get(receiverId)
      if (receiverClient && receiverClient.ws.readyState === 1) {
        receiverClient.ws.send(JSON.stringify({
          type: 'new_message',
          data: {
            ...savedMessage,
            tempId
          }
        }))
        console.log(`Message sent to receiver ${receiverId}`)
      } else {
        console.log(`Receiver ${receiverId} is offline`)
      }
      
      // Send confirmation to sender
      const senderClient = this.clients.get(senderId)
      if (senderClient && senderClient.ws.readyState === 1) {
        senderClient.ws.send(JSON.stringify({
          type: 'message_sent',
          data: {
            tempId,
            messageId: savedMessage.id,
            timestamp: savedMessage.createdAt
          }
        }))
      }
      
    } catch (error) {
      console.error('Error sending private message:', error)
    }
  }
  
  async handleFriendRequest(senderId, message) {
    try {
      const { receiverUsername } = message.data
      
      console.log(`Friend request from ${senderId} to ${receiverUsername}`)
      
      const receiver = await prisma.user.findUnique({
        where: { username: receiverUsername }
      })
      
      if (!receiver) {
        const senderClient = this.clients.get(senderId)
        if (senderClient && senderClient.ws.readyState === 1) {
          senderClient.ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'User not found' }
          }))
        }
        return
      }
      
      if (receiver.id === senderId) {
        const senderClient = this.clients.get(senderId)
        if (senderClient) {
          senderClient.ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Cannot send friend request to yourself' }
          }))
        }
        return
      }
      
      // Check if already friends
      const existingFriend = await prisma.friend.findFirst({
        where: {
          OR: [
            { user1Id: senderId, user2Id: receiver.id },
            { user1Id: receiver.id, user2Id: senderId }
          ]
        }
      })
      
      if (existingFriend) {
        const senderClient = this.clients.get(senderId)
        if (senderClient) {
          senderClient.ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Already friends with this user' }
          }))
        }
        return
      }
      
      // Check if request already exists
      const existingRequest = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId, receiverId: receiver.id },
            { senderId: receiver.id, receiverId: senderId }
          ]
        }
      })
      
      if (existingRequest) {
        const senderClient = this.clients.get(senderId)
        if (senderClient) {
          senderClient.ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Friend request already exists' }
          }))
        }
        return
      }
      
      // Create friend request
      const friendRequest = await prisma.friendRequest.create({
        data: {
          senderId,
          receiverId: receiver.id,
          status: 'pending'
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true
            }
          },
          receiver: {
            select: {
              id: true,
              username: true
            }
          }
        }
      })
      
      console.log(`Friend request created: ${friendRequest.id}`)
      
      // Notify receiver if online
      const receiverClient = this.clients.get(receiver.id)
      if (receiverClient && receiverClient.ws.readyState === 1) {
        receiverClient.ws.send(JSON.stringify({
          type: 'new_friend_request',
          data: friendRequest
        }))
        console.log(`Friend request notification sent to ${receiver.id}`)
      }
      
      // Confirm to sender
      const senderClient = this.clients.get(senderId)
      if (senderClient && senderClient.ws.readyState === 1) {
        senderClient.ws.send(JSON.stringify({
          type: 'friend_request_sent',
          data: friendRequest
        }))
      }
      
    } catch (error) {
      console.error('Error sending friend request:', error)
    }
  }
  
  async handleFriendRequestResponse(userId, message) {
    try {
      const { requestId, accept } = message.data
      
      console.log(`Friend request response: ${requestId} - ${accept ? 'accepted' : 'rejected'} by ${userId}`)
      
      const friendRequest = await prisma.friendRequest.findUnique({
        where: { id: requestId },
        include: {
          sender: true,
          receiver: true
        }
      })
      
      if (!friendRequest) {
        const client = this.clients.get(userId)
        if (client) {
          client.ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Friend request not found' }
          }))
        }
        return
      }
      
      if (friendRequest.receiverId !== userId) {
        const client = this.clients.get(userId)
        if (client) {
          client.ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Not authorized to respond to this request' }
          }))
        }
        return
      }
      
      await prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: accept ? 'accepted' : 'rejected' }
      })
      
      if (accept) {
        // Create friendship
        await prisma.friend.create({
          data: {
            user1Id: friendRequest.senderId,
            user2Id: friendRequest.receiverId
          }
        })
        
        console.log(`Friendship created between ${friendRequest.senderId} and ${friendRequest.receiverId}`)
        
        // Notify both users
        const notificationData = {
          type: 'friend_request_accepted',
          data: { 
            friendRequest: {
              ...friendRequest,
              status: 'accepted'
            }
          }
        }
        
        const senderClient = this.clients.get(friendRequest.senderId)
        const receiverClient = this.clients.get(friendRequest.receiverId)
        
        if (senderClient && senderClient.ws.readyState === 1) {
          senderClient.ws.send(JSON.stringify(notificationData))
        }
        if (receiverClient && receiverClient.ws.readyState === 1) {
          receiverClient.ws.send(JSON.stringify(notificationData))
        }
      } else {
        // Notify sender that request was rejected
        const senderClient = this.clients.get(friendRequest.senderId)
        if (senderClient && senderClient.ws.readyState === 1) {
          senderClient.ws.send(JSON.stringify({
            type: 'friend_request_rejected',
            data: { requestId }
          }))
        }
      }
      
    } catch (error) {
      console.error('Error responding to friend request:', error)
    }
  }
  
  async handleTypingIndicator(senderId, message) {
    const { receiverId, isTyping } = message.data
    const receiverClient = this.clients.get(receiverId)
    
    if (receiverClient && receiverClient.ws.readyState === 1) {
      receiverClient.ws.send(JSON.stringify({
        type: 'typing_indicator',
        data: { userId: senderId, isTyping }
      }))
    }
  }
  
  async handleMarkRead(userId, message) {
    try {
      const { messageIds, senderId } = message.data
      
      await prisma.message.updateMany({
        where: {
          id: { in: messageIds },
          receiverId: userId
        },
        data: { isRead: true }
      })
      
      // Notify sender that messages were read
      const senderClient = this.clients.get(senderId)
      if (senderClient && senderClient.ws.readyState === 1) {
        senderClient.ws.send(JSON.stringify({
          type: 'messages_read',
          data: { messageIds, readerId: userId }
        }))
      }
      
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }
  
  async handleGetMessages(userId, message) {
    try {
      const { otherUserId, limit = 50, offset = 0 } = message.data
      
      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId }
          ]
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset,
        include: {
          sender: {
            select: {
              id: true,
              username: true
            }
          },
          receiver: {
            select: {
              id: true,
              username: true
            }
          }
        }
      })
      
      const client = this.clients.get(userId)
      if (client && client.ws.readyState === 1) {
        client.ws.send(JSON.stringify({
          type: 'messages_history',
          data: {
            messages: messages.reverse(),
            otherUserId
          }
        }))
      }
      
    } catch (error) {
      console.error('Error getting messages:', error)
    }
  }
  
  async broadcastOnlineStatus(userId, isOnline) {
    try {
      // Get user's friends
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          friendsAsUser1: { include: { user2: true } },
          friendsAsUser2: { include: { user1: true } }
        }
      })
      
      if (!user) return
      
      const friends = [
        ...user.friendsAsUser1.map(f => f.user2),
        ...user.friendsAsUser2.map(f => f.user1)
      ]
      
      const statusData = {
        type: 'user_status_change',
        data: { 
          userId, 
          isOnline, 
          lastSeen: new Date().toISOString()
        }
      }
      
      friends.forEach(friend => {
        const friendClient = this.clients.get(friend.id)
        if (friendClient && friendClient.ws.readyState === 1) {
          friendClient.ws.send(JSON.stringify(statusData))
        }
      })
      
    } catch (error) {
      console.error('Error broadcasting online status:', error)
    }
  }
  
  sendToUser(userId, data) {
    const client = this.clients.get(userId)
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(data))
      return true
    }
    return false
  }
}

export const wsManager = new WebSocketManager()