## Lessons

- In K6 performance helpers, do not hide test identity behind default user IDs, fallback token creation, or extra guard abstractions. Actions that depend on a user should receive the VU's seeded `userId` directly, and authenticated projects should pass the matching token directly.
- For endpoint maps and K6 browser-action simulations, use the frontend as the source of truth. Verify both explicit `fetch` calls and browser-triggered `<img>`/`<video>` requests before adding an endpoint to tests or docs.
- When matching frontend behavior, do not cap media/image fetches with synthetic limits. If the UI renders N cards from a response, simulate the corresponding thumbnail/avatar requests for all rendered items unless the frontend itself enforces a limit.
- Mirror frontend concurrency: if the UI issues requests in parallel (`Promise.all`, concurrent React Query hooks), model the same phase with `http.batch` in K6 instead of serial calls.
- Keep K6 bootstrap scripts on the same shared action helpers as the runtime tests. Do not duplicate endpoint construction or request logic in `bootstrap.js`, because drift there can seed data through a different API path than the frontend simulation uses.
- For clean-slate runs, prefer `setup()`-driven seeding and pass only the minimal VU auth context from setup (for German: `[userId, token]` tuples). Avoid reintroducing manifest persistence unless explicitly requested.
- When changing a function that has a manual `verified`/`reviewed` marker, remove that marker so the user can re-review the changed function.
- Keep `verified`/`reviewed` markers on untouched functions. Only remove markers from functions that were actually edited.
- In K6 seed/runtime helpers, avoid defensive numeric validation such as `Number.isFinite` when the value is produced by the controlled bootstrap/test flow. Keep ID and duration handling direct unless the frontend/API contract requires normalization.
- K6 video duration buckets are fixed to the active seeded video corpus. Keep duration keys explicit and do not infer alternative duration keys from API responses or create new `videosByDuration` / `VIDEO_IDS_BY_DURATION` keys dynamically.
- Keep K6 action randomness internal to the action helpers. Do not pass video-selection callbacks or video IDs from scenario runners when the action can pick a seeded random target on its own.
- In K6 action helpers, prefer positional parameters for core identity/auth inputs (for example `userId`, `token`) instead of loose object bags.
- For local web consoles, terminal output must be a fixed-height scroll viewport, not normal page content that grows indefinitely.
- For local web consoles that launch cleanup scripts, handle sudo explicitly through a permission-grant step and non-interactive `sudo -n` retries. Do not hide password prompts inside browser flows.
- For local K6 action consoles, single-action smoke probes must not export k6 `setup()` or run the full bootstrap. Reserve full bootstrap seeding for explicit bootstrap actions and complete test entrypoints.
- Before writing lifecycle scripts for a project, read that project's README/docs/deploy scripts and use the documented startup path instead of inferring commands from Docker Compose files alone.
- If a lifecycle up script starts services in detached mode, wait for the documented health/readiness URLs before reporting success.

# CRITICAL
NEVER RUN K6

Do not run `k6 run`, `k6 inspect`, or any other k6 command in this repo. Use static checks only unless the user explicitly provides a separate safe runtime and overrides this rule.
