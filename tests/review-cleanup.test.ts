import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "..");

describe("pre-push cleanup", () => {
  it("does not keep an empty stylesheet in the release artifact list", () => {
    const script = readFileSync(join(repoRoot, "scripts", "install-to-vault.sh"), "utf8");
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

    expect(existsSync(join(repoRoot, "styles.css"))).toBe(false);
    expect(script).not.toContain('"$PROJECT_ROOT/styles.css"');
    expect(readme).not.toContain("styles.css");
  });

  it("keeps generated release JavaScript out of the source repository", () => {
    expect(() =>
      execFileSync("git", ["ls-files", "--error-unmatch", "main.js"], {
        cwd: repoRoot,
        stdio: "ignore"
      })
    ).toThrow();
  });

  it("does not pass unused Obsidian MenuItem constructors through the adapter", () => {
    const main = readFileSync(join(repoRoot, "src", "main.ts"), "utf8");
    const adapter = readFileSync(join(repoRoot, "src", "file-explorer-adapter.ts"), "utf8");

    expect(main).not.toContain("MenuItem");
    expect(adapter).not.toContain("MenuItem?:");
  });
});
