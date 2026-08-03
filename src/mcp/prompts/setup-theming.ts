import { definePrompt } from "tmcp/prompt";
import * as v from "valibot";

/**
 * Prompt: Setup custom theming for shadcn-svelte
 */
export const setupThemingPrompt = definePrompt(
  {
    name: "setup-theming",
    title: "Setup Custom Theming",
    description:
      "Guide to set up custom theming and CSS variables for shadcn-svelte",
    schema: v.object({
      themeType: v.optional(
        v.pipe(
          v.picklist(["basic", "advanced", "custom-colors"]),
          v.description("Type of theming setup (basic, advanced, custom-colors)"),
        ),
        "basic",
      ),
    }),
  },
  async ({ themeType = "basic" }) => ({
    messages: [
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
    ],
  }),
);
