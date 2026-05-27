import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "..");

describe("command labels", () => {
  it("uses concise folder sort command palette labels", () => {
    const main = readFileSync(join(repoRoot, "src", "main.ts"), "utf8");
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

    expect(main).toContain('name: "A to Z"');
    expect(main).toContain('name: "Z to A"');
    expect(main).toContain('name: "Toggle"');

    expect(readme).toContain("- Folder Sort: A to Z");
    expect(readme).toContain("- Folder Sort: Z to A");
    expect(readme).toContain("- Folder Sort: Toggle");

    expect(`${main}\n${readme}`).not.toContain("Set folders A to Z");
    expect(`${main}\n${readme}`).not.toContain("Set folders Z to A");
    expect(`${main}\n${readme}`).not.toContain("Toggle folder sort direction");
  });
});
