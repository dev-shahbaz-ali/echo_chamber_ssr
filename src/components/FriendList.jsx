export default function FriendList({
  friends,
  selectedUser,
  onSelectUser,
  currentUserId,
  messages,
}) {
  const getLastMessage = (userId) => {
    const userMessages = (messages || []).filter(
      (msg) =>
        ((msg.sender_id === userId || msg.senderId === userId) &&
          (msg.receiver_id === currentUserId ||
            msg.receiverId === currentUserId)) ||
        ((msg.sender_id === currentUserId || msg.senderId === currentUserId) &&
          (msg.receiver_id === userId || msg.receiverId === userId)),
    );
    return userMessages[userMessages.length - 1] || null;
  };

  const getUnreadCount = (userId) => {
    return (messages || []).filter(
      (msg) =>
        (msg.sender_id === userId || msg.senderId === userId) &&
        (msg.receiver_id === currentUserId ||
          msg.receiverId === currentUserId) &&
        !msg.is_read &&
        !msg.isRead,
    ).length;
  };

  if (!friends || friends.length === 0) {
    return (
      <div style={styles.noFriends}>
        <p>No friends yet.</p>
        <p style={styles.hint}>Click "Find Friends" to add new friends!</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {friends.map((friend) => {
        const friendUser = friend.friend || friend;
        const lastMessage = getLastMessage(friendUser.id);
        const unreadCount = getUnreadCount(friendUser.id);
        const isSelected = selectedUser?.id === friendUser.id;

        return (
          <div
            key={friendUser.id}
            onClick={() => onSelectUser(friend)}
            style={{
              ...styles.friendItem,
              backgroundColor: isSelected ? "#f1f5f9" : "transparent",
            }}
          >
            <div style={styles.avatar}>
              {friendUser.username?.charAt(0).toUpperCase()}
            </div>

            <div style={styles.friendInfo}>
              <div style={styles.friendName}>
                {friendUser.username}
                <span
                  style={{
                    ...styles.onlineStatus,
                    color: friendUser.isonline ? "#10b981" : "#94a3b8",
                  }}
                >
                  {friendUser.isonline ? "●" : "○"}
                </span>
              </div>

              {lastMessage && (
                <div style={styles.lastMessage}>
                  {lastMessage.sender_id === currentUserId ||
                  lastMessage.senderId === currentUserId
                    ? "You: "
                    : ""}
                  {(lastMessage.content || "").length > 30
                    ? lastMessage.content.substring(0, 30) + "..."
                    : lastMessage.content || ""}
                </div>
              )}
            </div>

            {unreadCount > 0 && (
              <div style={styles.unreadBadge}>{unreadCount}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    overflowY: "auto",
    backgroundColor: "#ffffff",
  },
  friendItem: {
    display: "flex",
    alignItems: "center",
    padding: "12px 16px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    margin: "4px 8px",
    borderRadius: "12px",
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "14px",
    backgroundColor: "#6366f1",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: "bold",
    marginRight: "12px",
    flexShrink: 0,
  },
  friendInfo: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    fontWeight: "600",
    fontSize: "15px",
    color: "#1e293b",
    marginBottom: "2px",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  onlineStatus: {
    fontSize: "10px",
  },
  lastMessage: {
    fontSize: "13px",
    color: "#64748b",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  unreadBadge: {
    backgroundColor: "#6366f1",
    color: "white",
    borderRadius: "10px",
    padding: "2px 8px",
    fontSize: "12px",
    fontWeight: "bold",
    flexShrink: 0,
    marginLeft: "8px",
  },
  noFriends: {
    padding: "30px 20px",
    textAlign: "center",
    color: "#64748b",
  },
  hint: {
    fontSize: "12px",
    marginTop: "10px",
  },
};
