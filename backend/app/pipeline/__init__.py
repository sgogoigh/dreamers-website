"""VENDORED generation pipeline (from dreamers-ai/backend/app/pipeline).

Steps: Gemini trailer script (script_writer) -> chained Veo prompts
(prompt_builder) -> Veo 3.1 clips + ffmpeg stitch helpers (video). The package
imports nothing from the rest of this app except `..config` (MOCK flag +
require_gemini_key), so pipeline upgrades stay a folder swap.

The GPU-only LoRA draft step (adapter.py) is intentionally not carried over —
the consumer product goes straight from prompt to script (PLAN §9).
"""
