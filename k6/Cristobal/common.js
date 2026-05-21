import http from "k6/http";
import { check, sleep } from "k6";
import checker from "./utils.js";
import repository from "./repository.js";

const BASE_URL = "http://localhost:8000";
const PROJECT = "Cristobal";
const STREAM_CHUNK_SECONDS = 5;
const STREAM_RANGE_WINDOW_BYTES = 1024 * 1024;

export const VIDEO_POOL = [
    { id: 1, filename: "one-minute.mp4", durationSeconds: 60, weight: 60, contentType: "video/mp4", data: open("../videos/one-minute.mp4", "b") },
    { id: 2, filename: "three-minute-a.mp4", durationSeconds: 180, weight: 40, contentType: "video/mp4", data: open("../videos/three-minute-a.mp4", "b") },
];
const GENERATED_FRAME_THUMBNAIL = open("../videos/frame-thumbnail.jpg", "b");

function url(path) {
    return `${BASE_URL}${path}`;
}

function assetUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return url(path);
}

function requestParams(action, endpoint, extra = {}) {
    return {
        ...extra,
        tags: {
            project: PROJECT,
            action,
            endpoint,
            ...(extra.tags || {}),
        },
    };
}

function jsonParams(action, endpoint) {
    return requestParams(action, endpoint, {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
    });
}

function multipartParams(action, endpoint) {
    return requestParams(action, endpoint, {
        headers: {
            Accept: "application/json",
        },
    });
}

function mediaParams(action, endpoint, range) {
    return requestParams(action, endpoint, {
        headers: {
            Accept: "video/webm,video/mp4,video/*;q=0.9,*/*;q=0.8",
            ...(range ? { Range: range } : {}),
        },
        responseType: "none",
    });
}

function imageParams(action, endpoint) {
    return requestParams(action, endpoint, {
        headers: {
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        responseType: "none",
    });
}

function parseJson(response) {
    try {
        return response.json();
    } catch (error) {
        return null;
    }
}

function defaultFile(filename, contentType) {
    return http.file("k6-placeholder", filename, contentType);
}

function generatedFrameThumbnail() {
    return http.file(GENERATED_FRAME_THUMBNAIL, "frame-thumbnail.jpg", "image/jpeg");
}

function selectedVideoFile(selection) {
    return http.file(selection.data, selection.filename, selection.contentType);
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(minLength, maxLength) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const length = randomInt(minLength, maxLength);
    let value = "";
    for (let index = 0; index < length; index += 1) {
        value += characters[Math.floor(Math.random() * characters.length)];
    }
    return value;
}

function randomName() {
    return randomString(12, 24);
}

function pickVideoTemplate() {
    const probability = Math.random();
    if (probability < 0.60) return VIDEO_POOL[0];
    return VIDEO_POOL[1];
}

function seededUserContextForVu(authTuples) {
    if (!Array.isArray(authTuples) || authTuples.length === 0) {
        throw new Error("No seeded auth tuples were provided by setup().");
    }
    return authTuples[(__VU - 1) % authTuples.length];
}

function pickWeightedDurationSeconds() {
    const probability = Math.random();
    if (probability < 0.60) return 60;
    return 180;
}

function pickVideoSelectionByDurationMap() {
    const pickedDuration = pickWeightedDurationSeconds();
    const videoId = repository.getRandomVideoId(pickedDuration);
    if (!videoId) {
        throw new Error(`Repository has no videos for duration ${pickedDuration}.`);
    }
    return { id: videoId, durationSeconds: pickedDuration };
}

function checkJson(response, name, validator) {
    check(response, {
        [name]: (r) => r.status === 200 && validator(parseJson(r)),
    });
}

function checkStatus(response, name, expectedStatuses = [200]) {
    const statuses = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
    check(response, {
        [name]: (r) => statuses.includes(r.status),
    });
}

function headerValue(headers, name) {
    const target = name.toLowerCase();
    const found = Object.keys(headers || {}).find((key) => key.toLowerCase() === target);
    return found ? String(headers[found]) : "";
}

function isVideoContentType(response) {
    const contentType = headerValue(response.headers, "Content-Type").toLowerCase();
    return contentType.includes("video/") || contentType.includes("application/octet-stream");
}

function checkVideoChunk(response) {
    check(response, {
        "stream chunk has media status": (r) => r.status === 200 || r.status === 206 || r.status === 416,
        "stream chunk has video content type": isVideoContentType,
        "stream partial response has content range": (r) =>
            r.status !== 206 || headerValue(r.headers, "Content-Range").toLowerCase().startsWith("bytes "),
        "stream 416 has unsatisfied range header": (r) =>
            r.status !== 416 || headerValue(r.headers, "Content-Range").toLowerCase().startsWith("bytes */"),
    });
}

function getVisibleVideoThumbnailUrls(videoListResponse) {
    const body = parseJson(videoListResponse);
    return (Array.isArray(body) ? body : [])
        .filter((video) => video.thumbnail_url)
        .map((video) => video.thumbnail_url);
}

function getVisibleUploaderAvatarUrls(videoListResponse) {
    const body = parseJson(videoListResponse);
    return (Array.isArray(body) ? body : [])
        .filter((video) => video.uploader && video.uploader.avatar_url)
        .map((video) => video.uploader.avatar_url);
}

function getVisibleUserAvatarUrls(userListResponse) {
    const body = parseJson(userListResponse);
    return (Array.isArray(body) ? body : [])
        .filter((user) => user.avatar_url)
        .map((user) => user.avatar_url);
}

function getCurrentUserAvatarUrl(userListResponse, userId) {
    const body = parseJson(userListResponse);
    const users = Array.isArray(body) ? body : [];
    const currentUser = users.find((user) => user.id === userId);
    return currentUser && currentUser.avatar_url ? currentUser.avatar_url : null;
}

function requestVideoThumbnails(thumbnailUrls, action) {
    [...new Set(thumbnailUrls)].forEach((thumbnailUrl) => {
        const response = http.get(
            assetUrl(thumbnailUrl),
            imageParams(action, "videoThumbnail"),
        );
        checkStatus(response, "thumbnail status is valid", [200, 404]);
    });
}

function requestUserAvatars(avatarUrls, action) {
    [...new Set(avatarUrls.filter(Boolean))].forEach((avatarUrl) => {
        const response = http.get(
            assetUrl(avatarUrl),
            imageParams(action, "userAvatar"),
        );
        checkStatus(response, "avatar status is valid", [200, 404]);
    });
}

function openMainPage(userId) {
    const [videos, users, providers, subscriptions] = http.batch([
        ["GET", url("/videos"), null, requestParams("openMainPage", "listVideos")],
        ["GET", url("/users?limit=500&offset=0"), null, requestParams("openMainPage", "listUsers")],
        ["GET", url("/users/providers"), null, requestParams("openMainPage", "listProviders")],
        ["GET", url(`/users/${userId}/subscriptions?limit=500&offset=0`), null, requestParams("openMainPage", "listSubscriptions")],
    ]);

    check(videos, {
        "main page videos response is valid": (r) => r.status === 200 && checker.checkVideoArrayResponse(parseJson(r)),
    });
    checkJson(users, "main page users response is valid", checker.checkUserArrayResponse);
    checkJson(providers, "providers response is valid", checker.checkProvidersObject);
    checkJson(subscriptions, "subscriptions response is valid", checker.checkSubscriptionsObject);

    requestVideoThumbnails(getVisibleVideoThumbnailUrls(videos), "openMainPage");
    requestUserAvatars([
        ...getVisibleUploaderAvatarUrls(videos),
        getCurrentUserAvatarUrl(users, userId),
    ], "openMainPage");
}

function openUserPage(userId) {
    const [users, providers, subscriptions] = http.batch([
        ["GET", url("/users?limit=500&offset=0"), null, requestParams("openUserPage", "listUsers")],
        ["GET", url("/users/providers"), null, requestParams("openUserPage", "listProviders")],
        ["GET", url(`/users/${userId}/subscriptions?limit=500&offset=0`), null, requestParams("openUserPage", "listSubscriptions")],
    ]);

    checkJson(users, "user page users response is valid", checker.checkUserArrayResponse);
    checkJson(providers, "providers response is valid", checker.checkProvidersObject);
    checkJson(subscriptions, "subscriptions response is valid", checker.checkSubscriptionsObject);

    requestUserAvatars([
        ...getVisibleUserAvatarUrls(users),
        getCurrentUserAvatarUrl(users, userId),
    ], "openUserPage");
}

function createUser(
    displayName = randomName(),
    provider = "local",
    providerSubject = `k6-user-${__VU}-${__ITER}-${Date.now()}`,
    email = `k6-user-${__VU}-${__ITER}-${Date.now()}@example.test`,
    avatar = defaultFile("avatar.jpg", "image/jpeg"),
) {
    const response = http.post(
        url("/users"),
        {
            display_name: displayName,
            provider,
            provider_subject: providerSubject,
            email,
            avatar,
        },
        multipartParams("createUser", "createUser"),
    );
    checkJson(response, "created user response is valid", checker.checkUserObject);

    const users = http.get(
        url("/users?limit=500&offset=0"),
        requestParams("createUser", "refreshUsers"),
    );
    checkJson(users, "refreshed users response is valid", checker.checkUserArrayResponse);

    const providers = http.get(
        url("/users/providers"),
        requestParams("createUser", "refreshProviders"),
    );
    checkJson(providers, "refreshed providers response is valid", checker.checkProvidersObject);

    const createdUser = response.status === 200 ? parseJson(response) : null;
    if (createdUser && createdUser.avatar_url) {
        requestUserAvatars([createdUser.avatar_url], "createUser");
    }
    return createdUser;
}

function uploadVideo(
    userId,
    token,
    title = randomString(20, 45),
    description = randomString(120, 260),
    category = "music",
    videoSelection = pickVideoTemplate(),
    videoFile = selectedVideoFile(videoSelection),
    thumbnail = generatedFrameThumbnail(),
) {
    const response = http.post(
        url("/videos/upload"),
        {
            title,
            description,
            category,
            uploader_id: userId,
            file: videoFile,
            thumbnail,
        },
        multipartParams("uploadVideo", "uploadVideo"),
    );
    checkJson(response, "uploaded video response is valid", checker.checkVideoObject);

    const createdVideo = response.status === 200 ? parseJson(response) : null;

    const refreshedVideos = http.get(
        url("/videos"),
        requestParams("uploadVideo", "refreshVideos"),
    );
    checkJson(refreshedVideos, "post-upload videos refresh response is valid", checker.checkVideoArrayResponse);

    return createdVideo;
}

function watchVideo(chunkSeconds = STREAM_CHUNK_SECONDS) {
    const videoSelection = pickVideoSelectionByDurationMap();
    const [video, comments, recommended] = http.batch([
        ["GET", url(`/videos/${videoSelection.id}`), null, requestParams("watchVideo", "getVideo")],
        ["GET", url(`/videos/${videoSelection.id}/comments`), null, requestParams("watchVideo", "listComments")],
        ["GET", url(`/videos/${videoSelection.id}/recommended`), null, requestParams("watchVideo", "recommendedVideos")],
    ]);

    checkJson(video, "watch video response is valid", checker.checkVideoObject);
    checkJson(comments, "watch comments response is valid", checker.checkCommentArrayResponse);
    checkJson(recommended, "recommended videos response is valid", checker.checkVideoArrayResponse);

    requestVideoThumbnails(getVisibleVideoThumbnailUrls(recommended), "watchVideo");

    const chunkCount = Math.max(1, Math.ceil(videoSelection.durationSeconds / chunkSeconds));
    const startedAt = Date.now();
    let nextOffset = 0;

    let didIncrementView = false;

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
        const range =
            chunkIndex === 0
                ? "bytes=0-"
                : `bytes=${nextOffset}-${nextOffset + STREAM_RANGE_WINDOW_BYTES - 1}`;

        const stream = http.get(
            url(`/videos/${videoSelection.id}/stream`),
            mediaParams("watchVideo", "streamVideo", range),
        );
        checkVideoChunk(stream);

        if (!didIncrementView && (stream.status === 200 || stream.status === 206)) {
            didIncrementView = true;
            const views = http.post(
                url(`/videos/${videoSelection.id}/views`),
                null,
                requestParams("watchVideo", "incrementViews", {
                    headers: { Accept: "application/json" },
                }),
            );
            checkJson(views, "view increment response is valid", checker.checkVideoObject);

            const refreshedVideo = http.get(
                url(`/videos/${videoSelection.id}`),
                requestParams("watchVideo", "refreshVideoAfterView"),
            );
            checkJson(refreshedVideo, "post-view video refresh response is valid", checker.checkVideoObject);
        }

        if (stream.status === 416) {
            break;
        }

        if (stream.status === 200) {
            break;
        }

        const contentRange = headerValue(stream.headers, "Content-Range");
        const rangeMatch = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(contentRange);
        if (rangeMatch) {
            nextOffset = Number(rangeMatch[2]) + 1;
        } else {
            nextOffset += STREAM_RANGE_WINDOW_BYTES;
        }

        const targetElapsedSeconds = Math.min(videoSelection.durationSeconds, (chunkIndex + 1) * chunkSeconds);
        const elapsedSeconds = (Date.now() - startedAt) / 1000;
        if (targetElapsedSeconds > elapsedSeconds) {
            sleep(targetElapsedSeconds - elapsedSeconds);
        }
    }

    const elapsedSeconds = (Date.now() - startedAt) / 1000;
    if (videoSelection.durationSeconds > elapsedSeconds) {
        sleep(videoSelection.durationSeconds - elapsedSeconds);
    }
}

function addComment(userId, token, content = randomString(40, 120), author = randomName()) {
    const videoSelection = pickVideoSelectionByDurationMap();
    const response = http.post(
        url(`/videos/${videoSelection.id}/comments`),
        JSON.stringify({ author, content }),
        jsonParams("addComment", "addComment"),
    );
    checkJson(response, "created comment response is valid", checker.checkCommentObject);

    const comments = http.get(
        url(`/videos/${videoSelection.id}/comments`),
        requestParams("addComment", "refreshComments"),
    );
    checkJson(comments, "refreshed comments response is valid", checker.checkCommentArrayResponse);

    return response.status === 200 ? parseJson(response) : null;
}

function selectAction(userId, token) {
    const probability = Math.random();

    if (probability < 0.36) {
        return openMainPage(userId);
    }
    if (probability < 0.41) {
        return openUserPage(userId);
    }
    if (probability < 0.42) {
        return createUser();
    }
    if (probability < 0.421) {
        return uploadVideo(userId, token);
    }
    if (probability < 0.95) {
        return watchVideo();
    }
    return addComment(userId, token);
}

export default {
    seededUserContextForVu,
    openMainPage,
    openUserPage,
    createUser,
    uploadVideo,
    watchVideo,
    addComment,
    selectAction,
};
