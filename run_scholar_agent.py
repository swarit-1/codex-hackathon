#!/usr/bin/env python3
"""Standalone Browser Use runner – scholarship multi-page form filler.

Usage:
    cd /Users/abhipasam/Documents/codex-hackathon
    .venv/bin/python run_scholar_agent.py
"""

import asyncio
import inspect
import os
import sys
from pathlib import Path
from urllib.parse import urlparse


def _normalize_env_value(raw: str) -> str:
    value = raw.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


# ── Load .env ────────────────────────────────────────────────────────────────
original_env_keys = set(os.environ.keys())
for env_name in (".env", ".env.local"):
    env_path = Path(__file__).resolve().parent / env_name
    if not env_path.exists():
        continue
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env_key = key.strip()
        if env_key in original_env_keys:
            # Explicit shell environment always wins.
            continue
        os.environ[env_key] = _normalize_env_value(value)

from browser_use import Agent, Browser  # noqa: E402

# ── LLM setup ────────────────────────────────────────────────────────────────
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
    sys.exit("No LLM backend. Set BROWSER_USE_API_KEY or OPENAI_API_KEY in .env")

# ── Config ───────────────────────────────────────────────────────────────────
START_URL = os.getenv(
    "BROWSER_USE_SCHOLAR_SEARCH_URL",
    "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search",
)
DEFAULT_CHROME_EXECUTABLE = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

CHROME_USER_DATA_DIR = os.path.expanduser(
    os.getenv("BROWSER_USE_USER_DATA_DIR", "~/Library/Application Support/Google/Chrome")
)
CHROME_PROFILE = os.getenv("BROWSER_USE_PROFILE_DIRECTORY", "Default")
HEADLESS = os.getenv("BROWSER_USE_HEADLESS", "false").strip().lower() in {"1", "true", "yes", "on"}

# Credentials for UT EID login (used via sensitive_data so they don't appear in LLM logs)
UT_EID = os.getenv("UT_EID", "")
UT_PASSWORD = os.getenv("UT_PASSWORD", "")

LOGIN_CREDENTIAL_INSTRUCTIONS = """\
   - Enter the UT EID using the secret value mapped to x_ut_eid.
   - Enter the password using the secret value mapped to x_ut_password.
   - IMPORTANT: never type the literal strings "x_ut_eid" or "x_ut_password" into the form.
"""
if UT_EID and UT_PASSWORD:
    LOGIN_CREDENTIAL_INSTRUCTIONS = f"""\
   - Enter the UT EID exactly as: {UT_EID}
   - Enter the password exactly as: {UT_PASSWORD}
   - IMPORTANT: never type the literal strings "x_ut_eid" or "x_ut_password" into the form.
"""

TASK_PROMPT = f"""\
You are a browser automation agent helping a UT Austin student apply to a scholarship.

GOAL: Navigate to the scholarship search page, find the "CREEES McWilliams Scholarship", \
click its "Apply Now" button, and then fill out the entire scholarship application \
form across all pages — but DO NOT submit at the end.

Step-by-step instructions:

1. First, navigate to {START_URL}. Wait for the page to fully load.

2. Look through the list of scholarships on the page for "CREEES McWilliams Scholarship". \
   You may need to scroll down or paginate through results to find it. \
   Once you find it, click the "Apply Now" button next to it.

3. If you are redirected to a UT EID login page (login.utexas.edu or similar):
{LOGIN_CREDENTIAL_INSTRUCTIONS}
   - Click the login/sign-in button.
   - Handle any Duo or MFA prompts if they appear go to more options and select send phone call to the number closest to the top of the list.
   - After login, you should be redirected back to the scholarship application.

4. Once on the scholarship application form, fill out ALL available fields on \
   each page. Use reasonable values for a UT Austin undergraduate Computer Science student. \
   For text fields that ask for essays or explanations, write 2-3 thoughtful sentences.

5. After completing all fields on a page, click "Next", "Continue", or the next \
   step/page button to proceed.

6. Continue filling out ALL pages of the application.

7. On the FINAL page/step, STOP. Do NOT click "Submit", "Finish", or any button \
   that would finalize/submit the application.

8. Report back what fields you found on each page and what values you entered.

CRITICAL RULES:
- DO NOT click any Submit or Finish button that would finalize the application.
- Fill out EVERY field on EVERY page before moving to the next page.
- If a dropdown does not have an exact match, pick the closest available option.
- For file upload fields, upload the file at /Users/abhipasam/Documents/codex-hackathon/dummy.txt
- Take your time and be thorough — fill ALL fields before proceeding.
"""


async def main() -> None:
    print("🚀 Launching browser agent...")
    print(f"   URL: {START_URL}")
    print(f"   Chrome profile: {CHROME_USER_DATA_DIR} ({CHROME_PROFILE})")
    print()

    browser_kwargs = dict(
        is_local=True,
        headless=HEADLESS,
        user_data_dir=CHROME_USER_DATA_DIR,
        profile_directory=CHROME_PROFILE,
    )
    chrome_executable = os.getenv("BROWSER_USE_CHROME_EXECUTABLE", "").strip() or DEFAULT_CHROME_EXECUTABLE
    if chrome_executable:
        browser_kwargs["executable_path"] = chrome_executable

    browser = Browser(**browser_kwargs)

    await browser.start()
    page = await browser.new_page(START_URL)
    await page.goto(START_URL)
    wait_for_load_state = getattr(page, "wait_for_load_state", None)
    if callable(wait_for_load_state):
        await wait_for_load_state("networkidle")
    await asyncio.sleep(1)

    current_url = await _read_page_url(page)
    if current_url and current_url.lower().startswith("about:blank"):
        await page.goto(START_URL)
        await asyncio.sleep(2)
        current_url = await _read_page_url(page)
    if not current_url:
        raise RuntimeError("Could not read current page URL after startup navigation.")
    if current_url.lower().startswith("about:blank"):
        raise RuntimeError(f"Navigation stuck on {current_url}. Failed to open {START_URL}.")
    if not _is_same_origin(current_url, START_URL):
        print(f"⚠️  Startup navigation redirected from {START_URL} to {current_url}")
    else:
        print(f"✅ Startup navigation confirmed: {current_url}")

    sensitive_data = {}
    if UT_EID:
        sensitive_data["x_ut_eid"] = UT_EID
    if UT_PASSWORD:
        sensitive_data["x_ut_password"] = UT_PASSWORD

    agent_kwargs = dict(
        task=TASK_PROMPT,
        llm=_llm_factory(),
        browser=browser,
        use_vision=False,
        max_actions_per_step=5,
    )
    if sensitive_data:
        agent_kwargs["sensitive_data"] = sensitive_data
    agent = Agent(**agent_kwargs)

    try:
        result = await agent.run()
        print("\n✅ Agent finished.")
        print(f"   Result: {result}")
        print("\n⏳ Keeping browser open for 60 seconds...")
        await asyncio.sleep(60)
    except KeyboardInterrupt:
        print("\n⚠️  Interrupted by user.")
    except Exception as exc:
        print(f"\n❌ Agent failed: {exc}", file=sys.stderr)
        import traceback
        traceback.print_exc()
    finally:
        try:
            await browser.close()
        except Exception:
            pass


async def _read_page_url(page):
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


if __name__ == "__main__":
    asyncio.run(main())
