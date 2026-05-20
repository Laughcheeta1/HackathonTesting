# YouTube Clone Performance Test Strategy

## Purpose

The goal of this performance test suite is to compare the YouTube clone projects under the same realistic workload. The tests are built with K6 and focus on user-level actions instead of isolated backend endpoints.

The main question is:

> How many concurrent users and user actions can each project support before the application becomes unhealthy?

The stress test is the baseline. It finds the practical maximum load each project can tolerate. That maximum is treated as `100%` capacity for the remaining test types.

## Projects Covered

The K6 folder contains equivalent tests for:

- German
- Braulio
- Cristobal

Each project has its own `common.js`, `utils.js`, `bootstrap.js`, and test files for stress, spike, soak, and load testing.

## Break Rule

The application is considered broken when one or more of these conditions is sustained for 30 seconds:

- `p95` request duration is greater than `10s`
- HTTP error rate is greater than `10%`
- A critical container health failure or restart is detected

In K6, this is represented through thresholds on:

- `http_req_duration`
- `http_req_failed`
- `health_failures`

The health scenario runs alongside the user-action scenario and periodically checks the project health endpoint.

## Test Types

### Stress Test

The stress test ramps virtual users upward until the app crosses the break rule. The highest stable point before failure is considered the project's `100%` capacity.

This test answers:

- How many concurrent users can the app sustain?
- Which action or endpoint fails first?
- Does the app degrade gradually or fail abruptly?

### Spike Test

The spike test simulates low traffic followed by a sudden surge.

The intended capacity range is:

- Minimum: `1%` of max user capacity
- Maximum: `95%` of max user capacity

This test answers:

- Can the app absorb sudden traffic?
- Does it recover after the spike?
- Do queues, caches, or media paths fail under burst pressure?

### Soak Test

The soak test runs at `90%` of max capacity for 5 minutes.

This test answers:

- Does memory grow over time?
- Do database connections, file handles, workers, or caches degrade?
- Does latency stay stable under sustained near-maximum load?

### Load Test

The load test simulates normal traffic with periodic high-traffic moments.

The intended capacity range is:

- Normal load: `50%`
- Temporary spikes: `85%`

This represents normal usage with heavier periods, such as lunch or breakfast breaks.

## Action Model

The tests model frontend user actions, not direct endpoint units. A single action may trigger several requests because that is what the real browser frontend does.

Current action distribution:

- Main page opening: `34%`
- Opening user page: `5%`
- Creating user: `1%`
- Uploading video: `1%`
- Watching video: `48%`
- Going down page / loading more: `8%`
- Adding comment: `5%`

The `watching video` action includes both entering the watch page and reproducing the video. These are intentionally one action because a real user clicks a video in order to watch it.

## Frontend Source Of Truth

The K6 scripts should call the exact same backend requests that the frontend triggers.

This means:

- Explicit frontend `fetch` calls are included.
- Browser-triggered media and image requests are included when they happen in the real UI.
- Calls caused by another action are not counted in the wrong action.

For example, uploading a video includes the upload form request and only the direct post-success refresh requests that the upload page starts:

- `POST /videos/upload`
- Braulio: `GET /videos?offset=0&limit=20`
- Cristobal: `GET /videos`
- German: no immediate video-list GET from the upload page; it invalidates React Query caches locally

If upload success navigates to the watch page, those watch-page requests belong to the `watching video` action, not the upload action.

## Video Streaming

Video reproduction is part of the test because video streaming happens at the same time as the rest of the application traffic.

The K6 scripts simulate browser media loading by requesting the stream endpoint using range requests and `responseType: "none"` so K6 does not keep large video bodies in memory.

The scripts validate stream responses by checking:

- media status: `200`, `206`, or valid end-of-range `416`
- video-compatible `Content-Type`
- valid `Content-Range` headers for partial responses

The stream is paced so virtual users remain watching for the expected video duration instead of instantly downloading and exiting.

## Video Pool And Duration Selection

The upload pool uses real files under `k6/videos`:

- one `~1 minute` video
- two `~3 minute` videos
- two `~10 minute` videos
- one `~40 minute` video

The upload probability distribution is intentionally skewed:

- `1 minute`: common
- `3 minutes`: common
- `10 minutes`: less common
- `40 minutes`: rare

For reproduction, the scripts maintain a map:

```js
{
  60: [videoIds],
  180: [videoIds],
  600: [videoIds],
  2400: [videoIds]
}
```

When watching a video, K6 first chooses a duration using the same weighted probability as uploads, then randomly chooses a video ID from that duration bucket.

This prevents every virtual user from watching the same video and keeps watch traffic aligned with the upload distribution.

## Synthetic Dataset

Each project has a `bootstrap.js` script intended to create enough data before the actual tests run.

The dataset exists so tests do not start from zero. Without seed data, users would not have videos to watch, comments to load, subscriptions to fetch, or uploader/user pages to render.

The synthetic dataset includes:

- users
- user identities / provider subjects where required
- 6 videos, one for each fixture in the upload pool
- video files and thumbnails
- 1000 comments distributed across the seeded videos
- subscriptions

Seeded values can be simple and deterministic, such as:

- `user-1`
- `user-2`
- `video-title-1`
- `description-1`

The content does not need to be realistic text. It only needs to satisfy backend validation and create realistic enough database shape and media load.

Bootstrap is also responsible for writing a seed manifest for the matching project:

- Braulio: `k6/Braulio/seed-manifest-braulio.json`
- Cristobal: `k6/Cristobal/seed-manifest-cristobal.json`
- German: `k6/German/seed-manifest-german.json`

The manifest records:

- exact created `userIds`
- exact created `videoIds`
- video metadata by ID
- video IDs bucketed by duration
- created comment count
- German auth metadata showing seeded users authenticate through `/auth/token`

All stress, spike, soak, and load tests must load this manifest before running. They must not assume users were created as contiguous IDs such as `1..3000`; that assumption breaks when the database is not empty and is especially unsafe for German because JWTs are generated from the selected user ID.

## User Identity Model

Each K6 virtual user maps to one seeded user ID from the bootstrap manifest.

This matters because user-dependent actions should not use hidden defaults. The action should receive the seeded `userId` explicitly.

German's project uses JWT authentication. For German, the VU gets a token for its assigned user and passes that token to authenticated requests.

Braulio and Cristobal do not use the same JWT flow, so their scripts pass `userId` through request fields or query parameters where the frontend/backend expects it.

## Validation Utilities

Each project has a `utils.js` file exporting endpoint response checkers.

The checkers validate only complete endpoint response objects. They do not export every nested sub-object checker separately. The top-level checker is responsible for validating its nested fields.

This keeps the test code focused on endpoint contract validation instead of internal schema fragments.

## Metrics Collected

K6 collects standard metrics such as:

- request duration
- request failure rate
- throughput
- checks passed/failed
- per-action and per-endpoint tags

The test plan also includes measuring total EC2 instance resource usage:

- CPU
- memory
- container health/restarts

Because all projects are tested on the same instance and with the same action distribution, the comparison should be consistent.

## Current Implementation Notes

The shared action selector chooses actions by weight. The current `watchVideo` action includes:

- video detail request
- comments request
- recommended videos request
- rendered thumbnail requests
- media stream range requests
- view increment request where that project frontend does it

The upload action includes:

- `POST /videos/upload`
- Braulio: `GET /videos?offset=0&limit=20`
- Cristobal: `GET /videos`
- German: no immediate video-list GET; upload success only invalidates inactive/related query caches locally before watch navigation

The main page action includes the same initial video/user/provider/subscription fetches the frontend triggers, plus browser image requests for rendered thumbnails and avatars.

## Things To Watch Carefully

- Keep endpoint maps and K6 scripts synchronized with the real frontend.
- Do not add artificial caps to image or media requests if the frontend does not cap them.
- Keep upload, watch, scroll, and comment actions separate unless the frontend truly performs them as one user action.
- Confirm whether each backend stores or returns video duration. If it does not, the K6 script must use the upload-selected duration as fallback.
- Do not run K6 commands in this repo. Use static checks and code review for K6 script changes unless a separate safe runtime is explicitly provided.
- Run tests from a clean, seeded database when comparing projects.
