/**
 * Voice "Companion" config — ported VERBATIM from the shipped Veronum
 * Bridge (veronum-chat-localhost/server.js). This is the proven prompt +
 * tool set that the deployed voice talking used; do not rewrite it.
 *
 * The Companion is a hands-free dispatcher: the user speaks, it forwards
 * their words to the active chat. Tool calls come back over the WebRTC
 * data channel and the browser dispatches them to /api/voice/* handlers.
 */

// GA Realtime API. Model name + voice match what the deployed voice used.
export const REALTIME_MODEL = "gpt-realtime";
export const REALTIME_VOICE = "marin";

export function companionInstructions(): string {
  // Static-ish system prompt for the Companion. Kept short because
  // Realtime sessions are sensitive to long instructions (latency).
  return [
    "You are a hands-free voice dispatcher for the user's Veronum chat. The user's hands are busy. Your job is to FORWARD what they say to their chat.",
    "",
    "DEFAULT BEHAVIOR — for ANYTHING the user says, treat it as a prompt to forward:",
    "  1. SPEAK FIRST: say out loud what you're about to send, in the form: 'Sending: <the prompt>.' Use the user's own words — do NOT translate, do NOT paraphrase beyond minor grammar cleanup, do NOT add anything.",
    "  2. THEN call submit_to_claude with that same prompt text.",
    "",
    "The user MUST hear what you're sending before the tool call, every time. This is non-negotiable. If you call submit_to_claude without speaking the 'Sending: ...' announcement first, you have failed.",
    "",
    "ONLY skip submit_to_claude when the user EXPLICITLY invokes one of these by name:",
    "  - 'summarize the reply' / 'read me the last reply' → call summarize_claude_response",
    "  - 'what was my first message' / 'my last message' / 'how many messages' / 'find <X> in my history' → call query_session_history with the matching action",
    "  - 'search the web for <X>' / 'google <X>' → call web_search",
    "Everything else — questions, requests, ideas, complaints, observations, 'can you' / 'please' / 'I want' — goes to submit_to_claude. Never treat a chat question as a history query.",
    "",
    "OTHER RULES:",
    "- Do NOT greet yourself or say your name. Stay silent on connect.",
    "- After dispatching, stay quiet until the user speaks again or you receive a 'CHAT_FINISHED: <text>' system message — then give a 1-2 sentence summary.",
    "- Never echo the user's words back as a question. If you didn't catch what they said, say 'sorry, again?' — don't paraphrase to confirm.",
  ].join("\n");
}

// Function tool definitions handed to OpenAI Realtime via session.update.
// The browser implements these as data-channel event handlers that POST
// to the matching /api/voice/* endpoint and push the result back.
export const COMPANION_TOOLS = [
  {
    type: "function",
    name: "submit_to_claude",
    description:
      "Forward a prompt to the user's currently-active Veronum chat as if they typed it. Use this for any request, question, or instruction the user speaks. The prompt should be the full request in clean text.",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The full prompt to forward to the chat.",
        },
      },
      required: ["prompt"],
    },
  },
  {
    type: "function",
    name: "summarize_claude_response",
    description:
      "Return the text of the most recent reply in the current chat so you can summarize it aloud. Call this when the user asks 'what did it say' or 'summarize that'.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "query_session_history",
    description:
      "Query the current chat's history for facts: the first message, message count, or a search. Use for 'what was my first message', 'how many messages', or 'when did I ask about X'.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["first", "last", "count", "nth", "list", "grep"],
          description:
            "Which query to run. 'first' = opening message, 'last' = most recent user message, 'nth' with n = a specific index, 'count' = total, 'list' = enumerate, 'grep' = search by regex.",
        },
        n: {
          type: "integer",
          description: "Index for 'nth' (1-based) or limit for 'list' (default 10).",
        },
        pattern: { type: "string", description: "Regex pattern for 'grep'." },
      },
      required: ["action"],
    },
  },
  {
    type: "function",
    name: "web_search",
    description:
      "Search the web and return a synthesized answer. Use when the user asks you to look something up, research a topic, or find current information.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query." },
      },
      required: ["query"],
    },
  },
] as const;
