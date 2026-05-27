import type {
  FolderPlacement,
  FolderSortDirection,
  SortableAbstractFile,
  SortableTreeItem
} from "./types";

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base"
});

// Core sort policy: reorder folder items while leaving Obsidian's file ordering untouched.
export function sortFolderSiblings<T extends SortableTreeItem>(
  items: readonly T[],
  direction: FolderSortDirection,
  placement: FolderPlacement = "keep"
): T[] {
  const sortedFolders = items.filter(isFolderItem).sort((left, right) => {
    const result = collator.compare(getFileName(left.file), getFileName(right.file));
    if (result !== 0) {
      return direction === "asc" ? result : -result;
    }

    const pathResult = collator.compare(getFilePath(left.file), getFilePath(right.file));
    return direction === "asc" ? pathResult : -pathResult;
  });

  if (placement === "folders-first") {
    return [...sortedFolders, ...items.filter((item) => !isFolderItem(item))];
  }

  if (placement === "folders-last") {
    return [...items.filter((item) => !isFolderItem(item)), ...sortedFolders];
  }

  let folderIndex = 0;

  return items.map((item) => {
    if (!isFolderItem(item)) {
      return item;
    }

    const nextFolder = sortedFolders[folderIndex];
    folderIndex += 1;
    return nextFolder ?? item;
  });
}

export function isFolderItem(item: SortableTreeItem): boolean {
  return isFolderFile(item.file);
}

function isFolderFile(file: SortableAbstractFile | null | undefined): boolean {
  if (!file) {
    return false;
  }

  if (file.kind === "folder") {
    return true;
  }

  if (file.kind === "file") {
    return false;
  }

  return Array.isArray(file.children) || file.constructor?.name === "TFolder";
}

function getFileName(file: SortableAbstractFile | null | undefined): string {
  if (typeof file?.name === "string") {
    return file.name;
  }

  const path = getFilePath(file);
  const parts = path.split("/");
  return parts[parts.length - 1] ?? "";
}

function getFilePath(file: SortableAbstractFile | null | undefined): string {
  return typeof file?.path === "string" ? file.path : "";
}
