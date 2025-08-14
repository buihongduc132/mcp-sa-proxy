# Task 10: Architecture Follow-ups & Hardening

Derived from: `flow/designs/architecture.md`, `architecture copy.md`, `mcp-dc-architecture.md`

## A) Orchestration & State
- [ ] **Session persistence (SQLite)**: Implement `SessionStore` (in-memory + SQLite) and wire into `SessionManager` (persist `id`, `transport`, `last_activity`, `state` JSON). Add TTL cleanup and migration script.
- [ ] **Session timeout metrics**: Emit counters for `inc/dec/timeout` per session.

## B) Transports
- [ ] **SSE/Streamable split**: Confirm if Streamable HTTP fully covers SSE. If not, add `SseTransport.ts` (GET channel + heartbeat) and unify transport interface surface.
- [ ] **WebSocket schema safety**: Validate incoming JSON-RPC with a schema guard before routing (defensive parse added; add schema validation + error codes).

## C) Health & Observability
- [ ] **/healthz & /readyz**: Implement HTTP endpoints that check: serverManager initialized, transport bindings active, and (if configured) CDP endpoints reachable.
- [ ] **Metrics (/metrics)**: Expose Prometheus metrics: requests by method/status, open sessions, timeouts, WS ping/pong, child process restarts.
- [ ] **Structured logging**: Switch to JSON logs with request/session IDs; add log rotation policy.

## D) Config & Ops
- [ ] **Config overlays**: Create `config/base.json` + `overrides/{dev,prod,dual}.json`; provide a loader that merges overlays.
- [ ] **dotenv**: Move tunables (PORT, WS_*, SESSION_TTL, CDP_*) to `.env` and load at startup.
- [ ] **Version pinning**: Pin `@playwright/mcp`, Node LTS; avoid `npx @latest` in runtime configs.
- [ ] **Retries**: Replace naive retries with exponential backoff + jitter; add circuit breaker on repeated failures.
- [ ] **Service units**: Provide `systemd` and PM2 unit files for prod with graceful shutdown.

## E) Tests
- [ ] **Smoke tests**: health endpoints, `listServers`, simple DC op, simple PLW open.
- [ ] **Concurrency tests**: Extend WS test; add Streamable HTTP concurrency & long-poll tests.
- [ ] **Session lifecycle tests**: Validate inc/dec, timeout cleanup, persisted restore (if enabled).

## F) Docs & Runbooks
- [ ] Update READMEs to document new endpoints, env vars, and dual-mode topology.
- [ ] Add troubleshooting for ports, profiles, CDP reachability, and config overlays.
## G) Security & Access Control
- [ ] CORS allowlist and explicit methods/headers; optional auth token for WS/HTTP; per-IP/user rate limits.
- [ ] Secrets hygiene: redact tokens/paths in logs; prevent accidental leakage in error payloads.

## H) Validation & Error Taxonomy
- [ ] Central JSON-RPC schema guard with structured error codes (client vs server vs transport).
- [ ] Config schema (zod/ajv) + startup validation; fail-fast with actionable hints.

## I) Backpressure & Limits
- [ ] Per-session request queue limits and max payload size.
- [ ] WS/HTTP send buffer monitoring; graceful shedding when saturated.

## J) Lifecycle Robustness
- [ ] Graceful shutdown draining for WS/HTTP; idempotency patterns for retried requests.

## K) SQLite Operations
- [ ] Migrations toolchain (e.g., umzug/knex), WAL mode, periodic maintenance (VACUUM), integrity checks and backup/restore.

## L) Observability Enhancements
- [ ] Correlate logs with request/session trace IDs; optional OpenTelemetry spans.
- [ ] Log rotation: size/day-based rolling policy.

## M) CI/CD & Quality Gates
- [ ] CI matrix (lint, typecheck, unit, e2e, concurrency tests).
- [ ] Build artifact smoke test; dependency & vuln scans.

## N) Config Drift & Docs
- [ ] Overlays checksum printed on boot; environment summary banner.
- [ ] Expanded runbooks: dual-mode, port collisions, browser profile care, PLW/CDP troubleshooting.