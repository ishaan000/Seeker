import { useState, useEffect, useRef } from "react";
import { sendChatMessage } from "../utils/api";
import io from "socket.io-client";

const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001");

export interface ChatMessage {
  sender: "user" | "ai";
  content: string;
  timestamp?: string;
}

export interface SequenceStep {
  step_number: number;
  content: string;
}

export interface SavedSequence {
  title: string;
  steps: SequenceStep[];
}

export type LoadingStatus = {
  state: "thinking" | "generating" | "processing" | null;
  step?: string;
};

function getLoadingMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("find") && (lower.includes("job") || lower.includes("position") || lower.includes("role"))) {
    return "Searching for jobs";
  }
  if (lower.includes("find") && (lower.includes("hiring") || lower.includes("recruiter") || lower.includes("manager") || lower.includes("people"))) {
    return "Searching for people";
  }
  if (lower.includes("research") || lower.includes("tell me about") || lower.includes("what do you know about")) {
    return "Researching company";
  }
  if (lower.includes("interview") || lower.includes("prep")) {
    return "Preparing interview materials";
  }
  if (lower.includes("outreach") || lower.includes("sequence") || lower.includes("write")) {
    return "Crafting your message";
  }
  if (lower.includes("skill")) {
    return "Analyzing skills";
  }
  return "Thinking";
}

export const useChat = (sessionId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sequences, setSequences] = useState<SavedSequence[]>([]);
  const [activeSequenceIndex, setActiveSequenceIndex] = useState(0);
  const [status, setStatus] = useState<LoadingStatus>({ state: null });
  const isSendingRef = useRef(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(
    sessionId
  );

  // Update currentSessionId when sessionId prop changes
  useEffect(() => {
    setCurrentSessionId(sessionId);
  }, [sessionId]);

  // Create a new session if needed
  const createSession = async () => {
    try {
      const user_id = localStorage.getItem("user_id");
      if (!user_id) throw new Error("No user_id found");

      const res = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"
        }/sessions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id,
            session_title: "New Chat",
          }),
        }
      );

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Failed to create session: ${error}`);
      }

      const data = await res.json();
      setCurrentSessionId(data.session_id);
      return data.session_id;
    } catch (error) {
      console.error("Error creating session:", error);
      throw error;
    }
  };

  // 🔄 Fetch existing messages and sequence on session change
  useEffect(() => {
    if (!currentSessionId) return;

    // Skip reset/fetch if we're in the middle of sending (new session was just created)
    if (isSendingRef.current) return;

    // Clear stale data from previous session immediately
    setMessages([]);
    setSequences([]);
    setActiveSequenceIndex(0);
    setStatus({ state: null });

    const fetchData = async () => {
      try {
        // Fetch messages
        const messagesRes = await fetch(
          `${
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"
          }/sessions/${currentSessionId}/messages`
        );
        if (!messagesRes.ok) throw new Error("Failed to fetch messages");
        const messagesData = await messagesRes.json();
        setMessages(messagesData);

        // Fetch sequence
        const sequenceRes = await fetch(
          `${
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"
          }/sequence/${currentSessionId}`
        );
        if (sequenceRes.ok) {
          const groupedData = await sequenceRes.json();
          if (groupedData.length > 0) {
            setSequences(groupedData.map((g: { title: string; steps: SequenceStep[] }) => ({
              title: g.title,
              steps: g.steps
            })));
            setActiveSequenceIndex(groupedData.length - 1);
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [currentSessionId]);

  // 🔔 WebSocket listener for sequence updates
  useEffect(() => {
    if (!currentSessionId) return;

    const handleSequenceUpdate = (data: {
      session_id: string;
      sequences: Array<{ title: string; steps: SequenceStep[] }>;
    }) => {
      if (data.session_id === currentSessionId) {
        // Skip during sends — sendMessage handles new sequences via API response
        if (isSendingRef.current) return;
        if (data.sequences && data.sequences.length > 0) {
          setSequences(data.sequences.map((g) => ({ title: g.title, steps: g.steps })));
        }
      }
    };

    socket.on("sequence_updated", handleSequenceUpdate);
    return () => {
      socket.off("sequence_updated", handleSequenceUpdate);
    };
  }, [currentSessionId]);

  const sendMessage = async (content: string) => {
    try {
      // Set sending flag before createSession so the session-change effect
      // doesn't wipe our optimistic message when a new session is created
      isSendingRef.current = true;

      // Create a new session if none exists
      const sessionIdToUse = currentSessionId || (await createSession());
      if (!sessionIdToUse) throw new Error("Failed to create or get session");

      setMessages((prev) => [...prev, { sender: "user", content }]);
      setStatus({ state: "thinking", step: getLoadingMessage(content) });

      const data = await sendChatMessage(content, sessionIdToUse);
      isSendingRef.current = false;

      if (data.sequences && data.sequences.length > 0) {
        // Backend returns all grouped sequences — use them directly
        const newSequences: SavedSequence[] = data.sequences.map((g: { title: string; steps: SequenceStep[] }) => ({
          title: g.title,
          steps: g.steps
        }));
        setSequences(newSequences);
        setActiveSequenceIndex(newSequences.length - 1);
      }

      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (
          lastMessage?.sender === "ai" &&
          lastMessage?.content === data.response
        ) {
          return prev;
        }
        return [...prev, { sender: "ai", content: data.response }];
      });
      setStatus({ state: null });
    } catch (error) {
      console.error("Error sending message:", error);
      isSendingRef.current = false;
      setStatus({ state: null });
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          content: "I apologize, but I encountered an error. Please try again.",
        },
      ]);
    }
  };

  return {
    messages,
    sequences,
    activeSequenceIndex,
    setActiveSequenceIndex,
    status,
    sendMessage,
  };
};
