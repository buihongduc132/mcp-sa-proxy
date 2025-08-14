# MCP Desktop Commander & Proxy – Architecture (v1)
_Last updated: 2025-08-14_

## 1) Overview
This stack wires an MCP “Desktop Commander” (DC) server and a Playwright MCP to a WebSocket-exposed proxy so external LLM clients can drive local OS/browser automation.

**Core pieces**
- **mcp-sa-proxy**: Node service that exposes MCP servers over WS.
- **mcp-dc**: Local MCP server (file system, process orchestration, edits).
- **playwright/mcp**: Browser automation server speaking MCP over CDP.
- **Launcher scripts**: Start dev/prod single-stack or dual setups with logging/retry.

**High-level flow**
LLM client ⇄ _WS_ ⇄ **mcp-sa-proxy** ⇄ **MCP servers** { **dc**, **plw** }.
For dev, additional **dc-dev** + separate CDP port allow parallel browser sessions.

## 2) Components & Topology
- **Proxy binary**: /components/mcp-sa-proxy/dist_prod/index.js
  - Flags (seen in scripts): `--outputTransport ws --logLevel debug`
  - WS liveness: `--wsPingInterval 30000`, `--wsPongTimeout 15000`
  - `--sessionTimeout 3600000` (1h)
- **MCP configs**: /components/mcp-dc/config/*.json
  - Bind “dc”, “dc-dev”, “plw”, “plw-dev” with per-env NODE_ENV, LOG_LEVEL.
- **Browser endpoints (CDP)**:
  - Dev: 9223 (plw-dev), 9224 (plw)
  - User-data-dirs pinned per port for isolation## 3) Ports & Processes
- **Proxy WS port**: dev uses `${DEV_PORT:-3108}`; prod fixed **3007**.
- **CDP ports** (browser): **9223** (plw-dev), **9224** (plw).
- **Profiles**: separate `bm2-default-9223/9224` user-data-dirs to avoid cross-talk.

## 4) Scripts Matrix (what each does)
- `run_dev_only.sh`: runs proxy (ws) against **mcpconfig_dc_dev.json**; retries x3; logs to `logs/dev-proxy.log`; warns on port or missing build.
- `run_prod_only.sh`: runs proxy (ws) with **mcpconfig_dc_prod.json** on :3007; retries x3; logs to `logs/prod-proxy.log`.
- `run_dual*.sh`: coordinates dev+prod or dockerized dual modes (see also `docker_dual_*`, `dual_health_check.sh`, `status_stacks.sh`).
- Utilities: `dev-watcher.js`, `restart_dev.sh`, `sync-version.js`, fuzzy-log analyzers.

## 5) MCP Config Breakdown
- **/config/mcpconfig.json**: minimal sample; `desktop-commander` via `npx`, and `plw` with CDP `http://localhost:9222` + default chrome profile.
- **/config/mcpconfig_dc_dev.json**:
  - Servers: **dc** (dist_prod), **dc-dev** (dist), **plw** (9224), **plw-dev** (9223).
  - ENV: `NODE_ENV=development`, `MCP_DEBUG/ENABLE_*LOGGING=true`, `LOG_LEVEL=debug`.
- **/config/mcpconfig_dc_prod.json**:
  - Servers: **dc** (dist_prod), **plw** (9224).
  - ENV: `NODE_ENV=production`, logging flags still `true` with `debug` (consider tuning).

## 6) Logging & Observability
- Script-level: `tee` to `logs/dev-proxy.log` or `logs/prod-proxy.log`.
- Server ENV enables verbose/file logging across DC/PLW.
- Health/liveness: WS ping/pong (30s/15s). Add HTTP `/healthz` on proxy for k8s/docker readiness (recommended).## 7) Session, Lifecycle & Health
- Proxy: WS ping every 30s, pong timeout 15s; sessionTimeout 1h (CLI flags).
- Scripts trap SIGINT/SIGTERM; `run_dev_only` kills child via stored PID.
- Recommend: expose `/healthz` (OK), `/readyz` (checks MCP sockets & CDP); per-session counters + metrics.

## 8) Risks & Bad Practices (call-outs)
- **Pinned paths**: absolute Chrome & profile dirs hardcoded → brittle across hosts.
- **`npx @playwright/mcp@latest -y`** in configs → non-deterministic version drift.
- **Verbose logs in prod** (`LOG_LEVEL=debug`, `ENABLE_*LOGGING=true`) → noisy + cost.
- **Fixed port in prod (3007)** with no env override → clashes in shared hosts.
- **Retry loop without backoff/jitter** → thundering herd on flapping deps.
- **No log rotation** for `tee` files → unbounded disk growth.
- **No structured logs** → hard to query/ship to ELK/OTel.
- **Weak readiness**: only WS ping/pong; CDP may be up but browser unusable.
- **Mixed dev/prod configs** duplication → config drift risk.

## 9) Recommended Improvements (better approach)
- Move all tunables to `.env` (PORT, WS_* intervals, SESSION_TTL, CDP_*), load via dotenv.
- Pin toolchain versions: lock `@playwright/mcp@<semver>`, `node` LTS; pre-install vs `npx`.
- Add HTTP health endpoints; integrate `dual_health_check.sh` into scripts with fail-fast.
- Implement **exponential backoff + jitter** on retries; cap + circuit breaker.
- Switch logs to **JSON**; rotate via `logrotate` or built-in day files; add request IDs.
- Provide **systemd/PM2** unit for prod; graceful child cleanup; restart on failure.
- Parameterize Chrome path/profile via env; validate existence.
- Split configs: `base.json` + `dev.json`/`prod.json` with overrides to avoid duplication.
- Add smoke tests (port, MCP listServers, simple DC op, simple PLW open) before READY.

## 10) Runbooks
**Dev**: `scripts/run_dev_only.sh` → open ws://localhost:${DEV_PORT:-3108}; watch `logs/dev-proxy.log`.
**Prod**: `scripts/run_prod_only.sh` → ws://localhost:3007; tail `logs/prod-proxy.log`.
**Dual**: `scripts/run_dual*.sh` (ensure CDP 9223/9224 free; profiles exist).

## 11) Troubleshooting quick refs
- Port busy: `lsof -ti:3007 | xargs kill`; verify Chrome CDP: `curl :9224/json/version`.
- Config check: confirm `/components/mcp-dc/config/*` paths & env; validate JSON.
- Browser auth/profile: start Chrome manually with `--remote-debugging-port=9224` to test.## Appendix A — Dual Mode Topology
**Configs**: `mcpconfig_dc_dual.json`, `mcpconfig_dc_dual_9224_9223.json`
- Servers:
  - **dc** / **dc-dev** swap builds across files:
    - `mcpconfig_dc_dual.json`: `dc → dist`, `dc-dev → dist_prod`
    - `mcpconfig_dc_dual_9224_9223.json`: `dc → npm run dev` (cwd=components/mcp-dc)
  - **plw**: CDP `http://localhost:9224` (profile `bm2-default-9224`)
  - **plw-dev**: CDP `http://localhost:9223` (profile `bm2-default-9223`)
- Purpose: run **two** browser automation lanes concurrently (stable vs dev)
  while exercising DC in either prod build or live-dev (hot reload) mode.

### Additional call-outs (dual)
- Build mismatch risk: `dist` vs `dist_prod` inversion can confuse operators.
- `npm run dev` introduces toolchain drift vs `node dist*.js`.
- Env/flags absent in dual configs (no LOG_LEVEL/ENABLE_*LOGGING) → inconsistency.
- `@playwright/mcp@latest` via `npx` in both lanes → non-deterministic.

### Recommendations (dual)
- Normalize via **base + overlays**: `base.json` + `overrides/dev.json`, `overrides/dual.json`.
- Pin PLW MCP version; preinstall binaries; avoid `npx` at runtime.
- Standardize **ENV** blocks in all configs (LOG_LEVEL, MCP_DEBUG, paths) and read from `.env`.
- Single **launcher** accepts `--mode=dev|prod|dual` and computes CDP ports & user-data-dirs.
- Add **preflight**: verify ports 9223/9224 free; profiles exist; Chrome binary present.