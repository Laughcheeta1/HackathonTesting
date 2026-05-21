const projectSelect = document.querySelector("#project");
const endpointSelect = document.querySelector("#endpoint");
const memoryFill = document.querySelector("#memoryFill");
const memoryUsed = document.querySelector("#memoryUsed");
const memoryAvailable = document.querySelector("#memoryAvailable");
const memoryTotal = document.querySelector("#memoryTotal");
const memoryPercent = document.querySelector("#memoryPercent");
const memoryUpdated = document.querySelector("#memoryUpdated");
const terminalBody = document.querySelector("#terminalBody");
const output = document.querySelector("#output");
const statusText = document.querySelector("#status");
const commandText = document.querySelector("#command");
const buttons = [...document.querySelectorAll("button")];
const actionButtons = buttons.filter((button) => !button.dataset.clearTerminal);
const MAX_TERMINAL_LINES = 1000;
let pollTimer = null;
let endpointCatalog = {};

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

function renderMemory(snapshot) {
    const percent = Math.max(0, Math.min(100, snapshot.usedPercent || 0));
    memoryFill.style.width = `${percent}%`;
    memoryUsed.textContent = formatBytes(snapshot.usedBytes);
    memoryAvailable.textContent = formatBytes(snapshot.availableBytes);
    memoryTotal.textContent = formatBytes(snapshot.totalBytes);
    memoryPercent.textContent = `${percent.toFixed(1)}%`;
    memoryUpdated.textContent = `${snapshot.source} · ${new Date(snapshot.timestamp).toLocaleTimeString()}`;
}

async function pollMemory() {
    try {
        const response = await fetch("/api/memory");
        const snapshot = await response.json();
        if (!response.ok) {
            throw new Error(snapshot.error || "Could not read WSL memory.");
        }
        renderMemory(snapshot);
    } catch (error) {
        memoryUpdated.textContent = error.message;
    } finally {
        setTimeout(pollMemory, 2000);
    }
}

function setBusy(isBusy) {
    actionButtons.forEach((button) => {
        button.disabled = isBusy;
    });
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

async function loadEndpointCatalog() {
    const response = await fetch("/api/endpoints");
    endpointCatalog = await response.json();
    if (!response.ok) {
        throw new Error(endpointCatalog.error || "Could not load endpoint catalog.");
    }
    renderEndpoints();
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
    const project = projectSelect.value;

    if (event.target.dataset.callEndpoint !== undefined) {
        callSelectedEndpoint().catch(showError);
    }

    if (action) {
        startRun("/api/run-action", { project, action }).catch(showError);
    }

    if (dockerCommand) {
        startRun("/api/docker", { project, command: dockerCommand }).catch(showError);
    }
});

projectSelect.addEventListener("change", renderEndpoints);
loadEndpointCatalog().catch(showError);
pollMemory();
