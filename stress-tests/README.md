# Stress Test VM Workflow

Run all commands from the repository root.

## 1. Cold setup on a new VM

```bash
./cold_setup.sh
```

Cold setup installs the required tools, creates root `.env` from `stress-tests/.env.example` when missing, generates the required k6 media files when missing, and ensures each team repo is cloned and checked out to the expected commit in `stress-tests/expected-commits.env`.

Cold setup grants the current user access to the active Docker socket. If Docker is restarted later, refresh Docker group permissions:

```bash
newgrp docker
```

## 2. Configure discovered capacity

Create or edit the root `.env` file:

```bash
nano .env
```

Example:

```bash
MAX_USERS=100
METRICS_SAMPLE_INTERVAL_SECONDS=1
METRICS_PRINT_INTERVAL_SECONDS=5
K6_BIN=k6
```

The team projects can still have their own `.env` files. German's `.env` is created inside `EquipoGerman/` by `stress-tests/German/start_app.sh` if it does not already exist.

## 3. Run a project

```bash
./stress-tests/Braulio/start_app.sh
./stress-tests/Braulio/run_stress_test.sh
./stress-tests/Braulio/shutdown.sh
```

Equivalent folders exist for `Cristobal` and `German`.

Available test runners per project:

```bash
run_stress_test.sh
run_load_test.sh
run_spike_test.sh
run_soak_test.sh
```

## Metrics

Each run writes files under `stress-tests/results/<project>-<test>-<timestamp>/`:

- `k6-output.log`: raw k6 terminal output.
- `k6-summary.json`: k6 summary export.
- `docker-metrics.csv`: Docker-only CPU, memory, and GPU samples.
- `docker-metrics-summary.env`: average and max resource values.

During the run, the terminal prints live total VM usage, including k6. This is only for real-time visibility.

The persisted CSV and final summary are Docker-only app usage, excluding k6. GPU metrics are available only when `nvidia-smi` exists and can map GPU processes back to Docker container PIDs; otherwise Docker GPU is reported as `N/A`.
