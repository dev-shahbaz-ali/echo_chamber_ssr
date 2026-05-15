import { useState, useEffect, useRef } from 'react'

export default function ChatWindow({ user, messages, onSendMessage, onTyping, currentUserId }) {
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [typingUser, setTypingUser] = useState(false)
  const messagesEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const inputRef = useRef(null)
  
  useEffect(() => {
    scrollToBottom()
  }, [messages])
  
  useEffect(() => {
    // Focus input when chat opens
    inputRef.current?.focus()
  }, [user])
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  const handleSend = () => {
    if (inputMessage.trim()) {
      onSendMessage(inputMessage)
      setInputMessage('')
      handleTyping(false)
    }
  }
  
  const handleTyping = (typing) => {
    if (typing !== isTyping) {
      setIsTyping(typing)
      onTyping(typing)
    }
  }
  
  const handleInputChange = (e) => {
    setInputMessage(e.target.value)
    handleTyping(true)
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      handleTyping(false)
    }, 1000)
  }
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
  
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <strong>{user.username}</strong>
          <div style={styles.statusText}>
            {user.isOnline ? (
              <span style={styles.online}>🟢 Online</span>
            ) : (
              <span style={styles.offline}>
                Last seen: {new Date(user.lastSeen).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div style={styles.messagesArea}>
        {messages.length === 0 ? (
          <div style={styles.noMessages}>
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              style={{
                ...styles.message,
                justifyContent: msg.senderId === currentUserId ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                ...styles.messageBubble,
                backgroundColor: msg.senderId === currentUserId ? '#dcf8c5' : '#fff',
                border: msg.senderId === currentUserId ? 'none' : '1px solid #e0e0e0'
              }}>
                <div style={styles.messageContent}>{msg.content}</div>
                <div style={styles.messageTime}>
                  {new Date(msg.createdAt).toLocaleTimeString()}
                  {msg.senderId === currentUserId && (
                    <span style={styles.readStatus}>
                      {msg.isRead ? ' ✓✓' : ' ✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {typingUser && (
          <div style={styles.typingIndicator}>
            <em>{user.username} is typing...</em>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div style={styles.inputArea}>
        <input
          ref={inputRef}
          type="text"
          value={inputMessage}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          style={styles.input}
        />
        <button onClick={handleSend} style={styles.sendButton}>
          Send
        </button>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#e5ddd5'
  },
  header: {
    padding: '15px 20px',
    backgroundColor: '#075e54',
    color: 'white',
    borderBottom: '1px solid #064e44'
  },
  statusText: {
    fontSize: '12px',
    marginTop: '5px'
  },
  online: {
    color: '#25d366'
  },
  offline: {
    color: '#ddd'
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    backgroundImage: 'url("https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png")',
    backgroundRepeat: 'repeat'
  },
  message: {
    display: 'flex',
    marginBottom: '10px'
  },
  messageBubble: {
    maxWidth: '60%',
    padding: '8px 12px',
    borderRadius: '8px',
    boxShadow: '0 1px 1px rgba(0,0,0,0.1)'
  },
  messageContent: {
    wordWrap: 'break-word'
  },
  messageTime: {
    fontSize: '10px',
    color: '#999',
    marginTop: '5px',
    textAlign: 'right'
  },
  readStatus: {
    marginLeft: '3px'
  },
  noMessages: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: '#999'
  },
  typingIndicator: {
    padding: '10px',
    fontStyle: 'italic',
    color: '#666',
    fontSize: '12px'
  },
  inputArea: {
    display: 'flex',
    padding: '15px',
    backgroundColor: '#f0f0f0',
    borderTop: '1px solid #ddd'
  },
  input: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '20px',
    marginRight: '10px',
    fontSize: '14px',
    outline: 'none'
  },
  sendButton: {
    padding: '10px 20px',
    backgroundColor: '#075e54',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '14px'
  }
}