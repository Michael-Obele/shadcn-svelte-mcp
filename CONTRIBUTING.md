# Contributing to shadcn-svelte-mcp

Thank you for your interest in contributing to shadcn-svelte-mcp! We welcome contributions from the community and are grateful for your help in making this project better.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)
- [Reporting Issues](#reporting-issues)
- [Community](#community)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to help us maintain a welcoming and inclusive community.

## Getting Started

### Prerequisites

- Node.js >= 20.9.0
- Bun (recommended) or npm/yarn/pnpm
- Git

### Setting Up the Project

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/shadcn-svelte-mcp.git
   cd shadcn-svelte-mcp
   ```
3. Install dependencies:
   ```bash
   bun install
   ```
4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Development Commands

- `bun run dev` - Start Mastra in development mode (recommended smoke-test)
- `bun run build` - Build the Mastra project for production
- `bun run start` - Start the built Mastra server
- `bun run mcp:stdio` - Run the MCP server in stdio mode
- `bun run mcp:dev` - Run the MCP dev server

### Smoke Testing

Always run `bun run dev` for 10-15 seconds after making changes to catch early runtime errors. This is our standard smoke-test procedure.

### Project Structure

- `src/` - Mastra bootstrap, MCP servers, tools, and agents
- `src/services/` - Web scraping services for real-time documentation fetching
- `src/mastra/tools/` - Tools that expose component discovery, fetching and utilities
- `src/services/doc-fetcher.ts` - Multi-strategy documentation fetcher (Crawlee/Playwright for JS-heavy pages, Cheerio for simple pages)
- `src/services/component-discovery.ts` - Component discovery via web scraping

## Pull Request Process

1. **Ensure your code follows our guidelines**:
   - Follow Mastra tool patterns using `createTool` with proper Zod schemas
   - Use descriptive tool IDs and clear descriptions
   - Follow web scraping patterns in existing services
   - Include appropriate documentation

2. **Create a descriptive PR**:
   - Use clear, descriptive titles
   - Reference any related issues
   - Include a summary of changes
   - Add screenshots for UI changes if applicable

3. **Run the smoke test**:
   - Ensure `bun run dev` runs without errors
   - Verify all existing functionality still works

4. **Wait for review**:
   - Maintainers will review your PR
   - Address any feedback or requested changes
   - PRs require at least one approval before merging

## Code Style Guidelines

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow the existing code style and patterns
- Use meaningful variable and function names
- Include JSDoc comments for public APIs

### Tool Development

- Follow Mastra tool patterns using `createTool`:

  ```typescript
  import { createTool } from "@mastra/core/tools";
  import { z } from "zod";

  export const yourTool = createTool({
    id: "your-tool-id",
    description: "Clear description of what your tool does",
    inputSchema: z.object({
      parameter: z.string().describe("Description of parameter"),
    }),
    execute: async ({ context, input }) => {
      // Your tool logic here
      return { result: "your result" };
    },
  });
  ```

- Use descriptive tool IDs and descriptions
- Include proper Zod schemas for input validation

### Tools Development

When creating new tools, follow the pattern in existing tools:

```typescript
import { z } from "zod";
import { createTool } from "@mastra/core/tools";
import {
  fetchComponentDocs,
  fetchGeneralDocs,
} from "../../services/doc-fetcher.js";

export const yourTool = createTool({
  id: "your-tool-id",
  description: "Clear description of what your tool does and when to use it",
  inputSchema: z.object({
    // Define your input schema using Zod with descriptive parameter names
    parameter: z
      .string()
      .describe("Description of parameter and expected format"),
  }),
  outputSchema: z.object({
    // Define output structure for better type safety
    result: z.string().describe("Description of what the output contains"),
  }),
  execute: async ({ context, input }) => {
    // Use web scraping services for real-time data
    const result = await fetchComponentDocs(input.parameter);
    return { result: result.markdown || "No data found" };
  },
});
```

## Testing

### Running Tests

- `bun run test:simple` - Run the simple tools test
- `bun run test:crawlee` - Run the Crawlee-based documentation fetcher test

### Adding Tests

When adding new features, include appropriate tests:

- Unit tests for utility functions
- Integration tests for tools
- End-to-end tests for critical workflows

## Documentation

### Updating Documentation

- Update README.md for significant changes
- Add documentation for new tools in appropriate locations
- Update web scraping services if website structure changes
- Include examples and usage instructions

### Documentation Structure

- Use clear headings and sections
- Include code examples where relevant
- Document all public APIs and tools
- Keep documentation up to date with code changes
- Note that documentation is fetched in real-time from shadcn-svelte.com
- Document tool inputs and outputs clearly for AI agent usage

## Reporting Issues

### Bug Reports

When reporting bugs, please include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Step-by-step instructions to reproduce
3. **Expected Behavior**: What you expected to happen
4. **Actual Behavior**: What actually happened
5. **Environment**: OS, Node version, package manager
6. **Additional Context**: Logs, screenshots, etc.

### Feature Requests

For feature requests, please:

1. **Describe the feature**: What you'd like to see added
2. **Use case**: How this feature would be used
3. **Alternatives considered**: Any workarounds you've tried

## Community

### Getting Help

- **Issues**: Use GitHub issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for questions and community help
- **Email**: Contact support@svelte-apps.me for support questions

### Recognition

Contributors will be recognized in:

- The project's README.md
- Release notes
- GitHub contributors list

## License

By contributing to this project, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers the project.

---

Thank you for contributing to shadcn-svelte-mcp! Your efforts help make this project better for everyone.
