import actions from "./common.js";
import repository from "./repository.js";

const USER_COUNT = 3000;
const VIDEO_COUNT = 50;
const COMMENT_COUNT = 1000;
const ONE_MINUTE = {
    filename: "one-minute.mp4",
    contentType: "video/mp4",
    durationSeconds: 60,
    data: open("../videos/one-minute.mp4", "b"),
};
const THREE_MINUTE = {
    filename: "three-minute-a.mp4",
    contentType: "video/mp4",
    durationSeconds: 180,
    data: open("../videos/three-minute-a.mp4", "b"),
};
const TEN_MINUTE = {
    filename: "ten-minute-a.mp4",
    contentType: "video/mp4",
    durationSeconds: 600,
    data: open("../videos/ten-minute-a.mp4", "b"),
};
const FORTY_MINUTE = {
    filename: "forty-minute.mp4",
    contentType: "video/mp4",
    durationSeconds: 2400,
    data: open("../videos/forty-minute.mp4", "b"),
};

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
    const uploadSeededVideo = (videoSelection) => {
        if (uploadedCount >= VIDEO_COUNT) return;
        const userId = userIds[uploadedCount % userIds.length];
        const video = actions.uploadVideo(
            userId,
            "",
            `video-${uploadedCount + 1}`,
            `description-${uploadedCount + 1}`,
            videoSelection,
        );
        if (!video) return;
        repository.registerVideo(video.id, videoSelection.durationSeconds);
        uploadedCount += 1;
    };

    for (let i = 0; i < 23; i += 1) uploadSeededVideo(ONE_MINUTE);
    for (let i = 0; i < 18; i += 1) uploadSeededVideo(THREE_MINUTE);
    for (let i = 0; i < 8; i += 1) uploadSeededVideo(TEN_MINUTE);
    for (let i = 0; i < 1; i += 1) uploadSeededVideo(FORTY_MINUTE);

    if (uploadedCount === 0) {
        throw new Error("Bootstrap could not create enough videos to continue with comments.");
    }

    let commentCount = 0;
    for (let index = 1; index <= COMMENT_COUNT; index += 1) {
        const tuple = authTuples[(index - 1) % authTuples.length];
        const comment = actions.addComment(tuple[0], tuple[1], `comment-${index}`);
        if (comment) commentCount += 1;
    }

    const seededVideosByDuration = {
        60: [...repository.videosByDuration[60]],
        180: [...repository.videosByDuration[180]],
        600: [...repository.videosByDuration[600]],
        2400: [...repository.videosByDuration[2400]],
    };

    console.log(`Seeded users=${authTuples.length}, comments=${commentCount}`);
    return { authTuples, seededVideosByDuration };
}
