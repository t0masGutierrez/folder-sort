import type {
  FolderActionState,
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
  placement: FolderPlacement = "keep",
  folderActions: FolderActionState = {}
): T[] {
  const visibleItems = items.filter((item) => !isHiddenFolderItem(item, folderActions));
  const sortedFolders = visibleItems.filter(isFolderItem).sort((left, right) => {
    const pinnedResult = comparePinnedFolders(left, right, folderActions.pinnedFolderPaths);

    if (pinnedResult !== 0) {
      return pinnedResult;
    }

    return compareFolderNames(left, right, direction);
  });

  if (placement === "folders-first") {
    return [...sortedFolders, ...visibleItems.filter((item) => !isFolderItem(item))];
  }

  if (placement === "folders-last") {
    return [...visibleItems.filter((item) => !isFolderItem(item)), ...sortedFolders];
  }

  let folderIndex = 0;

  return visibleItems.map((item) => {
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

export function isIgnoredFolderPath(
  path: string,
  patterns: readonly string[] | undefined
): boolean {
  if (!path || !patterns) {
    return false;
  }

  return patterns.some((pattern) => matchesFolderPattern(path, pattern));
}

function isHiddenFolderItem(item: SortableTreeItem, folderActions: FolderActionState): boolean {
  return (
    isFolderItem(item) &&
    (folderActions.hiddenFolderPaths?.has(getFilePath(item.file)) === true ||
      isIgnoredFolderPath(getFilePath(item.file), folderActions.ignoredFolderPatterns))
  );
}

function matchesFolderPattern(path: string, rawPattern: string): boolean {
  const pattern = rawPattern.trim();

  if (!pattern) {
    return false;
  }

  const prefixPattern = pattern.endsWith("/**");
  const patternToMatch = prefixPattern ? pattern.slice(0, -3) : pattern;

  try {
    const suffix = prefixPattern ? "(?:/.*)?" : "";
    return new RegExp(`^${wildcardPatternToRegex(patternToMatch)}${suffix}$`).test(path);
  } catch {
    return false;
  }
}

function wildcardPatternToRegex(pattern: string): string {
  let result = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        result += "(?:.*/)?";
        index += 2;
      } else {
        result += ".*";
        index += 1;
      }
      continue;
    }

    if (character === "*") {
      result += "[^/]*";
      continue;
    }

    result += escapeRegexCharacter(character);
  }

  return result;
}

function escapeRegexCharacter(character: string): string {
  return /[\\^$+?.()|[\]{}]/.test(character) ? `\\${character}` : character;
}

function comparePinnedFolders(
  left: SortableTreeItem,
  right: SortableTreeItem,
  pinnedFolderPaths: ReadonlySet<string> | undefined
): number {
  const leftPinned = pinnedFolderPaths?.has(getFilePath(left.file)) === true;
  const rightPinned = pinnedFolderPaths?.has(getFilePath(right.file)) === true;

  if (leftPinned === rightPinned) {
    return 0;
  }

  return leftPinned ? -1 : 1;
}

function compareFolderNames(
  left: SortableTreeItem,
  right: SortableTreeItem,
  direction: FolderSortDirection
): number {
  const result = collator.compare(getFileName(left.file), getFileName(right.file));
  if (result !== 0) {
    return direction === "asc" ? result : -result;
  }

  const pathResult = collator.compare(getFilePath(left.file), getFilePath(right.file));
  return direction === "asc" ? pathResult : -pathResult;
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
