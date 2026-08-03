import { definePrompt } from "tmcp/prompt";
import * as v from "valibot";

/**
 * Prompt: Initialize a new shadcn-svelte project from scratch
 */
export const projectInitPrompt = definePrompt(
  {
    name: "project-init",
    title: "Initialize New Project",
    description: "Guide to initialize a new shadcn-svelte project from scratch",
    schema: v.object({
      projectType: v.optional(
        v.pipe(
          v.picklist(["sveltekit", "vite", "astro"]),
          v.description("Type of project (sveltekit, vite, astro)"),
        ),
        "sveltekit",
      ),
    }),
  },
  async ({ projectType = "sveltekit" }) => ({
    messages: [
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
    ],
  }),
);
