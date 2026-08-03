/**
 * Minimal ambient types for the `cloudflare:workers` module.
 *
 * Only used to satisfy `tsc` when type-checking `src/worker.ts`.
 * At bundle time, wrangler injects the real runtime module — these
 * declarations are never executed.
 */
declare module "cloudflare:workers" {
  export class DurableObject<Env = unknown, State = unknown> {
    constructor(ctx: unknown, env: Env);
    readonly env: Env;
    readonly state: State;
  }

  export const env: Record<string, any>;

  export function waitUntil(promise: Promise<unknown>): void;
}
