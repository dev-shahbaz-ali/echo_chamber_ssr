import { useState } from "react";

export default function FriendRequests({ requests, onRespond }) {
  const [showRequests, setShowRequests] = useState(false);

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setShowRequests(!showRequests)}>
        <span>Pending Requests ({requests.length})</span>
        <span>{showRequests ? "▼" : "▶"}</span>
      </div>

      {showRequests && (
        <div style={styles.content}>
          <div style={styles.addFriend}></div>

          {requests.length === 0 ? (
            <div style={styles.noRequests}>No new friend requests</div>
          ) : (
            requests.map((request) => (
              <div key={request.id} style={styles.requestItem}>
                <div style={styles.requestInfo}>
                  <strong>{request.sender.username}</strong>
                  <span style={styles.requestStatus}>
                    wants to be your friend
                  </span>
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
  );
}

const styles = {
  container: {
    borderBottom: "1px solid #e0e0e0",
    backgroundColor: "white",
  },
  header: {
    padding: "15px 20px",
    backgroundColor: "#f8f9fa",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: "bold",
  },
  content: {
    padding: "15px 20px",
    backgroundColor: "#fff",
  },
  addFriend: {},
  requestItem: {
    padding: "10px",
    borderBottom: "1px solid #f0f0f0",
    marginBottom: "10px",
  },
  requestInfo: {
    marginBottom: "10px",
  },
  requestStatus: {
    fontSize: "12px",
    color: "#666",
    marginLeft: "5px",
  },
  requestActions: {
    display: "flex",
    gap: "10px",
  },
  acceptButton: {
    padding: "5px 15px",
    backgroundColor: "#6366f1",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  rejectButton: {
    padding: "5px 15px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  noRequests: {
    textAlign: "center",
    color: "#999",
    padding: "20px",
  },
};
