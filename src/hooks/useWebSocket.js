import { useEffect, useRef, useState, useCallback } from 'react'

export const useWebSocket = (userId, token) => {
  const [isConnected, setIsConnected] = useState(false)
  const [messages, setMessages] = useState([])
  const wsRef = useRef(null)
  const messageHandlers = useRef(new Map())
  const reconnectTimeoutRef = useRef(null)

  const connect = useCallback(() => {
    if (!userId || !token) {
      console.log('No userId or token, skipping WebSocket connection')
      return
    }

    const wsUrl = `ws://localhost:3000/ws?token=${token}`
    console.log('Connecting to WebSocket:', wsUrl)
    
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      console.log('WebSocket connected successfully')
      setIsConnected(true)
      wsRef.current = ws
      
      // Clear reconnect timeout if any
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('WebSocket message received:', data.type)
        
        switch(data.type) {
          case 'new_message':
            setMessages(prev => [...prev, data.data])
            break
            
          case 'message_sent':
            setMessages(prev => prev.map(msg => 
              msg.tempId === data.data.tempId 
                ? { ...msg, id: data.data.messageId, createdAt: data.data.timestamp }
                : msg
            ))
            break
            
          case 'messages_history':
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id))
              const newMessages = data.data.messages.filter(m => !existingIds.has(m.id))
              return [...prev, ...newMessages]
            })
            break
            
          case 'user_status_change':
            if (messageHandlers.current.has('user_status_change')) {
              messageHandlers.current.get('user_status_change')(data.data)
            }
            break
            
          case 'new_friend_request':
            if (messageHandlers.current.has('new_friend_request')) {
              messageHandlers.current.get('new_friend_request')(data.data)
            }
            break
            
          case 'friend_request_accepted':
            if (messageHandlers.current.has('friend_request_accepted')) {
              messageHandlers.current.get('friend_request_accepted')(data.data)
            }
            break
            
          case 'friend_request_rejected':
            if (messageHandlers.current.has('friend_request_rejected')) {
              messageHandlers.current.get('friend_request_rejected')(data.data)
            }
            break
            
          case 'typing_indicator':
            if (messageHandlers.current.has('typing_indicator')) {
              messageHandlers.current.get('typing_indicator')(data.data)
            }
            break
            
          case 'messages_read':
            setMessages(prev => prev.map(msg => 
              data.data.messageIds.includes(msg.id) 
                ? { ...msg, isRead: true }
                : msg
            ))
            if (messageHandlers.current.has('messages_read')) {
              messageHandlers.current.get('messages_read')(data.data)
            }
            break
            
          case 'connection':
            console.log('Connection confirmed:', data)
            break
            
          case 'error':
            console.error('Server error:', data.data)
            if (messageHandlers.current.has('error')) {
              messageHandlers.current.get('error')(data.data)
            }
            break
            
          default:
            console.log('Unhandled message type:', data.type)
            if (messageHandlers.current.has(data.type)) {
              messageHandlers.current.get(data.type)(data.data)
            }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error)
      }
    }
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
    }
    
    ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason)
      setIsConnected(false)
      wsRef.current = null
      
      // Attempt to reconnect after 3 seconds
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...')
          reconnectTimeoutRef.current = null
          connect()
        }, 3000)
      }
    }
    
  }, [userId, token])
  
  useEffect(() => {
    connect()
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close()
      }
    }
  }, [connect])
  
  const sendMessage = useCallback((type, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }))
      return true
    } else {
      console.log(`Cannot send message: WebSocket is ${wsRef.current?.readyState}`)
      return false
    }
  }, [])
  
  const on = useCallback((eventType, handler) => {
    messageHandlers.current.set(eventType, handler)
  }, [])
  
  const off = useCallback((eventType) => {
    messageHandlers.current.delete(eventType)
  }, [])
  
  const sendPrivateMessage = useCallback((receiverId, content, tempId) => {
    return sendMessage('private_message', { receiverId, content, tempId })
  }, [sendMessage])
  
  const sendFriendRequest = useCallback((receiverUsername) => {
    return sendMessage('friend_request', { receiverUsername })
  }, [sendMessage])
  
  const respondToFriendRequest = useCallback((requestId, accept) => {
    return sendMessage('friend_request_response', { requestId, accept })
  }, [sendMessage])
  
  const sendTyping = useCallback((receiverId, isTyping) => {
    return sendMessage('typing', { receiverId, isTyping })
  }, [sendMessage])
  
  const markMessagesAsRead = useCallback((messageIds, senderId) => {
    return sendMessage('mark_read', { messageIds, senderId })
  }, [sendMessage])
  
  const getMessages = useCallback((otherUserId, limit = 50) => {
    return sendMessage('get_messages', { otherUserId, limit })
  }, [sendMessage])
  
  return {
    isConnected,
    messages,
    sendPrivateMessage,
    sendFriendRequest,
    respondToFriendRequest,
    sendTyping,
    markMessagesAsRead,
    getMessages,
    on,
    off
  }
}