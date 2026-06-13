#!/bin/bash
PYTHONPATH="$(dirname "$0")" python3 -m pymem.cli "$@"
