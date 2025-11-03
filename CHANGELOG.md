## [1.0.6](https://github.com/Michael-Obele/shadcn-svelte-mcp/compare/v1.0.5...v1.0.6) (2025-11-03)


### Features

* add version synchronization scripts and update README with new commands ([52590c3](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/52590c3d17e3868d00978aca8183fbc02e74027f))
* replace version check steps with auto-sync in workflows and scripts ([b894618](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/b89461887de693e63ba6b41654fc920d5fcadbef))

## [1.0.5](https://github.com/Michael-Obele/shadcn-svelte-mcp/compare/v1.0.4...v1.0.5) (2025-11-03)


### Bug Fixes

* revert version number to 1.0.4 in MCP server configuration ([f434b1e](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/f434b1e155a7560fe6be1c3564f37031ceadc881))


### Features

* add search functionality for components and documentation, update README and package.json ([d9be80e](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/d9be80ecc82e147e8637c888d30db103b462997b))
* add support for icon search functionality and enhance documentation for the 'icons' action ([1d96225](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/1d9622568dcac86af12742c5fc228c3819a3fbae))
* add unescapeMarkdown function to fix escaped quotes in Markdown content ([68c09ba](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/68c09ba8e86d309bf3cca5485bea222406bc0d6d))
* enhance documentation fetching and improve error handling in component discovery ([a2eae60](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/a2eae60cc8b4b32553c5b0a30a6b8a8afbb33e43))

## [1.0.4](https://github.com/Michael-Obele/shadcn-svelte-mcp/compare/v1.0.3...v1.0.4) (2025-10-23)


### Features

* add version consistency check script and CI safeguards ([f8844b1](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/f8844b183bade76946b5f6cb7a08ddb70657666e))

## [1.0.3](https://github.com/Michael-Obele/shadcn-svelte-mcp/compare/v1.0.2...v1.0.3) (2025-10-23)


### Bug Fixes

* move conventional-changelog-conventionalcommits dependency to devDependencies in package.json and bun.lock ([b8f500c](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/b8f500cba7c84b853ebac67a4192706c22e206af))

## [1.0.2](https://github.com/Michael-Obele/shadcn-svelte-mcp/compare/v1.0.1...v1.0.2) (2025-10-23)


### Bug Fixes

* add conventional-changelog-conventionalcommits dependency in package.json and bun.lock ([0be88fe](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/0be88fe5e70f392de268ae1cea64fc677bf6f7b0))
* add Node.js setup step in semantic-release workflow ([42c73fb](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/42c73fbeee9420104da6931502cc043b679e2f0f))
* change dependency installation from bun to npm in semantic-release workflow ([a9f162f](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/a9f162f30ab910dcce642ed61d32397b5e8f1b43))
* switch from Node.js to Bun for setup and dependency installation in semantic-release workflow ([6ab14f8](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/6ab14f82f36f44ffd1bb659f900b60eb5e72f5d8))
* update Node.js version to 24.10.0 in semantic-release workflow ([8b61613](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/8b6161330b8b4c00a7c882286d9c6db585a59b0e))


### Features

* add script to update version in mcp-server.ts based on package.json ([83b4e0a](https://github.com/Michael-Obele/shadcn-svelte-mcp/commit/83b4e0abd8c936b08d14c5c98c8d5aa994b3d151))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-XX

### Added

- Production deployment on Mastra Cloud (https://shadcn-svelte.mastra.cloud)
- Three powerful MCP tools for shadcn-svelte components:
  - `shadcnSvelteListTool` - List all components and documentation
  - `shadcnSvelteGetTool` - Get detailed component documentation
  - `shadcnSvelteUtilityTool` - Installation, theming, and migration help
- Support for multiple AI code editors (Cursor, Windsurf, VS Code, Zed, Claude Code, Codex)
- HTTP and SSE transport protocols
- Comprehensive component registry with 59+ components
- Complete installation documentation for all major editors
- GitHub Actions workflows for automated versioning and releases

### Changed

- Renamed MCP server from "Shadcn Svelte Documentation Server" to "Shadcn Svelte Docs"
- Simplified architecture to MCP Server only (removed optional MCP Client)
- Updated README with v1.0.0 announcement and editor installation guides

### Removed

- MCP Client implementation (not needed for this project's use case)
- Example MCP agent that used external tools
- Test script for MCP client

### Fixed

- Clarified "Tool not found" error is UI display issue, not server configuration
- Updated documentation to distinguish between MCP Server and MCP Client roles

## [0.1.0] - Initial Development

### Added

- Initial Mastra-based MCP server implementation
- Component documentation registry
- Basic tool implementations
- Development and testing infrastructure
