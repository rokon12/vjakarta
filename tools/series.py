import csv
import json
import math
import sys
from collections import defaultdict

DEADLINE_MS = 500


def load(path):
    requests, dropped = [], 0
    with open(path, newline="") as file:
        for row in csv.DictReader(file):
            if row["metric_name"] == "http_req_duration":
                duration = float(row["metric_value"])
                start = int(row["timestamp"]) - duration
                requests.append((start, duration, row["status"]))
            elif row["metric_name"] == "dropped_iterations":
                dropped += int(float(row["metric_value"]))
    return requests, dropped


def percentile(values, p):
    if not values:
        return 0
    ordered = sorted(values)
    return ordered[max(0, math.ceil(p / 100 * len(ordered)) - 1)]


def let_in(requests):
    return [duration for _, duration, status in requests if status != "503"]


def per_second(requests):
    first = min(start for start, _, _ in requests)
    seconds = defaultdict(list)
    for request in requests:
        seconds[int((request[0] - first) // 1000)].append(request)

    rows = []
    for second in range(max(seconds) + 1):
        bucket = seconds[second]
        statuses = [status for _, _, status in bucket]
        rows.append({
            "second": second,
            "requests": len(bucket),
            "p50": round(percentile(let_in(bucket), 50)),
            "p99": round(percentile(let_in(bucket), 99)),
            "201": statuses.count("201"),
            "503": statuses.count("503"),
            "other": len(statuses) - statuses.count("201") - statuses.count("503"),
        })
    return rows


def summary(requests, dropped):
    answered = [duration for _, duration, status in requests if status == "201"]
    refused = sum(1 for _, _, status in requests if status == "503")
    return {
        "requests": len(requests),
        "p50": round(percentile(let_in(requests), 50)),
        "p99": round(percentile(let_in(requests), 99)),
        "on time": sum(1 for duration in answered if duration <= DEADLINE_MS),
        "late": sum(1 for duration in answered if duration > DEADLINE_MS),
        "refused": refused,
        "failed": len(requests) - len(answered) - refused,
        "dropped": dropped,
    }


def main(path):
    requests, dropped = load(path)
    rows = per_second(requests)
    total = summary(requests, dropped)

    print("second  requests     p50     p99    201    503  other   (p50/p99 in ms, of requests let in)")
    for row in rows:
        print(f"{row['second']:6} {row['requests']:9} {row['p50']:7} {row['p99']:7} "
              f"{row['201']:6} {row['503']:6} {row['other']:6}")
    print(", ".join(f"{name} {value}" for name, value in total.items()))

    with open(path + ".series.json", "w") as file:
        json.dump({"seconds": rows, "summary": total}, file, indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
