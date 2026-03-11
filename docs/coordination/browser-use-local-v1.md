# Browser Use v1.0 Local Runtime Notes

## Runtime Modes
- `BROWSER_USE_MODE=local_v1`:
  - Primary path.
  - Spawns Python runner: `services/agents/browser_use_v1_runner.py`.
  - Uses local Chrome context (`user_data_dir` + `profile_directory`).
- `BROWSER_USE_MODE=mock`:
  - Deterministic in-memory task lifecycle for tests and fallback.

## ScholarBot Target URL
- ScholarBot local Browser Use prompts target:
  - `BROWSER_USE_SCHOLAR_SEARCH_URL`
  - default: `https://utexas.scholarships.ngwebsolutions.com/ScholarX_StudentLanding.aspx`
- You can override per-agent with `config.scholarshipSearchUrl`.
- In `local_v1` mode, runtime pre-navigates the browser session to this URL before `Agent.run()` to avoid `about:blank` starts.

## Fallback Behavior
- `BROWSER_USE_FALLBACK_ENABLED=true`:
  - If local runner prerequisites are missing (Python/browser_use package/runner path), runtime falls back to `mock` mode for task start.
- `BROWSER_USE_FALLBACK_ENABLED=false`:
  - Local runner errors fail the task directly.

## Local v1.0 Prerequisites
1. Install Python package:
   - `uv add browser-use && uv sync`
   - or `pip install -U browser-use`
2. Ensure browser runtime dependencies are installed:
   - `uvx browser-use install` (if Chromium dependencies are missing)
3. Ensure `BROWSER_USE_PYTHON_BIN` points to an interpreter where `browser_use` is installed.

## Troubleshooting
- Error: `python executable ... is unavailable`
  - Fix `BROWSER_USE_PYTHON_BIN` or install Python.
- Error: `python package 'browser_use' is not installed`
  - Install package in the selected interpreter environment.
- Local browser opens wrong profile
  - Set `BROWSER_USE_USER_DATA_DIR` and `BROWSER_USE_PROFILE_DIRECTORY` explicitly.
- Need deterministic tests
  - Set `BROWSER_USE_MODE=mock` before running test suites.
- Browser closes too quickly for debugging
  - Set `BROWSER_USE_HOLD_OPEN_SECONDS=20` (or similar) to keep the local browser open briefly after task completion.

## Cancellation Semantics
- `cancel(taskId)` sends `SIGTERM` to local Python runner process.
- Cancelled local tasks transition to `cancelled` state and are surfaced through existing orchestration delete semantics.
