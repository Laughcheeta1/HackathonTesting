const videosByDuration = { 60: [], 180: [], 600: [], 2400: [] };
let hydrated = false;

function resetVideos() {
    videosByDuration[60] = [];
    videosByDuration[180] = [];
    videosByDuration[600] = [];
    videosByDuration[2400] = [];
    hydrated = false;
}

function markHydrated() {
    hydrated = true;
}

function isHydrated() {
    return hydrated;
}

function registerVideo(videoId, durationSeconds) {
    const ids = videosByDuration[durationSeconds];
    if (!ids) return;
    if (!ids.includes(videoId)) ids.push(videoId);
}

function getVideoIdsForDuration(durationSeconds) {
    return videosByDuration[durationSeconds] || [];
}

function hasVideos() {
    return Object.values(videosByDuration).some((ids) => ids.length > 0);
}

export default {
    resetVideos,
    markHydrated,
    isHydrated,
    registerVideo,
    getVideoIdsForDuration,
    hasVideos,
};
