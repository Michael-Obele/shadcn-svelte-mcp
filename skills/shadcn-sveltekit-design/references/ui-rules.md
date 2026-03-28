# UI Rules

Use these rules when the task is visual, layout-heavy, or focused on UI quality.

## Visual Direction

- Choose a deliberate aesthetic direction before writing code.
- Avoid generic AI dashboard styling, especially bland grids, timid palettes, or interchangeable layouts.
- Make one strong visual idea easy to describe: editorial, industrial, restrained luxury, playful utility, data-dense control room, and so on.

## Typography

- Prefer expressive typography over default system-looking stacks.
- Pair display and body styles intentionally.
- Use scale, weight, and spacing to create hierarchy rather than relying only on borders and boxes.

## Color And Atmosphere

- Define a clear color system with CSS variables.
- Build depth with gradients, texture, overlays, or structure instead of flat blank backgrounds.
- Do not fall back to purple-on-white defaults.

## Styling Overrides

- Prefer targeted Tailwind utility overrides, semantic tokens, and scoped CSS over careless edits to vendor component source.
- Override with intent: know whether you are changing spacing, hierarchy, interaction, or theme behavior before adding classes.
- Reach for CSS variables or shared component-level CSS when a style decision needs to stay consistent across multiple surfaces.
- Avoid arbitrary-value sprawl, conflicting utility stacks, or one-off overrides that make future maintenance harder.
- If the design system already exposes tokens or variants, use those first and treat raw overrides as a deliberate exception.

## Layout

- Start from content hierarchy, then choose the layout.
- Use asymmetry, compression, or generous spacing intentionally.
- Design mobile and desktop together so the composition still feels considered at smaller sizes.

## Motion

- Use a few meaningful transitions or staged reveals rather than noisy micro-interactions everywhere.
- Motion should reinforce hierarchy and orientation.
- If the user did not name a motion library and the project does not already use one, prefer Svelte's built-in motion primitives before introducing a new dependency.
- Official docs:
	- `transition:`: `https://svelte.dev/docs/svelte/transition`
	- `in:` and `out:`: `https://svelte.dev/docs/svelte/in-and-out`
	- `animate:`: `https://svelte.dev/docs/svelte/animate`
- Use `transition:` for enter/exit behavior, `in:` and `out:` when intro and outro should not reverse, and `animate:` for reordering inside keyed each blocks.

## SvelteKit And Svelte Rules

- Write valid Svelte 5 code.
- Keep code Svelte-first; never introduce React patterns like JSX, `children`, or `asChild`.
- Use standard DOM event attributes such as `onclick`.
- Structure files in a way that fits SvelteKit routing and shared component reuse.

## Component Strategy

- Prefer verified shadcn-svelte primitives for the visible UI shell.
- Use Bits UI details only when the shadcn-svelte docs imply deeper behavior is needed.
- Keep component APIs small and readable when building reusable pieces.
- Install official components with the CLI, then adapt them with class composition, variants, wrappers, and scoped CSS instead of rewriting the library component files from scratch.

## Quality Bar

- The output should feel designed, not merely assembled.
- If working inside an existing product, preserve its patterns.
- If creating something new, make the visual language cohesive enough that another page could be built from it.
