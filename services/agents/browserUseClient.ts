import { randomUUID } from "node:crypto";
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type BrowserUseTaskState = "created" | "running" | "succeeded" | "failed" | "cancelled";
export type BrowserUseMode = "local_v1" | "mock";

export interface BrowserUseTaskRequest {
  agentId: string;
  runId: string;
  templateId?: string;
  startUrl?: string;
  mode?: "deterministic-success" | "deterministic-fail" | "deterministic-slow-success";
  taskPrompt?: string;
}

export interface BrowserUseTask {
  taskId: string;
  agentId: string;
  runId: string;
  templateId?: string;
  startUrl?: string;
  taskPrompt?: string;
  state: BrowserUseTaskState;
  polls: number;
  mode: NonNullable<BrowserUseTaskRequest["mode"]>;
  modeUsed: BrowserUseMode;
  createdAt: string;
  updatedAt: string;
  pid?: number;
  exitCode?: number | null;
  lastError?: string;
  stdoutTail?: string;
  stderrTail?: string;
}

interface BrowserUseClient {
  create(request: BrowserUseTaskRequest): BrowserUseTask;
  start(taskId: string): BrowserUseTask;
  status(taskId: string): BrowserUseTask;
  cancel(taskId: string): BrowserUseTask;
  snapshot(taskId: string): BrowserUseTask | undefined;
}

interface LocalRunnerConfig {
  pythonBin: string;
  runnerPath: string;
  chromeExecutable?: string;
  userDataDir: string;
  profileDirectory: string;
  headless: boolean;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_RUNNER_PATH = resolve(__dirname, "browser_use_v1_runner.py");
const DEFAULT_USER_DATA_DIR = "~/Library/Application Support/Google/Chrome";

class DualModeBrowserUseClient implements BrowserUseClient {
  private readonly tasks = new Map<string, BrowserUseTask>();
  private readonly childProcesses = new Map<string, ChildProcessWithoutNullStreams>();

  create(request: BrowserUseTaskRequest): BrowserUseTask {
    const now = new Date().toISOString();
    const task: BrowserUseTask = {
      taskId: `browser_task_${randomUUID()}`,
      agentId: request.agentId,
      runId: request.runId,
      templateId: request.templateId,
      startUrl: request.startUrl,
      taskPrompt: request.taskPrompt,
      state: "created",
      polls: 0,
      mode: request.mode ?? "deterministic-success",
      modeUsed: resolveBrowserUseModeFromEnv(),
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.taskId, task);
    return task;
  }

  start(taskId: string): BrowserUseTask {
    const task = this.getTask(taskId);

    if (task.modeUsed === "mock") {
      return this.startMockTask(task);
    }

    return this.startLocalTask(task);
  }

  status(taskId: string): BrowserUseTask {
    const task = this.getTask(taskId);

    if (task.modeUsed !== "mock") {
      return task;
    }

    const polls = task.polls + 1;

    if (task.state !== "running") {
      return task;
    }

    let nextState: BrowserUseTaskState = task.state;
    if (task.mode === "deterministic-success") {
      nextState = "succeeded";
    } else if (task.mode === "deterministic-fail") {
      nextState = "failed";
    } else if (task.mode === "deterministic-slow-success") {
      nextState = polls >= 2 ? "succeeded" : "running";
    }

    return this.updateTask(task.taskId, {
      polls,
      state: nextState,
    });
  }

  cancel(taskId: string): BrowserUseTask {
    const task = this.getTask(taskId);

    if (task.modeUsed === "mock") {
      return this.updateTask(taskId, {
        state: "cancelled",
      });
    }

    const child = this.childProcesses.get(taskId);
    if (child && !child.killed) {
      child.kill("SIGTERM");
    }

    return this.updateTask(taskId, {
      state: "cancelled",
    });
  }

  snapshot(taskId: string): BrowserUseTask | undefined {
    return this.tasks.get(taskId);
  }

  reset(): void {
    for (const [taskId, child] of this.childProcesses.entries()) {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
      this.childProcesses.delete(taskId);
    }

    this.tasks.clear();
  }

  private startMockTask(task: BrowserUseTask): BrowserUseTask {
    return this.updateTask(task.taskId, {
      modeUsed: "mock",
      state: "running",
      lastError: task.lastError,
    });
  }

  private startLocalTask(task: BrowserUseTask): BrowserUseTask {
    const runnerConfig = resolveLocalRunnerConfigFromEnv();
    const availability = checkLocalRunnerAvailability(runnerConfig);

    if (!availability.ok) {
      if (isBrowserUseFallbackEnabled()) {
        const fallbackReady = this.updateTask(task.taskId, {
          modeUsed: "mock",
          lastError:
            `local_v1 unavailable: ${availability.reason}. Falling back to mock mode. ` +
            "Set BROWSER_USE_FALLBACK_ENABLED=false to fail fast.",
        });
        return this.startMockTask(fallbackReady);
      }

      return this.updateTask(task.taskId, {
        state: "failed",
        lastError: `local_v1 unavailable: ${availability.reason}`,
      });
    }

    const payload = buildLocalRunnerPayload(task, runnerConfig);
    const child = spawn(runnerConfig.pythonBin, [runnerConfig.runnerPath, "--payload", JSON.stringify(payload)], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    this.childProcesses.set(task.taskId, child);

    child.stdout.on("data", (chunk) => {
      this.updateTask(task.taskId, {
        stdoutTail: appendTail(this.getTask(task.taskId).stdoutTail, chunk.toString()),
      });
    });

    child.stderr.on("data", (chunk) => {
      this.updateTask(task.taskId, {
        stderrTail: appendTail(this.getTask(task.taskId).stderrTail, chunk.toString()),
      });
    });

    child.on("error", (err) => {
      if (isBrowserUseFallbackEnabled()) {
        const fallbackTask = this.updateTask(task.taskId, {
          modeUsed: "mock",
          lastError:
            `local_v1 process error: ${err.message}. Falling back to mock mode. ` +
            "Set BROWSER_USE_FALLBACK_ENABLED=false to fail fast.",
        });
        this.childProcesses.delete(task.taskId);
        this.startMockTask(fallbackTask);
        return;
      }

      this.updateTask(task.taskId, {
        state: "failed",
        lastError: `local_v1 process error: ${err.message}`,
      });
      this.childProcesses.delete(task.taskId);
    });

    child.on("close", (exitCode, signal) => {
      this.childProcesses.delete(task.taskId);
      const current = this.tasks.get(task.taskId);
      if (!current) {
        return;
      }

      if (current.state === "cancelled") {
        this.updateTask(task.taskId, {
          exitCode,
          lastError: current.lastError,
        });
        return;
      }

      if (exitCode === 0) {
        this.updateTask(task.taskId, {
          state: "succeeded",
          exitCode,
        });
        return;
      }

      if (signal === "SIGTERM" || signal === "SIGINT") {
        this.updateTask(task.taskId, {
          state: "cancelled",
          exitCode,
          lastError: current.lastError,
        });
        return;
      }

      this.updateTask(task.taskId, {
        state: "failed",
        exitCode,
        lastError: current.stderrTail ?? describeLocalRunnerExit(exitCode, signal, current.startUrl),
      });
    });

    return this.updateTask(task.taskId, {
      modeUsed: "local_v1",
      state: "running",
      pid: child.pid,
    });
  }

  private getTask(taskId: string): BrowserUseTask {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Browser Use task not found: ${taskId}`);
    }
    return task;
  }

  private updateTask(taskId: string, patch: Partial<BrowserUseTask>): BrowserUseTask {
    const existing = this.getTask(taskId);
    const updated: BrowserUseTask = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(taskId, updated);
    return updated;
  }
}

function appendTail(previous: string | undefined, nextChunk: string): string {
  const combined = `${previous ?? ""}${nextChunk}`;
  const maxLength = 1000;
  if (combined.length <= maxLength) {
    return combined;
  }
  return combined.slice(combined.length - maxLength);
}

function describeLocalRunnerExit(
  exitCode: number | null,
  signal: NodeJS.Signals | null,
  startUrl: string | undefined,
): string {
  const base = `local_v1 runner exited with code ${String(exitCode)}${signal ? ` and signal ${signal}` : ""}`;
  if (signal === "SIGABRT") {
    const urlHint = startUrl ? ` while opening ${startUrl}` : "";
    return (
      `${base}. Browser launch aborted${urlHint}. ` +
      "Common causes: existing Chrome profile lock, invalid Chrome executable path, or non-GUI environment. " +
      "Try closing Chrome, setting BROWSER_USE_CHROME_EXECUTABLE explicitly, or temporarily setting BROWSER_USE_HEADLESS=true."
    );
  }
  return base;
}

function checkLocalRunnerAvailability(config: LocalRunnerConfig): { ok: true } | { ok: false; reason: string } {
  if (!existsSync(config.runnerPath)) {
    return {
      ok: false,
      reason: `runner script missing at ${config.runnerPath}`,
    };
  }

  const pythonCheck = spawnSync(config.pythonBin, ["--version"], {
    encoding: "utf-8",
  });

  if (pythonCheck.error) {
    return {
      ok: false,
      reason: `python executable '${config.pythonBin}' is unavailable (${pythonCheck.error.message})`,
    };
  }

  // Verify Python >= 3.10
  const versionOutput = (pythonCheck.stdout ?? pythonCheck.stderr ?? "").trim();
  const versionMatch = versionOutput.match(/Python\s+(\d+)\.(\d+)/);
  if (versionMatch) {
    const major = parseInt(versionMatch[1], 10);
    const minor = parseInt(versionMatch[2], 10);
    if (major < 3 || (major === 3 && minor < 10)) {
      return {
        ok: false,
        reason: `Python >= 3.10 required but found ${major}.${minor}. Update BROWSER_USE_PYTHON_BIN.`,
      };
    }
  }

  const browserUseImportCheck = spawnSync(config.pythonBin, ["-c", "import browser_use"], {
    encoding: "utf-8",
  });

  if (browserUseImportCheck.status !== 0) {
    return {
      ok: false,
      reason: "python package 'browser_use' is not installed in the selected interpreter. Run: pip install browser-use",
    };
  }

  return { ok: true };
}

function buildLocalRunnerPayload(task: BrowserUseTask, config: LocalRunnerConfig): Record<string, unknown> {
  const fallbackPrompt = task.startUrl
    ? `Navigate to ${task.startUrl} and complete the requested workflow for agent ${task.agentId}.`
    : `Open the target workflow page in the local browser context for agent ${task.agentId}, then finish.`;

  return {
    agent_id: task.agentId,
    run_id: task.runId,
    template_id: task.templateId,
    task_prompt: task.taskPrompt ?? process.env.BROWSER_USE_DEFAULT_TASK_PROMPT ?? fallbackPrompt,
    start_url: task.startUrl,
    chrome_executable: config.chromeExecutable,
    user_data_dir: config.userDataDir,
    profile_directory: config.profileDirectory,
    headless: config.headless,
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

export function resolveBrowserUseModeFromEnv(): BrowserUseMode {
  const raw = process.env.BROWSER_USE_MODE?.trim().toLowerCase();
  if (raw === "mock") {
    return "mock";
  }
  return "local_v1";
}

export function resolveLocalRunnerConfigFromEnv(): LocalRunnerConfig {
  let runnerPath = process.env.BROWSER_USE_LOCAL_RUNNER_PATH?.trim() || DEFAULT_RUNNER_PATH;
  // Resolve relative paths against cwd so the runner is found regardless of launch directory
  if (!isAbsolute(runnerPath)) {
    runnerPath = resolve(process.cwd(), runnerPath);
  }

  const envPythonBin = process.env.BROWSER_USE_PYTHON_BIN?.trim();
  let pythonBin = "python3";
  if (envPythonBin && envPythonBin.length > 0) {
    if (envPythonBin.includes("/") && !isAbsolute(envPythonBin)) {
      pythonBin = resolve(process.cwd(), envPythonBin);
    } else {
      pythonBin = envPythonBin;
    }
  } else {
    const projectVenvPython = resolve(process.cwd(), ".venv/bin/python");
    if (existsSync(projectVenvPython)) {
      pythonBin = projectVenvPython;
    }
  }

  return {
    pythonBin,
    runnerPath,
    chromeExecutable: process.env.BROWSER_USE_CHROME_EXECUTABLE?.trim() || undefined,
    userDataDir: process.env.BROWSER_USE_USER_DATA_DIR?.trim() || DEFAULT_USER_DATA_DIR,
    profileDirectory: process.env.BROWSER_USE_PROFILE_DIRECTORY?.trim() || "Default",
    headless: parseBoolean(process.env.BROWSER_USE_HEADLESS, false),
  };
}

export function isBrowserUseFallbackEnabled(): boolean {
  return parseBoolean(process.env.BROWSER_USE_FALLBACK_ENABLED, true);
}

const singletonClient = new DualModeBrowserUseClient();

export function getBrowserUseClient(): BrowserUseClient {
  return singletonClient;
}

export function resetBrowserUseMock(): void {
  singletonClient.reset();
}
