import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "..");

describe("settings tab content", () => {
  it("does not expose folder direction as a plugin settings row", () => {
    const settingsTab = readFileSync(join(repoRoot, "src", "settings-tab.ts"), "utf8");
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

    expect(`${settingsTab}\n${readme}`).not.toContain("Folder sort direction");
    expect(`${settingsTab}\n${readme}`).not.toContain(
      "Default direction for folders in the File explorer"
    );
  });

  it("does not expose compatibility diagnostics as a plugin settings row", () => {
    const settingsTab = readFileSync(join(repoRoot, "src", "settings-tab.ts"), "utf8");
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

    expect(settingsTab).not.toContain('.setName("Compatibility")');
    expect(settingsTab).not.toContain(".setButtonText(\"Retry\")");
    expect(readme).not.toContain("retried from the settings tab");
  });

  it("exposes folder placement as the only sorting behavior setting", () => {
    const settingsTab = readFileSync(join(repoRoot, "src", "settings-tab.ts"), "utf8");
    const readme = readFileSync(join(repoRoot, "README.md"), "utf8");

    expect(settingsTab).toContain('.setName("Folder placement")');
    expect(settingsTab).not.toContain(".setHeading()");
    expect(settingsTab).toContain("Existing order");
    expect(settingsTab).not.toContain("Keep Obsidian order");
    expect(settingsTab).toContain("Folders first");
    expect(settingsTab).toContain("Folders last");
    expect(readme).toContain("Folder placement");
  });

  it("does not expose a reset defaults settings row", () => {
    const settingsTab = readFileSync(join(repoRoot, "src", "settings-tab.ts"), "utf8");
    const main = readFileSync(join(repoRoot, "src", "main.ts"), "utf8");

    expect(settingsTab).not.toContain('.setName("Reset")');
    expect(settingsTab).not.toContain('setButtonText("Reset defaults")');
    expect(main).not.toContain("resetSettings");
  });
});
