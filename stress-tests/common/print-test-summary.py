#!/usr/bin/env python3
import json
import sys
from pathlib import Path

summary_json = Path(sys.argv[1])
metrics_summary = Path(sys.argv[2])
project = sys.argv[3]
test_type = sys.argv[4]
configured_max_users = sys.argv[5]
exit_code = int(sys.argv[6])


def metric_value(metrics, name, key, default="N/A"):
    item = metrics.get(name, {})
    values = item.get("values", {}) if isinstance(item, dict) else {}
    value = values.get(key, default)
    if isinstance(value, float):
        return f"{value:.4f}"
    return str(value)


def read_kv(path):
    result = {}
    if not path.exists():
        return result
    for line in path.read_text().splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            result[key] = value
    return result

metrics = {}
if summary_json.exists() and summary_json.stat().st_size > 0:
    try:
        metrics = json.loads(summary_json.read_text()).get("metrics", {})
    except json.JSONDecodeError:
        metrics = {}

resource = read_kv(metrics_summary)
checks_rate = metric_value(metrics, "checks", "rate")
http_failed_rate = metric_value(metrics, "http_req_failed", "rate")
iterations = metric_value(metrics, "iterations", "count")
http_reqs = metric_value(metrics, "http_reqs", "count")
vus_max = metric_value(metrics, "vus_max", "max", configured_max_users)

print("\n================ Stress Test Summary ================")
print(f"Project: {project}")
print(f"Test type: {test_type}")
print(f"Exit code: {exit_code}")
print(f"Configured MAX_USERS: {configured_max_users}")
print(f"Max VUs observed: {vus_max}")
print(f"Actions completed (iterations): {iterations}")
print(f"HTTP requests completed: {http_reqs}")
print(f"Check success rate: {checks_rate}")
print(f"HTTP failure rate: {http_failed_rate}")
print("Docker-only resources:")
print(f"  Average CPU: {resource.get('avg_cpu_percent', 'N/A')}%")
print(f"  Max CPU: {resource.get('max_cpu_percent', 'N/A')}%")
print(f"  Average GPU: {resource.get('avg_gpu_percent', 'N/A')}%")
print(f"  Max GPU: {resource.get('max_gpu_percent', 'N/A')}%")
print(f"  Average memory: {resource.get('avg_memory_bytes', 'N/A')} bytes")
print(f"  Max memory: {resource.get('max_memory_bytes', 'N/A')} bytes")
print("=====================================================\n")
