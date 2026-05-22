import http from "k6/http";
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

function parseJson(response) {
    try {
        return response.json();
    } catch (error) {
        return null;
    }
}

function listItems(response) {
    const body = parseJson(response);
    if (Array.isArray(body)) return body;
    if (body && Array.isArray(body.items)) return body.items;
    return [];
}

function firstExistingUserId() {
    const response = http.get("http://localhost:80/api/users", {
        tags: { project: "Braulio", action: "smokeSetup", endpoint: "listUsers" },
    });
    const user = listItems(response)[0];
    return user ? user.id : null;
}

function smokeUserContext() {
    let userId = firstExistingUserId();
    if (!userId) {
        const user = actions.createUser();
        userId = user && user.id;
    }
    if (!userId) throw new Error("Smoke action could not resolve or create a user.");
    return { userId, token: "" };
}

function hydrateRepositoryFromExistingVideos() {
    repository.resetVideos();
    const response = http.get("http://localhost:80/api/videos?offset=0&limit=100", {
        tags: { project: "Braulio", action: "smokeSetup", endpoint: "listVideos" },
    });
    listItems(response).forEach((video) => {
        repository.registerVideo(video.id, 60);
    });

    if (!repository.getRandomVideoId(60)) {
        throw new Error("Smoke action needs existing videos. Run Bootstrap or Upload Video first.");
    }
}

export default function runSelectedAction() {
    const action = __ENV.ACTION || "selectAction";

    if (action === "bootstrap") return seedData();
    if (action === "createUser") return actions.createUser();

    if (action === "watchVideo") {
        hydrateRepositoryFromExistingVideos();
        return actions.watchVideo();
    }

    const { userId, token } = smokeUserContext();
    if (action === "openMainPage") return actions.openMainPage(userId);
    if (action === "openUserPage") return actions.openUserPage(userId);
    if (action === "uploadVideo") return actions.uploadVideo(userId, token);
    if (action === "addComment") {
        hydrateRepositoryFromExistingVideos();
        return actions.addComment(userId, token);
    }
    if (action === "selectAction") {
        hydrateRepositoryFromExistingVideos();
        return actions.selectAction(userId, token);
    }

    throw new Error(`Unknown Braulio smoke action: ${action}`);
}
