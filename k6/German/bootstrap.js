import actions from "./common.js";
import repository from "./repository.js";

const USER_COUNT = 3000;
const VIDEO_COUNT = 6;
const COMMENT_COUNT = 1000;

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
    }

    if (userIds.length === 0) {
        throw new Error("Bootstrap could not create users.");
    }

    for (const userId of userIds) {
        const token = actions.getAuthToken(userId, "bootstrap");
        if (token) {
            authTuples.push([userId, token]);
        }
    }

    repository.resetVideos();
    for (let index = 1; index <= VIDEO_COUNT; index += 1) {
        const tuple = authTuples[(index - 1) % authTuples.length];
        const userId = tuple ? tuple[0] : null;
        const token = tuple ? tuple[1] : null;
        if (!token) continue;

        const videoSelection = actions.pickSeedVideoSelection(index);
        const video = actions.uploadVideo(userId, token, `video-${index}`, `description-${index}`, videoSelection);

        if (!video) continue;
        repository.registerVideo(video.id, videoSelection.durationSeconds);
    }

    if (!repository.hasVideos()) {
        throw new Error("Bootstrap could not create enough videos to continue with comments.");
    }

    let commentCount = 0;
    for (let index = 1; index <= COMMENT_COUNT; index += 1) {
        const tuple = authTuples[(index - 1) % authTuples.length];
        const userId = tuple ? tuple[0] : null;
        const token = tuple ? tuple[1] : null;
        if (!token) continue;

        const comment = actions.addComment(userId, token, `comment-${index}`);
        if (comment) commentCount += 1;
    }

    console.log(`Seeded users=${authTuples.length}, comments=${commentCount}`);
    return authTuples;
}

export default function bootstrap() {
    return seedData();
}
