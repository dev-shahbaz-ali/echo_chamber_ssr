import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useWebSocket } from "../hooks/useWebSocket";
import ChatWindow from "../components/ChatWindow";
import FriendList from "../components/FriendList";
import FindFriends from "../components/FindFriends";
import FriendRequests from "../components/FriendRequests";

export default function Chat() {
  const [selectedUser, setSelectedUser] = useState(null);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("chats");
  const [showFindFriends, setShowFindFriends] = useState(false);
  const router = useRouter();

  const userId =
    typeof window !== "undefined" ? localStorage.getItem("userId") : null;
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const {
    isConnected,
    messages,
    sendPrivateMessage,
    sendFriendRequest,
    respondToFriendRequest,
    sendTyping,
    markMessagesAsRead,
    on,
    off,
  } = useWebSocket(userId, token);

  useEffect(() => {
    if (!token) {
      router.push("/");
      return;
    }

    fetchUserData();

    // Setup WebSocket event handlers
    const handleNewFriendRequest = (request) => {
      setFriendRequests((prev) => [...prev, request]);
    };

    const handleFriendRequestAccepted = (data) => {
      fetchUserData();
    };

    const handleFriendRequestRejected = () => {
      fetchUserData();
    };

    const handleUserStatusChange = (data) => {
      setFriends((prev) =>
        prev.map((friend) =>
          friend.friend?.id === data.userId || friend.id === data.userId
            ? {
                ...friend,
                friend: friend.friend
                  ? {
                      ...friend.friend,
                      isonline: data.isOnline,
                      last_seen: data.lastSeen,
                    }
                  : friend,
                isonline: data.isOnline,
                last_seen: data.lastSeen,
              }
            : friend,
        ),
      );
      if (selectedUser?.id === data.userId) {
        setSelectedUser((prev) => ({
          ...prev,
          isonline: data.isOnline,
          last_seen: data.lastSeen,
        }));
      }
    };

    on("new_friend_request", handleNewFriendRequest);
    on("friend_request_accepted", handleFriendRequestAccepted);
    on("friend_request_rejected", handleFriendRequestRejected);
    on("user_status_change", handleUserStatusChange);

    return () => {
      off("new_friend_request");
      off("friend_request_accepted");
      off("friend_request_rejected");
      off("user_status_change");
    };
  }, [token]);

  const fetchUserData = async () => {
    try {
      const response = await fetch("/api/users/data", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        setFriends(data.friends);
        setFriendRequests(data.friendRequests);
      } else if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("username");
        router.push("/");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = (content) => {
    if (selectedUser && content.trim()) {
      const tempId = Date.now().toString();
      sendPrivateMessage(selectedUser.id, content, tempId);
    }
  };

  const handleTyping = (isTyping) => {
    if (selectedUser) {
      sendTyping(selectedUser.id, isTyping);
    }
  };

  const handleSelectUser = (user) => {
    // The user object from FriendList is the nested 'friend' object.
    // If it's coming from another source, it might be flat.
    const normalizedUser = user.friend ? user.friend : user;
    setSelectedUser(normalizedUser);
    setActiveTab("chats");
    // Mark messages as read when opening chat
    const unreadMessages = messages
      .filter((msg) => msg.senderId === user.id && !msg.isRead)
      .map((msg) => msg.id);

    if (unreadMessages.length > 0) {
      markMessagesAsRead(unreadMessages, user.id);
    }
  };

  // In chat.js, fix getMessagesWithUser:
  const getMessagesWithUser = (friendId) => {
    return messages.filter((msg) => {
      const senderId = msg.sender_id || msg.senderId;
      const receiverId = msg.receiver_id || msg.receiverId;
      return (
        (senderId === friendId && receiverId === currentUser?.id) ||
        (senderId === currentUser?.id && receiverId === friendId)
      );
    });
  };

  const handleFindFriendsClick = () => {
    setShowFindFriends(true);
  };

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <h3>Welcome, {currentUser?.username}</h3>
          <div style={styles.status}>
            Status: {isConnected ? "🟢 Online" : "🔴 Offline"}
          </div>
        </div>

        <div style={styles.tabContainer}>
          <button
            style={{
              ...styles.tab,
              ...styles.chatsTab,
              backgroundColor: activeTab === "chats" ? "#25d366" : "#ddd",
            }}
            onClick={() => setActiveTab("chats")}
          >
            Chats
          </button>
          <button
            style={{
              ...styles.tab,
              backgroundColor: activeTab === "requests" ? "#075e54" : "#ddd",
            }}
            onClick={() => {
              setActiveTab("requests");
              setShowFindFriends(false);
            }}
          >
            Requests
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {showFindFriends ? (
            <FindFriends
              onSendRequest={sendFriendRequest}
              onBack={() => setShowFindFriends(false)}
            />
          ) : (
            <>
              <div style={styles.friendListHeader}>
                <h4>
                  {activeTab === "chats"
                    ? `Friends (${friends.length})`
                    : "Friend Zone"}
                </h4>
                <button
                  style={styles.findFriendsBtn}
                  onClick={handleFindFriendsClick}
                >
                  Find Friends
                </button>
              </div>
              {activeTab === "chats" ? (
                <FriendList
                  friends={friends}
                  selectedUser={selectedUser}
                  onSelectUser={handleSelectUser}
                  currentUserId={currentUser?.id}
                  messages={messages}
                />
              ) : (
                <FriendRequests
                  requests={friendRequests}
                  onRespond={respondToFriendRequest}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div style={styles.chatArea}>
        {selectedUser ? (
          <ChatWindow
            user={selectedUser}
            messages={getMessagesWithUser(selectedUser.id)}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            currentUserId={currentUser?.id}
          />
        ) : (
          <div style={styles.noChat}>
            <p>Select a friend to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    backgroundColor: "#f0f2f5",
  },
  sidebar: {
    width: "320px",
    backgroundColor: "white",
    borderRight: "1px solid #e0e0e0",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    padding: "20px",
    borderBottom: "1px solid #e0e0e0",
    backgroundColor: "#075e54",
    color: "white",
  },
  status: {
    fontSize: "12px",
    marginTop: "5px",
  },
  tabContainer: {
    display: "flex",
    borderBottom: "1px solid #e0e0e0",
    backgroundColor: "#f8f9fa",
  },
  tab: {
    flex: 1,
    padding: "12px",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "bold",
    color: "#333",
    transition: "background-color 0.2s",
  },
  chatsTab: {
    borderRight: "1px solid #e0e0e0",
  },
  friendListHeader: {
    padding: "15px 20px",
    borderBottom: "1px solid #e0e0e0",
    backgroundColor: "#f8f9fa",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  findFriendsBtn: {
    padding: "8px 15px",
    backgroundColor: "#25d366",
    color: "white",
    border: "none",
    borderRadius: "20px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#fff",
  },
  noChat: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    color: "#666",
  },
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontSize: "18px",
  },
};
