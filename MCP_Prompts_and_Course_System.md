# MCP Prompts System

This document describes the comprehensive prompt system for the shadcn-svelte MCP server, designed to ensure intelligent CLI command usage, prevent hallucination, and provide guided workflows.

## 1. Overview

The MCP server implements a sophisticated system that combines user-triggered guided workflows (MCP Prompts) to deliver accurate, context-aware assistance for `shadcn-svelte`.

**Key Goals:**

- **Enforce a Tool-First Approach**: All responses must be verified using MCP tools before providing commands.
- **Prevent Hallucination**: The AI cannot invent components or commands; they must exist in the official documentation.
- **Ensure CLI Intelligence**: The server always fetches current CLI documentation for accurate command suggestions.

## 2. System Architecture

The system is built on several core components that work together to provide intelligent and reliable guidance.

- **Agent Instructions (`src/mastra/agents/shadcn-svelte-agent.ts`)**: A comprehensive system prompt containing strict directives for the AI, including tool-first verification, anti-hallucination safeguards.
- **MCP Prompts (`src/mastra/mcp-server.ts`)**: User-triggered guided workflows for common `shadcn-svelte` tasks, such as installing components or setting up theming.
- **Validation System (`test-prompt-validation.js`)**: An automated testing suite to ensure the effectiveness of prompts, tool verification, and anti-hallucination measures.

## 3. MCP Prompts (Guided Workflows)

The MCP server exposes four specialized prompts that users can trigger for step-by-step assistance with common tasks.

### 3.1. `install-component`

- **Purpose**: Provides a step-by-step guide to install a specific `shadcn-svelte` component.
- **Arguments**:
  - `component` (required): The name of the component to install.
  - `packageManager` (optional): The package manager to use (npm, yarn, pnpm, bun).
- **Example**: A user triggers the prompt with `component="button"`. The AI responds with a detailed installation guide, including the exact, verified CLI command.

### 3.2. `setup-theming`

- **Purpose**: Guides the user through setting up custom theming and CSS variables.
- **Arguments**:
  - `themeType` (optional): The type of theming setup (e.g., `basic`, `advanced`).
- **Example**: A user triggers the prompt for an `advanced` theming setup. The AI provides a comprehensive guide on using CSS variables and implementing dynamic theme switching.

### 3.3. `cli-usage`

- **Purpose**: Offers a comprehensive guide for using `shadcn-svelte` CLI commands.
- **Arguments**:
  - `command` (optional): A specific CLI command to learn about (e.g., `add`, `init`).
- **Example**: A user asks for help with the `add` command. The AI provides a detailed guide with examples and troubleshooting tips, fetched from the latest documentation.

### 3.4. `project-init`

- **Purpose**: Guides the user through initializing a new `shadcn-svelte` project from scratch.
- **Arguments**:
  - `projectType` (optional): The type of project (e.g., `sveltekit`, `vite`).
- **Example**: A user wants to start a `sveltekit` project. The AI provides a complete walkthrough for setting up the project and integrating `shadcn-svelte`.

### Technical Implementation

MCP Prompts are defined with a clear structure, including name, description, and arguments. A `getPromptMessages` function generates the contextual, step-by-step guidance for the AI to deliver.

```typescript
// MCP Prompt Specification Example
{
  name: "install-component",
  title: "Install shadcn-svelte Component",
  description: "Step-by-step guide to install a specific shadcn-svelte component",
  arguments: [
    {
      name: "component",
      description: "Name of the component to install",
      required: true
    }
  ]
}
```

## 4. Core Intelligence and Safeguards

The system's reliability is built on a foundation of strict rules and intelligent processes.

### 4.1. Tool-First Verification

Before providing any response involving commands or components, the AI **must** call the appropriate MCP tool to verify the information against the official documentation. It will never rely on internal knowledge.

**Process:**

1.  User asks: "How do I add a button?"
2.  AI internally calls `shadcnSvelteGetTool(name: "button", type: "component")`.
3.  AI uses the **exact** command returned by the tool in its response.

### 4.2. Anti-Hallucination Measures

Strict rules prevent the AI from inventing information:

- If a tool call confirms a component does **not** exist, the AI will inform the user and suggest verified alternatives.
- The AI will **never** invent CLI commands, component names, or properties.
- It corrects users who mention React-specific patterns (like `asChild`) and guides them toward the correct Svelte equivalents.

**Example:**

- **User**: "How do I use the `data-grid` component?"
- **AI**: "Let me check... I couldn't find a `data-grid` component. The available table-related components are `Table` and `DataTable`. Would you like help with one of those?"

### 4.3. CLI Command Intelligence

The system ensures all CLI command suggestions are accurate and up-to-date.

1.  It **always** fetches the latest CLI documentation using `shadcnSvelteGetTool(name: "cli", type: "doc")`.
2.  It verifies a component exists before suggesting the `add` command for it.
3.  It provides correct command variations for different package managers (pnpm, npm, yarn, bun).

**Validation:**

- ✅ **Correct**: `pnpm dlx shadcn-svelte@latest add button` (from official docs)
- ❌ **Wrong**: `npx shadcn-svelte add button` (invented or outdated)

## 5. Implementation for Developers

### 5.1. Agent Instructions Structure

The core logic is defined in a structured prompt within `shadcn-svelte-agent.ts`.

```typescript
instructions: `
  ⚠️ CRITICAL DIRECTIVES ⚠️
  1. SVELTE, NOT REACT: [Strict Svelte-only rules]
  2. TOOL-FIRST APPROACH: [Verification requirements]
  3. ANTI-HALLUCINATION: [Error handling and correction rules]
  4. CLI COMMAND INTELLIGENCE: [Command validation procedures]
`;
```

### 5.2. Tool Usage Patterns

- **Component Verification**: Always wrap component-related advice in a tool call to `shadcnSvelteGetTool` to confirm existence first.
- **CLI Documentation**: Fetch `shadcnSvelteGetTool(name: "cli", type: "doc")` for any questions related to the command-line interface.

### 5.3. Error Handling

- **Component Not Found**: If a tool call fails to find a component, use `shadcnSvelteListTool` to fetch and suggest available alternatives.
- **Tool Failures**: Communicate any tool errors clearly to the user and suggest a retry or an alternative approach.

## 6. Testing and Validation

A combination of automated and manual testing ensures the system's integrity.

- **Automated Tests**: Run the validation suite with `npm run test:prompts`. Tests cover CLI doc access, component verification, non-existent component rejection, and command accuracy.
- **Manual Checklist**: For each prompt scenario, manually verify that the AI calls tools first, uses exact commands, rejects non-existent components.

## 7. Usage Examples

### Adding a Component

- **User**: "Add a button component."
- **AI**: "Great! Let's add a button. [Tool call to verify 'button'] Perfect! Use this exact command: `pnpm dlx shadcn-svelte@latest add button`."

### Non-Existent Component Query

- **User**: "How do I use the `data-grid` component?"
- **AI**: "Let me check if that component exists... [Tool call fails] I couldn't find a 'data-grid' component. Here are the available table components: `Table`, `DataTable`. Would you like help with one of these instead?"

## 8. Future Enhancements

- Advanced error recovery patterns.
- Additional specialized MCP prompts for tasks like migration or debugging.

## 9. Contributing

When modifying the prompt system:

1.  Update agent instructions in `src/mastra/agents/shadcn-svelte-agent.ts`.
2.  Update MCP prompt definitions in `src/mastra/mcp-server.ts`.
3.  Update validation tests.
4.  Run the full automated and manual testing suite.

## 10. Related Files

- `src/mastra/agents/shadcn-svelte-agent.ts`
- `src/mastra/mcp-server.ts`
- `test-prompt-validation.js`
- `MCP_ARCHITECTURE.md`
