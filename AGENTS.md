## Lessons

- In K6 performance helpers, do not hide test identity behind default user IDs, fallback token creation, or extra guard abstractions. Actions that depend on a user should receive the VU's seeded `userId` directly, and authenticated projects should pass the matching token directly.
- For endpoint maps and K6 browser-action simulations, use the frontend as the source of truth. Verify both explicit `fetch` calls and browser-triggered `<img>`/`<video>` requests before adding an endpoint to tests or docs.
- When matching frontend behavior, do not cap media/image fetches with synthetic limits. If the UI renders N cards from a response, simulate the corresponding thumbnail/avatar requests for all rendered items unless the frontend itself enforces a limit.
- Mirror frontend concurrency: if the UI issues requests in parallel (`Promise.all`, concurrent React Query hooks), model the same phase with `http.batch` in K6 instead of serial calls.
- Keep K6 bootstrap scripts on the same shared action helpers as the runtime tests. Do not duplicate endpoint construction or request logic in `bootstrap.js`, because drift there can seed data through a different API path than the frontend simulation uses.
- Bootstrap must persist the exact created user/video IDs and runtime tests must consume that seed manifest. Do not assume seeded users are contiguous IDs such as `1..3000`, especially for JWT-authenticated projects.
- When changing a function that has a manual `verified`/`reviewed` marker, remove that marker so the user can re-review the changed function.
- In K6 seed/runtime helpers, avoid defensive numeric validation such as `Number.isFinite` when the value is produced by the controlled bootstrap/test flow. Keep ID and duration handling direct unless the frontend/API contract requires normalization.
- K6 video duration buckets are fixed to `60`, `180`, `600`, and `2400`. Do not infer alternative duration keys from API responses or create new `videosByDuration` / `VIDEO_IDS_BY_DURATION` keys dynamically.
- Keep K6 action randomness internal to the action helpers. Do not pass video-selection callbacks or video IDs from scenario runners when the action can pick a seeded random target on its own.

# CRITICAL
NEVER RUN K6

Do not run `k6 run`, `k6 inspect`, or any other k6 command in this repo. Use static checks only unless the user explicitly provides a separate safe runtime and overrides this rule.
