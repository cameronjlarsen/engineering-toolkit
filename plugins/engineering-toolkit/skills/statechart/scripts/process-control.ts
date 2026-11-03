import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { killTree } from "./process-control-windows.mjs";

// The caller owns worker creation and these two unique, freshly created paths.
export type Janitor = Readonly<{
  disarm(): Promise<void>;
}>;

export type JanitorInput = Readonly<{
  worker: ChildProcess;
  stage: string;
  tmp: string;
}>;

type WorkerPid = number & { readonly __brand: "WorkerPid" };

type JanitorState =
  | { kind: "armed"; child: ChildProcess }
  | { kind: "disarmed"; completion: Promise<void> };

const POSIX_JANITOR =
  'while read -r line; do :; done; kill -s KILL -- "-$1"; rm -rf -- "$2" "$3"';
const POSIX_KILL = 'kill -s KILL -- "-$1"';

function isWorkerPid(value: unknown): value is WorkerPid {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isCleanupPath(value: string): boolean {
  if (value.length === 0 || value.includes("\0") || !path.isAbsolute(value)) return false;
  const resolved = path.resolve(value);
  return resolved.length > path.parse(resolved).root.length;
}

function commandDone(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    child.once("error", (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once("exit", () => {
      if (settled) return;
      settled = true;
      resolve();
    });
  });
}

function posixKillGroup(pid: WorkerPid): Promise<void> {
  const child = spawn("/bin/sh", ["-c", POSIX_KILL, "sh", String(pid)], { stdio: "ignore" });
  return commandDone(child);
}

function spawnHelper(pid: WorkerPid, stage: string, tmp: string): ChildProcess {
  if (process.platform === "win32") {
    const helper = fileURLToPath(new URL("./process-control-windows.mjs", import.meta.url));
    return spawn(process.execPath, [helper, String(pid), stage, tmp], {
      detached: true,
      windowsHide: true,
      shell: false,
      stdio: ["pipe", "ignore", "ignore"],
    });
  }
  return spawn("/bin/sh", ["-c", POSIX_JANITOR, "sh", String(pid), stage, tmp], {
    detached: true,
    stdio: ["pipe", "ignore", "ignore"],
  });
}

function whenSpawned(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      child.off("spawn", onSpawn);
      reject(error);
    };
    const onSpawn = () => {
      child.off("error", onError);
      resolve();
    };
    child.once("error", onError);
    child.once("spawn", onSpawn);
  });
}

function janitorFor(child: ChildProcess): Janitor {
  let state: JanitorState = { kind: "armed", child };
  return {
    disarm() {
      if (state.kind === "disarmed") return state.completion;
      const armed = state.child;
      let resolveDone: (() => void) | undefined;
      let rejectDone: ((error: unknown) => void) | undefined;
      const completion = new Promise<void>((resolve, reject) => {
        resolveDone = resolve;
        rejectDone = reject;
      });
      state = { kind: "disarmed", completion };
      const resolve = resolveDone;
      const reject = rejectDone;
      if (!resolve || !reject) return completion;
      const finish = () => {
        // Closing the pipe earlier is EOF, and the Windows helper would clean up again.
        if (process.platform === "win32") armed.stdin?.destroy();
        resolve();
      };
      const gone = (error: unknown) =>
        typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH";
      if (armed.exitCode !== null || armed.signalCode !== null) {
        finish();
        return completion;
      }
      armed.once("exit", finish);
      armed.once("error", (error: Error) => {
        if (gone(error) || armed.exitCode !== null || armed.signalCode !== null) finish();
        else reject(error);
      });
      try {
        armed.kill("SIGKILL");
      } catch (error) {
        if (gone(error)) finish();
        else reject(error);
      }
      return completion;
    },
  };
}

async function stopWorker(worker: ChildProcess): Promise<void> {
  if (!isWorkerPid(worker.pid)) return;
  await killGroup(worker);
}

export async function startJanitor(input: JanitorInput): Promise<Janitor> {
  try {
    const pid = input.worker.pid;
    if (!isWorkerPid(pid) || !isCleanupPath(input.stage) || !isCleanupPath(input.tmp))
      throw new Error("statechart cannot arm a janitor for this worker.");
    const child = spawnHelper(pid, input.stage, input.tmp);
    // A late helper error must not crash the supervisor. disarm watches exit.
    child.on("error", () => {});
    await whenSpawned(child);
    return janitorFor(child);
  } catch (error) {
    try {
      await stopWorker(input.worker);
    } catch (killError) {
      throw killError;
    }
    throw error;
  }
}

export async function killGroup(worker: ChildProcess): Promise<void> {
  const pid = worker.pid;
  if (!isWorkerPid(pid)) return;
  if (process.platform === "win32") await killTree(pid);
  else await posixKillGroup(pid);
}
