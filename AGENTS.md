## Lessons

- In K6 performance helpers, do not hide test identity behind default user IDs, fallback token creation, or extra guard abstractions. Actions that depend on a user should receive the VU's seeded `userId` directly, and authenticated projects should pass the matching token directly.
- For endpoint maps and K6 browser-action simulations, use the frontend as the source of truth. Verify both explicit `fetch` calls and browser-triggered `<img>`/`<video>` requests before adding an endpoint to tests or docs.
- When matching frontend behavior, do not cap media/image fetches with synthetic limits. If the UI renders N cards from a response, simulate the corresponding thumbnail/avatar requests for all rendered items unless the frontend itself enforces a limit.
- Mirror frontend concurrency: if the UI issues requests in parallel (`Promise.all`, concurrent React Query hooks), model the same phase with `http.batch` in K6 instead of serial calls.
- Do not run K6 commands in this repo. The video fixtures are large enough that even non-execution K6 inspection commands can destabilize the VM; verify K6 scripts with static checks unless the user explicitly provides a separate safe runtime.
- When changing a function that has a manual `verified`/`reviewed` marker, remove that marker so the user can re-review the changed function.

# CRITICAL
NEVER RUN K6


NEVER RUN K6


NEVER RUN k6


NEVER RUN K6


You should never run k6 to test anything, just change the code and thats it. NEVER RUN K6
