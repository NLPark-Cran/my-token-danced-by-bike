#!/bin/bash
# $1 = prompt, $2 = output file, $3 = size (default 2K)
PROMPT="$1"; OUT="$2"; SIZE="${3:-2K}"
RESP=$(curl -s -m 180 https://tokendance.space/gateway/ark/v3/images/generations \
  -H "Authorization: Bearer sk-f931bd31af8d28a526c71e50001a17028111fd9d12452b44" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys;print(json.dumps({'model':'seedream-5.0-pro','prompt':sys.argv[1],'size':sys.argv[2],'output_format':'png','response_format':'url','watermark':False}))" "$PROMPT" "$SIZE")")
URL=$(echo "$RESP" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['data'][0]['url'])" 2>/dev/null)
if [ -z "$URL" ]; then echo "FAIL $OUT: $RESP" | head -c 400; exit 1; fi
curl -s -m 600 -o "$OUT" "$URL" && echo "OK $OUT $(stat -c%s "$OUT") bytes"
