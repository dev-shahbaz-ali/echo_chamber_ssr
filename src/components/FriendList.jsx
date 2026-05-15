export default function FriendList({ friends, selectedUser, onSelectUser, currentUserId, messages }) {
  const getLastMessage = (userId) => {
    const userMessages = messages.filter(msg => 
      (msg.senderId === userId && msg.receiverId === currentUserId) ||
      (msg.senderId === currentUserId && msg.receiverId === userId)
    )
    return userMessages[userMessages.length - 1]
  }
  
  const getUnreadCount = (userId) => {
    return messages.filter(msg => 
      msg.senderId === userId && 
      msg.receiverId === currentUserId && 
      !msg.isRead
    ).length
  }
  
  return (
    <div style={styles.container}>
      {friends.length === 0 ? (
        <div style={styles.noFriends}>
          <p>No friends yet. Send a friend request to start chatting!</p>
        </div>
      ) : (
        friends.map(friend => {
          const lastMessage = getLastMessage(friend.id)
          const unreadCount = getUnreadCount(friend.id)
          
          return (
            <div
              key={friend.id}
              onClick={() => onSelectUser(friend)}
              style={{
                ...styles.friendItem,
                backgroundColor: selectedUser?.id === friend.id ? '#e8f0fe' : 'white'
              }}
            >
              <div style={styles.avatar}>
                {friend.username.charAt(0).toUpperCase()}
              </div>
              <div style={styles.friendInfo}>
                <div style={styles.friendName}>
                  {friend.username}
                  <span style={styles.onlineStatus}>
                    {friend.isOnline ? '🟢' : '⚫'}
                  </span>
                </div>
                {lastMessage && (
                  <div style={styles.lastMessage}>
                    {lastMessage.senderId === currentUserId ? 'You: ' : ''}
                    {lastMessage.content.length > 30 
                      ? lastMessage.content.substring(0, 30) + '...' 
                      : lastMessage.content}
                  </div>
                )}
              </div>
              {unreadCount > 0 && (
                <div style={styles.unreadBadge}>
                  {unreadCount}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

const styles = {
  container: {
    flex: 1,
    overflowY: 'auto'
  },
  friendItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '15px',
    cursor: 'pointer',
    borderBottom: '1px solid #e0e0e0',
    transition: 'background-color 0.2s'
  },
  avatar: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    backgroundColor: '#075e54',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: 'bold',
    marginRight: '15px'
  },
  friendInfo: {
    flex: 1
  },
  friendName: {
    fontWeight: 'bold',
    marginBottom: '5px',
    display: 'flex',
    alignItems: 'center'
  },
  onlineStatus: {
    marginLeft: '5px',
    fontSize: '12px'
  },
  lastMessage: {
    fontSize: '12px',
    color: '#666'
  },
  unreadBadge: {
    backgroundColor: '#25d366',
    color: 'white',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  noFriends: {
    padding: '20px',
    textAlign: 'center',
    color: '#999'
  }
}