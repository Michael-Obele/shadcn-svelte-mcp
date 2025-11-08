import { MCPServer } from "@mastra/mcp";
import { shadcnSvelteListTool } from "./tools/shadcn-svelte-list";
import { shadcnSvelteGetTool } from "./tools/shadcn-svelte-get";
import { shadcnSvelteIconsTool } from "./tools/shadcn-svelte-icons";
import { shadcnSvelteSearchTool } from "./tools/shadcn-svelte-search";

export const shadcn = new MCPServer({
  name: "Shadcn Svelte Docs",
  version: "1.0.20",
  description:
    "Access shadcn-svelte component documentation and guides. IMPORTANT: This is for SVELTE components only, NOT React. Do not confuse with shadcn/ui (React version).",
  tools: {
    shadcnSvelteListTool,
    shadcnSvelteGetTool,
    shadcnSvelteIconsTool,
    shadcnSvelteSearchTool,
  },
  prompts: {
    listPrompts: async () => [
      {
        name: "install-component",
        title: "Install shadcn-svelte Component",
        description:
          "Step-by-step guide to install a specific shadcn-svelte component with proper CLI usage",
        arguments: [
          {
            name: "component",
            description:
              "Name of the component to install (e.g., 'button', 'input', 'card')",
            required: true,
          },
          {
            name: "packageManager",
            description: "Package manager to use (npm, yarn, pnpm, bun)",
            required: false,
          },
        ],
      },
      {
        name: "setup-theming",
        title: "Setup Custom Theming",
        description:
          "Guide to set up custom theming and CSS variables for shadcn-svelte",
        arguments: [
          {
            name: "themeType",
            description:
              "Type of theming setup (basic, advanced, custom-colors)",
            required: false,
          },
        ],
      },
      {
        name: "cli-usage",
        title: "CLI Usage Guide",
        description: "Comprehensive guide for using shadcn-svelte CLI commands",
        arguments: [
          {
            name: "command",
            description:
              "Specific CLI command to learn about (add, init, diff, etc.)",
            required: false,
          },
        ],
      },
      {
        name: "project-init",
        title: "Initialize New Project",
        description:
          "Guide to initialize a new shadcn-svelte project from scratch",
        arguments: [
          {
            name: "projectType",
            description: "Type of project (sveltekit, vite, astro)",
            required: false,
          },
        ],
      },
    ],
    getPromptMessages: async ({ name, version, args }) => {
      switch (name) {
        case "install-component":
          const component = args?.component as string;
          const packageManager = (args?.packageManager as string) || "npm";

          if (!component) {
            throw new Error("Component name is required");
          }

          return [
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
          ];

        case "setup-theming":
          const themeType = (args?.themeType as string) || "basic";

          return [
            {
              role: "user",
              content: {
                type: "text",
                text: `I want to set up custom theming for shadcn-svelte. Please provide a guide for ${themeType} theming setup.`,
              },
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: `I'll help you set up ${themeType} custom theming for shadcn-svelte. Here's the complete guide:

## ${themeType === "basic" ? "Basic" : themeType === "advanced" ? "Advanced" : "Custom Colors"} Theming Setup

### Step 1: Update CSS Variables
${
  themeType === "basic"
    ? `Add these CSS variables to your global stylesheet (usually \`src/app.css\` or \`src/routes/+layout.svelte\`):

\`\`\`css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 84% 4.9%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 84% 4.9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;
  --radius: 0.5rem;
}
\`\`\``
    : themeType === "advanced"
      ? `For advanced theming, create a theme system with multiple color schemes:

\`\`\`css
/* Light theme */
.light {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  /* ... other variables */
}

/* Dark theme */
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... other variables */
}
\`\`\`

Then apply themes dynamically in your app.`
      : `For custom colors, define your own color palette:

\`\`\`css
:root {
  --primary: 142 76% 36%;    /* Your brand green */
  --secondary: 280 100% 70%;  /* Your accent purple */
  /* ... customize all variables */
}
\`\`\``
}

### Step 2: Apply to Components
All shadcn-svelte components will automatically use these CSS variables. No additional changes needed!

### Step 3: Dynamic Theming (Optional)
${
  themeType === "advanced"
    ? `To switch themes dynamically:

\`\`\`svelte
<script>
  let theme = $state('light');

  function toggleTheme() {
    theme = theme === 'light' ? 'dark' : 'light';
  }
</script>

<div class={theme}>
  <!-- Your app content -->
  <button onclick={toggleTheme}>Toggle Theme</button>
</div>
\`\`\``
    : `For basic theming, your colors are now applied globally.`
}

### Step 4: Testing
Test your theming by using various components like Button, Card, and Input to ensure colors look correct.

Would you like me to help you customize specific colors or set up a particular theme?`,
              },
            },
          ];

        case "cli-usage":
          const command = args?.command as string;

          return [
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
          ];

        case "project-init":
          const projectType = (args?.projectType as string) || "sveltekit";

          return [
            {
              role: "user",
              content: {
                type: "text",
                text: `I want to start a new ${projectType} project with shadcn-svelte. Please provide a complete setup guide.`,
              },
            },
            {
              role: "assistant",
              content: {
                type: "text",
                text: `I'll help you initialize a new ${projectType} project with shadcn-svelte. Here's the complete setup guide:

## Step 1: Create New ${projectType.charAt(0).toUpperCase() + projectType.slice(1)} Project

${
  projectType === "sveltekit"
    ? `\`\`\`bash
npm create svelte@latest my-app
cd my-app
npm install
\`\`\`

Choose the following options:
- Template: "Skeleton project"
- TypeScript: "Yes"
- ESLint: "Yes"
- Prettier: "Yes"`
    : projectType === "vite"
      ? `\`\`\`bash
npm create vite@latest my-app -- --template svelte
cd my-app
npm install
\`\`\`

Then install SvelteKit:
\`\`\`bash
npm install @sveltejs/kit @sveltejs/vite-plugin-svelte svelte-check
\`\`\``
      : `\`\`\`bash
npm create astro@latest my-app
cd my-app
npm install
\`\`\`

Install Svelte integration:
\`\`\`bash
npx astro add svelte
\`\`\``
}

## Step 2: Install Dependencies
Install the required packages for shadcn-svelte:
\`\`\`bash
npm install tailwindcss@latest postcss@latest autoprefixer@latest
npm install -D @tailwindcss/typography @tailwindcss/forms
\`\`\`

## Step 3: Configure Tailwind CSS
Create \`tailwind.config.js\`:
\`\`\`javascript
import { fontFamily } from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: [...fontFamily.sans],
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("@tailwindcss/forms")],
};
\`\`\`

## Step 4: Add CSS Variables
Create/update your global CSS file (\`src/app.css\`):
\`\`\`css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 94.1%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
\`\`\`

## Step 5: Initialize shadcn-svelte
Run the init command:
\`\`\`bash
npx shadcn-svelte@latest init
\`\`\`

Choose:
- Style: "Default"
- Base color: "Slate"
- CSS variables: "Yes"

## Step 6: Add Your First Component
Install a component to test your setup:
\`\`\`bash
npx shadcn-svelte@latest add button
\`\`\`

## Step 7: Test Your Setup
Create a test page/component to verify everything works:
\`\`\`svelte
<script>
  import { Button } from "$lib/components/ui/button";
</script>

<Button>Click me</Button>
\`\`\`

## Step 8: Start Development Server
\`\`\`bash
npm run dev
\`\`\`

Your ${projectType} project with shadcn-svelte is now ready! 🎉

Would you like me to help you add specific components or customize the theme further?`,
              },
            },
          ];

        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    },
  },
});
