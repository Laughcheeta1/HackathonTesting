const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.ACTION_CONSOLE_PORT || 5179);
const HOST = process.env.ACTION_CONSOLE_HOST || "127.0.0.1";
const MAX_TERMINAL_LINES = Number(process.env.ACTION_CONSOLE_MAX_LINES || 1200);
const PROJECTS = {
    german: {
        label: "German",
        apiBase: "http://localhost:80/api",
        smokeScript: "k6/German/action-smoke-german.js",
        tests: {
            load: "k6/German/load-test-german.js",
            stress: "k6/German/stress-test-german.js",
            spike: "k6/German/spike-test-german.js",
            soak: "k6/German/soak-test-german.js",
        },
        upScript: "scripts/german-up.sh",
        downScript: "scripts/german-down.sh",
    },
    braulio: {
        label: "Braulio",
        apiBase: "http://localhost:80/api",
        smokeScript: "k6/Braulio/action-smoke-braulio.js",
        tests: {
            load: "k6/Braulio/load-test-braulio.js",
            stress: "k6/Braulio/stress-test-braulio.js",
            spike: "k6/Braulio/spike-test-braulio.js",
            soak: "k6/Braulio/soak-test-braulio.js",
        },
        upScript: "scripts/braulio-up.sh",
        downScript: "scripts/braulio-down.sh",
    },
    cristobal: {
        label: "Cristobal",
        apiBase: "http://localhost:8000",
        smokeScript: "k6/Cristobal/action-smoke-cristobal.js",
        tests: {
            load: "k6/Cristobal/load-test-cristobal.js",
            stress: "k6/Cristobal/stress-test-cristobal.js",
            spike: "k6/Cristobal/spike-test-cristobal.js",
            soak: "k6/Cristobal/soak-test-cristobal.js",
        },
        upScript: "scripts/cristobal-up.sh",
        downScript: "scripts/cristobal-down.sh",
    },
};
const TEST_TYPES = new Set(["load", "stress", "spike", "soak"]);
const ENDPOINTS = {
    german: [
        { id: "health", label: "GET /health", method: "GET", path: "/health" },
        { id: "healthQueues", label: "GET /health/queues", method: "GET", path: "/health/queues" },
        { id: "users", label: "GET /users?limit=100&offset=0", method: "GET", path: "/users?limit=100&offset=0" },
        { id: "providers", label: "GET /users/providers", method: "GET", path: "/users/providers" },
        { id: "videos", label: "GET /videos?limit=20&offset=0", method: "GET", path: "/videos?limit=20&offset=0" },
        { id: "video1", label: "GET /videos/1", method: "GET", path: "/videos/1" },
        { id: "video1Comments", label: "GET /videos/1/comments", method: "GET", path: "/videos/1/comments" },
        { id: "video1Recommended", label: "GET /videos/1/recommended", method: "GET", path: "/videos/1/recommended" },
        { id: "user1Subscriptions", label: "GET /users/1/subscriptions", method: "GET", path: "/users/1/subscriptions" },
        { id: "user1Feed", label: "GET /users/1/feed?limit=20&offset=0", method: "GET", path: "/users/1/feed?limit=20&offset=0" },
    ],
    braulio: [
        { id: "health", label: "GET /health", method: "GET", path: "/health" },
        { id: "users", label: "GET /users", method: "GET", path: "/users" },
        { id: "providers", label: "GET /users/providers", method: "GET", path: "/users/providers" },
        { id: "videos", label: "GET /videos?offset=0&limit=20", method: "GET", path: "/videos?offset=0&limit=20" },
        { id: "video1", label: "GET /videos/1", method: "GET", path: "/videos/1" },
        { id: "video1Comments", label: "GET /videos/1/comments", method: "GET", path: "/videos/1/comments" },
        { id: "video1Recommended", label: "GET /videos/1/recommended", method: "GET", path: "/videos/1/recommended" },
        { id: "user1Subscriptions", label: "GET /users/1/subscriptions", method: "GET", path: "/users/1/subscriptions" },
        { id: "user1Feed", label: "GET /users/1/feed", method: "GET", path: "/users/1/feed" },
    ],
    cristobal: [
        { id: "health", label: "GET /health", method: "GET", path: "/health" },
        { id: "openapi", label: "GET /openapi.json", method: "GET", path: "/openapi.json" },
        { id: "users", label: "GET /users?limit=24&offset=0", method: "GET", path: "/users?limit=24&offset=0" },
        { id: "providers", label: "GET /users/providers", method: "GET", path: "/users/providers" },
        { id: "videos", label: "GET /videos?limit=24&offset=0", method: "GET", path: "/videos?limit=24&offset=0" },
        { id: "video1", label: "GET /videos/1", method: "GET", path: "/videos/1" },
        { id: "video1Views", label: "POST /videos/1/views", method: "POST", path: "/videos/1/views" },
        { id: "video1Comments", label: "GET /videos/1/comments?limit=20&offset=0", method: "GET", path: "/videos/1/comments?limit=20&offset=0" },
        { id: "video1Recommended", label: "GET /videos/1/recommended", method: "GET", path: "/videos/1/recommended" },
        { id: "user1Subscriptions", label: "GET /users/1/subscriptions?limit=100&offset=0", method: "GET", path: "/users/1/subscriptions?limit=100&offset=0" },
        { id: "user1Feed", label: "GET /users/1/feed?limit=24&offset=0", method: "GET", path: "/users/1/feed?limit=24&offset=0" },
        {
            id: "batchVideosInfo",
            label: "POST /batch/videos/info",
            method: "POST",
            path: "/batch/videos/info",
            body: { video_ids: [1, 2, 3, 4, 5] },
        },
        {
            id: "batchComments",
            label: "POST /batch/comments",
            method: "POST",
            path: "/batch/comments",
            body: { video_ids: [1, 2, 3] },
        },
    ],
};
const ACTIONS = new Set([
    "bootstrap",
    "openMainPage",
    "openUserPage",
    "createUser",
    "uploadVideo",
    "watchVideo",
    "addComment",
    "selectAction",
]);
const runs = new Map();

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
}

function readTextFile(filePath) {
    try {
        return fs.readFileSync(filePath, "utf8").trim();
    } catch (error) {
        return null;
    }
}

function bytesFromKilobytes(value) {
    return value * 1024;
}

function readMeminfo() {
    const text = readTextFile("/proc/meminfo");
    if (!text) {
        throw new Error("Could not read /proc/meminfo.");
    }

    const fields = {};
    text.split("\n").forEach((line) => {
        const match = /^([^:]+):\s+(\d+)\s+kB$/.exec(line);
        if (match) {
            fields[match[1]] = bytesFromKilobytes(Number(match[2]));
        }
    });

    const totalBytes = fields.MemTotal;
    const availableBytes = fields.MemAvailable || fields.MemFree || 0;
    const freeBytes = fields.MemFree || 0;
    const usedBytes = Math.max(0, totalBytes - availableBytes);

    return {
        totalBytes,
        usedBytes,
        availableBytes,
        freeBytes,
        cachedBytes: fields.Cached || 0,
        buffersBytes: fields.Buffers || 0,
        swapTotalBytes: fields.SwapTotal || 0,
        swapFreeBytes: fields.SwapFree || 0,
    };
}

function readCgroupMemory() {
    const currentText = readTextFile("/sys/fs/cgroup/memory.current");
    const maxText = readTextFile("/sys/fs/cgroup/memory.max");
    if (!currentText || !maxText || maxText === "max") {
        return null;
    }

    return {
        currentBytes: Number(currentText),
        maxBytes: Number(maxText),
    };
}

function memorySnapshot() {
    const meminfo = readMeminfo();
    const cgroup = readCgroupMemory();
    const totalBytes = cgroup ? cgroup.maxBytes : meminfo.totalBytes;
    const usedBytes = cgroup ? cgroup.currentBytes : meminfo.usedBytes;
    const availableBytes = Math.max(0, totalBytes - usedBytes);

    return {
        source: cgroup ? "cgroup" : "/proc/meminfo",
        timestamp: new Date().toISOString(),
        totalBytes,
        usedBytes,
        availableBytes,
        usedPercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0,
        meminfo,
        cgroup,
    };
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                request.destroy();
                reject(new Error("Request body too large."));
            }
        });
        request.on("end", () => resolve(body ? JSON.parse(body) : {}));
        request.on("error", reject);
    });
}

function appendRunLine(run, line) {
    run.output += line;
    const lines = run.output.split(/\r?\n/);
    if (lines.length > MAX_TERMINAL_LINES) {
        run.output = lines.slice(-MAX_TERMINAL_LINES).join("\n");
    }
}

function appendFailureSummary(run, details) {
    const lines = [
        "",
        "----- failure summary -----",
        `Run: ${run.label}`,
        `Command: ${run.command}`,
    ];

    if (details.exitCode !== null && details.exitCode !== undefined) {
        lines.push(`Exit code: ${details.exitCode}`);
    }
    if (details.signal) {
        lines.push(`Signal: ${details.signal}`);
    }
    if (details.errorMessage) {
        lines.push(`Error: ${details.errorMessage}`);
    }
    if (!run.hadOutput) {
        lines.push("No stdout/stderr was produced before the process failed.");
    }
    if (details.errorCode === "ENOENT") {
        lines.push(`The executable '${details.command}' was not found in PATH.`);
    }
    if (details.exitCode === 127) {
        lines.push("Exit code 127 usually means a command was not found.");
    }
    if (details.exitCode === 126) {
        lines.push("Exit code 126 usually means a command exists but is not executable.");
    }
    if (details.exitCode === 1 && run.command.includes("sudo -v")) {
        lines.push("Sudo permission was not granted. Enter the password in the terminal running this server.");
    }

    lines.push("---------------------------", "");
    appendRunLine(run, `${lines.join("\n")}\n`);
}

function startProcess(command, args, label, options = {}) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const run = {
        id,
        label,
        command: [command, ...args].join(" "),
        status: "running",
        exitCode: null,
        output: "",
        hadOutput: false,
        startedAt: new Date().toISOString(),
        finishedAt: null,
    };
    runs.set(id, run);

    const child = spawn(command, args, {
        cwd: ROOT,
        env: process.env,
        stdio: [options.inheritStdin ? "inherit" : "ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => {
        run.hadOutput = true;
        appendRunLine(run, chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
        run.hadOutput = true;
        appendRunLine(run, chunk.toString());
    });
    child.on("error", (error) => {
        run.status = "failed";
        run.exitCode = null;
        run.finishedAt = new Date().toISOString();
        appendFailureSummary(run, {
            command,
            errorCode: error.code,
            errorMessage: error.message,
        });
    });
    child.on("close", (code, signal) => {
        run.status = code === 0 ? "passed" : "failed";
        run.exitCode = code;
        run.finishedAt = new Date().toISOString();
        if (code !== 0 || signal) {
            appendFailureSummary(run, {
                command,
                exitCode: code,
                signal,
            });
        }
    });

    return run;
}

function endpointCatalog() {
    return Object.fromEntries(
        Object.entries(ENDPOINTS).map(([key, endpoints]) => [
            key,
            endpoints.map(({ id, label, method, path }) => ({ id, label, method, path })),
        ]),
    );
}

function findEndpoint(projectKey, endpointId) {
    return (ENDPOINTS[projectKey] || []).find((endpoint) => endpoint.id === endpointId);
}

function formatResponseBody(contentType, text) {
    if (contentType.includes("application/json")) {
        try {
            return JSON.stringify(JSON.parse(text), null, 2);
        } catch (error) {
            return text;
        }
    }
    return text;
}

async function callEndpoint(projectKey, endpointId) {
    const project = PROJECTS[projectKey];
    const endpoint = findEndpoint(projectKey, endpointId);
    if (!project || !endpoint) {
        throw new Error("Unknown project or endpoint.");
    }

    const url = `${project.apiBase}${endpoint.path}`;
    const startedAt = Date.now();
    const response = await fetch(url, {
        method: endpoint.method,
        headers: endpoint.body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "*/*" },
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
    });
    const elapsedMs = Date.now() - startedAt;
    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();
    const body = formatResponseBody(contentType, rawBody);

    return {
        project: project.label,
        endpoint: endpoint.label,
        method: endpoint.method,
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        elapsedMs,
        contentType,
        headers: Object.fromEntries(response.headers.entries()),
        body: body.slice(0, 60000),
        truncated: body.length > 60000,
    };
}

async function handleApi(request, response) {
    if (request.method === "GET" && request.url === "/api/memory") {
        return sendJson(response, 200, memorySnapshot());
    }

    if (request.method === "GET" && request.url === "/api/endpoints") {
        return sendJson(response, 200, endpointCatalog());
    }

    if (request.method === "POST" && request.url === "/api/call-endpoint") {
        const body = await readBody(request);
        const result = await callEndpoint(body.project, body.endpointId);
        return sendJson(response, 200, result);
    }

    if (request.method === "POST" && request.url === "/api/run-action") {
        const body = await readBody(request);
        const project = PROJECTS[body.project];
        if (!project || !ACTIONS.has(body.action)) {
            return sendJson(response, 400, { error: "Unknown project or action." });
        }
        if (body.project === "german" && body.action === "watchVideo") {
            return sendJson(response, 400, { error: "German watchVideo is disabled because the video reproductor is not working." });
        }
        const run = startProcess(
            "k6",
            ["run", "-e", `ACTION=${body.action}`, project.smokeScript],
            `${project.label} ${body.action}`,
        );
        return sendJson(response, 202, run);
    }

    if (request.method === "POST" && request.url === "/api/run-test") {
        const body = await readBody(request);
        const project = PROJECTS[body.project];
        if (!project || !TEST_TYPES.has(body.testType)) {
            return sendJson(response, 400, { error: "Unknown project or test type." });
        }
        const run = startProcess(
            "k6",
            ["run", project.tests[body.testType]],
            `${project.label} ${body.testType} test`,
        );
        return sendJson(response, 202, run);
    }

    if (request.method === "POST" && request.url === "/api/docker") {
        const body = await readBody(request);
        const project = PROJECTS[body.project];
        if (!project || (body.command !== "up" && body.command !== "down")) {
            return sendJson(response, 400, { error: "Unknown project or Docker command." });
        }
        const script = body.command === "up" ? project.upScript : project.downScript;
        const run = startProcess("bash", [script], `${project.label} ${body.command}`);
        return sendJson(response, 202, run);
    }

    if (request.method === "POST" && request.url === "/api/sudo") {
        const run = startProcess("sudo", ["-v"], "Grant sudo permission", { inheritStdin: true });
        appendRunLine(
            run,
            "If sudo asks for a password, enter it in the terminal where this Node server is running.\n",
        );
        return sendJson(response, 202, run);
    }

    const runMatch = request.url.match(/^\/api\/runs\/([^/?]+)/);
    if (request.method === "GET" && runMatch) {
        const run = runs.get(runMatch[1]);
        if (!run) return sendJson(response, 404, { error: "Run not found." });
        return sendJson(response, 200, run);
    }

    return sendJson(response, 404, { error: "Not found." });
}

const server = http.createServer((request, response) => {
    if (request.url.startsWith("/api/")) {
        handleApi(request, response).catch((error) => sendJson(response, 500, { error: error.message }));
        return;
    }

    const file = request.url === "/" ? "index.html" : request.url.slice(1);
    const filePath = path.join(__dirname, file);
    if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath)) {
        response.writeHead(404);
        response.end("Not found");
        return;
    }

    const contentType = filePath.endsWith(".css")
        ? "text/css"
        : filePath.endsWith(".js")
          ? "application/javascript"
          : "text/html";
    response.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(response);
});

server.listen(PORT, HOST, () => {
    console.log(`K6 action console: http://${HOST}:${PORT}`);
});
