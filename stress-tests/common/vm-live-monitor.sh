#!/usr/bin/env bash
set -euo pipefail

sample_interval="${METRICS_SAMPLE_INTERVAL_SECONDS:-1}"
print_interval="${METRICS_PRINT_INTERVAL_SECONDS:-5}"
output_csv="${1:-}"
summary_file="${2:-}"
last_print=0
prev_total=""
prev_idle=""
samples=0
sum_cpu="0"
max_cpu="0"
sum_memory_percent="0"
max_memory_percent="0"
sum_memory_used_bytes="0"
max_memory_used_bytes="0"
memory_total_bytes="0"

if [[ -n "$output_csv" ]]; then
    mkdir -p "$(dirname "$output_csv")"
    echo "timestamp,cpu_percent,memory_percent,memory_used_bytes,memory_total_bytes,gpu_percent,gpu_memory_mib" > "$output_csv"
fi

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
        printf "%.2f,%d,%d\n", used * 100 / total, used * 1024, total * 1024
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

write_summary() {
    [[ -z "$summary_file" ]] && return

    local avg_cpu avg_memory_percent avg_memory_used_bytes
    if (( samples > 0 )); then
        avg_cpu="$(awk -v s="$sum_cpu" -v n="$samples" 'BEGIN { printf "%.2f", s / n }')"
        avg_memory_percent="$(awk -v s="$sum_memory_percent" -v n="$samples" 'BEGIN { printf "%.2f", s / n }')"
        avg_memory_used_bytes="$(awk -v s="$sum_memory_used_bytes" -v n="$samples" 'BEGIN { printf "%.0f", s / n }')"
    else
        avg_cpu="0.00"
        avg_memory_percent="0.00"
        avg_memory_used_bytes="0"
    fi

    cat > "$summary_file" <<SUMMARY
samples=$samples
avg_cpu_percent=$avg_cpu
max_cpu_percent=$max_cpu
avg_memory_percent=$avg_memory_percent
max_memory_percent=$max_memory_percent
avg_memory_used_bytes=$avg_memory_used_bytes
max_memory_used_bytes=$max_memory_used_bytes
memory_total_bytes=$memory_total_bytes
SUMMARY
}

trap 'write_summary; exit 0' TERM INT

while true; do
    timestamp="$(date -Is)"
    cpu_percent="$(sample_cpu_percent)"
    IFS=',' read -r memory_percent memory_used_bytes memory_total_bytes < <(sample_memory)
    IFS=',' read -r gpu_percent gpu_memory_mib < <(sample_gpu)

    if [[ -n "$output_csv" ]]; then
        echo "$timestamp,$cpu_percent,$memory_percent,$memory_used_bytes,$memory_total_bytes,$gpu_percent,$gpu_memory_mib" >> "$output_csv"
    fi

    samples=$((samples + 1))
    sum_cpu="$(awk -v a="$sum_cpu" -v b="$cpu_percent" 'BEGIN { printf "%.2f", a + b }')"
    max_cpu="$(awk -v a="$max_cpu" -v b="$cpu_percent" 'BEGIN { printf "%.2f", (b > a ? b : a) }')"
    sum_memory_percent="$(awk -v a="$sum_memory_percent" -v b="$memory_percent" 'BEGIN { printf "%.2f", a + b }')"
    max_memory_percent="$(awk -v a="$max_memory_percent" -v b="$memory_percent" 'BEGIN { printf "%.2f", (b > a ? b : a) }')"
    sum_memory_used_bytes="$(awk -v a="$sum_memory_used_bytes" -v b="$memory_used_bytes" 'BEGIN { printf "%.0f", a + b }')"
    max_memory_used_bytes="$(awk -v a="$max_memory_used_bytes" -v b="$memory_used_bytes" 'BEGIN { printf "%.0f", (b > a ? b : a) }')"

    now="$(date +%s)"
    if (( now - last_print >= print_interval )); then
        printf '[vm live] cpu=%s%% mem=%s%% used=%s/%s bytes gpu=%s%% gpu_mem=%s MiB\n' \
            "$cpu_percent" "$memory_percent" "$memory_used_bytes" "$memory_total_bytes" "$gpu_percent" "$gpu_memory_mib" >&2
        last_print="$now"
    fi

    sleep "$sample_interval"
done
