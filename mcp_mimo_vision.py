#!/usr/bin/env python3
"""
MCP Server: mimo-vision
用 mimo V2.5 识别图片，供 Claude Code 调用。
纯标准库实现，无需 pip install。
"""

import json
import sys
import base64
import urllib.request
import os

# ── 配置 ──────────────────────────────────────────────
MIFY_BASE = os.environ.get("MIFY_BASE_URL", "http://model.mify.ai.srv/v1")
MIFY_KEY = os.environ.get("LLM_API_KEY", "")
MODEL = os.environ.get("MIMO_VISION_MODEL", "xiaomi/mimo-v2.5")
# ─────────────────────────────────────────────────────

TOOL_DEF = {
    "name": "recognize_image",
    "description": (
        "Recognize/describe the content of an image using mimo V2.5 vision model. "
        "Accepts a local file path or base64-encoded image data. "
        "Returns a text description of the image content."
    ),
    "inputSchema": {
        "type": "object",
        "properties": {
            "image_path": {
                "type": "string",
                "description": "Local file path to the image (e.g. /tmp/screenshot.png)"
            },
            "image_base64": {
                "type": "string",
                "description": "Base64-encoded image data (alternative to image_path)"
            },
            "prompt": {
                "type": "string",
                "description": "What to ask about the image (default: 'Describe this image in detail')",
                "default": "Describe this image in detail"
            }
        },
        "oneOf": [
            {"required": ["image_path"]},
            {"required": ["image_base64"]}
        ]
    }
}


def call_mimo_vision(b64_data: str, prompt: str) -> str:
    """Call mimo V2.5 with an image."""
    # Detect mime type from base64 header or default to png
    if b64_data.startswith("/9j/"):
        mime = "image/jpeg"
    elif b64_data.startswith("iVBOR"):
        mime = "image/png"
    elif b64_data.startswith("R0lGOD"):
        mime = "image/gif"
    elif b64_data.startswith("UklGR"):
        mime = "image/webp"
    else:
        mime = "image/png"

    payload = {
        "model": MODEL,
        "messages": [{
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:{mime};base64,{b64_data}"}
                },
                {
                    "type": "text",
                    "text": prompt
                }
            ]
        }],
        "max_completion_tokens": 2000
    }

    headers = {
        "Authorization": f"Bearer {MIFY_KEY}",
        "Content-Type": "application/json"
    }

    req = urllib.request.Request(
        f"{MIFY_BASE}/chat/completions",
        data=json.dumps(payload).encode(),
        headers=headers
    )
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read())
    return result["choices"][0]["message"]["content"]


def handle_request(req: dict) -> dict:
    """Handle a single JSON-RPC request."""
    method = req.get("method", "")
    req_id = req.get("id")
    params = req.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {
                    "name": "mimo-vision",
                    "version": "1.0.0"
                }
            }
        }

    elif method == "notifications/initialized":
        # Notification, no response needed
        return None

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {"tools": [TOOL_DEF]}
        }

    elif method == "tools/call":
        tool_name = params.get("name", "")
        args = params.get("arguments", {})

        if tool_name != "recognize_image":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": f"Unknown tool: {tool_name}"}],
                    "isError": True
                }
            }

        try:
            prompt = args.get("prompt", "Describe this image in detail")

            if "image_path" in args:
                with open(args["image_path"], "rb") as f:
                    b64 = base64.b64encode(f.read()).decode()
            elif "image_base64" in args:
                b64 = args["image_base64"]
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": "Error: provide image_path or image_base64"}],
                        "isError": True
                    }
                }

            description = call_mimo_vision(b64, prompt)
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": description}]
                }
            }

        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{"type": "text", "text": f"Error: {e}"}],
                    "isError": True
                }
            }

    elif method == "ping":
        return {"jsonrpc": "2.0", "id": req_id, "result": {}}

    else:
        # Unknown method
        if req_id is not None:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32601, "message": f"Method not found: {method}"}
            }
        return None


def main():
    """Read JSON-RPC messages from stdin, write responses to stdout."""
    # Ensure stdout is unbuffered
    sys.stdout.reconfigure(line_buffering=False)
    sys.stdin.reconfigure(encoding="utf-8")

    buffer = ""
    content_length = -1

    while True:
        line = sys.stdin.readline()
        if not line:
            break

        line = line.rstrip("\r\n")

        if line.startswith("Content-Length: "):
            content_length = int(line[16:])
            continue

        if line == "" and content_length > 0:
            # Read the body
            body = sys.stdin.read(content_length)
            content_length = -1

            try:
                req = json.loads(body)
            except json.JSONDecodeError:
                continue

            # Handle batch requests
            if isinstance(req, list):
                responses = []
                for r in req:
                    resp = handle_request(r)
                    if resp is not None:
                        responses.append(resp)
                if responses:
                    for resp in responses:
                        send_response(resp)
            else:
                resp = handle_request(req)
                if resp is not None:
                    send_response(resp)


def send_response(resp: dict):
    """Write a JSON-RPC response to stdout with Content-Length header."""
    body = json.dumps(resp)
    msg = f"Content-Length: {len(body.encode())}\r\n\r\n{body}"
    sys.stdout.write(msg)
    sys.stdout.flush()


if __name__ == "__main__":
    main()
