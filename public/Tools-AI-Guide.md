# Tools AI — Feature Guide

## 1. Profile Setup (First Launch)

**What it is:** When you first open Tools AI, a setup screen asks what kind of work you do. It recommends a curated set of extensions, settings, and AI defaults for your workflow.

**How to use it:**
- Opens automatically on first launch
- Click a profile card to expand it and see every extension it includes
- Each extension shows what it does and why it's included
- Click "Set up this profile" to install everything
- Or type freely (e.g. "I'm a PhD student doing NLP research") and AI recommends a profile
- Switch profiles anytime: click the profile name in the bottom-left status bar

**Available profiles:** Web Developer, Researcher, Vibe Coder, Student, Founder, Data Scientist, AI Researcher, Designer


## 2. AI Builder

**What it is:** Multi-model AI orchestration. Send your coding task to up to 5 AI models simultaneously (Claude, GPT-4o, Gemini, Grok, Perplexity). They work in parallel, share context, and refine each other's output.

**How to use it:**
- Click "AI Builder" in the status bar, or press Cmd+Shift+A
- Three modes:
  - **Parallel:** All models work on the same task simultaneously, then refine with shared context
  - **Hierarchy:** One model plans, others execute sub-tasks, master synthesizes
  - **Master Planner:** Chat with AI to plan your task before executing
- Type your task, pick which models to use, and click Run
- Results are automatically written to your workspace files
- Uses Cursor-style diff review — accept or reject each file change


## 3. Live Preview

**What it is:** A built-in HTTP server that serves your project with a floating AI edit overlay. Edit your site visually by describing changes in plain English.

**How to use it:**
- Click "Live Preview" in the status bar, or press Cmd+Shift+L
- Your project opens in the browser at localhost:9173
- Click the floating button (bottom-right corner) to open the edit panel
- Type a change (e.g. "make the background red") and click Apply
- AI updates your actual source files and the page reloads


## 4. Smart Terminal

**What it is:** A terminal that works exactly like zsh but understands natural language. Type shell commands normally. Type naturally to talk to AI. It knows about your project, your files, and all Tools AI features.

**How to use it:**
- Click "AI Terminal" in the status bar, or Cmd+Shift+T
- Prompt looks like normal zsh: `dylanwain@Dylans-Laptop project %`

**Shell commands (work normally):**
```
ls
git status
npm install
python3 script.py
```

**AI commands (just type naturally):**
```
what files are in this project
explain this error
open ai builder
build a landing page
create a React component for user login
```

**How it decides:** If the first word is a known shell command (ls, git, npm, etc.), it runs in the shell. Everything else goes to AI.

**Code generation:** When you ask it to build/create something, it writes the files directly to your workspace and opens them in the editor. You'll see green `+ filename` lines confirming what was created.

**IDE integration:** The AI can open Tools AI features for you. Say "open ai builder", "open the meetings", "start recording", "change profile", etc.

**Force shell mode:** Prefix with `!` to force a command to run in the shell (e.g. `!open something`).


## 5. Meeting Recorder

**What it is:** Records audio from your meetings, transcribes with Whisper, and extracts actionable tasks using Claude. Tasks can be executed against your codebase.

**How to use it:**
- Click "Record Meeting" in the status bar to start/stop
- After recording stops, transcription and analysis happen automatically
- Click a meeting in the Meetings sidebar (microphone icon in activity bar) to see:
  - Summary and main points
  - Actionable items extracted from the conversation
  - Full timestamped transcript
- Click "Open task runner" on any meeting to execute tasks against your code
- Use the chat in the task runner to refine which tasks to run (e.g. "just do #1 and #3")

**Note for developers:** If the Record Meeting button isn't visible in the status bar, open the terminal and type: `start recording`


## 6. Context Library

**What it is:** Upload files that get injected into every AI prompt as context. Drop in a design spec, API docs, or a reference codebase, and all AI features will reference them.

**How to use it:**
- Click the book icon in the activity bar (left sidebar)
- Click the + button to add files
- Supported: code, text, data files (CSV, JSON), PDFs, markdown
- Per-file limit: 200KB. Total budget: 400KB (~100K tokens)
- Click the lightbulb icon to "Analyze & Suggest" — AI compares your uploaded files against your workspace and proposes concrete changes
- Files persist across sessions

**How context flows:**
- AI Builder uses it when generating code
- Live Preview uses it when editing
- Meeting task execution uses it
- Terminal AI uses it (reads your workspace files)


## 7. Terminal Healing Loop

**What it is:** When AI Builder or the task executor writes code, it automatically runs a verify command (build, type-check, or test). If verification fails, it reads the error, fixes the code, and retries — up to 3 times.

**How it works:**
- After AI writes files, it auto-detects the best verify command:
  - Node.js: `npx tsc --noEmit` (fast) or `npm test`
  - Python: `pytest`, `ruff`, `mypy`
  - Rust: `cargo check`
  - Go: `go build`
- If the command fails, AI reads the error output and generates a fix
- Repeats up to 3 times
- You see each attempt in the terminal with the error and fix

**Settings:**
- `toolsAI.terminal.autoVerify`: enable/disable (default: on)
- `toolsAI.terminal.commandAllowlist`: add custom auto-approved commands
- `toolsAI.terminal.commandDenylist`: add commands to always block


## 8. Inline Diff Review

**What it is:** Cursor-style accept/reject for AI-generated code changes. When AI writes files, you review each change before it's applied.

**How to use it:**
- After AI Builder or task execution generates code, a diff view opens
- Shows the original file vs. proposed changes side by side
- Status bar shows "N files to review"
- Press Tab to accept the current file, Esc to reject
- Or use "Accept All" / "Reject All"
- Changes only write to disk when you accept


## 9. Command Safety Gate

**What it is:** A safety system that decides which shell commands AI can auto-run and which need your approval.

**Auto-approved:** npm/yarn install/test, python/pip, cargo, go, git (read-only), ls, pwd, echo

**Always blocked:** `rm -rf /`, `sudo`, `curl | sh`, `git push --force`, `shutdown`, fork bombs

**Prompted:** Everything else — you see the command and choose "Run once", "Always allow in this workspace", or "Block"


## 10. Profile Switching

**What it is:** Switch between different IDE configurations instantly. Each profile installs/removes extensions and changes settings.

**How to use it:**
- Click the profile name in the bottom-left status bar (e.g. "Web Developer")
- A dropdown shows all 8 profiles with their extensions listed
- Select one — old profile's unique extensions are removed, new ones installed
- Settings update immediately (font size, minimap, line numbers, etc.)
- Or use Cmd+Shift+P > "Change Profile"


## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+Shift+A | Open AI Builder |
| Cmd+Shift+L | Open Live Preview |
| Cmd+Shift+T | Open AI Terminal |
| Cmd+Shift+P | Command Palette |
| Tab | Accept current diff |
| Esc | Reject current diff |


## Status Bar (bottom)

From left to right:
- **Profile name** — click to switch profiles
- **Record Meeting** — click to start/stop recording
- **Live Preview** — click to open preview server
- **AI Builder** — click to open orchestration panel
- **Meetings** — click to view meeting history
- **Sign in / Plan info** — shows trial status or current plan
