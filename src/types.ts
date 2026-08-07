export type FolderPlacement = "keep" | "folders-first" | "folders-last";

export type FolderSortDirection = "asc" | "desc";

export interface FolderSortSettings {
  compatibilityNoticeShown: boolean;
  folderPlacement: FolderPlacement;
  folderSortDirection: FolderSortDirection;
  hiddenFolderPaths: string[];
  ignoredFolderPatterns: string[];
  pinnedFolderPaths: string[];
}

export interface SortableAbstractFile {
  children?: unknown[];
  kind?: "file" | "folder";
  name?: string;
  path?: string;
}

export interface SortableTreeItem {
  file?: SortableAbstractFile | null;
  [key: string]: unknown;
}

export interface FolderActionState {
  hiddenFolderPaths?: ReadonlySet<string>;
  ignoredFolderPatterns?: readonly string[];
  pinnedFolderPaths?: ReadonlySet<string>;
}

export interface AttachResult {
  attachedViews: number;
  supported: boolean;
}
