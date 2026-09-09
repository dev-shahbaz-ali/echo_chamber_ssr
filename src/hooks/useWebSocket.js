import { useEffect, useRef, useState, useCallback } from "react";

export const useWebSocket = (userId, token) => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const wsRef = useRef(null);
  const messageHandlers = useRef(new Map());
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!userId || !token) {
      console.log("No userId or token, skipping WebSocket connection");
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
<<<<<<< HEAD
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        console.log("Closing existing WebSocket connection");
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      wsRef.current = null;
=======
      wsRef.current.close();
>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5
    }

    // Use relative protocol-relative URL to work with any host
    const protocol =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "wss"
        : "ws";
    const host =
      typeof window !== "undefined" ? window.location.host : "localhost:3000";
    const wsUrl = `${protocol}://${host}/ws?token=${token}`;
    console.log("Connecting to WebSocket:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws; // Set reference immediately to ensure cleanup works

    ws.onopen = () => {
      console.log("WebSocket connected successfully");
      setIsConnected(true);
      reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection

      // Clear reconnect timeout if any
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Setup ping interval to keep connection alive
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
          console.log("Ping sent to server");
        }
      }, 25000); // Send ping every 25 seconds

      // Send initial connection info
      ws.send(
        JSON.stringify({
          type: "client_info",
          data: {
            userId,
            timestamp: new Date().toISOString(),
          },
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle pong response
        if (data.type === "pong") {
          console.log("Pong received from server");
          return;
        }

        console.log("WebSocket message received:", data.type);

        switch (data.type) {
          case "new_message":
            // Normalize snake_case from Supabase to camelCase for frontend
            const normalized = {
              ...data,
              senderId: data.sender_id || data.senderId,
              receiverId: data.receiver_id || data.receiverId,
              isRead: data.is_read ?? data.isRead,
              createdAt: data.created_at || data.createdAt,
            };
            setMessages((prev) => {
              // Prevent duplicates
              if (prev.some((m) => m.id === normalized.id)) return prev;
              return [...prev, normalized];
            });
            break;
          case "message_sent":
            setMessages((prev) =>
              prev.map((msg) =>
                msg.clientMessageId === data.clientMessageId
                  ? {
                      ...msg,
                      id: data.messageId,
                      created_at: data.timestamp,
                      is_delivered: true,
                    }
                  : msg,
              ),
            );
            break;

          case "message_delivered":
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === data.data.messageId
                  ? { ...msg, is_delivered: true }
                  : msg,
              ),
            );
            break;

          case "messages_history":
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newMessages = data.data.messages.filter(
                (m) => !existingIds.has(m.id),
              );
              return [...prev, ...newMessages];
            });
            break;

          case "user_status_change":
            if (messageHandlers.current.has("user_status_change")) {
              messageHandlers.current.get("user_status_change")(data.data);
            }
            break;

          case "new_friend_request":
            if (messageHandlers.current.has("new_friend_request")) {
              messageHandlers.current.get("new_friend_request")(data.data);
            }
            // Play notification sound
            if (messageHandlers.current.has("notification")) {
              messageHandlers.current.get("notification")({
                type: "friend_request",
                data: data.data,
              });
            }
            break;

          case "friend_request_accepted":
            if (messageHandlers.current.has("friend_request_accepted")) {
              messageHandlers.current.get("friend_request_accepted")(data.data);
            }
            break;

          case "friend_request_rejected":
            if (messageHandlers.current.has("friend_request_rejected")) {
              messageHandlers.current.get("friend_request_rejected")(data.data);
            }
            break;

          case "typing_indicator":
            if (messageHandlers.current.has("typing_indicator")) {
              messageHandlers.current.get("typing_indicator")(data.data);
            }
            break;

          case "messages_read":
            setMessages((prev) =>
              prev.map((msg) =>
                data.data.messageIds.includes(msg.id)
                  ? { ...msg, is_read: true }
                  : msg,
              ),
            );
            if (messageHandlers.current.has("messages_read")) {
              messageHandlers.current.get("messages_read")(data.data);
            }
            break;

          case "connection":
            console.log("Connection confirmed:", data);
            if (messageHandlers.current.has("connection")) {
              messageHandlers.current.get("connection")(data);
            }
            break;

          case "error":
            console.error("Server error:", data.data);
            if (messageHandlers.current.has("error")) {
              messageHandlers.current.get("error")(data.data);
            }
            break;

          default:
            console.log("Unhandled message type:", data.type);
            if (messageHandlers.current.has(data.type)) {
              messageHandlers.current.get(data.type)(data.data);
            }
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsConnected(false);

      if (messageHandlers.current.has("error")) {
        messageHandlers.current.get("error")({
          type: "connection_error",
          message: "WebSocket connection error",
        });
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket disconnected:", event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;

      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Notify about disconnection
      if (messageHandlers.current.has("disconnect")) {
        messageHandlers.current.get("disconnect")({
          code: event.code,
          reason: event.reason,
        });
      }

      // Attempt to reconnect with exponential backoff
      if (
        !reconnectTimeoutRef.current &&
        reconnectAttemptsRef.current < maxReconnectAttempts
      ) {
        const delay = Math.min(
          3000 * Math.pow(2, reconnectAttemptsRef.current),
          30000,
        );
        console.log(
          `Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`,
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = null;
          connect();
        }, delay);
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log(
          "Max reconnection attempts reached. Please refresh the page.",
        );
        if (messageHandlers.current.has("max_reconnect")) {
          messageHandlers.current.get("max_reconnect")();
        }
      }
    };
  }, [userId, token]);

  useEffect(() => {
    connect();

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((type, data) => {
<<<<<<< HEAD
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }));
=======
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, data });
      wsRef.current.send(message);
>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5
      console.log(`Message sent: ${type}`, data);
      return true;
    } else {
      console.log(
<<<<<<< HEAD
        `Cannot send message: WebSocket is ${ws ? ws.readyState : "undefined"}`,
=======
        `Cannot send message: WebSocket is ${wsRef.current?.readyState}`,
>>>>>>> c6e402d26fb3678188306cdd3e39c1a80b4fada5
      );

      // Queue message for when connection is restored
      if (messageHandlers.current.has("queue_message")) {
        messageHandlers.current.get("queue_message")({ type, data });
      }
      return false;
    }
  }, []);

  const on = useCallback((eventType, handler) => {
    messageHandlers.current.set(eventType, handler);
  }, []);

  const off = useCallback((eventType) => {
    messageHandlers.current.delete(eventType);
  }, []);

  const sendPrivateMessage = useCallback(
    (
      receiverId,
      content,
      clientMessageId,
      messageType = "text",
      fileUrl = null,
      voiceDuration = null,
    ) => {
      return sendMessage("private_message", {
        receiverId,
        content,
        clientMessageId,
        messageType,
        fileUrl,
        voiceDuration,
      });
    },
    [sendMessage],
  );

  const sendFriendRequest = useCallback(
    (receiverUsername, message = "") => {
      return sendMessage("friend_request", { receiverUsername, message });
    },
    [sendMessage],
  );

  const respondToFriendRequest = useCallback(
    (requestId, accept) => {
      return sendMessage("friend_request_response", { requestId, accept });
    },
    [sendMessage],
  );

  const sendTyping = useCallback(
    (receiverId, isTyping) => {
      return sendMessage("typing", { receiverId, isTyping });
    },
    [sendMessage],
  );

  const markMessagesAsRead = useCallback(
    (messageIds, conversationId) => {
      return sendMessage("mark_read", { messageIds, conversationId });
    },
    [sendMessage],
  );

  const markMessagesAsDelivered = useCallback(
    (messageIds, senderId) => {
      return sendMessage("mark_delivered", { messageIds, senderId });
    },
    [sendMessage],
  );

  const getMessages = useCallback(
    (otherUserId, limit = 50, before = null) => {
      return sendMessage("get_messages", { otherUserId, limit, before });
    },
    [sendMessage],
  );

  const getConversations = useCallback(() => {
    return sendMessage("get_conversations", {});
  }, [sendMessage]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    connect();
  }, [connect]);

  return {
    isConnected,
    messages,
    setMessages, // Expose setMessages for manual updates
    sendPrivateMessage,
    sendFriendRequest,
    respondToFriendRequest,
    sendTyping,
    markMessagesAsRead,
    markMessagesAsDelivered,
    getMessages,
    getConversations,
    reconnect,
    on,
    off,
  };
};
