import type { FolderPlacement, FolderSortDirection, FolderSortSettings } from "./types";

export const DEFAULT_SETTINGS: FolderSortSettings = {
  compatibilityNoticeShown: false,
  folderPlacement: "keep",
  folderSortDirection: "asc",
  hiddenFolderPaths: [],
  pinnedFolderPaths: []
};

// Obsidian save data is untyped and may come from an older plugin version.
export function normalizeSettings(data: unknown): FolderSortSettings {
  const saved = isRecord(data) ? data : {};
  const folderSortDirection = isFolderSortDirection(saved.folderSortDirection)
    ? saved.folderSortDirection
    : DEFAULT_SETTINGS.folderSortDirection;
  const folderPlacement = isFolderPlacement(saved.folderPlacement)
    ? saved.folderPlacement
    : DEFAULT_SETTINGS.folderPlacement;

  return {
    compatibilityNoticeShown:
      typeof saved.compatibilityNoticeShown === "boolean"
        ? saved.compatibilityNoticeShown
        : DEFAULT_SETTINGS.compatibilityNoticeShown,
    folderPlacement,
    folderSortDirection,
    hiddenFolderPaths: normalizePathList(saved.hiddenFolderPaths),
    pinnedFolderPaths: normalizePathList(saved.pinnedFolderPaths)
  };
}

export function isFolderPlacement(value: unknown): value is FolderPlacement {
  return value === "keep" || value === "folders-first" || value === "folders-last";
}

export function isFolderSortDirection(value: unknown): value is FolderSortDirection {
  return value === "asc" || value === "desc";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePathList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))
  ].sort();
}
