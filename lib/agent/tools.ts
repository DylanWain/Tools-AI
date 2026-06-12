/**
 * Agent tool definitions — the contract shared by the server step
 * endpoint and the client executor.
 *
 * Modeled directly on Claude Code's tool set (read from the real
 * @anthropic-ai/claude-agent-sdk on disk): Read / Edit / Write /
 * Grep / Glob / Bash. Same input shapes — notably Edit is
 * { file_path, old_string, new_string }, the exact contract Claude
 * Code uses.
 *
 * The schemas are provider-neutral JSON Schema. The step endpoint
 * translates them into each provider's tool format (Anthropic
 * `tools`, OpenAI `functions`, Gemini `functionDeclarations`). The
 * client executes a returned tool call against the user's workspace —
 * the desktop bridge when available (live disk), the in-memory
 * project map otherwise.
 */

export type ToolName = "read_file" | "edit_file" | "write_file" | "grep" | "glob" | "bash";

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: string; description: string }>;
  required: string[];
};

export type ToolDef = {
  name: ToolName;
  description: string;
  input_schema: JsonSchema;
};

/** Which tools require an explicit user OK in accept-skip mode.
 *  Reads and searches are side-effect-free → always auto-run. Writes
 *  and shell commands mutate the workspace → gated unless bypass. */
export const MUTATING_TOOLS: ReadonlySet<ToolName> = new Set(["edit_file", "write_file", "bash"]);

export const AGENT_TOOLS: ToolDef[] = [
  {
    name: "read_file",
    description:
      "Read the full contents of a file in the workspace. Use before editing so you match existing code style and have exact text to replace.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative path, e.g. components/chat/CompareChat.tsx" },
      },
      required: ["path"],
    },
  },
  {
    name: "edit_file",
    description:
      "Replace an exact substring in a file. old_string must appear EXACTLY once and match including whitespace. For new files use write_file instead.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative path to the file to modify" },
        old_string: { type: "string", description: "The exact text to replace (must be unique in the file)" },
        new_string: { type: "string", description: "The replacement text (must differ from old_string)" },
      },
      required: ["path", "old_string", "new_string"],
    },
  },
  {
    name: "write_file",
    description:
      "Create a new file or overwrite an existing one with the given content. Prefer edit_file for changing part of an existing file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Workspace-relative path to write" },
        content: { type: "string", description: "Full file content" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "grep",
    description: "Search the workspace for a regular expression. Returns matching lines with their file path and line number.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regular expression to search for" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "glob",
    description: "List workspace files matching a glob pattern, e.g. **/*.tsx or lib/**/*.ts.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern, e.g. **/*.ts" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "bash",
    description:
      "Run a shell command in the workspace root (desktop app only). Use for git (add/commit/push), running tests, or builds. Does NOT work in the browser — read/edit/write do.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to run, e.g. git add -A && git commit -m 'fix'" },
      },
      required: ["command"],
    },
  },
];

export const AGENT_SYSTEM_PROMPT = `You are Veronum's coding agent. You edit the user's actual project files through tools and can run shell commands (including git) in the desktop app.

Rules:
- Before editing a file, read_file it so your old_string matches exactly.
- Make the smallest change that satisfies the request. Match surrounding code style.
- Prefer edit_file for changes to existing files; write_file only for new files.
- When the task is done, stop calling tools and give a 1-2 sentence summary of what you changed.
- For git: only commit/push when the user explicitly asks. Use clear conventional-commit messages.
- If a tool returns an error, read the error and adjust — don't repeat the same call.`;
