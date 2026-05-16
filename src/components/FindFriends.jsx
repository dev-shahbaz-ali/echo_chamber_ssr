import { useState, useEffect } from "react";

export default function FindFriends({ onSendRequest, onBack }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState({});
  const [error, setError] = useState("");

  const searchUsers = async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/users/discover`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(data.users);
      } else {
        setError(data.error || "Failed to search users");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async (user) => {
    setSending((prev) => ({ ...prev, [user.id]: true }));

    try {
      // Server and WebSocket hook expect receiverUsername, not ID
      onSendRequest(user.username);
      // Update UI to show request sent
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, friendStatus: "pending" } : u,
        ),
      );
    } catch (err) {
      setError("Failed to send request");
    } finally {
      setSending((prev) => ({ ...prev, [user.id]: false }));
    }
  };

  useEffect(() => {
    searchUsers();
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>
          ←
        </button>
        <h3 style={styles.title}>Find Friends</h3>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {loading ? (
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          Searching for users...
        </div>
      ) : (
        <div style={styles.usersList}>
          {users.length === 0 ? (
            <div style={styles.noResults}>
              <p>No new users to discover at the moment.</p>
            </div>
          ) : null}

          {users.map((user) => (
            <div key={user.id} style={styles.userCard}>
              <div style={styles.avatar}>
                {user.username?.charAt(0).toUpperCase()}
              </div>
              <div style={styles.userInfo}>
                <div style={styles.username}>{user.username}</div>
                <div style={styles.status}>{user.status}</div>
              </div>
              <button
                onClick={() => handleSendRequest(user)}
                disabled={sending[user.id] || user.friendStatus === "pending"}
                style={{
                  ...styles.addBtn,
                  backgroundColor:
                    user.friendStatus === "pending" ? "#94a3b8" : "#6366f1",
                }}
              >
                {sending[user.id]
                  ? "Sending..."
                  : user.friendStatus === "pending"
                    ? "Request Sent"
                    : "Add Friend"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: "15px",
    borderBottom: "1px solid #f1f5f9",
    backgroundColor: "#ffffff",
  },
  backBtn: {
    padding: "8px 12px",
    backgroundColor: "transparent",
    color: "#6366f1",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    marginRight: "10px",
    fontSize: "20px",
    fontWeight: "bold",
  },
  title: {
    margin: 0,
    flex: 1,
    fontSize: "18px",
    color: "#1e293b",
  },
  searchBox: {
    padding: "16px",
    backgroundColor: "#ffffff",
    borderBottom: "1px solid #f1f5f9",
  },
  searchInput: {
    width: "100%",
    padding: "10px 16px",
    backgroundColor: "#f1f5f9",
    border: "1px solid transparent",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
  },
  usersList: {
    flex: 1,
    overflowY: "auto",
    padding: "10px",
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    padding: "14px",
    marginBottom: "12px",
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    border: "1px solid #f1f5f9",
  },
  avatar: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    backgroundColor: "#6366f1",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: "bold",
    marginRight: "12px",
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontWeight: "600",
    fontSize: "15px",
    color: "#1e293b",
    marginBottom: "2px",
  },
  status: {
    fontSize: "12px",
    color: "#64748b",
  },
  addBtn: {
    padding: "8px 16px",
    color: "white",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
  },
  loading: {
    textAlign: "center",
    padding: "20px",
    color: "#666",
  },
  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid #f3f3f3",
    borderTop: "2px solid #6366f1",
    borderRadius: "50%",
    margin: "0 auto 10px",
  },
  noResults: {
    textAlign: "center",
    padding: "40px",
    color: "#999",
  },
  hint: {
    fontSize: "12px",
    marginTop: "10px",
  },
  error: {
    padding: "10px",
    margin: "10px",
    backgroundColor: "#ffebee",
    color: "#c62828",
    borderRadius: "5px",
    fontSize: "12px",
    textAlign: "center",
  },
};
