#!/usr/bin/env python3
"""Standalone Browser Use runner – scholarship multi-page form filler.

Usage:
    cd /Users/abhipasam/Documents/codex-hackathon
    .venv/bin/python run_scholar_agent.py
"""

import asyncio
import os
import sys
from pathlib import Path

# ── Load .env ────────────────────────────────────────────────────────────────
_env_path = Path(__file__).resolve().parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())

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
START_URL = "https://utexas.scholarships.ngwebsolutions.com/Scholarships/Search"

CHROME_USER_DATA_DIR = os.path.expanduser(
    os.getenv("BROWSER_USE_USER_DATA_DIR", "~/Library/Application Support/Google/Chrome")
)
CHROME_PROFILE = os.getenv("BROWSER_USE_PROFILE_DIRECTORY", "Default")

# Credentials for UT EID login (used via sensitive_data so they don't appear in LLM logs)
UT_EID = "ap64646"
UT_PASSWORD = "Applea14x135"

TASK_PROMPT = f"""\
You are a browser automation agent helping a UT Austin student apply to a scholarship.

GOAL: Navigate to the scholarship search page, find the "CREEES McWilliams Scholarship", \
click its "Apply Now" button, and then fill out the entire scholarship application \
form across all pages — but DO NOT submit at the end.

Step-by-step instructions:

1. You should already be on {START_URL}. Wait for the page to fully load.

2. Look through the list of scholarships on the page for "CREEES McWilliams Scholarship". \
   You may need to scroll down or paginate through results to find it. \
   Once you find it, click the "Apply Now" button next to it.

3. If you are redirected to a UT EID login page (login.utexas.edu or similar):
   - Enter the UT EID: use the value of x_ut_eid
   - Enter the password: use the value of x_ut_password
   - Click the login/sign-in button.
   - Handle any Duo or MFA prompts if they appear (e.g. click "Send Me a Push" \
     or approve via the Duo app — wait for it to complete).
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

    browser_kwargs = {
        "user_data_dir": CHROME_USER_DATA_DIR,
        "profile_directory": CHROME_PROFILE,
        "headless": False,
    }
    chrome_executable = os.getenv("BROWSER_USE_CHROME_EXECUTABLE", "").strip()
    if chrome_executable:
        browser_kwargs["executable_path"] = chrome_executable
    browser = Browser(**browser_kwargs)

    agent = Agent(
        task=TASK_PROMPT,
        llm=_llm_factory(),
        browser=browser,
        sensitive_data={
            "x_ut_eid": UT_EID,
            "x_ut_password": UT_PASSWORD,
        },
        use_vision=True,
        max_actions_per_step=5,
    )

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


if __name__ == "__main__":
    asyncio.run(main())
