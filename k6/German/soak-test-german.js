import http from "k6/http";
import { Rate } from "k6/metrics";
import { sleep } from "k6";
import actions from "./common.js";
import { seedData } from "./bootstrap.js";
import repository from "./repository.js";

const PROJECT = "German";
const HEALTH_URL = "http://localhost/api/health";
let repositoryInitialized = false;
let cachedUserId;
let cachedToken;
const MAX_USERS = Number(__ENV.MAX_USERS) > 0 ? Number(__ENV.MAX_USERS) : 100;
const SOAK_USERS = Math.max(1, Math.ceil(MAX_USERS * 0.90));

export const healthFailures = new Rate("health_failures");

export const options = {
    thresholds: {
        http_req_duration: [{ threshold: "p(95)<10000", abortOnFail: true, delayAbortEval: "30s" }],
        http_req_failed: [{ threshold: "rate<0.10", abortOnFail: true, delayAbortEval: "30s" }],
        health_failures: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "30s" }],
    },
    scenarios: {
        actions: {
            executor: "ramping-vus",
            exec: "runAction",
            stages: [
                { duration: "30s", target: SOAK_USERS },
                { duration: "5m", target: SOAK_USERS },
                { duration: "30s", target: 0 },
            ],
            gracefulRampDown: "30s",
        },
        health: { executor: "constant-vus", exec: "healthCheck", vus: 1, duration: "6m" },
    },
};

export function setup() {
    return seedData();
}

function ensureVuContext(setupData) {
    if (!repositoryInitialized) {
        const seededVideosByDuration = setupData && setupData.seededVideosByDuration;
        repository.resetVideos();
        [60, 180, 600, 2400].forEach((durationSeconds) => {
            const ids = (seededVideosByDuration && seededVideosByDuration[durationSeconds]) || [];
            ids.forEach((videoId) => repository.registerVideo(videoId, durationSeconds));
        });
        repositoryInitialized = true;
    }

    if (cachedUserId && cachedToken) return;

    const tuple = actions.seededUserContextForVu(setupData && setupData.authTuples);
    cachedUserId = tuple[0];
    cachedToken = tuple[1];
}

export function runAction(setupData) {
    ensureVuContext(setupData);
    actions.selectAction(cachedUserId, cachedToken);
    sleep(1);
}

export function healthCheck() {
    const response = http.get(HEALTH_URL, {
        tags: { project: PROJECT, action: "health", endpoint: "health" },
    });
    healthFailures.add(response.status !== 200);
    sleep(5);
}
