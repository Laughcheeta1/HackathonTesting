import actions from "./common.js";
import repository from "./repository.js";

const USER_COUNT = 3000;
const VIDEO_COUNT = 50;
const COMMENT_COUNT = 1000;
const UPLOAD_PLAN = [
    { seedIndex: 1, count: 23 },   // 60s  (45%)
    { seedIndex: 46, count: 18 },  // 180s (36%)
    { seedIndex: 82, count: 8 },   // 600s (16%)
    { seedIndex: 98, count: 1 },   // 2400s (3%)
];

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
    const userIds = [];
    const authTuples = [];

    for (let index = 1; index <= USER_COUNT; index += 1) {
        const user = actions.createUser(`user-${index}`, "local", `user-${index}`, `user-${index}@example.test`);
        if (!user) continue;
        userIds.push(user.id);
        authTuples.push([user.id, ""]);
    }

    if (userIds.length === 0) {
        throw new Error("Bootstrap could not create users.");
    }

    repository.resetVideos();
    let uploadedCount = 0;
    UPLOAD_PLAN.forEach(({ seedIndex, count }) => {
        for (let planIndex = 0; planIndex < count; planIndex += 1) {
            if (uploadedCount >= VIDEO_COUNT) break;
            const userId = userIds[uploadedCount % userIds.length];
            const videoSelection = actions.pickSeedVideoSelection(seedIndex);
            const video = actions.uploadVideo(
                userId,
                "",
                `video-${uploadedCount + 1}`,
                `description-${uploadedCount + 1}`,
                "music",
                videoSelection,
            );

            if (!video) continue;
            repository.registerVideo(video.id, videoSelection.durationSeconds);
            uploadedCount += 1;
        }
    });

    if (uploadedCount === 0) {
        throw new Error("Bootstrap could not create enough videos to continue with comments.");
    }

    let commentCount = 0;
    for (let index = 1; index <= COMMENT_COUNT; index += 1) {
        const tuple = authTuples[(index - 1) % authTuples.length];
        const comment = actions.addComment(tuple[0], tuple[1], `comment-${index}`);
        if (comment) commentCount += 1;
    }

    console.log(`Seeded users=${authTuples.length}, comments=${commentCount}`);
    return authTuples;
}

export default function bootstrap() {
    return seedData();
}
