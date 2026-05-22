#!/usr/bin/env bash
set -euo pipefail

output_csv="$1"
summary_file="$2"
sample_interval="${METRICS_SAMPLE_INTERVAL_SECONDS:-1}"

mkdir -p "$(dirname "$output_csv")"
echo "timestamp,container_count,cpu_percent,memory_bytes,gpu_percent,gpu_memory_mib" > "$output_csv"

samples=0
sum_cpu="0"
max_cpu="0"
sum_mem="0"
max_mem="0"
sum_gpu="0"
max_gpu="0"
sum_gpu_mem="0"
max_gpu_mem="0"
gpu_samples=0

mem_to_bytes() {
    awk -v raw="$1" 'BEGIN {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", raw)
        if (raw == "" || raw == "0B") { print 0; exit }
        value = raw + 0
        unit = raw
        sub(/^[0-9.]+[[:space:]]*/, "", unit)
        if (unit == "B") mult = 1
        else if (unit == "kB" || unit == "KB") mult = 1000
        else if (unit == "KiB") mult = 1024
        else if (unit == "MB") mult = 1000 * 1000
        else if (unit == "MiB") mult = 1024 * 1024
        else if (unit == "GB") mult = 1000 * 1000 * 1000
        else if (unit == "GiB") mult = 1024 * 1024 * 1024
        else mult = 1
        printf "%.0f\n", value * mult
    }'
}

container_pids() {
    local container
    while IFS= read -r container; do
        [[ -z "$container" ]] && continue
        docker top "$container" -eo pid 2>/dev/null | awk 'NR > 1 { print $1 }' || true
    done < <(docker ps --format '{{.Names}}')
}

sample_gpu_for_containers() {
    if ! command -v nvidia-smi >/dev/null 2>&1; then
        echo "NA,NA"
        return
    fi

    local pid_file pmon_file
    pid_file="$(mktemp)"
    pmon_file="$(mktemp)"
    container_pids | sort -u > "$pid_file"

    if [[ ! -s "$pid_file" ]]; then
        rm -f "$pid_file" "$pmon_file"
        echo "0,0"
        return
    fi

    if ! nvidia-smi pmon -c 1 -s u > "$pmon_file" 2>/dev/null; then
        rm -f "$pid_file" "$pmon_file"
        echo "NA,NA"
        return
    fi

    awk 'NR==FNR { pids[$1]=1; next }
        /^[[:space:]]*#/ { next }
        NF >= 5 && ($2 in pids) {
            sm = $4 == "-" ? 0 : $4
            mem = $5 == "-" ? 0 : $5
            gpu += sm
            gpu_mem += mem
        }
        END { printf "%.2f,%.2f\n", gpu + 0, gpu_mem + 0 }' "$pid_file" "$pmon_file"
    rm -f "$pid_file" "$pmon_file"
}

write_summary() {
    local avg_cpu avg_mem avg_gpu avg_gpu_mem
    if (( samples > 0 )); then
        avg_cpu="$(awk -v s="$sum_cpu" -v n="$samples" 'BEGIN { printf "%.2f", s / n }')"
        avg_mem="$(awk -v s="$sum_mem" -v n="$samples" 'BEGIN { printf "%.0f", s / n }')"
    else
        avg_cpu="0.00"
        avg_mem="0"
    fi

    if (( gpu_samples > 0 )); then
        avg_gpu="$(awk -v s="$sum_gpu" -v n="$gpu_samples" 'BEGIN { printf "%.2f", s / n }')"
        avg_gpu_mem="$(awk -v s="$sum_gpu_mem" -v n="$gpu_samples" 'BEGIN { printf "%.2f", s / n }')"
    else
        avg_gpu="NA"
        avg_gpu_mem="NA"
        max_gpu="NA"
        max_gpu_mem="NA"
    fi

    cat > "$summary_file" <<SUMMARY
samples=$samples
avg_cpu_percent=$avg_cpu
max_cpu_percent=$max_cpu
avg_memory_bytes=$avg_mem
max_memory_bytes=$max_mem
avg_gpu_percent=$avg_gpu
max_gpu_percent=$max_gpu
avg_gpu_memory_mib=$avg_gpu_mem
max_gpu_memory_mib=$max_gpu_mem
SUMMARY
}

trap 'write_summary; exit 0' TERM INT

while true; do
    timestamp="$(date -Is)"
    stats="$(docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}' 2>/dev/null || true)"
    container_count=0
    cpu_percent="0"
    memory_bytes="0"

    while IFS='|' read -r name cpu_raw mem_raw; do
        [[ -z "${name:-}" ]] && continue
        container_count=$((container_count + 1))
        cpu_value="${cpu_raw%%%}"
        mem_used="${mem_raw%% / *}"
        mem_bytes="$(mem_to_bytes "$mem_used")"
        cpu_percent="$(awk -v a="$cpu_percent" -v b="$cpu_value" 'BEGIN { printf "%.2f", a + b }')"
        memory_bytes="$(awk -v a="$memory_bytes" -v b="$mem_bytes" 'BEGIN { printf "%.0f", a + b }')"
    done <<< "$stats"

    IFS=',' read -r gpu_percent gpu_mem_mib < <(sample_gpu_for_containers)

    echo "$timestamp,$container_count,$cpu_percent,$memory_bytes,$gpu_percent,$gpu_mem_mib" >> "$output_csv"

    samples=$((samples + 1))
    sum_cpu="$(awk -v a="$sum_cpu" -v b="$cpu_percent" 'BEGIN { printf "%.2f", a + b }')"
    sum_mem="$(awk -v a="$sum_mem" -v b="$memory_bytes" 'BEGIN { printf "%.0f", a + b }')"
    max_cpu="$(awk -v a="$max_cpu" -v b="$cpu_percent" 'BEGIN { printf "%.2f", b > a ? b : a }')"
    max_mem="$(awk -v a="$max_mem" -v b="$memory_bytes" 'BEGIN { printf "%.0f", b > a ? b : a }')"

    if [[ "$gpu_percent" != "NA" ]]; then
        gpu_samples=$((gpu_samples + 1))
        sum_gpu="$(awk -v a="$sum_gpu" -v b="$gpu_percent" 'BEGIN { printf "%.2f", a + b }')"
        sum_gpu_mem="$(awk -v a="$sum_gpu_mem" -v b="$gpu_mem_mib" 'BEGIN { printf "%.2f", a + b }')"
        max_gpu="$(awk -v a="$max_gpu" -v b="$gpu_percent" 'BEGIN { printf "%.2f", b > a ? b : a }')"
        max_gpu_mem="$(awk -v a="$max_gpu_mem" -v b="$gpu_mem_mib" 'BEGIN { printf "%.2f", b > a ? b : a }')"
    fi

    sleep "$sample_interval"
done
