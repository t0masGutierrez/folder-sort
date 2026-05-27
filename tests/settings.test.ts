import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "../src/settings";

describe("normalizeSettings", () => {
  it("defaults to A-Z sorting on first load", () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("preserves a valid Z-A setting from saved plugin data", () => {
    expect(normalizeSettings({ folderSortDirection: "desc" })).toMatchObject({
      folderSortDirection: "desc"
    });
  });

  it("preserves a valid folder placement setting from saved plugin data", () => {
    expect(normalizeSettings({ folderPlacement: "folders-first" })).toMatchObject({
      folderPlacement: "folders-first"
    });
  });

  it("repairs invalid saved direction values", () => {
    expect(normalizeSettings({ folderSortDirection: "sideways" })).toMatchObject({
      folderSortDirection: "asc"
    });
  });

  it("repairs invalid folder placement values", () => {
    expect(normalizeSettings({ folderPlacement: "somewhere" })).toMatchObject({
      folderPlacement: "keep"
    });
  });
});
