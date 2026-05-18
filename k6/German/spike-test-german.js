import http from "k6/http";
import { Rate } from "k6/metrics";
import { sleep } from "k6";
import actions from "./common.js";

const PROJECT = "German";
const HEALTH_URL = "http://localhost/api/health";
const SEEDED_USER_COUNT = 3000;
const MAX_USERS = 100; // Replace with the stress-test breaking point.
const MIN_USERS = Math.max(1, Math.ceil(MAX_USERS * 0.01));
const PEAK_USERS = Math.max(1, Math.ceil(MAX_USERS * 0.95));
let cachedUserContext;

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
                { duration: "1m", target: MIN_USERS },
                { duration: "15s", target: PEAK_USERS },
                { duration: "1m", target: PEAK_USERS },
                { duration: "15s", target: MIN_USERS },
                { duration: "1m", target: MIN_USERS },
                { duration: "15s", target: 0 },
            ],
            gracefulRampDown: "30s",
        },
        health: { executor: "constant-vus", exec: "healthCheck", vus: 1, duration: "4m" },
    },
};

export function runAction() {
    actions.selectAction(currentUserContext());
    sleep(1);
}

function currentUserContext() {
    if (!cachedUserContext) {
        const userId = ((__VU - 1) % SEEDED_USER_COUNT) + 1;
        cachedUserContext = {
            userId,
            token: actions.getAuthToken(userId, "vuAuth"),
        };
    }
    return cachedUserContext;
}

export function healthCheck() {
    const response = http.get(HEALTH_URL, {
        tags: { project: PROJECT, action: "health", endpoint: "health" },
    });
    healthFailures.add(response.status !== 200);
    sleep(5);
}
