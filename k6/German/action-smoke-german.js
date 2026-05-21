import actions from "./common.js";
import { seedData } from "./bootstrap.js";
import repository from "./repository.js";

export const options = {
    vus: 1,
    iterations: 1,
    setupTimeout: "10m",
    teardownTimeout: "10m",
    thresholds: {
        checks: ["rate>0.95"],
    },
};

export function setup() {
    return seedData();
}

function hydrateRepository(setupData) {
    const seededVideosByDuration = setupData && setupData.seededVideosByDuration;
    repository.resetVideos();
    [60, 180].forEach((durationSeconds) => {
        const ids = (seededVideosByDuration && seededVideosByDuration[durationSeconds]) || [];
        ids.forEach((videoId) => repository.registerVideo(videoId, durationSeconds));
    });
}

function userContext(setupData) {
    const tuple = actions.seededUserContextForVu(setupData && setupData.authTuples);
    return { userId: tuple[0], token: tuple[1] };
}

export default function runSelectedAction(setupData) {
    const action = __ENV.ACTION || "selectAction";
    hydrateRepository(setupData);
    const { userId, token } = userContext(setupData);

    if (action === "bootstrap") return;
    if (action === "openMainPage") return actions.openMainPage(userId);
    if (action === "openUserPage") return actions.openUserPage(userId);
    if (action === "createUser") return actions.createUser();
    if (action === "uploadVideo") return actions.uploadVideo(userId, token);
    if (action === "watchVideo") return actions.watchVideo();
    if (action === "addComment") return actions.addComment(userId, token);
    if (action === "selectAction") return actions.selectAction(userId, token);

    throw new Error(`Unknown German smoke action: ${action}`);
}
