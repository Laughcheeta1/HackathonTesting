import http from "k6/http";
import { check } from "k6";

const BASE_URL = "http://localhost:8000";
const USER_COUNT = 3000;
const VIDEO_COUNT = 500;
const COMMENT_COUNT = 5000;

const VIDEO_FILES = [
    { filename: "one-minute.mp4", contentType: "video/mp4", data: open("../videos/one-minute.mp4", "b"), weight: 45 },
    { filename: "three-minute-a.mp4", contentType: "video/mp4", data: open("../videos/three-minute-a.mp4", "b"), weight: 18 },
    { filename: "three-minute-b.mp4", contentType: "video/mp4", data: open("../videos/three-minute-b.mp4", "b"), weight: 18 },
    { filename: "ten-minute-a.mp4", contentType: "video/mp4", data: open("../videos/ten-minute-a.mp4", "b"), weight: 8 },
    { filename: "ten-minute-b.mp4", contentType: "video/mp4", data: open("../videos/ten-minute-b.mp4", "b"), weight: 8 },
    { filename: "forty-minute.mp4", contentType: "video/mp4", data: open("../videos/forty-minute.mp4", "b"), weight: 3 },
];

const THUMBNAIL = open("../videos/frame-thumbnail.jpg", "b");

export const options = {
    vus: 1,
    iterations: 1,
    setupTimeout: "10m",
    teardownTimeout: "10m",
    thresholds: {
        checks: ["rate>0.95"],
    },
};

function url(path) {
    return `${BASE_URL}${path}`;
}

function multipartParams() {
    return {
        headers: { Accept: "application/json" },
        tags: { project: "Cristobal", action: "bootstrap" },
    };
}

function jsonParams() {
    return {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        tags: { project: "Cristobal", action: "bootstrap" },
    };
}

function parseJson(response) {
    try {
        return response.json();
    } catch (error) {
        return null;
    }
}

function pickWeighted(index, items) {
    const totalWeight = items.reduce((total, item) => total + item.weight, 0);
    let cursor = index % totalWeight;

    for (const item of items) {
        cursor -= item.weight;
        if (cursor < 0) {
            return item;
        }
    }

    return items[items.length - 1];
}

function createUser(index) {
    const response = http.post(
        url("/users"),
        {
            display_name: `user-${index}`,
            provider: "local",
            provider_subject: `user-${index}`,
            email: `user-${index}@example.test`,
            avatar: http.file(`avatar-${index}`, `avatar-${index}.jpg`, "image/jpeg"),
        },
        multipartParams(),
    );

    check(response, {
        "bootstrap user created": (r) => r.status === 200,
    });

    const body = response.status === 200 ? parseJson(response) : null;
    return body && body.id ? body.id : null;
}

function uploadVideo(index, userId) {
    const selected = pickWeighted(index, VIDEO_FILES);
    const response = http.post(
        url("/videos/upload"),
        {
            title: `video-${index}`,
            description: `description-${index}`,
            category: "music",
            uploader_id: userId,
            file: http.file(selected.data, selected.filename, selected.contentType),
            thumbnail: http.file(THUMBNAIL, `thumbnail-${index}.jpg`, "image/jpeg"),
        },
        multipartParams(),
    );

    check(response, {
        "bootstrap video uploaded": (r) => r.status === 200,
    });

    const body = response.status === 200 ? parseJson(response) : null;
    return body && body.id ? body.id : null;
}

function addComment(index, videoId) {
    const response = http.post(
        url(`/videos/${videoId}/comments`),
        JSON.stringify({
            author: `user-${index}`,
            content: `comment-${index}`,
        }),
        jsonParams(),
    );

    check(response, {
        "bootstrap comment created": (r) => r.status === 200,
    });
}

export default function bootstrap() {
    const userIds = [];
    const videoIds = [];

    for (let index = 1; index <= USER_COUNT; index += 1) {
        const userId = createUser(index);
        if (userId) userIds.push(userId);
        if (index % 250 === 0) console.log(`Created ${index}/${USER_COUNT} users`);
    }

    if (userIds.length === 0) {
        throw new Error("Bootstrap could not create users.");
    }

    for (let index = 1; index <= VIDEO_COUNT; index += 1) {
        const userId = userIds[(index - 1) % userIds.length];
        const videoId = uploadVideo(index, userId);
        if (videoId) videoIds.push(videoId);
        if (index % 50 === 0) console.log(`Uploaded ${index}/${VIDEO_COUNT} videos`);
    }

    if (userIds.length === 0 || videoIds.length === 0) {
        throw new Error("Bootstrap could not create enough users or videos to continue with comments.");
    }

    for (let index = 1; index <= COMMENT_COUNT; index += 1) {
        const videoId = videoIds[(index - 1) % videoIds.length];
        addComment(index, videoId);
        if (index % 500 === 0) console.log(`Created ${index}/${COMMENT_COUNT} comments`);
    }
}
