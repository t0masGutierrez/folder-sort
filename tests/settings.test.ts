import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  isFolderPlacement,
  normalizeSettings
} from "../src/settings";

describe("folder placement settings", () => {
  it("uses folders-first by default and migrates the removed existing-order value", () => {
    expect(DEFAULT_SETTINGS.folderPlacement).toBe("folders-first");
    expect(normalizeSettings({ folderPlacement: "keep" }).folderPlacement).toBe("folders-first");
    expect(normalizeSettings({ folderPlacement: "unexpected" }).folderPlacement).toBe(
      "folders-first"
    );
    expect(isFolderPlacement("keep")).toBe(false);
    expect(isFolderPlacement("folders-first")).toBe(true);
    expect(isFolderPlacement("folders-last")).toBe(true);
  });
});

it("normalizes saved paths without dropping unavailable folders", () => {
  expect(normalizeSettings({ hiddenFolderPaths: ["Missing", "Missing", "", null], pinnedFolderPaths: ["Z", "A", 3] })).toMatchObject({ hiddenFolderPaths: ["Missing"], pinnedFolderPaths: ["A", "Z"] });
});
