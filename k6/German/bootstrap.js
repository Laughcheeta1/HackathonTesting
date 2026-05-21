import actions, { VIDEO_POOL } from "./common.js";
import repository from "./repository.js";
import http from "k6/http";

const USER_COUNT = 3000;
const VIDEO_COUNT = 50;
const COMMENT_COUNT = 1000;
const ONE_MINUTE = VIDEO_POOL[0];
const THREE_MINUTE = VIDEO_POOL[1];
const TEN_MINUTE = VIDEO_POOL[2];
const FORTY_MINUTE = VIDEO_POOL[3];

function logProgress(label, count, total, step = 100) {
    if (count === 0 || count === total || count % step === 0) {
        console.log(`[bootstrap] ${label}: ${count}/${total}`);
    }
}

function asMultipartVideoFile(videoSelection) {
    return http.file(videoSelection.data, videoSelection.filename, videoSelection.contentType);
}

export const options = {
    vus: 1,
    iterations: 1,
    setupTimeout: "10m",
    teardownTimeout: "10m",
    thresholds: {
        checks: ["rate>0.95"],
    },
};

export function seedData() {
    console.log(
        `[bootstrap] Starting seed: users=${USER_COUNT}, videos=${VIDEO_COUNT}, comments=${COMMENT_COUNT}`,
    );

    // 1) Seed users first, because all subsequent actions (JWT, uploads, comments)
    // depend on having valid user identities.
    const userIds = [];
    const authTuples = [];

    console.log("[bootstrap] Creating users...");
    logProgress("users created", 0, USER_COUNT);
    for (let index = 1; index <= USER_COUNT; index += 1) {
        const user = actions.createUser(`user-${index}`, "local", `user-${index}`, `user-${index}@example.test`);
        if (!user) continue;
        userIds.push(user.id);
        logProgress("users created", userIds.length, USER_COUNT);
    }

    if (userIds.length === 0) {
        throw new Error("Bootstrap could not create users.");
    }
    console.log(`[bootstrap] Finished users: ${userIds.length}/${USER_COUNT}`);

    // 2) Resolve JWT token per seeded user (German project uses authenticated endpoints).
    console.log("[bootstrap] Resolving auth tokens...");
    logProgress("auth tokens resolved", 0, userIds.length);
    for (const userId of userIds) {
        const token = actions.getAuthToken(userId, "bootstrap");
        if (token) {
            authTuples.push([userId, token]);
            logProgress("auth tokens resolved", authTuples.length, userIds.length);
        }
    }
    console.log(`[bootstrap] Finished auth tokens: ${authTuples.length}/${userIds.length}`);

    // 3) Build the deterministic initial video corpus and register IDs by duration.
    repository.resetVideos();
    let uploadedCount = 0;
    console.log("[bootstrap] Uploading seed videos...");
    logProgress("videos uploaded", 0, VIDEO_COUNT, 1);
    const uploadSeededVideo = (videoSelection) => {
        if (uploadedCount >= VIDEO_COUNT) return;
        // Spread uploads over the seeded identities to avoid a single-uploader bias.
        const tuple = authTuples[uploadedCount % authTuples.length];
        const userId = tuple ? tuple[0] : null;
        const token = tuple ? tuple[1] : null;
        if (!token) return;

        const video = actions.uploadVideo(
            userId,
            token,
            `video-${uploadedCount + 1}`,
            `description-${uploadedCount + 1}`,
            asMultipartVideoFile(videoSelection),
        );
        if (!video) return;
        // Repository is the source for runtime random watch/comment video selection.
        repository.registerVideo(video.id, videoSelection.durationSeconds);
        uploadedCount += 1;
        logProgress("videos uploaded", uploadedCount, VIDEO_COUNT, 1);
    };

    // Hardcoded distribution (50 total) matching the target duration weights.
    for (let i = 0; i < 23; i += 1) uploadSeededVideo(ONE_MINUTE);
    for (let i = 0; i < 18; i += 1) uploadSeededVideo(THREE_MINUTE);
    for (let i = 0; i < 8; i += 1) uploadSeededVideo(TEN_MINUTE);
    for (let i = 0; i < 1; i += 1) uploadSeededVideo(FORTY_MINUTE);

    if (uploadedCount === 0) {
        throw new Error("Bootstrap could not create enough videos to continue with comments.");
    }
    console.log(`[bootstrap] Finished seed videos: ${uploadedCount}/${VIDEO_COUNT}`);

    // 4) Seed comment load after videos exist; rotate through seeded users.
    let commentCount = 0;
    console.log("[bootstrap] Creating comments...");
    logProgress("comments created", 0, COMMENT_COUNT);
    for (let index = 1; index <= COMMENT_COUNT; index += 1) {
        const tuple = authTuples[(index - 1) % authTuples.length];
        const userId = tuple ? tuple[0] : null;
        const token = tuple ? tuple[1] : null;
        if (!token) continue;

        const comment = actions.addComment(userId, token, `comment-${index}`);
        if (comment) {
            commentCount += 1;
            logProgress("comments created", commentCount, COMMENT_COUNT);
        }
    }
    console.log(`[bootstrap] Finished comments: ${commentCount}/${COMMENT_COUNT}`);

    // 5) Return setup payload consumed by each VU:
    //    - auth tuples for identity/token assignment
    //    - seeded video IDs per duration bucket for repository hydration
    const seededVideosByDuration = {
        60: [...repository.videosByDuration[60]],
        180: [...repository.videosByDuration[180]],
        600: [...repository.videosByDuration[600]],
        2400: [...repository.videosByDuration[2400]],
    };

    console.log(
        `[bootstrap] Complete: users=${authTuples.length}, videos=${uploadedCount}, comments=${commentCount}`,
    );
    return { authTuples, seededVideosByDuration };
}
