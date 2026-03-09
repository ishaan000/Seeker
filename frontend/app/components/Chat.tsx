import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Fade,
  Chip,
  Link,
  Divider,
} from "@mui/material";
import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, LoadingStatus } from "../hooks/useChat";
import SendIcon from "@mui/icons-material/Send";
import SearchIcon from "@mui/icons-material/Search";
import WorkIcon from "@mui/icons-material/Work";
import BusinessIcon from "@mui/icons-material/Business";
import SchoolIcon from "@mui/icons-material/School";

/**
 * Interface defining the props for the Chat component.
 * @interface ChatProps
 * @property {ChatMessage[]} messages - Array of chat messages to display
 * @property {(content: string) => Promise<void>} sendMessage - Function to send a new message
 * @property {LoadingStatus} status - Current loading status of the chat
 */
interface ChatProps {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  status: LoadingStatus;
  prompts?: string[];
}

/**
 * Interface defining the structure of a search result.
 * @interface SearchResult
 * @property {string} name - Name of the professional
 * @property {string} [source] - Source of the search result
 * @property {string} snippet - Brief description or snippet
 * @property {string} [link] - URL to the professional's profile
 */
interface SearchResult {
  name: string;
  source?: string;
  snippet: string;
  link?: string;
}

/**
 * Example prompts to help users get started with the chat.
 * @constant {string[]}
 */
const EXAMPLE_PROMPTS = [
  "Find hiring managers at Google for Software Engineer roles",
  "Find Software Engineer jobs in San Francisco",
  "Research Google - funding, culture, and recent news",
  "Prep me for an interview at Google for a Software Engineer role",
  "What skills should I highlight for a Software Engineer role?",
  "Write an outreach sequence for the hiring manager at Google",
];

/**
 * Component to display search results in a styled box.
 * @component
 * @param {Object} props - Component props
 * @param {SearchResult[]} props.results - Array of search results to display
 * @returns {JSX.Element} Rendered search results box
 */
const SearchResultsBox = ({ results }: { results: SearchResult[] }) => {
  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        background: "rgba(151, 71, 255, 0.04)",
        backdropFilter: "blur(12px)",
        borderRadius: "14px",
        border: "1px solid rgba(151, 71, 255, 0.12)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(151, 71, 255, 0.5), transparent)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <SearchIcon sx={{ color: "#9747FF" }} />
        <Typography variant="subtitle2" sx={{ color: "#9747FF" }}>
          Search Results
        </Typography>
      </Box>
      {results.map((result, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
            {result.name}
          </Typography>
          {result.snippet && (
            <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
              {result.snippet}
            </Typography>
          )}
          {result.link && (
            <Link
              href={result.link}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: "inline-block",
                mt: 1,
                color: "#9747FF",
                textDecoration: "none",
                "&:hover": {
                  textDecoration: "underline",
                },
              }}
            >
              View Profile →
            </Link>
          )}
          {index < results.length - 1 && (
            <Divider sx={{ my: 2, borderColor: "rgba(151, 71, 255, 0.1)" }} />
          )}
        </Box>
      ))}
    </Box>
  );
};

interface JobResult {
  title: string;
  company: string;
  location: string;
  description: string;
  link: string;
  posted: string;
  schedule: string;
}

const JobResultsBox = ({ results }: { results: JobResult[] }) => {
  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        background: "rgba(71, 151, 255, 0.04)",
        backdropFilter: "blur(12px)",
        borderRadius: "14px",
        border: "1px solid rgba(71, 151, 255, 0.12)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(71, 151, 255, 0.5), transparent)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <WorkIcon sx={{ color: "#4797FF" }} />
        <Typography variant="subtitle2" sx={{ color: "#4797FF" }}>
          Job Listings
        </Typography>
      </Box>
      {results.map((job, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {job.title}
          </Typography>
          <Typography variant="body2" sx={{ color: "#9747FF", fontWeight: 500 }}>
            {job.company}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {job.location}
            {job.schedule ? ` · ${job.schedule}` : ""}
            {job.posted ? ` · ${job.posted}` : ""}
          </Typography>
          {job.description && (
            <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
              {job.description}
            </Typography>
          )}
          {job.link && (
            <Link
              href={job.link}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: "inline-block",
                mt: 1,
                color: "#4797FF",
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              View Job →
            </Link>
          )}
          {index < results.length - 1 && (
            <Divider sx={{ my: 2, borderColor: "rgba(71, 151, 255, 0.1)" }} />
          )}
        </Box>
      ))}
    </Box>
  );
};

interface CompanyResearchResult {
  section: string;
  content: string;
}

interface InterviewPrepResult {
  section: string;
  content: string;
}

const CompanyResearchBox = ({ sections }: { sections: CompanyResearchResult[] }) => {
  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        background: "rgba(0, 191, 165, 0.04)",
        backdropFilter: "blur(12px)",
        borderRadius: "14px",
        border: "1px solid rgba(0, 191, 165, 0.15)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(0, 191, 165, 0.5), transparent)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <BusinessIcon sx={{ color: "#00BFA5" }} />
        <Typography variant="subtitle2" sx={{ color: "#00BFA5" }}>
          Company Research
        </Typography>
      </Box>
      {sections.map((section, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#00BFA5", mb: 0.5 }}>
            {section.section}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "pre-line" }}>
            {section.content}
          </Typography>
          {index < sections.length - 1 && (
            <Divider sx={{ my: 1.5, borderColor: "rgba(0, 191, 165, 0.1)" }} />
          )}
        </Box>
      ))}
    </Box>
  );
};

const InterviewPrepBox = ({ sections }: { sections: InterviewPrepResult[] }) => {
  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        background: "rgba(255, 143, 0, 0.04)",
        backdropFilter: "blur(12px)",
        borderRadius: "14px",
        border: "1px solid rgba(255, 143, 0, 0.15)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(255, 143, 0, 0.5), transparent)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <SchoolIcon sx={{ color: "#FF8F00" }} />
        <Typography variant="subtitle2" sx={{ color: "#FF8F00" }}>
          Interview Prep
        </Typography>
      </Box>
      {sections.map((section, index) => (
        <Box key={index} sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "#FF8F00", mb: 0.5 }}>
            {section.section}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", whiteSpace: "pre-line" }}>
            {section.content}
          </Typography>
          {index < sections.length - 1 && (
            <Divider sx={{ my: 1.5, borderColor: "rgba(255, 143, 0, 0.1)" }} />
          )}
        </Box>
      ))}
    </Box>
  );
};

/**
 * Converts URLs in text to clickable links
 * @param {string} text - The text containing URLs to convert
 * @returns {React.ReactNode[]} Array of text and link elements
 */
const convertUrlsToLinks = (text: string): React.ReactNode[] => {
  if (!text) return [];

  // Regular expression to match URLs (including LinkedIn URLs)
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Find all URLs in the text
  const matches: { url: string; index: number }[] = [];
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    matches.push({ url: match[0], index: match.index });
  }

  // If no URLs found, return the original text
  if (matches.length === 0) return [text];

  // Create an array of text and link elements
  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((match, i) => {
    // Add text before the URL
    if (match.index > lastIndex) {
      result.push(text.substring(lastIndex, match.index));
    }

    // Format the display text for the link
    let displayText = match.url;

    // For LinkedIn URLs, show a cleaner text
    if (match.url.includes("linkedin.com")) {
      displayText = "View LinkedIn Profile";
    } else if (displayText.length > 30) {
      // For other long URLs, truncate them
      displayText = displayText.substring(0, 30) + "...";
    }

    // Add the URL as a link
    result.push(
      <Link
        key={i}
        href={match.url}
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          color: "#9747FF",
          textDecoration: "none",
          "&:hover": {
            textDecoration: "underline",
          },
        }}
      >
        {displayText}
      </Link>
    );

    lastIndex = match.index + match.url.length;
  });

  // Add any remaining text after the last URL
  if (lastIndex < text.length) {
    result.push(text.substring(lastIndex));
  }

  return result;
};

/**
 * Main Chat component that handles message display and user input.
 * Features:
 * - Real-time message display
 * - Message input with send functionality
 * - Loading state indicators
 * - Example prompts for quick start
 * - Search results display
 *
 * @component
 * @param {ChatProps} props - Component props
 * @returns {JSX.Element} Rendered chat interface
 */
export default function Chat({ messages, sendMessage, status, prompts }: ChatProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const handleSubmit = async () => {
    if (!input.trim()) return;

    const currentMessage = input;
    setInput("");

    try {
      await sendMessage(currentMessage);
    } catch (e) {
      console.error("Send failed", e);
    }
  };

  const handleExampleClick = (prompt: string) => {
    setInput(prompt);
  };

  const parseSuggestions = (content: string): string[] => {
    // Find the last block of numbered suggestions (1. 2. 3.) in the content
    const lines = content.split("\n");
    const numberedLines: string[] = [];
    let lastBlockStart = -1;

    // Walk backwards to find the last cluster of numbered lines (matches 1. or 1) style)
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^\s*\d+[.)]\s/.test(lines[i])) {
        if (lastBlockStart === -1) lastBlockStart = i;
        numberedLines.unshift(lines[i]);
      } else if (lastBlockStart !== -1) {
        // We hit a non-numbered line after finding some — block ends
        break;
      }
    }

    if (numberedLines.length < 2) return []; // Need at least 2 suggestions to show chips

    return numberedLines
      .map((line) =>
        line
          .replace(/^\s*\d+[.)]\s*/, "")
          .replace(/^[\s"'\[\]]+|[\s"'\[\]]+$/g, "")
          .trim()
      )
      .filter((line) => line.length > 0);
  };

  const stripSuggestions = (content: string): string => {
    // Strip from the lead-in line (any line ending with ?: before the numbered block) through the end
    const lines = content.split("\n");

    // Find where the last numbered block starts (matches 1. or 1) style)
    let blockStart = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (/^\s*\d+[.)]\s/.test(lines[i])) {
        blockStart = i;
      } else if (blockStart !== -1) {
        break;
      }
    }

    if (blockStart === -1) return content;

    // Also strip the lead-in line before the block (e.g., "Would you like to:", "How would you like to proceed?")
    let cutStart = blockStart;
    if (blockStart > 0) {
      const prevLine = lines[blockStart - 1].trim();
      if (prevLine.endsWith(":") || prevLine.endsWith("?")) {
        cutStart = blockStart - 1;
      }
    }

    return lines.slice(0, cutStart).join("\n").trimEnd();
  };

  const QuestionForm = ({ questions }: { questions: string[] }) => {
    const [answers, setAnswers] = React.useState<Record<number, string>>({});
    const [submitted, setSubmitted] = React.useState(false);

    const handleSubmitAnswers = async () => {
      const filledAnswers = questions
        .map((q, i) => {
          const answer = (answers[i] || "").trim();
          if (!answer) return null;
          return `${q}\n→ ${answer}`;
        })
        .filter(Boolean);

      if (filledAnswers.length === 0) return;

      setSubmitted(true);
      await sendMessage(filledAnswers.join("\n\n"));
    };

    if (submitted) return null;

    return (
      <Box
        sx={{
          mt: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          p: 2,
          borderRadius: "12px",
          background: "rgba(151, 71, 255, 0.03)",
          border: "1px solid rgba(151, 71, 255, 0.1)",
        }}
      >
        {questions.map((question, idx) => (
          <Box key={idx} sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            <Typography
              variant="body2"
              sx={{ color: "#B47FFF", fontWeight: 500, fontSize: "0.85rem" }}
            >
              {question}
            </Typography>
            <TextField
              size="small"
              placeholder="Type your answer..."
              value={answers[idx] || ""}
              onChange={(e) =>
                setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  // Move to next question or submit if last
                  if (idx === questions.length - 1) {
                    handleSubmitAnswers();
                  }
                }
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "10px",
                  fontSize: "0.875rem",
                  "& fieldset": {
                    borderColor: "rgba(151, 71, 255, 0.12)",
                  },
                  "&:hover fieldset": {
                    borderColor: "rgba(151, 71, 255, 0.25)",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "rgba(151, 71, 255, 0.4)",
                    borderWidth: "1px",
                  },
                },
                "& .MuiInputBase-input::placeholder": {
                  color: "rgba(160, 160, 160, 0.4)",
                  fontSize: "0.85rem",
                },
              }}
            />
          </Box>
        ))}
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 0.5 }}>
          <Button
            size="small"
            onClick={() => setSubmitted(true)}
            sx={{
              color: "text.secondary",
              fontSize: "0.8rem",
              textTransform: "none",
              "&:hover": { background: "rgba(255,255,255,0.05)" },
            }}
          >
            Skip
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSubmitAnswers}
            disabled={Object.values(answers).every((a) => !a?.trim())}
            sx={{
              textTransform: "none",
              fontSize: "0.8rem",
              borderRadius: "10px",
              px: 2.5,
              background: "linear-gradient(135deg, #9747FF, #7B2FFF)",
              "&:hover": {
                background: "linear-gradient(135deg, #B47FFF, #9747FF)",
              },
              "&.Mui-disabled": {
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.2)",
              },
            }}
          >
            Send answers
          </Button>
        </Box>
      </Box>
    );
  };

  const SuggestionChips = ({ content }: { content: string }) => {
    const suggestions = parseSuggestions(content);
    if (suggestions.length === 0) return null;

    // Detect if these are questions (end with ?) vs action suggestions
    const questionCount = suggestions.filter((s) => s.endsWith("?")).length;
    const isQuestions = questionCount > suggestions.length / 2;

    if (isQuestions) {
      return <QuestionForm questions={suggestions} />;
    }

    return (
      <Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
        {suggestions.map((suggestion, idx) => (
          <Chip
            key={idx}
            label={suggestion}
            onClick={() => handleExampleClick(suggestion)}
            sx={{
              backgroundColor: "rgba(151, 71, 255, 0.08)",
              backdropFilter: "blur(8px)",
              color: "#B47FFF",
              cursor: "pointer",
              border: "1px solid rgba(151, 71, 255, 0.15)",
              transition: "all 0.25s ease",
              "&:hover": {
                backgroundColor: "rgba(151, 71, 255, 0.18)",
                borderColor: "rgba(151, 71, 255, 0.35)",
                boxShadow: "0 0 16px rgba(151, 71, 255, 0.15)",
                transform: "translateY(-1px)",
              },
            }}
          />
        ))}
      </Box>
    );
  };

  const renderLoadingState = () => {
    if (!status.state) return null;

    return (
      <Box
        sx={{
          my: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          alignSelf: "flex-start",
          maxWidth: "60%",
          animation: "loadingAppear 0.3s ease forwards",
          "@keyframes loadingAppear": {
            "0%": { opacity: 0, transform: "translateY(8px)" },
            "100%": { opacity: 1, transform: "translateY(0)" },
          },
        }}
      >
        <Typography
          variant="body2"
          sx={{
            color: "#B47FFF",
            fontWeight: 500,
            fontSize: "0.85rem",
            letterSpacing: "0.02em",
          }}
        >
          {status.step || "Thinking"}
        </Typography>
        <Box
          sx={{
            height: "2px",
            borderRadius: "1px",
            background: "rgba(151, 71, 255, 0.1)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              height: "100%",
              width: "40%",
              background: "linear-gradient(90deg, transparent, #9747FF, transparent)",
              animation: "shimmerSlide 1.5s ease-in-out infinite",
              "@keyframes shimmerSlide": {
                "0%": { transform: "translateX(-100%)" },
                "100%": { transform: "translateX(350%)" },
              },
            }}
          />
        </Box>
      </Box>
    );
  };

  const parseSearchResults = (content: string): SearchResult[] | null => {
    // Check if the content contains search results
    if (!content.includes("matching your search for")) return null;

    const results: SearchResult[] = [];
    const lines = content.split("\n");
    let currentResult: Partial<SearchResult> = {};

    // Find the start of search results
    let startIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("matching your search for")) {
        startIndex = i;
        break;
      }
    }

    // Process only the search results section.
    // A valid result entry is a numbered line followed by structured detail lines
    // (Current:, Profile:, Source:). We stop as soon as we see a numbered line
    // WITHOUT those details — that means we've left the results section.
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];

      // Skip the initial count line
      if (line.includes("matching your search for")) {
        continue;
      }

      // Numbered line — check if it's a real result via look-ahead
      if (line.match(/^\d+\.\s/)) {
        let hasDetails = false;
        for (let j = i + 1; j < lines.length && j <= i + 5; j++) {
          const next = lines[j].trimStart();
          if (next.startsWith("Current:") || next.startsWith("Profile:") || next.startsWith("Source:")) {
            hasDetails = true;
            break;
          }
          // Hit another numbered line or empty gap before finding details — stop
          if (lines[j].match(/^\d+\.\s/) || (lines[j].trim() === "" && j > i + 1)) {
            break;
          }
        }
        if (!hasDetails) break; // Not a search result — stop parsing

        if (Object.keys(currentResult).length > 0) {
          results.push(currentResult as SearchResult);
        }
        currentResult = { name: line.replace(/^\d+\.\s*/, "") };
      }
      // Detail lines
      else if (line.trimStart().startsWith("Source:")) {
        currentResult.source = line.replace(/^\s*Source:/, "").trim();
      } else if (line.trimStart().startsWith("Current:")) {
        currentResult.snippet = line.replace(/^\s*Current:/, "").trim();
      } else if (line.trimStart().startsWith("Profile:")) {
        currentResult.link = line.replace(/^\s*Profile:/, "").trim();
      }
    }

    // Add the last result
    if (Object.keys(currentResult).length > 0) {
      results.push(currentResult as SearchResult);
    }

    return results.length > 0 ? results : null;
  };

  const parseJobResults = (content: string): JobResult[] | null => {
    if (!content.includes("job listings matching")) return null;

    const results: JobResult[] = [];
    const lines = content.split("\n");
    let currentJob: Partial<JobResult> = {};

    for (const line of lines) {
      // Stop at follow-up suggestions
      if (line.includes("Would you like to:")) break;

      // Numbered entry with bold title: "1. **Senior Engineer**"
      const titleMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*/);
      if (titleMatch) {
        if (currentJob.title) {
          results.push(currentJob as JobResult);
        }
        currentJob = { title: titleMatch[1], company: "", location: "", description: "", link: "", posted: "", schedule: "" };
        continue;
      }

      const trimmed = line.trim();
      if (trimmed.startsWith("Company:")) {
        currentJob.company = trimmed.replace("Company:", "").trim();
      } else if (trimmed.startsWith("Location:")) {
        currentJob.location = trimmed.replace("Location:", "").trim();
      } else if (trimmed.startsWith("Type:")) {
        currentJob.schedule = trimmed.replace("Type:", "").trim();
      } else if (trimmed.startsWith("Posted:")) {
        currentJob.posted = trimmed.replace("Posted:", "").trim();
      } else if (trimmed.startsWith("Link:")) {
        currentJob.link = trimmed.replace("Link:", "").trim();
      } else if (trimmed && !trimmed.startsWith("I found") && currentJob.title && !currentJob.description) {
        currentJob.description = trimmed;
      }
    }

    if (currentJob.title) {
      results.push(currentJob as JobResult);
    }

    return results.length > 0 ? results : null;
  };

  const parseCompanyResearch = (content: string): CompanyResearchResult[] | null => {
    if (!content.includes("**Company Overview**")) return null;

    const sections: CompanyResearchResult[] = [];
    const sectionHeaders = [
      "Company Overview",
      "Funding & Financials",
      "Recent News",
      "Company Culture",
      "Tech Stack",
      "Employee Count",
      "Why Work Here",
    ];

    for (let i = 0; i < sectionHeaders.length; i++) {
      const header = sectionHeaders[i];
      const marker = `**${header}**`;
      const startIdx = content.indexOf(marker);
      if (startIdx === -1) continue;

      const contentStart = startIdx + marker.length;
      let contentEnd = content.length;

      // Find the next section or "Would you like to:"
      for (let j = i + 1; j < sectionHeaders.length; j++) {
        const nextMarker = `**${sectionHeaders[j]}**`;
        const nextIdx = content.indexOf(nextMarker, contentStart);
        if (nextIdx !== -1) {
          contentEnd = nextIdx;
          break;
        }
      }

      const wouldLikeIdx = content.indexOf("Would you like to:", contentStart);
      if (wouldLikeIdx !== -1 && wouldLikeIdx < contentEnd) {
        contentEnd = wouldLikeIdx;
      }

      const sectionContent = content.substring(contentStart, contentEnd).trim();
      if (sectionContent) {
        sections.push({ section: header, content: sectionContent });
      }
    }

    return sections.length > 0 ? sections : null;
  };

  const parseInterviewPrep = (content: string): InterviewPrepResult[] | null => {
    if (!content.includes("**Interview Process**")) return null;

    const sections: InterviewPrepResult[] = [];
    const sectionHeaders = [
      "Interview Process",
      "Common Questions",
      "What They Look For",
      "Tips for Success",
      "Compensation Range",
    ];

    for (let i = 0; i < sectionHeaders.length; i++) {
      const header = sectionHeaders[i];
      const marker = `**${header}**`;
      const startIdx = content.indexOf(marker);
      if (startIdx === -1) continue;

      const contentStart = startIdx + marker.length;
      let contentEnd = content.length;

      for (let j = i + 1; j < sectionHeaders.length; j++) {
        const nextMarker = `**${sectionHeaders[j]}**`;
        const nextIdx = content.indexOf(nextMarker, contentStart);
        if (nextIdx !== -1) {
          contentEnd = nextIdx;
          break;
        }
      }

      const wouldLikeIdx = content.indexOf("Would you like to:", contentStart);
      if (wouldLikeIdx !== -1 && wouldLikeIdx < contentEnd) {
        contentEnd = wouldLikeIdx;
      }

      const sectionContent = content.substring(contentStart, contentEnd).trim();
      if (sectionContent) {
        sections.push({ section: header, content: sectionContent });
      }
    }

    return sections.length > 0 ? sections : null;
  };

  const renderMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];

    lines.forEach((line, i) => {
      // Bold: **text**
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      const rendered = parts.map((part, j) => {
        const boldMatch = part.match(/^\*\*(.+)\*\*$/);
        if (boldMatch) {
          return <strong key={j}>{boldMatch[1]}</strong>;
        }
        return part;
      });

      // List items: - text or * text or numbered 1. text
      const trimmed = line.trim();
      if (trimmed.match(/^[-*]\s/) || trimmed.match(/^\d+\.\s/)) {
        elements.push(
          <Box key={i} component="div" sx={{ pl: 2, py: 0.25 }}>
            {convertUrlsToLinks(rendered.map(r => (typeof r === 'string' ? r : '')).join('')).length > 1
              ? convertUrlsToLinks(line)
              : rendered}
          </Box>
        );
      } else if (line === "") {
        elements.push(<Box key={i} sx={{ height: 8 }} />);
      } else {
        // Check for URLs in the line
        const urlNodes = convertUrlsToLinks(line);
        if (urlNodes.length > 1) {
          elements.push(<span key={i}>{urlNodes}{"\n"}</span>);
        } else {
          elements.push(<span key={i}>{rendered}{"\n"}</span>);
        }
      }
    });

    return elements;
  };

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          overflowY: "auto",
          overflowX: "hidden",
          p: 4,
          "&::-webkit-scrollbar": {
            width: "8px",
          },
          "&::-webkit-scrollbar-track": {
            background: "rgba(255, 255, 255, 0.05)",
            borderRadius: "4px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "4px",
            "&:hover": {
              background: "rgba(255, 255, 255, 0.15)",
            },
          },
        }}
      >
        {messages.map((msg, i) => (
          <Fade
            key={i}
            in
            timeout={500}
            style={{
              transformOrigin: msg.sender === "ai" ? "0 0" : "100% 0",
              transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1,
                alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                animation:
                  msg.sender === "ai"
                    ? "messageAppear 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
                    : "none",
                "@keyframes messageAppear": {
                  "0%": {
                    opacity: 0,
                    transform: "translateY(10px) scale(0.98)",
                  },
                  "100%": {
                    opacity: 1,
                    transform: "translateY(0) scale(1)",
                  },
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "text.secondary",
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                  opacity: 0,
                  animation: "fadeIn 0.3s ease forwards",
                  "@keyframes fadeIn": {
                    "0%": { opacity: 0 },
                    "100%": { opacity: 1 },
                  },
                }}
              >
                {msg.sender === "user" ? "You" : "Seeker"}
              </Typography>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  background:
                    msg.sender === "user"
                      ? "linear-gradient(135deg, #9747FF 0%, #7B2FFF 60%, #6B1FEE 100%)"
                      : "rgba(255, 255, 255, 0.03)",
                  backdropFilter: msg.sender === "ai" ? "blur(16px)" : "none",
                  borderRadius: msg.sender === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  border:
                    msg.sender === "user"
                      ? "1px solid rgba(151, 71, 255, 0.3)"
                      : "1px solid rgba(255, 255, 255, 0.07)",
                  boxShadow:
                    msg.sender === "user"
                      ? "0 4px 24px rgba(151, 71, 255, 0.2)"
                      : "0 2px 12px rgba(0, 0, 0, 0.2)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                  overflow: "hidden",
                  ...(msg.sender === "ai" && {
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "2px",
                      height: "100%",
                      background: "linear-gradient(180deg, rgba(151, 71, 255, 0.4), rgba(151, 71, 255, 0.05))",
                    },
                  }),
                  "&:hover": {
                    boxShadow:
                      msg.sender === "ai"
                        ? "0 4px 20px rgba(151, 71, 255, 0.1)"
                        : "0 6px 28px rgba(151, 71, 255, 0.25)",
                    ...(msg.sender === "ai" && {
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                    }),
                  },
                }}
              >
                {msg.sender === "ai" && parseCompanyResearch(msg.content) ? (
                  <>
                    <Typography
                      variant="body1"
                      sx={{ color: "text.primary", whiteSpace: "pre-line", mb: 2 }}
                    >
                      {msg.content.split("\n\n")[0]}
                    </Typography>
                    <CompanyResearchBox sections={parseCompanyResearch(msg.content)!} />
                  </>
                ) : msg.sender === "ai" && parseInterviewPrep(msg.content) ? (
                  <>
                    <Typography
                      variant="body1"
                      sx={{ color: "text.primary", whiteSpace: "pre-line", mb: 2 }}
                    >
                      {msg.content.split("\n\n")[0]}
                    </Typography>
                    <InterviewPrepBox sections={parseInterviewPrep(msg.content)!} />
                  </>
                ) : msg.sender === "ai" && parseJobResults(msg.content) ? (
                  <>
                    <Typography
                      variant="body1"
                      sx={{ color: "text.primary", whiteSpace: "pre-line", mb: 2 }}
                    >
                      {msg.content.split("\n\n")[0]}
                    </Typography>
                    <JobResultsBox results={parseJobResults(msg.content)!} />
                  </>
                ) : msg.sender === "ai" && parseSearchResults(msg.content) ? (
                  <>
                    <Typography
                      variant="body1"
                      sx={{ color: "text.primary", whiteSpace: "pre-line", mb: 2 }}
                    >
                      {msg.content.split("\n\n")[0]}
                    </Typography>
                    <SearchResultsBox results={parseSearchResults(msg.content)!} />
                  </>
                ) : (
                  <Typography
                    variant="body1"
                    component="div"
                    sx={{
                      color: msg.sender === "user" ? "white" : "text.primary",
                      whiteSpace: "pre-line",
                    }}
                  >
                    {msg.sender === "ai"
                      ? renderMarkdown(stripSuggestions(msg.content))
                      : msg.content}
                  </Typography>
                )}
              </Paper>
              {msg.sender === "ai" && <SuggestionChips content={msg.content} />}
            </Box>
          </Fade>
        ))}
        {renderLoadingState()}
        <div ref={messagesEndRef} />
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          borderTop: "1px solid rgba(255, 255, 255, 0.06)",
          p: 2,
          background: "rgba(10, 10, 15, 0.6)",
          backdropFilter: "blur(20px)",
        }}
      >
        {messages.length === 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{ color: "rgba(160, 160, 160, 0.6)", mb: 1.5, display: "block", letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.65rem" }}
            >
              Try these to get started
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {(prompts ?? EXAMPLE_PROMPTS).map((prompt, index) => (
                <Chip
                  key={index}
                  label={prompt}
                  onClick={() => handleExampleClick(prompt)}
                  sx={{
                    backgroundColor: "rgba(151, 71, 255, 0.06)",
                    backdropFilter: "blur(8px)",
                    color: "#B47FFF",
                    border: "1px solid rgba(151, 71, 255, 0.12)",
                    transition: "all 0.25s ease",
                    "&:hover": {
                      backgroundColor: "rgba(151, 71, 255, 0.15)",
                      borderColor: "rgba(151, 71, 255, 0.3)",
                      boxShadow: "0 0 16px rgba(151, 71, 255, 0.12)",
                      transform: "translateY(-1px)",
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask Seeker something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                backdropFilter: "blur(12px)",
                borderRadius: "14px",
                transition: "all 0.3s ease",
                "& fieldset": {
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  transition: "all 0.3s ease",
                },
                "&:hover fieldset": {
                  borderColor: "rgba(151, 71, 255, 0.25)",
                },
                "&.Mui-focused": {
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  boxShadow: "0 0 24px rgba(151, 71, 255, 0.08)",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "rgba(151, 71, 255, 0.4)",
                  borderWidth: "1px",
                },
              },
              "& .MuiInputBase-input::placeholder": {
                color: "rgba(160, 160, 160, 0.5)",
              },
            }}
          />
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!input.trim()}
            sx={{
              minWidth: "44px",
              width: "44px",
              height: "44px",
              borderRadius: "14px",
              p: 0,
              background: input.trim()
                ? "linear-gradient(135deg, #9747FF 0%, #7B2FFF 100%)"
                : "rgba(255, 255, 255, 0.05)",
              border: input.trim()
                ? "1px solid rgba(151, 71, 255, 0.3)"
                : "1px solid rgba(255, 255, 255, 0.06)",
              boxShadow: input.trim()
                ? "0 0 20px rgba(151, 71, 255, 0.2)"
                : "none",
              transition: "all 0.3s ease",
              "&:hover": {
                background: "linear-gradient(135deg, #B47FFF 0%, #9747FF 100%)",
                boxShadow: "0 0 28px rgba(151, 71, 255, 0.3)",
              },
              "&.Mui-disabled": {
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.05)",
              },
            }}
          >
            <SendIcon sx={{ fontSize: 18, color: input.trim() ? "white" : "rgba(255,255,255,0.2)" }} />
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
