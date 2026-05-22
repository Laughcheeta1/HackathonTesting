#!/usr/bin/env bash
set -euo pipefail

sample_interval="${METRICS_SAMPLE_INTERVAL_SECONDS:-1}"
print_interval="${METRICS_PRINT_INTERVAL_SECONDS:-5}"
last_print=0
prev_total=""
prev_idle=""

read_cpu_totals() {
    awk '/^cpu / {
        idle=$5+$6
        total=0
        for (i=2; i<=NF; i++) total += $i
        print total, idle
    }' /proc/stat
}

sample_cpu_percent() {
    local current total idle delta_total delta_idle cpu
    current="$(read_cpu_totals)"
    total="${current%% *}"
    idle="${current##* }"

    if [[ -z "$prev_total" ]]; then
        prev_total="$total"
        prev_idle="$idle"
        echo "0.00"
        return
    fi

    delta_total=$((total - prev_total))
    delta_idle=$((idle - prev_idle))
    prev_total="$total"
    prev_idle="$idle"

    if (( delta_total <= 0 )); then
        echo "0.00"
        return
    fi

    cpu="$(awk -v total="$delta_total" -v idle="$delta_idle" 'BEGIN { printf "%.2f", (total - idle) * 100 / total }')"
    echo "$cpu"
}

sample_memory() {
    awk '/^MemTotal:/ { total=$2 } /^MemAvailable:/ { available=$2 } END {
        used = total - available
        printf "%.2f,%d,%d", used * 100 / total, used * 1024, total * 1024
    }' /proc/meminfo
}

sample_gpu() {
    if ! command -v nvidia-smi >/dev/null 2>&1; then
        echo "NA,NA"
        return
    fi

    nvidia-smi --query-gpu=utilization.gpu,memory.used --format=csv,noheader,nounits 2>/dev/null | \
        awk -F',' 'BEGIN { gpu=0; mem=0; count=0 }
            NF >= 2 {
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", $1)
                gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2)
                gpu += $1 + 0
                mem += $2 + 0
                count++
            }
            END {
                if (count == 0) print "NA,NA"
                else printf "%.2f,%.2f\n", gpu / count, mem
            }'
}

trap 'exit 0' TERM INT

while true; do
    cpu_percent="$(sample_cpu_percent)"
    IFS=',' read -r memory_percent memory_used_bytes memory_total_bytes < <(sample_memory)
    IFS=',' read -r gpu_percent gpu_memory_mib < <(sample_gpu)

    now="$(date +%s)"
    if (( now - last_print >= print_interval )); then
        printf '[vm live] cpu=%s%% mem=%s%% used=%s/%s bytes gpu=%s%% gpu_mem=%s MiB\n' \
            "$cpu_percent" "$memory_percent" "$memory_used_bytes" "$memory_total_bytes" "$gpu_percent" "$gpu_memory_mib" >&2
        last_print="$now"
    fi

    sleep "$sample_interval"
done
