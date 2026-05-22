import http from "k6/http";
import { check, sleep } from "k6";
import checker from "./utils.js";
import repository from "./repository.js";

const BASE_URL = "http://localhost:80/api";
const PROJECT = "German";
const STREAM_CHUNK_SECONDS = 5;
const STREAM_CHUNK_SLEEP_SECONDS = 0.5;
const STREAM_RANGE_WINDOW_BYTES = 1024 * 1024;

export const VIDEO_POOL = [
    {
        id: 1,
        filename: "one-minute.mp4",
        path: "../videos/one-minute.mp4",
        durationSeconds: 60,
        weight: 100,
        contentType: "video/mp4",
        data: open("../videos/one-minute.mp4", "b"),
    },
];
const GENERATED_FRAME_THUMBNAIL = open("../videos/frame-thumbnail.jpg", "b");

// Verified
function url(path) {
    return `${BASE_URL}${path}`;
}

// Verified
function assetUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    if (path.startsWith("/api/") || path.startsWith("/uploads/")) return `http://localhost:80${path}`;
    return url(path);
}

// Verified
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

// verified
function jsonParams(action, endpoint, extraHeaders = {}) {
    return requestParams(action, endpoint, {
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...extraHeaders,
        },
    });
}

// verified
function multipartParams(action, endpoint, extraHeaders = {}) {
    return requestParams(action, endpoint, {
        headers: {
            Accept: "application/json",
            ...extraHeaders,
        },
    });
}

// verified
function mediaParams(action, endpoint, range) {
    return requestParams(action, endpoint, {
        headers: {
            Accept: "video/webm,video/mp4,video/*;q=0.9,*/*;q=0.8",
            ...(range ? { Range: range } : {}),
        },
        responseType: "none",
    });
}

// Verified
function imageParams(action, endpoint) {
    return requestParams(action, endpoint, {
        headers: {
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
        responseType: "none",
    });
}

// Verified
function parseJson(response) {
    try {
        return response.json();
    } catch (error) {
        return null;
    }
}

// Verified
function queryString(params) {
    const parts = [];
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
    });
    return parts.length ? `?${parts.join("&")}` : "";
}

// Verified
function randomSearchQuery() {
    // 30% chance of searching something in youtube
    if (Math.random() < 0.7) {
        return "";
    }

    // Random search to avoid hitting a cache (that way stressing the endpoint)
    const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
    const length = Math.floor(Math.random() * 10) + 1;
    let value = "";
    for (let index = 0; index < length; index += 1) {
        value += characters[Math.floor(Math.random() * characters.length)];
    }
    return value;
}

// Verified
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Verified
function randomString(minLength, maxLength) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const length = randomInt(minLength, maxLength);
    let value = "";
    for (let index = 0; index < length; index += 1) {
        value += characters[Math.floor(Math.random() * characters.length)];
    }
    return value;
}

function pickVideoTemplate() {
    return VIDEO_POOL[0];
}

// Verified
function seededUserContextForVu(authTuples) {
    if (!Array.isArray(authTuples) || authTuples.length === 0) {
        throw new Error("No seeded auth tuples were provided by setup().");
    }
    return authTuples[(__VU - 1) % authTuples.length];
}

function pickWeightedDurationSeconds() {
    return 60;
}

// Verified
function pickVideoSelectionByDurationMap() {
    const pickedDuration = pickWeightedDurationSeconds();
    const videoId = repository.getRandomVideoId(pickedDuration);
    if (!videoId) {
        throw new Error(`Repository has no videos for duration ${pickedDuration}.`);
    }
    return { id: videoId, durationSeconds: pickedDuration };
}

// Verified
function defaultFile(filename, contentType) {
    return http.file("k6-placeholder", filename, contentType);
}

// Verified
function generatedFrameThumbnail() {
    return http.file(GENERATED_FRAME_THUMBNAIL, "frame-thumbnail.jpg", "image/jpeg");
}

// Verified
function selectedVideoFile(selection) {
    return http.file(selection.data, selection.filename, selection.contentType);
}

// Verified
function checkJson(response, name, validator) {
    check(response, {
        [name]: (r) => r.status === 200 && validator(parseJson(r)),
    });
}

// Verified
function checkStatus(response, name, expectedStatuses = [200]) {
    const statuses = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
    check(response, {
        [name]: (r) => statuses.includes(r.status),
    });
}

// Verified
function headerValue(headers, name) {
    const target = name.toLowerCase();
    const found = Object.keys(headers || {}).find((key) => key.toLowerCase() === target);
    return found ? String(headers[found]) : "";
}

// Verified
function isVideoContentType(response) {
    const contentType = headerValue(response.headers, "Content-Type").toLowerCase();
    return contentType.includes("video/") || contentType.includes("application/octet-stream");
}

// Verified
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

// Verified
function getAuthToken(userId, action = "getAuthToken") {
    const response = http.post(
        url("/auth/token"),
        JSON.stringify({ user_id: userId }),
        jsonParams(action, "authToken"),
    );

    checkJson(response, "auth token response is valid", checker.checkAuthTokenObject);
    const body = response.status === 200 ? parseJson(response) : null;
    return body ? body.access_token : null;
}

// verified
function getVisibleVideoThumbnailUrls(videoListResponse) {
    const body = parseJson(videoListResponse);
    return ((body && body.items) || [])
        .filter((video) => video.thumbnail_url)
        .map((video) => video.thumbnail_url);
}

// Verified
function getVisibleUploaderAvatarUrls(videoListResponse) {
    const body = parseJson(videoListResponse);
    return ((body && body.items) || [])
        .filter((video) => video.uploader && video.uploader.avatar_url)
        .map((video) => video.uploader.avatar_url);
}

// Verified
function getVisibleUserAvatarUrls(userListResponse) {
    const body = parseJson(userListResponse);
    return ((body && body.items) || [])
        .filter((user) => user.avatar_url)
        .map((user) => user.avatar_url);
}

// Verified
function getCurrentUserAvatarUrl(userListResponse, userId) {
    const body = parseJson(userListResponse);
    const users = (body && body.items) || [];
    const currentUser = users.find((user) => user.id === userId);
    return currentUser && currentUser.avatar_url ? currentUser.avatar_url : null;
}

// Verified
function requestVideoThumbnails(thumbnailUrls, action) {
    [...new Set(thumbnailUrls)].forEach((thumbnailUrl) => {
        const response = http.get(
            assetUrl(thumbnailUrl),
            imageParams(action, "videoThumbnail"),
        );
        checkStatus(response, "thumbnail status is valid", [200, 404]);
    });
}

// Verified
function requestUserAvatars(avatarUrls, action) {
    [...new Set(avatarUrls.filter(Boolean))].forEach((avatarUrl) => {
        const response = http.get(
            assetUrl(avatarUrl),
            imageParams(action, "userAvatar"),
        );
        checkStatus(response, "avatar status is valid", [200, 404]);
    });
}

// Verified
function openMainPage(userId) {
    const searchQuery = randomSearchQuery();
    const [videos, users, providers, subscriptions] = http.batch([
        ["GET", url(`/videos${queryString({ limit: 20, offset: 0, q: searchQuery })}`), null, requestParams("openMainPage", "listVideos")],
        ["GET", url("/users?limit=100&offset=0"), null, requestParams("openMainPage", "listUsers")],
        ["GET", url("/users/providers"), null, requestParams("openMainPage", "listProviders")],
        ["GET", url(`/users/${userId}/subscriptions`), null, requestParams("openMainPage", "listSubscriptions")],
    ]);

    check(videos, {
        "main page videos response is valid": (r) =>
            r.status === 200 && checker.checkPaginatedVideoObjectResponse(parseJson(r), Boolean(searchQuery)),
    });
    checkJson(users, "main page users response is valid", checker.checkPaginatedUserObjectResponse);
    checkJson(providers, "providers response is valid", checker.checkProvidersObject);
    checkJson(subscriptions, "subscriptions response is valid", checker.checkSubscriptionsObject);

    requestVideoThumbnails(getVisibleVideoThumbnailUrls(videos), "openMainPage");
    requestUserAvatars([
        ...getVisibleUploaderAvatarUrls(videos),
        getCurrentUserAvatarUrl(users, userId),
    ], "openMainPage");
}

// Verified
function openUserPage(userId) {
    const [users, subscriptions] = http.batch([
        ["GET", url("/users?limit=20&offset=0"), null, requestParams("openUserPage", "listUsers")],
        ["GET", url(`/users/${userId}/subscriptions`), null, requestParams("openUserPage", "listSubscriptions")],
    ]);

    checkJson(users, "user page users response is valid", checker.checkPaginatedUserObjectResponse);
    checkJson(subscriptions, "subscriptions response is valid", checker.checkSubscriptionsObject);
    requestUserAvatars([
        ...getVisibleUserAvatarUrls(users),
        getCurrentUserAvatarUrl(users, userId),
    ], "openUserPage");
}

// Verified
function createUser(
    displayName = randomString(12, 24),
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

    const [contextUsers, providers, pageUsers] = http.batch([
        ["GET", url("/users?limit=100&offset=0"), null, requestParams("createUser", "refreshContextUsers")],
        ["GET", url("/users/providers"), null, requestParams("createUser", "refreshProviders")],
        ["GET", url("/users?limit=20&offset=0"), null, requestParams("createUser", "refreshUsersPage")],
    ]);
    checkJson(contextUsers, "refreshed context users response is valid", checker.checkPaginatedUserObjectResponse);
    checkJson(providers, "refreshed providers response is valid", checker.checkProvidersObject);
    checkJson(pageUsers, "refreshed users page response is valid", checker.checkPaginatedUserObjectResponse);

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
    videoFile = selectedVideoFile(pickVideoTemplate()),
    thumbnail = generatedFrameThumbnail(),
) {
    const response = http.post(
        url("/videos/upload"),
        {
            title,
            description,
            file: videoFile,
            thumbnail,
        },
        multipartParams("uploadVideo", "uploadVideo", { Authorization: `Bearer ${token}` }),
    );
    checkJson(response, "uploaded video response is valid", checker.checkVideoObject);

    return response.status === 200 ? parseJson(response) : null;
}

function watchVideo(chunkSeconds = STREAM_CHUNK_SECONDS) {
    const videoSelection = pickVideoSelectionByDurationMap();
    const [video, comments, recommended] = http.batch([
        ["GET", url(`/videos/${videoSelection.id}`), null, requestParams("watchVideo", "getVideo")],
        ["GET", url(`/videos/${videoSelection.id}/comments`), null, requestParams("watchVideo", "listComments")],
        ["GET", url(`/videos/${videoSelection.id}/recommended`), null, requestParams("watchVideo", "recommendedVideos")],
    ]);

    checkJson(video, "watch video response is valid", checker.checkVideoObject);
    checkJson(comments, "watch comments response is valid", checker.checkPaginatedCommentObjectResponse);
    checkJson(recommended, "recommended videos response is valid", checker.checkPaginatedVideoObjectResponse);

    requestVideoThumbnails(getVisibleVideoThumbnailUrls(recommended), "watchVideo");

    const chunkCount = Math.max(1, Math.ceil(videoSelection.durationSeconds / chunkSeconds));
    let nextOffset = 0;

    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
        const range = `bytes=${nextOffset}-${nextOffset + STREAM_RANGE_WINDOW_BYTES - 1}`;

        const stream = http.get(
            url(`/videos/${videoSelection.id}/stream`),
            mediaParams("watchVideo", "streamVideo", range),
        );
        checkVideoChunk(stream);

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
            const totalBytes = rangeMatch[3] === "*" ? null : Number(rangeMatch[3]);
            if (totalBytes !== null && nextOffset >= totalBytes) {
                break;
            }
        } else {
            nextOffset += STREAM_RANGE_WINDOW_BYTES;
        }

        if (chunkIndex < chunkCount - 1) {
            sleep(STREAM_CHUNK_SLEEP_SECONDS);
        }
    }
}

// Verified
function addComment(userId, token, content = randomString(40, 120)) {
    const videoSelection = pickVideoSelectionByDurationMap();
    const response = http.post(
        url(`/videos/${videoSelection.id}/comments`),
        JSON.stringify({ content }),
        jsonParams("addComment", "addComment", { Authorization: `Bearer ${token}` }),
    );
    checkJson(response, "created comment response is valid", checker.checkCommentObject);

    const comments = http.get(
        url(`/videos/${videoSelection.id}/comments`),
        requestParams("addComment", "refreshComments"),
    );
    checkJson(comments, "refreshed comments response is valid", checker.checkPaginatedCommentObjectResponse);

    return response.status === 200 ? parseJson(response) : null;
}

function selectAction(userId, token) {
    const probability = Math.random();

    if (probability < 0.76) {
        return openMainPage(userId);
    }
    if (probability < 0.87) {
        return openUserPage(userId);
    }
    if (probability < 0.89) {
        return createUser();
    }
    if (probability < 0.891) {
        return uploadVideo(userId, token);
    }
    return addComment(userId, token);
}

export default {
    getAuthToken,
    seededUserContextForVu,
    openMainPage,
    openUserPage,
    createUser,
    uploadVideo,
    watchVideo,
    addComment,
    selectAction,
};
