import actions from "./common.js";

const PROJECT = "Cristobal";
const USER_COUNT = 3000;
const VIDEO_COUNT = 500;
const COMMENT_COUNT = 5000;

const seedManifest = {
    project: PROJECT,
    generatedAt: null,
    userIds: [],
    videosById: {},
    videosByDuration: { 60: [], 180: [], 600: [], 2400: [] },
    videoIds: [],
    commentCount: 0,
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

function recordUser(user) {
    if (user && Number.isFinite(user.id)) {
        seedManifest.userIds.push(user.id);
    }
}

function videoDuration(video, selection) {
    return Number(video && (video.duration_seconds || video.durationSeconds || video.duration)) || selection.durationSeconds;
}

function recordVideo(video, selection) {
    if (!video || !Number.isFinite(video.id)) return;

    const durationSeconds = videoDuration(video, selection);
    seedManifest.videoIds.push(video.id);
    seedManifest.videosById[String(video.id)] = {
        id: video.id,
        durationSeconds,
        title: video.title || null,
    };

    const bucket = String(durationSeconds);
    if (!seedManifest.videosByDuration[bucket]) {
        seedManifest.videosByDuration[bucket] = [];
    }
    seedManifest.videosByDuration[bucket].push(video.id);
}

export default function bootstrap() {
    seedManifest.generatedAt = new Date().toISOString();

    for (let index = 1; index <= USER_COUNT; index += 1) {
        const user = actions.createUser({
            displayName: `user-${index}`,
            provider: "local",
            providerSubject: `user-${index}`,
            email: `user-${index}@example.test`,
        });
        recordUser(user);
        if (index % 250 === 0) console.log(`Created ${index}/${USER_COUNT} users`);
    }

    if (seedManifest.userIds.length === 0) {
        throw new Error("Bootstrap could not create users.");
    }

    for (let index = 1; index <= VIDEO_COUNT; index += 1) {
        const userId = seedManifest.userIds[(index - 1) % seedManifest.userIds.length];
        const videoSelection = actions.pickSeedVideoSelection(index);
        const video = actions.uploadVideo({
            userId,
            title: `video-${index}`,
            description: `description-${index}`,
            category: "music",
            videoSelection,
        });
        recordVideo(video, videoSelection);
        if (index % 50 === 0) console.log(`Uploaded ${index}/${VIDEO_COUNT} videos`);
    }

    if (seedManifest.videoIds.length === 0) {
        throw new Error("Bootstrap could not create enough videos to continue with comments.");
    }

    for (let index = 1; index <= COMMENT_COUNT; index += 1) {
        const videoId = seedManifest.videoIds[(index - 1) % seedManifest.videoIds.length];
        const comment = actions.addComment({
            videoId,
            author: `user-${index}`,
            content: `comment-${index}`,
        });
        if (comment) seedManifest.commentCount += 1;
        if (index % 500 === 0) console.log(`Created ${index}/${COMMENT_COUNT} comments`);
    }
}

export function handleSummary() {
    return {
        "seed-manifest-cristobal.json": JSON.stringify(seedManifest, null, 2),
        stdout: `Seed manifest: ${seedManifest.userIds.length} users, ${seedManifest.videoIds.length} videos, ${seedManifest.commentCount} comments\n`,
    };
}
