## Lessons

- In K6 performance helpers, do not hide test identity behind default user IDs, fallback token creation, or extra guard abstractions. Actions that depend on a user should receive the VU's seeded `userId` directly, and authenticated projects should pass the matching token directly.
- For endpoint maps and K6 browser-action simulations, use the frontend as the source of truth. Verify both explicit `fetch` calls and browser-triggered `<img>`/`<video>` requests before adding an endpoint to tests or docs.
- When matching frontend behavior, do not cap media/image fetches with synthetic limits. If the UI renders N cards from a response, simulate the corresponding thumbnail/avatar requests for all rendered items unless the frontend itself enforces a limit.
- Mirror frontend concurrency: if the UI issues requests in parallel (`Promise.all`, concurrent React Query hooks), model the same phase with `http.batch` in K6 instead of serial calls.
- Keep K6 bootstrap scripts on the same shared action helpers as the runtime tests. Do not duplicate endpoint construction or request logic in `bootstrap.js`, because drift there can seed data through a different API path than the frontend simulation uses.
- When changing a function that has a manual `verified`/`reviewed` marker, remove that marker so the user can re-review the changed function.

# CRITICAL
You can run `k6 inspect ...`, but only one file at a time, otherwise it will crash WSL.