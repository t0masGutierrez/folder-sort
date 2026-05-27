import { sortFolderSiblings } from "./folder-sorter";
import type {
  AttachResult,
  FolderPlacement,
  FolderSortDirection,
  SortableTreeItem
} from "./types";

const FILE_EXPLORER_VIEW_TYPE = "file-explorer";
const FILE_NAME_ASC_TITLES = new Set(["File name (A to Z)", "Sort by file name (A to Z)"]);
const FILE_NAME_DESC_TITLES = new Set(["File name (Z to A)", "Sort by file name (Z to A)"]);

interface WorkspaceLike {
  getLeavesOfType?: (viewType: string) => Array<{ view?: unknown }>;
}

interface AppLike {
  workspace?: WorkspaceLike;
}

interface FileExplorerViewLike {
  getSortedFolderItems?: (folder: unknown) => unknown;
  requestSort?: () => void;
  sort?: () => void;
}

interface MenuItemLike {
  onClick?: (callback: (event?: unknown) => unknown) => unknown;
  setChecked?: (checked: boolean | null) => unknown;
  setTitle?: (title: string | DocumentFragment) => unknown;
}

interface MenuLike {
  addItem?: (callback: (item: MenuItemLike) => unknown) => unknown;
}

interface PrototypeConstructor<TPrototype> {
  prototype: TPrototype;
}

interface MenuConstructors {
  Menu?: PrototypeConstructor<Required<MenuLike>>;
}

interface AdapterOptions {
  app: AppLike;
  getDirection: () => FolderSortDirection;
  getPlacement?: () => FolderPlacement;
  menuConstructors?: MenuConstructors;
  onSelectDirection: (direction: FolderSortDirection) => unknown;
}

interface ViewPatch {
  originalGetSortedFolderItems: NonNullable<FileExplorerViewLike["getSortedFolderItems"]>;
}

interface MenuPatch {
  originalAddItem: Required<MenuLike>["addItem"];
}

interface MenuState {
  injected: boolean;
  sawFileNameAsc: boolean;
}

export class FileExplorerAdapter {
  private readonly menuStates = new WeakMap<MenuLike, MenuState>();
  private menuPatch: MenuPatch | null = null;
  private patchingMenu = false;
  private readonly patchedViews = new Map<FileExplorerViewLike, ViewPatch>();

  constructor(private readonly options: AdapterOptions) {}

  attach(): AttachResult {
    this.installMenuPatch();

    const views = this.getFileExplorerViews();
    let attachedViews = 0;

    for (const view of views) {
      if (this.patchView(view)) {
        attachedViews += 1;
      }
    }

    return {
      attachedViews,
      supported: attachedViews > 0
    };
  }

  detach(): void {
    for (const [view, patch] of this.patchedViews) {
      view.getSortedFolderItems = patch.originalGetSortedFolderItems;
    }

    this.patchedViews.clear();
    this.uninstallMenuPatch();
  }

  refresh(): void {
    for (const view of this.patchedViews.keys()) {
      this.requestSort(view);
    }
  }

  setDirection(direction: FolderSortDirection): void {
    this.options.onSelectDirection(direction);
    this.refresh();
  }

  private getFileExplorerViews(): FileExplorerViewLike[] {
    const leaves = this.options.app.workspace?.getLeavesOfType?.(FILE_EXPLORER_VIEW_TYPE) ?? [];

    return leaves
      .map((leaf) => leaf.view)
      .filter((view): view is FileExplorerViewLike => isRecord(view));
  }

  private patchView(view: FileExplorerViewLike): boolean {
    if (this.patchedViews.has(view)) {
      return true;
    }

    if (typeof view.getSortedFolderItems !== "function") {
      return false;
    }

    const originalGetSortedFolderItems = view.getSortedFolderItems;
    const adapter = this;

    // Obsidian's File explorer has no public folder-only sort hook, so keep this patch narrow.
    view.getSortedFolderItems = function patchedGetSortedFolderItems(folder: unknown): unknown {
      const items = originalGetSortedFolderItems.call(this, folder);

      if (!Array.isArray(items)) {
        return items;
      }

      return sortFolderSiblings(
        items as SortableTreeItem[],
        adapter.options.getDirection(),
        adapter.options.getPlacement?.() ?? "keep"
      );
    };

    this.patchedViews.set(view, { originalGetSortedFolderItems });
    this.requestSort(view);
    return true;
  }

  private installMenuPatch(): boolean {
    if (this.menuPatch) {
      return true;
    }

    const menuPrototype = this.options.menuConstructors?.Menu?.prototype;

    if (!menuPrototype || typeof menuPrototype.addItem !== "function") {
      return false;
    }

    const originalAddItem = menuPrototype.addItem;
    const adapter = this;

    // The native sort menu is identified by the neighboring file-name sort titles.
    menuPrototype.addItem = function patchedAddItem(
      this: MenuLike,
      callback: (item: MenuItemLike) => unknown
    ): unknown {
      if (adapter.patchingMenu) {
        return originalAddItem.call(this, callback);
      }

      const menu = this;

      return originalAddItem.call(menu, (item: MenuItemLike) => {
        const originalSetTitle = item.setTitle;
        let capturedTitle: string | null = null;

        if (typeof originalSetTitle === "function") {
          item.setTitle = function patchedSetTitle(title: string | DocumentFragment): unknown {
            capturedTitle = getMenuTitleText(title);

            return originalSetTitle.call(this, title);
          };
        }

        const result = callback(item);

        if (originalSetTitle) {
          item.setTitle = originalSetTitle;
        }

        adapter.recordMenuTitle(menu, capturedTitle);
        return result;
      });
    };

    this.menuPatch = { originalAddItem };
    return true;
  }

  private uninstallMenuPatch(): void {
    const menuPrototype = this.options.menuConstructors?.Menu?.prototype;

    if (this.menuPatch && menuPrototype) {
      menuPrototype.addItem = this.menuPatch.originalAddItem;
    }

    this.menuPatch = null;
  }

  private recordMenuTitle(menu: MenuLike, title: string | null): void {
    if (!title) {
      return;
    }

    const state = this.getMenuState(menu);

    if (FILE_NAME_ASC_TITLES.has(title)) {
      state.sawFileNameAsc = true;
      return;
    }

    if (FILE_NAME_DESC_TITLES.has(title) && state.sawFileNameAsc && !state.injected) {
      state.injected = true;
      this.injectFolderSortItems(menu);
    }
  }

  private injectFolderSortItems(menu: MenuLike): void {
    if (!this.menuPatch) {
      return;
    }

    this.patchingMenu = true;

    try {
      this.menuPatch.originalAddItem.call(menu, (item) => {
        item.setTitle?.("Folder name (A to Z)");
        item.setChecked?.(this.options.getDirection() === "asc");
        item.onClick?.(() => this.setDirection("asc"));
      });

      this.menuPatch.originalAddItem.call(menu, (item) => {
        item.setTitle?.("Folder name (Z to A)");
        item.setChecked?.(this.options.getDirection() === "desc");
        item.onClick?.(() => this.setDirection("desc"));
      });
    } finally {
      this.patchingMenu = false;
    }
  }

  private getMenuState(menu: MenuLike): MenuState {
    const existingState = this.menuStates.get(menu);

    if (existingState) {
      return existingState;
    }

    const state: MenuState = {
      injected: false,
      sawFileNameAsc: false
    };

    this.menuStates.set(menu, state);
    return state;
  }

  private requestSort(view: FileExplorerViewLike): void {
    if (typeof view.requestSort === "function") {
      view.requestSort();
      return;
    }

    if (typeof view.sort === "function") {
      view.sort();
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getMenuTitleText(title: string | DocumentFragment): string | null {
  const text = typeof title === "string" ? title : title.textContent;
  const normalizedText = text?.trim();

  return normalizedText ? normalizedText : null;
}
