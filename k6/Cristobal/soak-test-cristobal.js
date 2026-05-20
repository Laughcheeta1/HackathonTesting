import http from "k6/http";
import { Rate } from "k6/metrics";
import { sleep } from "k6";
import actions from "./common.js";

const PROJECT = "Cristobal";
const HEALTH_URL = "http://localhost:8000/health";
const SEED_MANIFEST = actions.loadSeedManifest(__ENV.SEED_MANIFEST || "./seed-manifest-cristobal.json");
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

export function runAction() {
    actions.selectAction({ userId: currentUserId() });
    sleep(1);
}

function currentUserId() {
    return actions.seededUserIdForVu(SEED_MANIFEST);
}

export function healthCheck() {
    const response = http.get(HEALTH_URL, {
        tags: { project: PROJECT, action: "health", endpoint: "health" },
    });
    healthFailures.add(response.status !== 200);
    sleep(5);
}
