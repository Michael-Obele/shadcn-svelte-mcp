#!/usr/bin/env bun
/**
 * Unit tests for the two pure cores that decide what an agent is told:
 * registry metadata extraction and catalog search ranking.
 *
 * Deliberately network-free and fixture-based. Both cores are pure functions
 * over data the registry/catalog already hold, so they can be asserted exactly
 * — which matters because these fields are copied straight into generated code.
 * A wrong `importPath` or `dependencies` list produces code that does not build,
 * and a wrong ranking produces a confidently wrong component choice.
 *
 * Fixtures below are trimmed copies of the real payloads served from
 * shadcn-svelte.com/registry/{button,sonner}.json and the published component
 * descriptions.
 */

import { expect, test } from "bun:test";
import {
  extractSizes,
  extractVariants,
  extractVariantAxes,
  registryDependenciesOf,
  registryExports,
  registryImportPath,
  stripApiReference,
  type RegistryItem,
} from "../src/mcp/tools/utils/shadcn-utils.js";
import {
  buildIndex,
  queryTerms,
  searchOnce,
} from "../src/services/catalog-search.js";
import type { CatalogItem } from "../src/services/catalog.js";

/* ------------------------------------------------------------------ */
/* Registry metadata                                                    */
/* ------------------------------------------------------------------ */

const buttonRegistry = {
  name: "button",
  type: "registry:ui",
  devDependencies: ["tailwind-variants@^3.2.2"],
  files: [
    {
      type: "registry:file",
      target: "button/button.svelte",
      content: `<script lang="ts" module>
\texport const buttonVariants = tv({
\t\tvariants: {
\t\t\tvariant: {
\t\t\t\tdefault: "bg-primary text-primary-foreground hover:bg-primary/90",
\t\t\t\tdestructive:
\t\t\t\t\t"bg-destructive hover:bg-destructive/90 dark:bg-destructive/60",
\t\t\t\toutline: "bg-background hover:bg-accent border",
\t\t\t\tsecondary: "bg-secondary text-secondary-foreground",
\t\t\t\tghost: "hover:bg-accent hover:text-accent-foreground",
\t\t\t\tlink: "text-primary underline-offset-4",
\t\t\t},
\t\t\tsize: {
\t\t\t\tdefault: "h-9 px-4 py-2",
\t\t\t\tsm: "h-8 gap-1.5 rounded-md px-3",
\t\t\t\tlg: "h-10 rounded-md px-6",
\t\t\t\ticon: "size-9",
\t\t\t\t"icon-sm": "size-8",
\t\t\t\t"icon-lg": "size-10",
\t\t\t},
\t\t},
\t});
</script>`,
    },
    {
      type: "registry:file",
      target: "button/index.ts",
      content: `import Root, {
\ttype ButtonProps,
\tbuttonVariants,
} from "./button.svelte";

export {
\tRoot,
\ttype ButtonProps as Props,
\t//
\tRoot as Button,
\tbuttonVariants,
\ttype ButtonProps,
\ttype ButtonSize,
\ttype ButtonVariant,
};
`,
    },
  ],
} as unknown as RegistryItem;

const sonnerRegistry = {
  name: "sonner",
  type: "registry:ui",
  devDependencies: [
    "@lucide/svelte@^0.561.0",
    "svelte-sonner@^1.2.0",
    "mode-watcher@^1.1.0",
  ],
  files: [
    {
      type: "registry:file",
      target: "sonner/index.ts",
      content: 'export { default as Toaster } from "./sonner.svelte";\n',
    },
  ],
} as unknown as RegistryItem;

test("dependencies come from the registry, version ranges stripped", () => {
  expect(registryDependenciesOf(buttonRegistry)).toEqual(["tailwind-variants"]);
});

test("scoped package names survive version stripping", () => {
  expect(registryDependenciesOf(sonnerRegistry)).toEqual([
    "@lucide/svelte",
    "svelte-sonner",
    "mode-watcher",
  ]);
});

test("a component with no registry entry reports no dependencies", () => {
  // Previously inferred from whether a Bits UI name existed, which reported
  // `bits-ui` for plain components and nothing for wrapper-only ones.
  expect(registryDependenciesOf(undefined)).toEqual([]);
});

/* --- dependency boilerplate (upstream registry noise) ---------------- */

const toggleRegistry = {
  name: "toggle",
  type: "registry:ui",
  // Verbatim from shadcn-svelte.com/registry/toggle.json: `@internationalized/date`
  // is declared but no file in the item imports it.
  devDependencies: [
    "bits-ui@^2.14.4",
    "@internationalized/date@^3.10.0",
    "tailwind-variants@^3.2.2",
  ],
  files: [
    {
      type: "registry:file",
      target: "toggle/toggle.svelte",
      content:
        'import { tv } from "tailwind-variants";\nimport { Toggle } from "bits-ui";\nimport type { ToggleProps } from "./toggle.svelte";\n',
    },
  ],
} as unknown as RegistryItem;

test("a declared package the component never imports is not reported", () => {
  // Reporting the registry verbatim told an agent to install a date library
  // to add a Toggle. The import statements decide, not the declaration.
  expect(registryDependenciesOf(toggleRegistry)).toEqual([
    "bits-ui",
    "tailwind-variants",
  ]);
});

test("subpath imports still resolve to their package", () => {
  const item = {
    name: "checkbox",
    type: "registry:ui",
    devDependencies: ["bits-ui@^2.14.4", "@lucide/svelte@^0.561.0"],
    files: [
      {
        type: "registry:file",
        target: "checkbox/checkbox.svelte",
        content:
          'import Check from "@lucide/svelte/icons/check";\nimport Minus from "@lucide/svelte/icons/minus";\nimport { Checkbox } from "bits-ui";\n',
      },
    ],
  } as unknown as RegistryItem;
  expect(registryDependenciesOf(item)).toEqual(["bits-ui", "@lucide/svelte"]);
});

test("relative and aliased imports are not treated as packages", () => {
  const item = {
    name: "card",
    type: "registry:ui",
    devDependencies: ["bits-ui@^2.14.4"],
    files: [
      {
        type: "registry:file",
        target: "card/index.ts",
        content:
          'export * from "$UTILS$.js";\nimport { Card } from "./card.svelte";\nimport { cn } from "$lib/utils.js";\n',
      },
    ],
  } as unknown as RegistryItem;
  // Nothing resolves to a package, so the declared list survives unfiltered.
  expect(registryDependenciesOf(item)).toEqual(["bits-ui"]);
});

test("a payload with no readable file content keeps its declared list", () => {
  // Nothing to check imports against; dropping everything would be worse than
  // reporting boilerplate, so the declared list passes through.
  const item = {
    name: "unknown",
    type: "registry:ui",
    devDependencies: ["bits-ui@^2.14.4"],
    files: [],
  } as unknown as RegistryItem;
  expect(registryDependenciesOf(item)).toEqual(["bits-ui"]);
});

test("variant and size axes are read from the component's own tv() config", () => {
  expect(extractVariantAxes(buttonRegistry).variants).toEqual([
    "default",
    "destructive",
    "outline",
    "secondary",
    "ghost",
    "link",
  ]);
  expect(extractVariantAxes(buttonRegistry).sizes).toEqual([
    "default",
    "sm",
    "lg",
    "icon",
    "icon-sm",
    "icon-lg",
  ]);
});

test("tailwind colons inside class values are not mistaken for keys", () => {
  // `hover:bg-accent` and friends contain colons; several wrap onto their own
  // line, so an unmasked scan invents variant keys.
  expect(extractVariantAxes(buttonRegistry).variants).not.toContain("hover");
  expect(extractVariantAxes(buttonRegistry).variants).not.toContain("dark");
});

test("components without a variant axis report none", () => {
  expect(extractVariantAxes(sonnerRegistry).variants).toBeUndefined();
  expect(extractVariantAxes(sonnerRegistry).sizes).toBeUndefined();
});

test("value exports exclude type-only exports", () => {
  expect(registryExports(buttonRegistry)).toEqual([
    "Root",
    "Button",
    "buttonVariants",
  ]);
});

test("importPath uses the real export, not the slug", () => {
  expect(registryImportPath(buttonRegistry, "button")).toBe(
    'import { Button } from "$lib/components/ui/button/index.js";',
  );
  // `sonner` exports `Toaster`; guessing from the slug yields `Sonner`, which
  // does not exist and breaks the build.
  expect(registryImportPath(sonnerRegistry, "sonner")).toBe(
    'import { Toaster } from "$lib/components/ui/sonner/index.js";',
  );
});

test("importPath is omitted when the barrel cannot be identified", () => {
  expect(registryImportPath(undefined, "button")).toBeUndefined();
  expect(
    registryImportPath({ files: [] } as RegistryItem, "button"),
  ).toBeUndefined();
});

const BUTTON_DOCS = `# Button

## [Installation](#installation)

\`\`\`bash
npx shadcn-svelte@latest add button
\`\`\`

## [Usage](#usage)

\`\`\`svelte
<Button variant="outline">Button</Button>
\`\`\`

## [Cursor](#cursor)

\`\`\`css
@layer base { button { cursor: pointer; } }
\`\`\`

## [Default](#default)

\`\`\`svelte
<Button>Button</Button>
\`\`\`

## [Outline](#outline)

\`\`\`svelte
<Button variant="outline">Outline</Button>
\`\`\`

## [Link](#link)

\`\`\`svelte
<Button variant="link">Link</Button>
\`\`\`

## [As Link](#as-link)

Pass an href prop.
`;

test("docs headings are read at any level and through link labels", () => {
  // Site headings are `## [Default](#default)`, not `### Default`.
  expect(extractVariants(BUTTON_DOCS, "button").map((v) => v.name)).toEqual([
    "default",
    "outline",
    "link",
  ]);
});

test("another component's attributes are not reported as this component's variants", () => {
  // The Sonner page demonstrates `<Button variant="outline">` throughout.
  expect(
    extractVariants(
      '```svelte\n<Button variant="outline" onclick={() => toast("hi")}>Show</Button>\n```',
      "sonner",
    ),
  ).toEqual([]);
});

test("sizes are scoped to the component's own tag", () => {
  expect(
    extractSizes(
      '<Button size="lg" variant="outline">Large</Button>',
      "button",
    ),
  ).toEqual(["lg"]);
  expect(extractSizes('<Button size="lg">Large</Button>', "sonner")).toEqual(
    [],
  );
});

/* ------------------------------------------------------------------ */
/* Catalog search ranking                                               */
/* ------------------------------------------------------------------ */

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9+]+/i)
    .filter((w) => w.length > 1);

function item(
  name: string,
  category: string,
  description: string,
  type: CatalogItem["type"] = "component",
): CatalogItem {
  return {
    name,
    title: name
      .split("-")
      .map((w) => (w[0] ?? "").toUpperCase() + w.slice(1))
      .join(" "),
    type,
    category,
    description,
    url: `https://example.test/${name}`,
    keywords: [...new Set([...words(name), ...words(category)])],
  };
}

const catalog: CatalogItem[] = [
  item(
    "button",
    "Form & Input",
    "Displays a button or a component that looks like a button.",
  ),
  item(
    "sonner",
    "Feedback & Status",
    "An opinionated toast component for Svelte.",
  ),
  item("alert", "Feedback & Status", "Displays a callout for user attention."),
  item(
    "badge",
    "Feedback & Status",
    "Displays a badge or a component that looks like a badge.",
  ),
  item(
    "skeleton",
    "Feedback & Status",
    "Use to show a placeholder while content is loading.",
  ),
  item(
    "spinner",
    "Feedback & Status",
    "An indicator that can be used to show a loading state.",
  ),
  item(
    "dialog",
    "Overlays & Dialogs",
    "A window overlaid on either the primary window or another dialog window.",
  ),
  item(
    "alert-dialog",
    "Overlays & Dialogs",
    "A modal dialog that interrupts the user with important content.",
  ),
  item(
    "tooltip",
    "Overlays & Dialogs",
    "A popup that displays information related to an element.",
  ),
  item(
    "popover",
    "Overlays & Dialogs",
    "Displays rich content in a portal, triggered by a button.",
  ),
  item(
    "field",
    "Form & Input",
    "Combine labels, controls, and help text to compose accessible form fields.",
  ),
  item(
    "input",
    "Form & Input",
    "A text input component for forms and user data entry.",
  ),
  item(
    "data-table",
    "Display & Media",
    "Powerful table and datagrids built using TanStack Table.",
  ),
  item("table", "Display & Media", "A responsive table component."),
  item("chart-radar-default", "Radar", "Radar chart with one or more axes."),
  item(
    "chart-radar-multiple-default",
    "Radar",
    "Radar chart with multiple data sets.",
  ),
  item("chart-radar-square-default", "Radar", "Square radar chart."),
  item("chart-radar-circle-default", "Radar", "Circle radar chart."),
  item("chart-radar-grid", "Radar", "Radar chart with a grid."),
  item("chart-radar-tooltip", "Radar", "Radar chart with a tooltip."),
  item("chart-radial-default", "Radial", "Radial chart with one or more axes."),
  item("chart-radial-simple", "Radial", "Simple radial chart."),
];

const index = buildIndex(catalog);
const top = (query: string, limit = 3) =>
  searchOnce(index, query, limit).map((r) => r.item.name);

/*
 * Vocabulary gaps are NOT bridged.
 *
 * "notification" cannot reach Sonner from text alone - the page only ever says
 * "toast" - and no local data can close that gap. A hand-written synonym table
 * can fake it, but it silently rots whenever the site's wording changes, which
 * is the failure mode this search core is meant to avoid. So the ranker
 * declines to answer, and the tool surfaces the real catalog vocabulary
 * instead, letting the calling model choose with the descriptions in hand.
 */
test("a word the catalog never uses yields no match rather than a wrong one", () => {
  expect(top("notification")).toEqual([]);
});

test("words absent from the catalog do not dilute the ones that are present", () => {
  // No stopword list: unseen terms simply are not evidence, so padding a
  // query with junk ranks exactly the same as the bare query.
  expect(top("qqq zzz dialog")).toEqual(top("dialog"));
});

test("catalog-wide filler words cannot outrank a rare one", () => {
  // "component" and "display" appear in most descriptions, so they carry
  // almost no weight on their own - which is what a stopword list used to buy.
  expect(top("component")).not.toContain("button");
});

test("'modal' resolves via the description that uses the word", () => {
  expect(top("modal")[0]).toBe("alert-dialog");
});

test("a category word does not outrank the component itself", () => {
  // "Overlays & Dialogs" made every neighbour match "dialog" as hard as Dialog.
  expect(top("dialog")[0]).toBe("dialog");
  expect(top("dialog")).not.toContain("tooltip");
});

test("a generic term does not swamp the specific phrase", () => {
  // "grid" appears in every radar chart, so rarity weighting keeps Data Table
  // ahead of them.
  expect(top("data grid with sorting")[0]).toBe("data-table");
});

test("typo tolerance is preserved", () => {
  expect(top("buton")[0]).toBe("button");
});

/* ------------------------------------------------------------------ */
/* bits-ui-get response shape                                          */
/* ------------------------------------------------------------------ */

const BITS_UI_PAGE = `# Popover
A popover displays rich content in a floating panel.

## Installation

\`\`\`bash
npm install bits-ui
\`\`\`

## Usage

Compose the parts yourself:

\`\`\`svelte
<Popover.Root>
  <Popover.Trigger>Open</Popover.Trigger>
  <Popover.Content>Content</Popover.Content>
</Popover.Root>
\`\`\`

## API Reference

### Popover.Root

| Property | Type | Description |
| --- | --- | --- |
| \`open\` | \`boolean\` | The open state. Default: false |

### Popover.Content

| Property | Type | Description |
| --- | --- | --- |
| \`side\` | \`Side\` | Which side to place. Default: bottom |
`;

test("the API Reference section is not shipped twice", () => {
  // `parseBitsUiApi` already lifts this section into `api.raw`; leaving it in the
  // body meant 40-70% of a Bits UI response was the same bytes twice, and those
  // responses are the largest this server produces.
  const body = stripApiReference(BITS_UI_PAGE);

  expect(body).not.toContain("API Reference");
  expect(body).not.toContain("The open state");
  expect(body).not.toContain("Which side to place");
});

test("content around the API Reference survives stripping", () => {
  const body = stripApiReference(BITS_UI_PAGE);

  expect(body).toContain("A popover displays rich content");
  expect(body).toContain("Popover.Trigger");
});

test("a page with no API Reference is returned unchanged", () => {
  const page = "# Switch\n\nA control that toggles between on and off.\n";
  expect(stripApiReference(page)).toBe(page);
});

test("a body that is only a reference table is not emptied", () => {
  const page = "## API Reference\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n";
  expect(stripApiReference(page)).toBe(page);
});
