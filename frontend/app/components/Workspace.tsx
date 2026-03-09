import { Paper, Typography, Box, Fade, IconButton, Chip } from "@mui/material";
import { SequenceStep, SavedSequence } from "../hooks/useChat";
import { useEffect, useState, useRef } from "react";
import CloseIcon from "@mui/icons-material/Close";

interface WorkspaceProps {
  sequences: SavedSequence[];
  activeIndex: number;
  onSelectSequence: (index: number) => void;
  onMinimize?: () => void;
}

export default function Workspace({ sequences, activeIndex, onSelectSequence, onMinimize }: WorkspaceProps) {
  const sequence = sequences[activeIndex]?.steps || [];
  const [updatedSteps, setUpdatedSteps] = useState<Set<number>>(new Set());
  const prevSequenceRef = useRef<SequenceStep[]>([]);

  // Track which steps have been updated
  useEffect(() => {
    const currentStepNumbers = new Set(
      sequence.map((step) => step.step_number)
    );
    const prevStepNumbers = new Set(
      prevSequenceRef.current.map((step) => step.step_number)
    );
    const updated = new Set<number>();

    // Find steps that are new or have been modified
    currentStepNumbers.forEach((stepNumber) => {
      if (!prevStepNumbers.has(stepNumber)) {
        updated.add(stepNumber);
      }
    });

    if (updated.size > 0) {
      setUpdatedSteps(updated);
      // Reset the highlight after animation completes
      const timer = setTimeout(() => {
        setUpdatedSteps(new Set());
      }, 2000); // Match this with the animation duration

      return () => clearTimeout(timer);
    }
  }, [sequence]); // Only depend on sequence changes

  // Update the previous sequence reference
  useEffect(() => {
    prevSequenceRef.current = sequence;
  }, [sequence]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 4,
        height: "100%",
        overflowY: "auto",
        background: "transparent",
        position: "relative",
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            background: "linear-gradient(145deg, #9747FF 0%, #7B2FFF 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "titleAppear 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            "@keyframes titleAppear": {
              "0%": {
                opacity: 0,
                transform: "translateY(-10px)",
              },
              "100%": {
                opacity: 1,
                transform: "translateY(0)",
              },
            },
          }}
        >
          {sequences[activeIndex]?.title || "Generated Sequence"}
        </Typography>
        {onMinimize && (
          <IconButton
            onClick={onMinimize}
            sx={{
              color: "#9747FF",
              "&:hover": {
                background: "rgba(151, 71, 255, 0.1)",
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        )}
      </Box>
      {sequences.length > 1 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
          {sequences.map((seq, idx) => (
            <Chip
              key={idx}
              label={seq.title}
              onClick={() => onSelectSequence(idx)}
              variant={idx === activeIndex ? "filled" : "outlined"}
              sx={{
                backgroundColor: idx === activeIndex ? "rgba(151, 71, 255, 0.15)" : "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(8px)",
                borderColor: idx === activeIndex ? "rgba(151, 71, 255, 0.35)" : "rgba(255, 255, 255, 0.08)",
                color: idx === activeIndex ? "#B47FFF" : "text.secondary",
                fontWeight: idx === activeIndex ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.25s ease",
                boxShadow: idx === activeIndex ? "0 0 12px rgba(151, 71, 255, 0.1)" : "none",
                "&:hover": {
                  backgroundColor: "rgba(151, 71, 255, 0.12)",
                  borderColor: "rgba(151, 71, 255, 0.25)",
                },
              }}
            />
          ))}
        </Box>
      )}
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {sequence.length > 0 ? (
          sequence.map((step, index) => (
            <Fade
              key={step.step_number}
              in
              timeout={500}
              style={{
                transitionDelay: `${index * 100}ms`,
                transformOrigin: "0 0",
                transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  background: "rgba(255, 255, 255, 0.03)",
                  backdropFilter: "blur(12px)",
                  borderRadius: "14px",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: "0 2px 12px rgba(0, 0, 0, 0.2)",
                  position: "relative",
                  overflow: "hidden",
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "2px",
                    height: "100%",
                    background: "linear-gradient(180deg, rgba(151, 71, 255, 0.4), rgba(151, 71, 255, 0.05))",
                  },
                  animation: updatedSteps.has(step.step_number)
                    ? "stepHighlight 2s cubic-bezier(0.4, 0, 0.2, 1)"
                    : "stepAppear 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                  "@keyframes stepAppear": {
                    "0%": {
                      opacity: 0,
                      transform: "translateX(-20px) scale(0.98)",
                    },
                    "100%": {
                      opacity: 1,
                      transform: "translateX(0) scale(1)",
                    },
                  },
                  "@keyframes stepHighlight": {
                    "0%": {
                      background: "rgba(151, 71, 255, 0.1)",
                      boxShadow: "0 0 30px rgba(151, 71, 255, 0.2)",
                      borderColor: "rgba(151, 71, 255, 0.3)",
                    },
                    "100%": {
                      background: "rgba(255, 255, 255, 0.03)",
                      boxShadow: "0 2px 12px rgba(0, 0, 0, 0.2)",
                      borderColor: "rgba(255, 255, 255, 0.07)",
                    },
                  },
                  "&:hover": {
                    background: "rgba(255, 255, 255, 0.05)",
                    borderColor: "rgba(255, 255, 255, 0.12)",
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 16px rgba(151, 71, 255, 0.08)",
                  },
                }}
              >
                <Typography
                  variant="subtitle1"
                  sx={{
                    mb: 1,
                    fontWeight: 600,
                    color: "#9747FF",
                    animation: "fadeIn 0.3s ease forwards",
                    "@keyframes fadeIn": {
                      "0%": { opacity: 0 },
                      "100%": { opacity: 1 },
                    },
                  }}
                >
                  Step {step.step_number}
                </Typography>
                {step.content.split("\n\n").map((paragraph, i) => (
                  <Typography
                    key={i}
                    variant="body1"
                    sx={{
                      color: "text.primary",
                      lineHeight: 1.6,
                      mb: 2,
                      whiteSpace: "pre-line",
                      wordBreak: "break-word",
                      animation: "fadeIn 0.3s ease forwards",
                      animationDelay: `${i * 0.1}s`,
                    }}
                  >
                    {paragraph}
                  </Typography>
                ))}
              </Paper>
            </Fade>
          ))
        ) : (
          <Typography
            variant="body1"
            sx={{
              color: "text.secondary",
              textAlign: "center",
              py: 4,
              animation: "fadeIn 0.5s ease forwards",
            }}
          >
            Your generated sequences will appear here.
          </Typography>
        )}
      </Box>
    </Paper>
  );
}
