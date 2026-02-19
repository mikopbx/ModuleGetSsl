#!/bin/sh
# Wraps a command's output with ISO timestamps on each line
"$@" 2>&1 | while IFS= read -r line; do
    line="${line#\[*\] }"
    printf "[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$line"
done
