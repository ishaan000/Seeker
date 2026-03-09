"use client";

import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import Chat from "../../components/Chat";
import Workspace from "../../components/Workspace";
import ArticleIcon from "@mui/icons-material/Article";
import ChatSidebar from "../../components/ChatSidebar";
import { useChat } from "../../hooks/useChat";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useUser } from "../../hooks/useUser";
import { generatePersonalizedPrompts } from "../../utils/generatePrompts";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");
  const { messages, sequences, activeSequenceIndex, setActiveSequenceIndex, sendMessage, status } = useChat(sessionId);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(true);
  const { user } = useUser();
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const firstName = user?.name?.split(" ")[0] || "there";
    if (hour < 5) return `Burning the midnight oil, ${firstName}?`;
    if (hour < 12) return `Good morning, ${firstName}`;
    if (hour < 17) return `Good afternoon, ${firstName}`;
    if (hour < 21) return `Good evening, ${firstName}`;
    return `Night owl mode, ${firstName}?`;
  }, [user]);

  const personalizedPrompts = useMemo(
    () => (user ? generatePersonalizedPrompts(user) : undefined),
    [user]
  );

  // Debug log for sequence state
  useEffect(() => {
    console.log("Sequences state:", sequences);
  }, [sequences]);

  // Check for user authentication
  useEffect(() => {
    const user_id = localStorage.getItem("user_id");
    if (!user_id) {
      console.log("No user_id found, redirecting to intake");
      router.push("/intake");
    }
  }, [router]);

  // Auto-minimize sidebar and open workspace when sequences change
  useEffect(() => {
    if (sequences.length > 0) {
      setIsSidebarExpanded(false);
      setIsWorkspaceOpen(true);
    }
  }, [sequences]);

  const activeSequence = sequences[activeSequenceIndex];
  const hasValidSequence =
    activeSequence && activeSequence.steps.length > 0 && activeSequence.steps.some((step) => step.content);
  const showWorkspace = hasValidSequence && isWorkspaceOpen;

  return (
    <Box
      sx={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        background: "linear-gradient(145deg, #0A0A0F 0%, #0D0D1A 50%, #12121F 100%)",
        "&::before": {
          content: '""',
          position: "fixed",
          top: "-20%",
          left: "-10%",
          width: "50%",
          height: "50%",
          background: "radial-gradient(circle, rgba(151, 71, 255, 0.08) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "ambientDrift 20s ease-in-out infinite",
          pointerEvents: "none",
          zIndex: -1,
        },
        "&::after": {
          content: '""',
          position: "fixed",
          bottom: "-15%",
          right: "-10%",
          width: "45%",
          height: "45%",
          background: "radial-gradient(circle, rgba(123, 47, 255, 0.06) 0%, transparent 70%)",
          filter: "blur(100px)",
          animation: "ambientDrift 25s ease-in-out infinite reverse",
          pointerEvents: "none",
          zIndex: -1,
        },
        "@keyframes ambientDrift": {
          "0%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(5%, 8%) scale(1.05)" },
          "66%": { transform: "translate(-3%, -5%) scale(0.97)" },
          "100%": { transform: "translate(0, 0) scale(1)" },
        },
      }}
    >
      <ChatSidebar
        onSelect={(id) => router.push(`/chat?session=${id}`)}
        isExpanded={isSidebarExpanded}
        onToggleExpand={() => setIsSidebarExpanded(!isSidebarExpanded)}
      />

      <Box
        sx={{
          flex: 1,
          display: "flex",
          minWidth: 0,
          height: "100%",
          position: "relative",
        }}
      >
        <Box
          sx={{
            width: showWorkspace ? "35%" : "100%",
            minWidth: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            transition: "width 0.5s ease-in-out",
            borderRight: showWorkspace
              ? "1px solid rgba(151, 71, 255, 0.1)"
              : "none",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {messages.length === 0 && (
            <Box
              sx={{
                position: "absolute",
                top: "25%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "100%",
                textAlign: "center",
                zIndex: 1,
              }}
            >
              <Typography
                variant="h1"
                sx={{
                  background: "linear-gradient(135deg, #B47FFF 0%, #9747FF 40%, #7B2FFF 70%, #B47FFF 100%)",
                  backgroundSize: "200% 100%",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontSize: { xs: "2.5rem", sm: "3.5rem", md: "4.5rem" },
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  animation: "greetingShimmer 6s ease-in-out infinite",
                  "@keyframes greetingShimmer": {
                    "0%": { backgroundPosition: "0% 50%" },
                    "50%": { backgroundPosition: "100% 50%" },
                    "100%": { backgroundPosition: "0% 50%" },
                  },
                }}
              >
                {greeting}
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: "rgba(160, 160, 160, 0.8)",
                  mt: 1.5,
                  fontWeight: 400,
                  fontSize: { xs: "1rem", sm: "1.15rem" },
                  letterSpacing: "0.01em",
                }}
              >
                Ready to help you land your next {user?.title || "dream"} role
              </Typography>
            </Box>
          )}
          <Chat messages={messages} sendMessage={sendMessage} status={status} prompts={personalizedPrompts} />

          {hasValidSequence && !isWorkspaceOpen && (
            <Tooltip title="Show sequence" placement="left">
              <IconButton
                onClick={() => setIsWorkspaceOpen(true)}
                sx={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  zIndex: 10,
                  background: "linear-gradient(145deg, #9747FF 0%, #7B2FFF 100%)",
                  color: "white",
                  width: 40,
                  height: 40,
                  "&:hover": {
                    background: "linear-gradient(145deg, #7B2FFF 0%, #6020DD 100%)",
                  },
                }}
              >
                <ArticleIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {showWorkspace && (
          <Box sx={{ width: "65%", minWidth: 0, height: "100%", overflow: "hidden" }}>
            <Workspace
              sequences={sequences}
              activeIndex={activeSequenceIndex}
              onSelectSequence={setActiveSequenceIndex}
              onMinimize={() => setIsWorkspaceOpen(false)}
            />
          </Box>
        )}
      </Box>
    </Box>
  );
}
