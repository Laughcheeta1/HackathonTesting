import http from "k6/http";
import { Rate } from "k6/metrics";
import { sleep } from "k6";
import actions from "./common.js";

const PROJECT = "Braulio";
const HEALTH_URL = "http://localhost/api/health";
const SEED_MANIFEST = actions.loadSeedManifest(__ENV.SEED_MANIFEST || "./seed-manifest-braulio.json");

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
                { duration: "1m", target: 50 },
                { duration: "2m", target: 100 },
                { duration: "2m", target: 250 },
                { duration: "2m", target: 500 },
                { duration: "2m", target: 1000 },
                { duration: "2m", target: 2000 },
                { duration: "2m", target: 4000 },
                { duration: "30s", target: 0 },
            ],
            gracefulRampDown: "30s",
        },
        health: { executor: "constant-vus", exec: "healthCheck", vus: 1, duration: "14m" },
    },
};

export function runAction() {
    actions.selectAction({
        userId: currentUserId(),
        pickVideoSelection: () => actions.pickSeededVideoSelection(SEED_MANIFEST),
    });
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
