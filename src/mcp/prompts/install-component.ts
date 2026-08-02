import { definePrompt } from "tmcp/prompt";
import * as v from "valibot";

/**
 * Prompt: Install a shadcn-svelte component
 */
export const installComponentPrompt = definePrompt(
  {
    name: "install-component",
    title: "Install shadcn-svelte Component",
    description:
      "Step-by-step guide to install a specific shadcn-svelte component with proper CLI usage",
    schema: v.object({
      component: v.pipe(
        v.string(),
        v.description(
          "Name of the component to install (e.g., 'button', 'input', 'card')",
        ),
      ),
      packageManager: v.optional(
        v.pipe(
          v.picklist(["npm", "yarn", "pnpm", "bun"]),
          v.description("Package manager to use (npm, yarn, pnpm, bun)"),
        ),
      ),
    }),
  },
  async ({ component, packageManager = "npm" }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `I want to install the "${component}" component from shadcn-svelte. Please provide a step-by-step guide using the ${packageManager} package manager.`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I'll help you install the "${component}" component from shadcn-svelte using ${packageManager}. Here's the complete process:

## Step 1: Verify Component Exists
First, let me check if the "${component}" component is available in shadcn-svelte.

## Step 2: Install the Component
Once verified, run this command in your terminal:
\`\`\`bash
${packageManager === "npm" ? "npx" : packageManager === "yarn" ? "yarn dlx" : packageManager === "pnpm" ? "pnpm dlx" : "bunx"} shadcn-svelte@latest add ${component}
\`\`\`

## Step 3: Verify Installation
After installation, you should see:
- The component files added to your \`src/lib/components/ui/\` directory
- Any required dependencies automatically installed
- TypeScript types properly configured

## Step 4: Import and Use
Import the component in your Svelte files:
\`\`\`typescript
import { ${component.charAt(0).toUpperCase() + component.slice(1)} } from "$lib/components/ui/${component}";
\`\`\`

## Troubleshooting
- If the component doesn't exist, you'll get an error message
- Make sure you're in the root directory of your SvelteKit project
- Ensure you have a \`components.json\` configuration file

Would you like me to check if the "${component}" component exists first?`,
        },
      },
    ],
  }),
);
