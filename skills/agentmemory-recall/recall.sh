#!/bin/bash
FUNCTION_ID="$1"
PAYLOAD="$2"
iii trigger --function-id "$FUNCTION_ID" --port 49134 --timeout-ms 15000 --payload "$PAYLOAD"
