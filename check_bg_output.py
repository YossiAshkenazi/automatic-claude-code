import sys
import json

# Read the background process output
lines = sys.stdin.read().strip().split('\n')
for line in lines:
    print(f"[PYTHON-WS] {line}")
