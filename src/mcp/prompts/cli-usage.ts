import { definePrompt } from "tmcp/prompt";
import * as v from "valibot";

/**
 * Prompt: Comprehensive guide for using shadcn-svelte CLI commands
 */
export const cliUsagePrompt = definePrompt(
  {
    name: "cli-usage",
    title: "CLI Usage Guide",
    description: "Comprehensive guide for using shadcn-svelte CLI commands",
    schema: v.object({
      command: v.optional(
        v.pipe(
          v.string(),
          v.description(
            "Specific CLI command to learn about (add, init, diff, etc.)",
          ),
        ),
      ),
    }),
  },
  async ({ command }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `I need help with shadcn-svelte CLI commands${command ? `, specifically the "${command}" command` : ""}. Please provide usage guidance.`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I'll help you with shadcn-svelte CLI usage${command ? ` for the "${command}" command` : ""}. Here's the comprehensive guide:

## Available CLI Commands

### \`init\` - Initialize shadcn-svelte
Sets up your project with the necessary configuration:
\`\`\`bash
npx shadcn-svelte@latest init
\`\`\`
This creates \`components.json\` and sets up your project structure.

### \`add\` - Add components
${
  command === "add"
    ? `**Detailed guide for the "add" command:**

The \`add\` command installs components from the shadcn-svelte registry:

\`\`\`bash
npx shadcn-svelte@latest add [component-name]
\`\`\`

**Examples:**
\`\`\`bash
# Add a single component
npx shadcn-svelte@latest add button

# Add multiple components
npx shadcn-svelte@latest add button input card

# Add with specific package manager
npx shadcn-svelte@latest add button --yes
\`\`\`

**Options:**
- \`--yes\`: Skip confirmation prompts
- \`--overwrite\`: Overwrite existing files
- \`--path\`: Custom installation path

**What it does:**
1. Fetches component code from the registry
2. Installs any required dependencies
3. Creates component files in \`src/lib/components/ui/\`
4. Updates TypeScript types if needed

**Troubleshooting:**
- Make sure you're in a SvelteKit project root
- Check that \`components.json\` exists (run \`init\` first)
- Verify component name spelling`
    : `Add components to your project:
\`\`\`bash
npx shadcn-svelte@latest add button
npx shadcn-svelte@latest add input card dialog
\`\`\``
}

### \`diff\` - Show changes
Compare your components with the latest versions:
\`\`\`bash
npx shadcn-svelte@latest diff button
\`\`\`

### \`migrate\` - Migrate components
Update components to newer versions:
\`\`\`bash
npx shadcn-svelte@latest migrate button
\`\`\`

## Package Manager Support
Works with npm, yarn, pnpm, and bun:
\`\`\`bash
# npm
npx shadcn-svelte@latest add button

# yarn
yarn dlx shadcn-svelte@latest add button

# pnpm
pnpm dlx shadcn-svelte@latest add button

# bun
bunx shadcn-svelte@latest add button
\`\`\`

## Configuration
Your \`components.json\` file controls:
- Component installation path
- CSS variables location
- TypeScript configuration
- Package manager preference

${command ? `Would you like more details about the "${command}" command or help with another command?` : "Which command would you like me to explain in more detail?"}`,
        },
      },
    ],
  }),
);
