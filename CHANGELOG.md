# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-02-22

### Changed

- Renamed `LiteMCP` to `TokenLite` throughout codebase
- Renamed `LiteMCPOptions` to `TokenLiteOptions`
- File renamed from `litemcp.ts` to `tokenlite.ts`

### Fixed

- Refactored to eliminate code duplication (meta-tool constants, unified `callTool` method)

## [0.2.0] - 2025-02-22

### Added

- Per-tool visibility with `_meta: { alwaysVisible: true }` option
- Always-visible tools appear directly in `tools/list`
- Always-visible tools callable directly by name (no `execute` wrapper needed)
- Always-visible tools excluded from `search` results

## [0.1.0] - 2025-02-22

### Added

- Initial release
- `TokenLite` class extending `McpServer` from official SDK
- `search` tool to query registered tools by name/description
- `execute` tool to run any registered tool by name
- Full API compatibility with `McpServer`
- Unit tests for search and execute functionality
