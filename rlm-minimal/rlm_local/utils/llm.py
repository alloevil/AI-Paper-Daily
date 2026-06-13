"""
Mify-compatible LLM Client for RLM.
Uses urllib directly — no openai dependency needed.
"""

import os
import json
import urllib.request
from typing import Optional


class MifyClient:
    """LLM client pointing to mify endpoint (OpenAI-compatible API)."""

    MIFY_BASE_URL = "http://model.mify.ai.srv/v1"

    def __init__(self, api_key: Optional[str] = None, model: str = "xiaomi/mimo-v2.5"):
        self.api_key = api_key or os.getenv("LLM_API_KEY") or os.getenv("MIFY_API_KEY")
        if not self.api_key:
            raise ValueError(
                "API key required. Set LLM_API_KEY or MIFY_API_KEY env var, "
                "or pass api_key parameter."
            )
        self.model = model

    def completion(
        self,
        messages: list[dict[str, str]] | str,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> str:
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        elif isinstance(messages, dict):
            messages = [messages]

        payload = {
            "model": self.model,
            "messages": messages,
        }
        if max_tokens:
            payload["max_completion_tokens"] = max_tokens

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{self.MIFY_BASE_URL}/chat/completions",
            data=data,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                result = json.loads(resp.read().decode("utf-8"))
            return result["choices"][0]["message"]["content"]
        except Exception as e:
            raise RuntimeError(f"Error generating completion: {str(e)}")
