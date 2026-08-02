# shadcn-svelte-mcp — Fly.io container image
# Runs the HTTP entry (Streamable HTTP at /mcp) with bun.

FROM oven/bun:1.2 AS build

WORKDIR /app

# Install dependencies first for better layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build the HTTP + stdio bundles
RUN bun run build

# --- runtime image ---
FROM oven/bun:1.2-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Runtime needs only the built output
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Health check used by Fly.io (and Docker HEALTHCHECK)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" || exit 1

CMD ["bun", "./dist/index.js"]
