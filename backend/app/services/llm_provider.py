"""
AuraHealth LLM Provider Abstraction Layer.

Provides a common interface for all LLM providers used by General Medicine.
Only GeminiProvider is implemented now.  The interface is designed to also
support OpenAIProvider and AnthropicProvider without rewriting the service.

Environment variables:
    GENERAL_MEDICINE_LLM_PROVIDER=gemini      (default)
    GENERAL_MEDICINE_LLM_MODEL=gemini-2.5-flash
    GEMINI_API_KEY=<key>

The backend (not the LLM) decides what tools are allowed and what patient
data is accessible.  The provider only passes tool declarations to the LLM
and returns tool-call requests — it never executes them.
"""
from __future__ import annotations

import json
import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

_DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
_GEMINI_TIMEOUT_S = 20.0
_MAX_OUTPUT_TOKENS = 4096


# =====================================================================
# DATA CLASSES
# =====================================================================

@dataclass
class ToolCallRequest:
    """Represents a single tool-call request returned by the LLM."""
    name: str
    args: Dict[str, Any]


@dataclass
class LLMChatResult:
    """
    Unified result from any LLM provider for a single chat turn.

    response_type:
        "text"       — LLM produced a final text response (parse as JSON)
        "tool_calls" — LLM requests one or more tools to be executed
        "error"      — provider encountered an unrecoverable error
    """
    response_type: str                            # "text" | "tool_calls" | "error"
    text: Optional[str] = None                    # present when response_type == "text"
    tool_calls: List[ToolCallRequest] = field(default_factory=list)
    error_message: Optional[str] = None           # present when response_type == "error"


# =====================================================================
# ABSTRACT BASE
# =====================================================================

class LLMProvider(ABC):
    """
    Abstract interface for all LLM providers used by AuraHealth General Medicine.

    Concrete implementations: GeminiProvider, MockLLMProvider.
    Planned: OpenAIProvider, AnthropicProvider (interface is designed for them).
    """

    @abstractmethod
    def chat(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tool_definitions: Optional[List[Dict[str, Any]]] = None,
    ) -> LLMChatResult:
        """
        Sends the conversation to the LLM and returns one turn of output.

        Args:
            system_prompt:    Persistent system/role instructions.
            messages:         Conversation so far in provider-agnostic format:
                              [{"role": "user"|"model"|"tool", "content": str,
                                "tool_name": str (only for role=="tool"),
                                "tool_result": dict (only for role=="tool")}]
            tool_definitions: Optional list of tool schemas (provider-agnostic).
                              Each entry: {"name", "description", "parameters"}.

        Returns:
            LLMChatResult with response_type "text", "tool_calls", or "error".
        """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider identifier, e.g. 'gemini'."""

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Active model identifier, e.g. 'gemini-2.5-flash'."""


# =====================================================================
# GEMINI PROVIDER
# =====================================================================

class GeminiProvider(LLMProvider):
    """
    Calls the Google Gemini API via httpx.

    Multi-turn conversation is maintained via the contents array.
    Tool calling uses Gemini function_declarations and functionCall / functionResponse.
    Structured JSON output is enforced via the system prompt when no tools are pending.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self._api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        raw_model = (
            model
            or os.getenv("GENERAL_MEDICINE_LLM_MODEL", "")
            or os.getenv("GEMINI_MODEL", "")
            or _DEFAULT_GEMINI_MODEL
        )
        self._model = raw_model.strip()

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self._model

    @property
    def _current_api_key(self) -> str:
        return os.getenv("GEMINI_API_KEY", "") or self._api_key

    # ── Internal: convert provider-agnostic messages to Gemini contents ──

    def _to_gemini_contents(
        self, messages: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Converts AuraHealth message dicts to Gemini API 'contents' format.

        AuraHealth message roles:
            "user"  → Gemini role "user"
            "model" → Gemini role "model"
            "tool"  → Gemini role "user" with functionResponse part
                      (Gemini requires function responses sent as "user" role)
        """
        contents = []
        for msg in messages:
            role = msg.get("role", "user")
            if role == "tool":
                contents.append({
                    "role": "user",
                    "parts": [{
                        "functionResponse": {
                            "name": msg.get("tool_name", "unknown_tool"),
                            "response": msg.get("tool_result", {}),
                        }
                    }],
                })
            elif role == "model":
                # Check if this is a model turn that contained a tool call
                tc = msg.get("tool_call")
                if tc:
                    contents.append({
                        "role": "model",
                        "parts": [{
                            "functionCall": {
                                "name": tc.get("name", ""),
                                "args": tc.get("args", {}),
                            }
                        }],
                    })
                else:
                    contents.append({
                        "role": "model",
                        "parts": [{"text": msg.get("content", "")}],
                    })
            else:  # user
                contents.append({
                    "role": "user",
                    "parts": [{"text": msg.get("content", "")}],
                })
        return contents

    def _to_gemini_tools(
        self, tool_definitions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Converts provider-agnostic tool defs to Gemini functionDeclarations format."""
        return [{
            "functionDeclarations": [
                {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t.get("parameters", {"type": "object", "properties": {}}),
                }
                for t in tool_definitions
            ]
        }]

    def chat(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tool_definitions: Optional[List[Dict[str, Any]]] = None,
    ) -> LLMChatResult:
        """
        Executes one LLM turn.

        If tool_definitions is provided, Gemini runs in tool-calling mode (AUTO).
        When Gemini returns a functionCall, we return response_type="tool_calls".
        When Gemini returns text, we return response_type="text".
        """
        api_key = self._current_api_key
        if not api_key:
            return LLMChatResult(
                response_type="error",
                error_message="GEMINI_API_KEY is not configured",
            )

        url = f"{GEMINI_API_BASE}/{self._model}:generateContent?key={api_key}"
        headers = {"Content-Type": "application/json"}

        contents = self._to_gemini_contents(messages)

        body: Dict[str, Any] = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": contents,
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": _MAX_OUTPUT_TOKENS,
            },
        }

        if tool_definitions:
            body["tools"] = self._to_gemini_tools(tool_definitions)
            body["toolConfig"] = {"functionCallingConfig": {"mode": "AUTO"}}
        else:
            # No tools — request strict JSON output
            body["generationConfig"]["response_mime_type"] = "application/json"

        import time as _time

        _MAX_RETRIES = 3
        _resp = None
        for _attempt in range(_MAX_RETRIES):
            try:
                with httpx.Client(timeout=_GEMINI_TIMEOUT_S) as client:
                    _resp = client.post(url, headers=headers, json=body)
            except httpx.TimeoutException as e:
                logger.error("Gemini API timeout (attempt %d): %s", _attempt + 1, e)
                if _attempt == _MAX_RETRIES - 1:
                    return LLMChatResult(response_type="error", error_message=f"Timeout: {e}")
                _time.sleep(2 ** _attempt)
                continue
            except httpx.RequestError as e:
                logger.error("Gemini API request error: %s", e)
                return LLMChatResult(response_type="error", error_message=f"Request error: {e}")

            # Retry on 503 (server busy) and 429 (rate limit) with backoff
            if _resp.status_code in (503, 429) and _attempt < _MAX_RETRIES - 1:
                wait = 2 ** _attempt  # 1s, 2s, 4s
                logger.warning("Gemini %d — retrying in %ds (attempt %d/%d)",
                               _resp.status_code, wait, _attempt + 1, _MAX_RETRIES)
                _time.sleep(wait)
                continue
            break  # success or unretriable error

        resp = _resp
        if resp is None:
            return LLMChatResult(response_type="error", error_message="Gemini request failed")

        if resp.status_code == 429:
            return LLMChatResult(response_type="error", error_message="Gemini 429 quota exceeded")
        if resp.status_code != 200:
            return LLMChatResult(
                response_type="error",
                error_message=f"Gemini HTTP {resp.status_code}: {resp.text[:300]}",
            )

        try:
            res_json = resp.json()
        except Exception as e:
            return LLMChatResult(response_type="error", error_message=f"JSON parse error: {e}")

        candidates = res_json.get("candidates", [])
        if not candidates:
            # Check for promptFeedback block (safety filter)
            feedback = res_json.get("promptFeedback", {})
            block_reason = feedback.get("blockReason", "unknown")
            return LLMChatResult(
                response_type="error",
                error_message=f"Gemini returned no candidates (blockReason={block_reason})",
            )

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])

        # Check for function call(s)
        tool_calls: List[ToolCallRequest] = []
        text_parts: List[str] = []

        for part in parts:
            if "functionCall" in part:
                fc = part["functionCall"]
                tool_calls.append(ToolCallRequest(
                    name=fc.get("name", ""),
                    args=fc.get("args", {}),
                ))
            elif "text" in part:
                text_parts.append(part["text"])

        if tool_calls:
            return LLMChatResult(response_type="tool_calls", tool_calls=tool_calls)

        text = "".join(text_parts).strip()
        if not text:
            return LLMChatResult(response_type="error", error_message="Gemini returned empty text")

        return LLMChatResult(response_type="text", text=text)


# =====================================================================
# MOCK LLM PROVIDER (for automated tests — no network I/O)
# =====================================================================

class MockLLMProvider(LLMProvider):
    """
    Deterministic mock LLM provider for automated tests.

    Configured via a response_sequence list.  Each element is either:
      - A dict with "type": "tool_calls", "calls": [{"name": ..., "args": ...}]
      - A dict with "type": "text", "text": "<json string>"
      - A dict with "type": "error", "message": "..."

    When the sequence is exhausted, returns the last element repeatedly.
    If response_sequence is empty, defaults to a QUESTIONING state JSON response.
    """

    _DEFAULT_QUESTIONING_JSON = json.dumps({
        "assistant_message": "When did these symptoms start?",
        "language": "en",
        "state": "QUESTIONING",
        "clinical_updates": {
            "chief_complaint": None,
            "onset": None,
            "onset_pattern": None,
            "duration": None,
            "severity": None,
            "associated_symptoms": [],
            "triggers": [],
            "relieving_factors": [],
            "medical_history": [],
            "medications": [],
            "risk_factors": [],
            "relevant_negative_findings": [],
        },
        "information_completeness": 0.2,
        "needs_more_questions": True,
        "next_question_axis": "onset",
        "triage_urgency": "ROUTINE",
        "possible_considerations": [],
        "recommended_investigations": [],
        "recommended_departments": [],
        "tool_calls": [],
        "disclaimer": "This is AI decision support only.",
    })

    def __init__(
        self,
        response_sequence: Optional[List[Dict[str, Any]]] = None,
        provider_name_override: str = "mock",
        model_name_override: str = "mock-gm-v1",
    ):
        self._sequence = response_sequence or []
        self._index = 0
        self._provider_name = provider_name_override
        self._model = model_name_override
        self.call_log: List[Dict[str, Any]] = []  # records every call for test assertions

    @property
    def provider_name(self) -> str:
        return self._provider_name

    @property
    def model_name(self) -> str:
        return self._model

    def chat(
        self,
        system_prompt: str,
        messages: List[Dict[str, Any]],
        tool_definitions: Optional[List[Dict[str, Any]]] = None,
    ) -> LLMChatResult:
        # Log the call
        self.call_log.append({
            "system_prompt_len": len(system_prompt),
            "message_count": len(messages),
            "tool_defs_count": len(tool_definitions or []),
            "last_message": messages[-1] if messages else None,
        })

        if not self._sequence:
            return LLMChatResult(response_type="text", text=self._DEFAULT_QUESTIONING_JSON)

        # Return the current element (clamp at last)
        idx = min(self._index, len(self._sequence) - 1)
        entry = self._sequence[idx]
        self._index += 1  # advance for next call

        entry_type = entry.get("type", "text")

        if entry_type == "tool_calls":
            calls = [
                ToolCallRequest(name=c["name"], args=c.get("args", {}))
                for c in entry.get("calls", [])
            ]
            return LLMChatResult(response_type="tool_calls", tool_calls=calls)

        if entry_type == "error":
            return LLMChatResult(
                response_type="error",
                error_message=entry.get("message", "Mock error"),
            )

        # type == "text"
        text = entry.get("text", self._DEFAULT_QUESTIONING_JSON)
        return LLMChatResult(response_type="text", text=text)


# =====================================================================
# PROVIDER FACTORY
# =====================================================================

def get_llm_provider(
    override_provider: Optional[str] = None,
    override_key: Optional[str] = None,
) -> LLMProvider:
    """
    Returns the configured LLM provider based on GENERAL_MEDICINE_LLM_PROVIDER env var.

    Args:
        override_provider: Bypass env var (useful for tests).
        override_key:      Bypass API key env var (useful for tests).

    Returns:
        GeminiProvider by default, or MockLLMProvider when provider="mock".

    Raises:
        ValueError for unknown provider names.
    """
    provider_name = (
        override_provider
        or os.getenv("GENERAL_MEDICINE_LLM_PROVIDER", "gemini")
    ).lower().strip()

    if provider_name == "gemini":
        return GeminiProvider(api_key=override_key)

    if provider_name == "mock":
        return MockLLMProvider()

    raise ValueError(
        f"Unknown LLM provider: '{provider_name}'. "
        f"Supported: 'gemini'. "
        f"Set GENERAL_MEDICINE_LLM_PROVIDER=gemini (or 'mock' for tests)."
    )
