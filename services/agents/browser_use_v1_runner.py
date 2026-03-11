#!/usr/bin/env python3
"""Browser Use v1.0 local runner.

Invoked by the TypeScript runtime adapter with a JSON payload to execute one
local Browser Use task in the user's Chrome profile context.

Requires Python >= 3.10 and the ``browser-use`` package.
"""

from __future__ import annotations

import argparse
import asyncio
import inspect
import json
import os
import sys
import traceback
from urllib.parse import urlparse
from typing import Any, Dict

# ── Fail-fast: Python version check ──────────────────────────────────────────
MIN_PYTHON = (3, 10)
if sys.version_info < MIN_PYTHON:
    sys.exit(
        f"Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]}+ is required "
        f"(running {sys.version_info.major}.{sys.version_info.minor}). "
        "Set BROWSER_USE_PYTHON_BIN to a compatible interpreter."
    )

# ── Fail-fast: browser_use import ────────────────────────────────────────────
try:
    from browser_use import Agent, Browser
except ImportError as _imp_err:
    sys.exit(
        f"Required package 'browser-use' is not installed: {_imp_err}\n"
        "Install it with: pip install browser-use"
    )

# LLM selection: prefer ChatBrowserUse, fall back to ChatOpenAI if available
_llm_factory = None
try:
    from browser_use import ChatBrowserUse
    _llm_factory = lambda: ChatBrowserUse()
except Exception:
    pass

if _llm_factory is None:
    try:
        from browser_use import ChatOpenAI
        _model = os.getenv("OPENAI_MODEL", "gpt-4o")
        _llm_factory = lambda: ChatOpenAI(model=_model)
    except Exception:
        pass

if _llm_factory is None:
    sys.exit(
        "No LLM backend available. Either set BROWSER_USE_API_KEY for ChatBrowserUse "
        "or OPENAI_API_KEY for ChatOpenAI."
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Browser Use v1.0 task locally")
    parser.add_argument("--payload", required=True, help="JSON payload for Browser Use task")
    return parser.parse_args()


async def run_task(payload: Dict[str, Any]) -> None:
    browser_kwargs: Dict[str, Any] = {
        "headless": bool(payload.get("headless", False)),
    }

    chrome_executable = payload.get("chrome_executable")
    if chrome_executable:
        browser_kwargs["executable_path"] = chrome_executable

    user_data_dir = payload.get("user_data_dir")
    if user_data_dir:
        browser_kwargs["user_data_dir"] = os.path.expanduser(str(user_data_dir))

    profile_directory = payload.get("profile_directory")
    if profile_directory:
        browser_kwargs["profile_directory"] = profile_directory

    browser = Browser(**browser_kwargs)

    start_url = payload.get("start_url")
    if start_url:
        await browser.start()
        page = await browser.new_page(str(start_url))
        await page.goto(str(start_url))

        wait_for_load_state = getattr(page, "wait_for_load_state", None)
        if callable(wait_for_load_state):
            await wait_for_load_state("networkidle")
        await asyncio.sleep(1)

        current_url = await _read_page_url(page)
        if not current_url:
            raise RuntimeError(f"Unable to read current page URL after navigating to {start_url}")
        if current_url.lower().startswith("about:blank"):
            raise RuntimeError(f"Navigation stuck on {current_url} (expected {start_url})")
        if not _is_same_origin(current_url, str(start_url)):
            print(
                f"Warning: pre-navigation redirected from {start_url} to {current_url}",
                file=sys.stderr,
            )

    task_prompt = payload.get("task_prompt")
    if not task_prompt and start_url:
        task_prompt = f"Navigate to {start_url}, then complete the requested workflow."
    if not task_prompt:
        task_prompt = "Open the target workflow page and complete the requested task."
    llm = _llm_factory()

    agent = Agent(
        task=str(task_prompt),
        browser=browser,
        llm=llm,
    )

    try:
        await agent.run()

        hold_seconds_raw = os.getenv("BROWSER_USE_HOLD_OPEN_SECONDS", "0").strip()
        try:
            hold_seconds = max(0.0, float(hold_seconds_raw))
        except ValueError:
            hold_seconds = 0.0
        if hold_seconds > 0:
            await asyncio.sleep(hold_seconds)
    finally:
        try:
            await browser.close()
        except Exception:
            pass


async def _read_page_url(page: Any) -> str | None:
    get_url = getattr(page, "get_url", None)
    if callable(get_url):
        value = get_url()
        if inspect.isawaitable(value):
            value = await value
        if isinstance(value, str):
            return value

    url_attr = getattr(page, "url", None)
    if isinstance(url_attr, str):
        return url_attr

    return None


def _is_same_origin(current: str, target: str) -> bool:
    current_parts = urlparse(current)
    target_parts = urlparse(target)
    if not current_parts.scheme or not current_parts.netloc:
        return False
    if not target_parts.scheme or not target_parts.netloc:
        return False
    return (
        current_parts.scheme.lower() == target_parts.scheme.lower()
        and current_parts.netloc.lower() == target_parts.netloc.lower()
    )


def main() -> int:
    args = parse_args()

    if os.getenv("BROWSER_USE_LOCAL_SIMULATE", "").strip().lower() in {"1", "true", "yes", "on"}:
        return 0

    try:
        payload: Dict[str, Any] = json.loads(args.payload)
    except Exception as exc:  # noqa: BLE001
        print(f"Invalid payload JSON: {exc}", file=sys.stderr)
        return 1

    try:
        asyncio.run(run_task(payload))
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"Browser Use local runner failed: {exc}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
