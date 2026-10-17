import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "worktree-audit.sh");

function bashExecutable(): string {
  // Windows resolves `bash` to the WSL launcher, which does not run this script.
  if (process.platform !== "win32") return "bash";
  const candidates = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
  ];
  const found = candidates.find((path) => existsSync(path));
  if (found === undefined) throw new Error("Git bash is required to test worktree-audit.sh on Windows");
  return found;
}

function classify(path: string): string {
  const result = Bun.spawnSync([bashExecutable(), script, "--classify", path]);
  expect(result.exitCode).toBe(0);
  return new TextDecoder().decode(result.stdout).split("\t")[0] ?? "";
}

function git(cwd: string, args: string[]): void {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "test",
      GIT_COMMITTER_EMAIL: "test@example.com",
    },
  });
  if (result.exitCode !== 0) {
    const err = new TextDecoder().decode(result.stderr);
    throw new Error(`git ${args.join(" ")} failed: ${err}`);
  }
}

function bucketFor(table: string, needle: string): string {
  const row = table.split(/\r?\n/).find((line) => line.includes(needle));
  if (row === undefined) throw new Error(`no audit row for ${needle}\n${table}`);
  const bucket = row.split("\t")[7];
  if (bucket === undefined || bucket.length === 0) {
    throw new Error(`no bucket column\n${row}`);
  }
  return bucket;
}

describe("slice tree hold", () => {
  it("holds a {repo}-wt slice and its container", () => {
    expect(classify("C:/parent/TmoPro-wt/WI1_code_slice")).toBe("hold-slice");
    expect(classify("C:\\parent\\TmoPro-wt\\WI1_code_slice")).toBe("hold-slice");
    expect(classify("/parent/TmoPro-wt")).toBe("hold-slice");
  });

  it("leaves ordinary worktrees alone", () => {
    expect(classify("C:/Users/x/.t3/worktrees/engineering-toolkit/t3-abc")).toBe("other");
    expect(classify("C:/parent/not-wt-name/slice")).toBe("other");
    expect(classify("C:/parent/notes-wt-backup/slice")).toBe("other");
  });

  it("emits hold-slice for a slice worktree even when it has tracked edits", () => {
    const root = mkdtempSync(join(tmpdir(), "wt-audit-"));
    const repo = join(root, "repo");
    const slice = join(root, "sample-wt", "slice");
    const plain = join(root, "plain-work");
    try {
      mkdirSync(repo);
      mkdirSync(join(root, "sample-wt"));
      git(root, ["init", "-b", "main", repo]);
      git(repo, ["commit", "--allow-empty", "-m", "init"]);
      git(repo, ["worktree", "add", "-b", "slice", slice]);
      git(repo, ["worktree", "add", "-b", "plain", plain]);
      writeFileSync(join(slice, "note.txt"), "edit\n");
      git(slice, ["add", "note.txt"]);

      const result = Bun.spawnSync([bashExecutable(), script, "-b", "main", repo], {
        env: { ...process.env, HOME: root },
        timeout: 20000,
      });
      expect(result.exitCode).toBe(0);
      const table = new TextDecoder().decode(result.stdout);
      expect(bucketFor(table, "sample-wt")).toBe("hold-slice");
      expect(bucketFor(table, "plain-work")).not.toBe("hold-slice");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 20000);
});
