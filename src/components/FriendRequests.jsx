import { useState } from 'react'

export default function FriendRequests({ requests, onRespond, onRefresh }) {
  const [showRequests, setShowRequests] = useState(false)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  
  const handleSendRequest = async () => {
    if (!username.trim()) {
      setError('Please enter a username')
      return
    }
    
    // Send friend request via WebSocket
    // This will be handled by the WebSocket hook
    setUsername('')
    setError('')
  }
  
  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setShowRequests(!showRequests)}>
        <span>Friend Requests ({requests.length})</span>
        <span>{showRequests ? '▼' : '▶'}</span>
      </div>
      
      {showRequests && (
        <div style={styles.content}>
          <div style={styles.addFriend}>
            <input
              type="text"
              placeholder="Enter username to add"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
            />
            <button onClick={handleSendRequest} style={styles.addButton}>
              Add Friend
            </button>
            {error && <div style={styles.error}>{error}</div>}
          </div>
          
          {requests.length === 0 ? (
            <div style={styles.noRequests}>No pending friend requests</div>
          ) : (
            requests.map(request => (
              <div key={request.id} style={styles.requestItem}>
                <div style={styles.requestInfo}>
                  <strong>{request.sender.username}</strong>
                  <span style={styles.requestStatus}>wants to be your friend</span>
                </div>
                <div style={styles.requestActions}>
                  <button 
                    onClick={() => onRespond(request.id, true)}
                    style={styles.acceptButton}
                  >
                    Accept
                  </button>
                  <button 
                    onClick={() => onRespond(request.id, false)}
                    style={styles.rejectButton}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: 'white'
  },
  header: {
    padding: '15px 20px',
    backgroundColor: '#f8f9fa',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 'bold'
  },
  content: {
    padding: '15px 20px',
    backgroundColor: '#fff'
  },
  addFriend: {
    marginBottom: '15px',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '5px'
  },
  input: {
    width: '100%',
    padding: '8px',
    marginBottom: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px'
  },
  addButton: {
    width: '100%',
    padding: '8px',
    backgroundColor: '#075e54',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  error: {
    color: 'red',
    fontSize: '12px',
    marginTop: '5px'
  },
  requestItem: {
    padding: '10px',
    borderBottom: '1px solid #f0f0f0',
    marginBottom: '10px'
  },
  requestInfo: {
    marginBottom: '10px'
  },
  requestStatus: {
    fontSize: '12px',
    color: '#666',
    marginLeft: '5px'
  },
  requestActions: {
    display: 'flex',
    gap: '10px'
  },
  acceptButton: {
    padding: '5px 15px',
    backgroundColor: '#25d366',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  rejectButton: {
    padding: '5px 15px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  noRequests: {
    textAlign: 'center',
    color: '#999',
    padding: '20px'
  }
}