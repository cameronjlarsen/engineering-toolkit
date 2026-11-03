import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function isWorkerPid(pid) {
  return typeof pid === "number" && Number.isSafeInteger(pid) && pid > 0;
}

function absent(pid) {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ESRCH";
  }
}

function taskkillPath() {
  const root = process.env.SYSTEMROOT || process.env.SystemRoot;
  if (!root) throw new Error("statechart cannot find taskkill.exe.");
  return path.join(root, "System32", "taskkill.exe");
}

function commandCode(child) {
  return new Promise((resolve, reject) => {
    let settled = false;
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      resolve(code);
    });
  });
}

export async function killTree(pid) {
  if (!isWorkerPid(pid)) throw new Error("statechart cannot kill a worker without a positive pid.");
  const child = spawn(taskkillPath(), ["/PID", String(pid), "/T", "/F"], {
    windowsHide: true,
    shell: false,
    stdio: "ignore",
  });
  const code = await commandCode(child);
  if (code === 0 || absent(pid)) return;
  throw new Error(`taskkill could not stop process ${pid}.`);
}

function isCleanupPath(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) return false;
  if (!path.win32.isAbsolute(value)) return false;
  const resolved = path.win32.resolve(value);
  return resolved.length > path.win32.parse(resolved).root.length;
}

function parsePid(text) {
  if (typeof text !== "string" || !/^[1-9][0-9]*$/.test(text)) return undefined;
  const pid = Number(text);
  return isWorkerPid(pid) ? pid : undefined;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  const left = path.resolve(entry);
  const right = fileURLToPath(import.meta.url);
  return process.platform === "win32" ? left.toLowerCase() === path.resolve(right).toLowerCase() : left === right;
}

async function removeOwned(stage, tmp) {
  await fs.rm(stage, { recursive: true, force: true });
  await fs.rm(tmp, { recursive: true, force: true });
}

async function onEof(pid, stage, tmp) {
  let killError;
  try {
    await killTree(pid);
  } catch (error) {
    killError = error;
  }
  // Deletion still runs when taskkill fails; the exit status reports that failure afterward.
  let removeError;
  try {
    await removeOwned(stage, tmp);
  } catch (error) {
    removeError = error;
  }
  if (killError || removeError) process.exit(1);
}

function main() {
  const pid = parsePid(process.argv[2]);
  const stage = process.argv[3];
  const tmp = process.argv[4];
  if (process.argv.length !== 5 || pid === undefined || !isCleanupPath(stage) || !isCleanupPath(tmp))
    process.exit(1);
  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true;
    void onEof(pid, stage, tmp);
  };
  process.stdin.on("end", run);
  process.stdin.resume();
}

if (isDirectRun()) main();
