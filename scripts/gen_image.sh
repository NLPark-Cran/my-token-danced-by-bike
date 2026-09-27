#!/bin/bash
# $1 = prompt, $2 = output file, $3 = size (default 2K)
PROMPT="$1"; OUT="$2"; SIZE="${3:-2K}"
RESP=$(curl -s -m180 https://tokendance.space/gateway/v1/images/generations -H "Authorization:Bearer $TOKENDANCE_API_KEY" -H Content-Type:application/json -d "{\"model\":\"seedream-5.0-lite\",\"prompt\":\"$PROMPT\"}")
echo "$RESP"|jq -r '.data[0].url'|xargs curl -sL -o"$OUT"
 