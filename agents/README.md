# Shadcn Svelte agent — per-editor installs

One agent, packaged for every major AI editor. The body is byte-identical across the **five frontmatter agents** listed in the table below (the MCP-grounded shadcn-svelte workflow); only the frontmatter changes to match each editor's format. Keep those bodies in sync when editing — `bun run check:agents` fails CI on drift.

`agents-md-snippet.md` is the one deliberate exception: it is a task-scoped `###` section meant to be appended to `AGENTS.md` / `GEMINI.md`, so it is intentionally a different shape and is **exempt** from that check.

**Prerequisite:** configure the shadcn-svelte MCP and keep the server named `shadcn-svelte` so tool bindings like `shadcn-svelte/*` resolve. See the repo [README → Connect](../README.md#connect-30-seconds).

## Where each file goes

| Editor / CLI                                            | Destination                                                                                           | Source file                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------- |
| VS Code (Copilot custom agent)                          | `.github/agents/shadcn-svelte.agent.md` (workspace) or your profile's `agents/` folder (all projects) | `vscode-shadcn-svelte.agent.md` |
| Claude Code (subagent) — VS Code also reads this folder | `.claude/agents/shadcn-svelte.md` (project) or `~/.claude/agents/shadcn-svelte.md` (all projects)     | `claude-shadcn-svelte.md`       |
| Cursor (project rule)                                   | `.cursor/rules/shadcn-svelte.mdc`                                                                     | `cursor-shadcn-svelte.mdc`      |
| Windsurf / Devin (workspace rule)                       | `.windsurf/rules/shadcn-svelte.md` — Devin Desktop prefers `.devin/rules/`                            | `windsurf-shadcn-svelte.md`     |
| OpenCode (selectable agent)                             | `.opencode/agents/shadcn-svelte.md` or `~/.config/opencode/agents/shadcn-svelte.md`                   | `opencode-shadcn-svelte.md`     |
| Zed (always-on instructions)                            | project `AGENTS.md` or `~/.config/zed/AGENTS.md`                                                      | `agents-md-snippet.md`          |
| Codex, Amp, and other AGENTS.md readers                 | `AGENTS.md` at the repo root                                                                          | `agents-md-snippet.md`          |
| Gemini CLI (context file)                               | `GEMINI.md` at the repo root or `~/.gemini/GEMINI.md`                                                 | `agents-md-snippet.md`          |

## Install

The copy-pasteable install block lives in exactly one place — the repo root [README → Agent](../README.md#agent). It is the canonical copy; this file deliberately does not repeat it, so the two can't drift.

```bash
# Full install block (all six editors):
open https://github.com/Michael-Obele/shadcn-svelte-mcp#agent

# Or, from a local clone, copy the file for your editor straight across:
cp agents/vscode-shadcn-svelte.agent.md <your-project>/.github/agents/shadcn-svelte.agent.md
```

## Format notes (verified against official docs)

- **VS Code** — `.agent.md` in `.github/agents/` (or the profile `agents/` folder). Frontmatter: `description`, `name`, `tools` (arrays; MCP tools via `<server>/*`, e.g. `shadcn-svelte/*`), `model`, `argument-hint`. VS Code also detects `.claude/agents/*.md`, so the Claude file works in both. Docs: <https://code.visualstudio.com/docs/agent-customization/custom-agents>
- **Claude Code** — plain `.md` in `.claude/agents/` or `~/.claude/agents/`; `name` + `description` required, body becomes the system prompt. Omitting `tools` inherits all tools (including MCP). Docs: <https://code.claude.com/docs/en/subagents>
- **Cursor** — `.mdc` files in `.cursor/rules/` with `description` / `globs` / `alwaysApply`. Description-only (this file) = agent-requested: Cursor attaches it when relevant. Docs: <https://cursor.com/docs/rules>
- **Windsurf / Devin** — `.md` files in `.windsurf/rules/` (`.devin/rules/` preferred on Devin Desktop) with `trigger: always_on | model_decision | glob | manual`. This file uses `model_decision`. Docs: <https://docs.windsurf.com/windsurf/cascade/memories>
- **OpenCode** — `.md` files in `.opencode/agents/` with `description` + `mode: primary | subagent | all`; filename becomes the agent id. Docs: <https://opencode.ai/docs/agents/>
- **Zed** — no custom agent files; always-on context comes from instructions (`AGENTS.md`, `.github/copilot-instructions.md`, `CLAUDE.md`, …) and reusable workflows from Skills (`~/.agents/skills/`, `.agents/skills/`). Paste this snippet into `AGENTS.md`, or install the skill below. Docs: <https://zed.dev/docs/ai/instructions>
- **Gemini CLI** — context file `GEMINI.md` (project root / `~/.gemini/GEMINI.md`); add `"AGENTS.md"` to `context.fileName` in `settings.json` to read both. Docs: <https://geminicli.com/docs/cli/gemini-md/>

## Pairing with the skill

The deeper design guidance (visual direction, UI rules, MCP workflow) lives in the skill — install both for full coverage. See the repo [README → Skill](../README.md#skill) for the install command and the note on installing it in Zed.
