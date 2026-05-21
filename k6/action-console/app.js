const projectSelect = document.querySelector("#project");
const endpointSelect = document.querySelector("#endpoint");
const memoryFill = document.querySelector("#memoryFill");
const memoryUsed = document.querySelector("#memoryUsed");
const memoryAvailable = document.querySelector("#memoryAvailable");
const memoryTotal = document.querySelector("#memoryTotal");
const memoryPercent = document.querySelector("#memoryPercent");
const memoryMaxUsed = document.querySelector("#memoryMaxUsed");
const memoryUpdated = document.querySelector("#memoryUpdated");
const memoryChart = document.querySelector("#memoryChart");
const memoryChartWrap = document.querySelector("#memoryChartWrap");
const memoryYAxisMax = document.querySelector("#memoryYAxisMax");
const memoryYAxisMid = document.querySelector("#memoryYAxisMid");
const terminalBody = document.querySelector("#terminalBody");
const output = document.querySelector("#output");
const statusText = document.querySelector("#status");
const commandText = document.querySelector("#command");
const buttons = [...document.querySelectorAll("button")];
const actionButtons = buttons.filter((button) => !button.dataset.clearTerminal);
const MAX_TERMINAL_LINES = 1000;
const MEMORY_BAR_POLL_MS = 1000;
const MEMORY_CHART_SAMPLE_MS = 10000;
const MAX_MEMORY_SAMPLES = 720;
let pollTimer = null;
let endpointCatalog = {};
let memorySamples = [];
let maxMemoryUsedBytes = 0;
let lastChartSampleAt = 0;

function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "--";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function updateMemoryStats(snapshot) {
    const percent = Math.max(0, Math.min(100, snapshot.usedPercent || 0));
    maxMemoryUsedBytes = Math.max(maxMemoryUsedBytes, snapshot.usedBytes || 0);
    memoryFill.style.width = `${percent}%`;
    memoryUsed.textContent = formatBytes(snapshot.usedBytes);
    memoryAvailable.textContent = formatBytes(snapshot.availableBytes);
    memoryTotal.textContent = formatBytes(snapshot.totalBytes);
    memoryPercent.textContent = `${percent.toFixed(1)}%`;
    memoryMaxUsed.textContent = formatBytes(maxMemoryUsedBytes);
    memoryUpdated.textContent = `${snapshot.source} · ${new Date(snapshot.timestamp).toLocaleTimeString()}`;
}

function appendMemoryChartSample(snapshot) {
    const now = Date.now();
    if (lastChartSampleAt && now - lastChartSampleAt < MEMORY_CHART_SAMPLE_MS) return;
    lastChartSampleAt = now;

    memorySamples.push({
        timestamp: snapshot.timestamp,
        usedBytes: snapshot.usedBytes || 0,
        totalBytes: snapshot.totalBytes || 0,
    });
    if (memorySamples.length > MAX_MEMORY_SAMPLES) {
        memorySamples = memorySamples.slice(-MAX_MEMORY_SAMPLES);
    }
    renderMemoryChart();
}

function renderMemoryChart() {
    const context = memoryChart.getContext("2d");
    const { width, height } = memoryChart;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#101816";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "rgba(216, 245, 232, 0.12)";
    context.lineWidth = 1;
    for (let i = 1; i < 4; i += 1) {
        const y = (height / 4) * i;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
    }

    if (memorySamples.length === 0) return;

    const leftPad = 16;
    const rightPad = 16;
    const topPad = 16;
    const bottomPad = 34;
    const chartWidth = width - leftPad - rightPad;
    const chartHeight = height - topPad - bottomPad;
    const firstTimestamp = Date.parse(memorySamples[0].timestamp);
    const lastTimestamp = Date.parse(memorySamples[memorySamples.length - 1].timestamp);
    const timeSpan = Math.max(1, lastTimestamp - firstTimestamp);
    const yMaxBytes = Math.max(
        1,
        ...memorySamples.map((sample) => sample.totalBytes || sample.usedBytes || 0),
    );

    memoryYAxisMax.textContent = formatBytes(yMaxBytes);
    memoryYAxisMid.textContent = formatBytes(yMaxBytes / 2);

    context.strokeStyle = "rgba(216, 245, 232, 0.28)";
    context.beginPath();
    context.moveTo(leftPad, topPad);
    context.lineTo(leftPad, topPad + chartHeight);
    context.stroke();

    context.beginPath();
    memorySamples.forEach((sample, index) => {
        const timestamp = Date.parse(sample.timestamp);
        const x = leftPad + (memorySamples.length === 1 ? chartWidth : ((timestamp - firstTimestamp) / timeSpan) * chartWidth);
        const y = topPad + chartHeight - (Math.min(sample.usedBytes, yMaxBytes) / yMaxBytes) * chartHeight;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
    });
    context.strokeStyle = "#45d39f";
    context.lineWidth = 4;
    context.stroke();

    const latest = memorySamples[memorySamples.length - 1];
    const first = memorySamples[0];
    context.fillStyle = "#d8f5e8";
    context.font = "18px Cascadia Mono, Consolas, monospace";
    context.fillText(new Date(first.timestamp).toLocaleTimeString(), leftPad, height - 10);
    context.fillText(formatBytes(latest.usedBytes), Math.floor(width / 2) - 44, height - 10);
    context.fillText(new Date(latest.timestamp).toLocaleTimeString(), width - 136, height - 10);
    memoryChartWrap.scrollLeft = memoryChartWrap.scrollWidth;
}

async function pollMemory() {
    try {
        const response = await fetch("/api/memory");
        const snapshot = await response.json();
        if (!response.ok) {
            throw new Error(snapshot.error || "Could not read WSL memory.");
        }
        updateMemoryStats(snapshot);
        appendMemoryChartSample(snapshot);
    } catch (error) {
        memoryUpdated.textContent = error.message;
    } finally {
        setTimeout(pollMemory, MEMORY_BAR_POLL_MS);
    }
}

function setBusy(isBusy) {
    actionButtons.forEach((button) => {
        button.disabled = isBusy;
    });
    if (!isBusy) renderProjectControls();
}

async function startRun(url, payload) {
    setBusy(true);
    output.textContent = "Starting...\n";
    statusText.textContent = "Running";
    commandText.textContent = "";

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const run = await response.json();
    if (!response.ok) {
        throw new Error(run.error || "Could not start run.");
    }

    commandText.textContent = run.command;
    pollRun(run.id);
}

function newestTerminalOutput(text) {
    const lines = text.split(/\r?\n/);
    return lines.slice(-MAX_TERMINAL_LINES).join("\n");
}

function appendTerminal(text) {
    output.textContent = newestTerminalOutput(`${output.textContent}${output.textContent ? "\n" : ""}${text}`);
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

function renderEndpoints() {
    const endpoints = endpointCatalog[projectSelect.value] || [];
    endpointSelect.replaceChildren(
        ...endpoints.map((endpoint) => {
            const option = document.createElement("option");
            option.value = endpoint.id;
            option.textContent = endpoint.label;
            return option;
        }),
    );
}

function renderProjectControls() {
    const isGerman = projectSelect.value === "german";
    document.querySelectorAll('[data-action="watchVideo"]').forEach((button) => {
        button.disabled = isGerman;
        button.title = isGerman ? "Disabled for German because the video reproductor is not working." : "";
    });
}

async function loadEndpointCatalog() {
    const response = await fetch("/api/endpoints");
    endpointCatalog = await response.json();
    if (!response.ok) {
        throw new Error(endpointCatalog.error || "Could not load endpoint catalog.");
    }
    renderEndpoints();
    renderProjectControls();
}

function formatEndpointResult(result) {
    return [
        `> ${result.method} ${result.url}`,
        `Status: ${result.status} ${result.statusText} (${result.elapsedMs}ms)`,
        `Content-Type: ${result.contentType || "(none)"}`,
        "",
        result.body || "(empty response body)",
        result.truncated ? "\n[response truncated at 60000 characters]" : "",
    ].join("\n");
}

async function callSelectedEndpoint() {
    setBusy(true);
    statusText.textContent = "Calling endpoint";
    commandText.textContent = endpointSelect.options[endpointSelect.selectedIndex]?.textContent || "";

    const response = await fetch("/api/call-endpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            project: projectSelect.value,
            endpointId: endpointSelect.value,
        }),
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || "Endpoint call failed.");
    }

    statusText.textContent = result.ok ? "Endpoint OK" : "Endpoint Failed";
    commandText.textContent = `${result.method} ${result.url}`;
    appendTerminal(formatEndpointResult(result));
    setBusy(false);
}

async function pollRun(runId) {
    clearTimeout(pollTimer);
    const response = await fetch(`/api/runs/${runId}`);
    const run = await response.json();
    if (!response.ok) {
        throw new Error(run.error || "Could not read run.");
    }

    statusText.textContent = run.status;
    commandText.textContent =
        run.status === "failed" && run.exitCode !== null
            ? `${run.command} exited with ${run.exitCode}`
            : run.command;
    output.textContent = newestTerminalOutput(run.output || "Waiting for output...\n");
    terminalBody.scrollTop = terminalBody.scrollHeight;

    if (run.status === "running") {
        pollTimer = setTimeout(() => pollRun(runId).catch(showError), 1000);
        return;
    }

    setBusy(false);
}

function showError(error) {
    setBusy(false);
    statusText.textContent = "Failed";
    output.textContent = newestTerminalOutput(`${output.textContent}\n${error.message}\n`);
}

document.addEventListener("click", (event) => {
    if (event.target.dataset.clearTerminal !== undefined) {
        output.textContent = "";
        terminalBody.scrollTop = 0;
        return;
    }

    const action = event.target.dataset.action;
    const dockerCommand = event.target.dataset.docker;
    const testType = event.target.dataset.test;
    const project = projectSelect.value;

    if (event.target.dataset.callEndpoint !== undefined) {
        callSelectedEndpoint().catch(showError);
    }

    if (event.target.dataset.sudo !== undefined) {
        startRun("/api/sudo", {}).catch(showError);
    }

    if (action) {
        startRun("/api/run-action", { project, action }).catch(showError);
    }

    if (dockerCommand) {
        startRun("/api/docker", { project, command: dockerCommand }).catch(showError);
    }

    if (testType) {
        startRun("/api/run-test", { project, testType }).catch(showError);
    }
});

projectSelect.addEventListener("change", () => {
    renderEndpoints();
    renderProjectControls();
});
loadEndpointCatalog().catch(showError);
pollMemory();
