# Changelog

## [0.2.0] - 2026-03-21

### Added (Winnie)
- **gateway-health-beacon** hook: Multi-gateway discovery and health monitoring over NATS + memU
- **cross-gateway-relay** hook: Cross-gateway task coordination signals for multi-host agent collaboration
- Architecture diagram in README showing cross-gateway communication flow
- Full NATS subject hierarchy documentation

### Fixed (Winnie)
- **memu-logger**: Fixed endpoint from `/api/v1/memu/memories` → `/api/v1/memu/add` (correct memU API)
- **memu-logger**: Added required `X-MemU-Key` auth header
- **memu-logger**: Added required `user_id`, `session_id` fields and valid `category` enum values
- **memu-logger**: Default endpoint changed to Railway production (localhost unreachable from Windows host)
- **nats-publisher**: Made fully cross-platform (Windows PowerShell + Unix shell)
- **nats-publisher**: Added auto-detection for NATS binary path across platforms
- **nats-publisher**: Added gateway identity (`COMPUTERNAME`/`HOSTNAME`) to all published events
- **nats-publisher**: Added publish failure tracking for observability
- **compaction-guard**: Same memU endpoint/auth/schema fixes as memu-logger
- **compaction-guard**: Cross-platform path resolution (Windows `E:\` + Linux mounts + macOS)
- **compaction-guard**: Added host identifier to snapshot records

## [0.1.0] - 2026-03-21

### Added (Lenny)
- Initial release with 5 hooks: memu-logger, nats-publisher, quality-gate, session-metrics, compaction-guard
- Implementation plan documentation
- MIT license
