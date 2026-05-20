class VideoRepository {
    constructor() {
        this.videosByDuration = { 60: [], 180: [], 600: [], 2400: [] };
    }

    resetVideos() {
        this.videosByDuration[60] = [];
        this.videosByDuration[180] = [];
        this.videosByDuration[600] = [];
        this.videosByDuration[2400] = [];
    }

    registerVideo(videoId, durationSeconds) {
        const ids = this.videosByDuration[durationSeconds];
        if (!ids) return;
        if (!ids.includes(videoId)) ids.push(videoId);
    }

    getRandomVideoId(durationSeconds) {
        const ids = this.videosByDuration[durationSeconds] || [];
        if (ids.length === 0) return null;
        const index = Math.floor(Math.random() * ids.length);
        return ids[index];
    }
}

export default new VideoRepository();
