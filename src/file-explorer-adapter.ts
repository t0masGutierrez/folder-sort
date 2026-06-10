import { sortFolderSiblings } from "./folder-sorter";
import type {
  AttachResult,
  FolderPlacement,
  FolderSortDirection,
  SortableAbstractFile,
  SortableTreeItem
} from "./types";

const FILE_EXPLORER_VIEW_TYPE = "file-explorer";
const FILE_NAME_ASC_TITLES = new Set(["File name (A to Z)", "Sort by file name (A to Z)"]);
const FILE_NAME_DESC_TITLES = new Set(["File name (Z to A)", "Sort by file name (Z to A)"]);
const FOLDER_TITLE_SELECTOR = ".nav-folder-title, .tree-item-self";
const FOLDER_TITLE_ELEMENT_KEYS = ["selfEl", "titleEl", "el", "containerEl"] as const;
const FOLDER_TITLE_TEXT_SELECTOR = ".nav-folder-title-content, .tree-item-inner, .tree-item-title";
const FOLDER_ACTION_SECTION = "action";
const PINNED_FOLDER_CLASS = "folder-sort-is-pinned";
const PINNED_FOLDER_ICON_CLASS = "folder-sort-pinned-icon";
const MOVE_FOLDER_TITLES = new Set(["Move folder to...", "Move folder to…"]);

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
  setIcon?: (icon: string | null) => unknown;
  onClick?: (callback: (event?: unknown) => unknown) => unknown;
  setChecked?: (checked: boolean | null) => unknown;
  setSection?: (section: string) => unknown;
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
  getHiddenFolderPaths?: () => ReadonlySet<string>;
  getPlacement?: () => FolderPlacement;
  getPinnedFolderPaths?: () => ReadonlySet<string>;
  isFolderPinned?: (path: string) => boolean;
  menuConstructors?: MenuConstructors;
  onHideFolder?: (path: string) => unknown;
  onSelectDirection: (direction: FolderSortDirection) => unknown;
  setIcon?: (element: HTMLElement, iconId: string) => void;
  onTogglePinned?: (path: string) => unknown;
}

interface ViewPatch {
  originalGetSortedFolderItems: NonNullable<FileExplorerViewLike["getSortedFolderItems"]>;
}

interface MenuPatch {
  originalAddItem: Required<MenuLike>["addItem"];
}

interface MenuState {
  folderActionsInjected: boolean;
  folderHideItem: MenuItemLike | null;
  folderPath: string | null;
  folderPinItem: MenuItemLike | null;
  injected: boolean;
  moveFolderSection: string | null;
  sawFileNameAsc: boolean;
  sawMoveFolderTo: boolean;
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

    this.schedulePinnedFolderIconSync();
    return {
      attachedViews,
      supported: attachedViews > 0
    };
  }

  detach(): void {
    for (const [view, patch] of this.patchedViews) {
      view.getSortedFolderItems = patch.originalGetSortedFolderItems;
    }

    cleanupPinnedFolderIcons(getGlobalDocument());
    this.patchedViews.clear();
    this.uninstallMenuPatch();
  }

  refresh(): void {
    for (const view of this.patchedViews.keys()) {
      this.requestSort(view);
    }

    this.schedulePinnedFolderIconSync();
  }

  setDirection(direction: FolderSortDirection): void {
    this.options.onSelectDirection(direction);
    this.refresh();
  }

  registerFolderContextMenu(menu: MenuLike, folder: SortableAbstractFile): void {
    this.installMenuPatch();

    const path = getFilePath(folder);

    if (path) {
      const state = this.getMenuState(menu);
      state.folderPath = path;
      this.injectFolderActionsIfReady(menu);
      this.updateFolderActionItems(state);
    }
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
    const { options } = this;

    // Obsidian's File explorer has no public folder-only sort hook, so keep this patch narrow.
    view.getSortedFolderItems = function patchedGetSortedFolderItems(folder: unknown): unknown {
      const items = originalGetSortedFolderItems.call(this, folder);

      if (!Array.isArray(items)) {
        return items;
      }

      const sortedItems = sortFolderSiblings(
        items as SortableTreeItem[],
        options.getDirection(),
        options.getPlacement?.() ?? "keep",
        {
          hiddenFolderPaths: options.getHiddenFolderPaths?.(),
          pinnedFolderPaths: options.getPinnedFolderPaths?.()
        }
      );

      syncPinnedFolderIcons(
        sortedItems,
        options.getPinnedFolderPaths?.() ?? new Set(),
        options.setIcon
      );

      return sortedItems;
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
    const isPatchingMenu = (): boolean => this.patchingMenu;
    const recordMenuItem = (
      menu: MenuLike,
      title: string | null,
      section: string | null
    ): void => this.recordMenuItem(menu, title, section);

    // The native sort menu is identified by the neighboring file-name sort titles.
    menuPrototype.addItem = function patchedAddItem(
      this: MenuLike,
      callback: (item: MenuItemLike) => unknown
    ): unknown {
      if (isPatchingMenu()) {
        return originalAddItem.call(this, callback);
      }

      let capturedTitle: string | null = null;
      let capturedSection: string | null = null;
      const result = originalAddItem.call(this, (item: MenuItemLike) => {
        const originalSetTitle = item.setTitle;
        const originalSetSection = item.setSection;

        if (typeof originalSetTitle === "function") {
          item.setTitle = function patchedSetTitle(title: string | DocumentFragment): unknown {
            capturedTitle = getMenuTitleText(title);

            return originalSetTitle.call(this, title);
          };
        }

        if (typeof originalSetSection === "function") {
          item.setSection = function patchedSetSection(section: string): unknown {
            capturedSection = section;

            return originalSetSection.call(this, section);
          };
        }

        try {
          return callback(item);
        } finally {
          if (originalSetTitle) {
            item.setTitle = originalSetTitle;
          }

          if (originalSetSection) {
            item.setSection = originalSetSection;
          }
        }
      });

      recordMenuItem(this, capturedTitle, capturedSection);
      return result;
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

  private recordMenuItem(
    menu: MenuLike,
    title: string | null,
    section: string | null
  ): void {
    if (!title) {
      return;
    }

    const state = this.getMenuState(menu);

    if (MOVE_FOLDER_TITLES.has(title)) {
      state.sawMoveFolderTo = true;
      state.moveFolderSection = section ?? state.moveFolderSection;
      this.injectFolderActionsIfReady(menu);
      this.updateFolderActionItems(state);
      return;
    }

    if (FILE_NAME_ASC_TITLES.has(title)) {
      state.sawFileNameAsc = true;
      return;
    }

    if (FILE_NAME_DESC_TITLES.has(title) && state.sawFileNameAsc && !state.injected) {
      state.injected = true;
      this.injectFolderSortItems(menu);
    }
  }

  private injectFolderActionsIfReady(menu: MenuLike): void {
    const state = this.getMenuState(menu);

    if (!state.sawMoveFolderTo || state.folderActionsInjected) {
      return;
    }

    state.folderActionsInjected = true;
    this.injectFolderActionItems(menu);
  }

  private injectFolderActionItems(menu: MenuLike): void {
    if (!this.menuPatch) {
      return;
    }

    const state = this.getMenuState(menu);
    state.folderPinItem = null;
    state.folderHideItem = null;
    this.patchingMenu = true;

    try {
      const pinItem = this.addMenuItem(menu, (item) => {
        setMenuItemSection(item, FOLDER_ACTION_SECTION);
        item.onClick?.(() => {
          const path = state.folderPath;

          if (path) {
            this.options.onTogglePinned?.(path);
          }
        });
      });

      if (pinItem) {
        state.folderPinItem = pinItem;
      }

      const hideItem = this.addMenuItem(menu, (item) => {
        setMenuItemSection(item, FOLDER_ACTION_SECTION);
        item.onClick?.(() => {
          const path = state.folderPath;

          if (path) {
            this.options.onHideFolder?.(path);
          }
        });
      });

      if (hideItem) {
        state.folderHideItem = hideItem;
      }

      this.updateFolderActionItems(state);
    } finally {
      this.patchingMenu = false;
    }
  }

  private injectFolderSortItems(menu: MenuLike): void {
    if (!this.menuPatch) {
      return;
    }

    this.patchingMenu = true;

    try {
      this.addMenuItem(menu, (item) => {
        item.setTitle?.("Folder name (A to Z)");
        item.setChecked?.(this.options.getDirection() === "asc");
        item.onClick?.(() => this.setDirection("asc"));
      });

      this.addMenuItem(menu, (item) => {
        item.setTitle?.("Folder name (Z to A)");
        item.setChecked?.(this.options.getDirection() === "desc");
        item.onClick?.(() => this.setDirection("desc"));
      });
    } finally {
      this.patchingMenu = false;
    }
  }

  private addMenuItem(menu: MenuLike, configure: (item: MenuItemLike) => void): MenuItemLike | null {
    if (!this.menuPatch) {
      return null;
    }

    let createdItem: MenuItemLike | null = null;

    this.menuPatch.originalAddItem.call(menu, (item) => {
      createdItem = item;
      configure(item);
    });

    return createdItem;
  }

  private updateFolderActionItems(state: MenuState): void {
    const path = state.folderPath;
    const pinned = path ? this.options.isFolderPinned?.(path) === true : false;

    state.folderPinItem?.setTitle?.(pinned ? "Unpin folder" : "Pin folder");
    state.folderPinItem?.setIcon?.(pinned ? "pin-off" : "pin");
    state.folderHideItem?.setTitle?.("Hide folder");
    state.folderHideItem?.setIcon?.("eye-off");
  }

  private schedulePinnedFolderIconSync(): void {
    syncPinnedFolderIconsInDocument(
      this.options.getPinnedFolderPaths?.() ?? new Set(),
      this.options.setIcon,
      getGlobalDocument()
    );

    scheduleAfterRender(() => {
      syncPinnedFolderIconsInDocument(
        this.options.getPinnedFolderPaths?.() ?? new Set(),
        this.options.setIcon,
        getGlobalDocument()
      );
    });
  }

  private getMenuState(menu: MenuLike): MenuState {
    const existingState = this.menuStates.get(menu);

    if (existingState) {
      return existingState;
    }

    const state: MenuState = {
      folderActionsInjected: false,
      folderHideItem: null,
      folderPath: null,
      folderPinItem: null,
      injected: false,
      moveFolderSection: null,
      sawFileNameAsc: false,
      sawMoveFolderTo: false
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

function getFilePath(file: SortableAbstractFile | null | undefined): string {
  return typeof file?.path === "string" ? file.path : "";
}

function syncPinnedFolderIcons(
  items: readonly SortableTreeItem[],
  pinnedFolderPaths: ReadonlySet<string>,
  setIcon: AdapterOptions["setIcon"]
): void {
  for (const item of items) {
    const path = getFilePath(item.file);
    const titleEl = getFolderTitleElement(item, path);

    if (!titleEl) {
      continue;
    }

    syncPinnedFolderIcon(titleEl, pinnedFolderPaths.has(path), setIcon);
  }
}

function syncPinnedFolderIconsInDocument(
  pinnedFolderPaths: ReadonlySet<string>,
  setIcon: AdapterOptions["setIcon"],
  root: Document | null
): void {
  if (!root) {
    return;
  }

  const pinnedFolderNames = new Set(Array.from(pinnedFolderPaths, getPathBasename));
  const matchedPinnedPaths = new Set<string>();

  for (const titleEl of findAllInRoot(root, FOLDER_TITLE_SELECTOR)) {
    const path = getElementPath(titleEl);

    if (path) {
      const pinned = pinnedFolderPaths.has(path);
      syncPinnedFolderIcon(titleEl, pinned, setIcon);

      if (pinned) {
        matchedPinnedPaths.add(path);
      }

      continue;
    }

    const title = getFolderTitleText(titleEl);

    if (!title) {
      continue;
    }

    syncPinnedFolderIcon(titleEl, pinnedFolderNames.has(title), setIcon);
  }

  for (const path of pinnedFolderPaths) {
    if (matchedPinnedPaths.has(path)) {
      continue;
    }

    const titleEl = findFolderTitleElementByPath(path, root);

    if (titleEl) {
      syncPinnedFolderIcon(titleEl, true, setIcon);
    }
  }
}

function syncPinnedFolderIcon(
  titleEl: HTMLElement,
  pinned: boolean,
  setIcon: AdapterOptions["setIcon"]
): void {
  titleEl.classList.toggle(PINNED_FOLDER_CLASS, pinned);

  const existingIcon = getExistingPinnedIcon(titleEl);

  if (!pinned) {
    existingIcon?.remove();
    return;
  }

  const iconEl = existingIcon ?? createPinnedIconElement(titleEl);

  if (!iconEl) {
    return;
  }

  if (!existingIcon) {
    titleEl.appendChild(iconEl);
  }

  setIcon?.(iconEl, "pin");
}

function getFolderTitleElement(item: SortableTreeItem, path: string): HTMLElement | null {
  for (const key of FOLDER_TITLE_ELEMENT_KEYS) {
    const element = findFolderTitleElement(item[key]);

    if (element) {
      return element;
    }
  }

  return findFolderTitleElementByPath(path, getDocumentForItem(item));
}

function findFolderTitleElement(value: unknown): HTMLElement | null {
  if (!isHTMLElementLike(value)) {
    return null;
  }

  if (value.classList.contains("nav-folder-title") || value.classList.contains("tree-item-self")) {
    return value;
  }

  return value.querySelector<HTMLElement>(FOLDER_TITLE_SELECTOR);
}

function getExistingPinnedIcon(titleEl: HTMLElement): HTMLElement | null {
  return Array.from(titleEl.children).find((child): child is HTMLElement => {
    return isHTMLElementLike(child) && child.classList.contains(PINNED_FOLDER_ICON_CLASS);
  }) ?? null;
}

function cleanupPinnedFolderIcons(root: Document | null): void {
  if (!root) {
    return;
  }

  for (const iconEl of findAllInRoot(root, `.${PINNED_FOLDER_ICON_CLASS}`)) {
    iconEl.remove();
  }

  for (const titleEl of findAllInRoot(root, `.${PINNED_FOLDER_CLASS}`)) {
    titleEl.classList.remove(PINNED_FOLDER_CLASS);
  }
}

function findFolderTitleElementByPath(path: string, root: Document | null): HTMLElement | null {
  if (!root || !path) {
    return null;
  }

  const escapedPath = cssEscape(path);
  const dataPathSelector = `[data-path="${escapedPath}"]`;
  const selector = [
    `.nav-folder-title${dataPathSelector}`,
    `.tree-item-self${dataPathSelector}`,
    `${dataPathSelector} > ${FOLDER_TITLE_SELECTOR}`,
    `${dataPathSelector} ${FOLDER_TITLE_SELECTOR}`
  ].join(", ");

  try {
    const element = root.querySelector<HTMLElement>(selector);
    if (isHTMLElementLike(element)) {
      return element;
    }
  } catch {
    return findFolderTitleElementByText(getPathBasename(path), root);
  }

  return findFolderTitleElementByText(getPathBasename(path), root);
}

function createPinnedIconElement(titleEl: HTMLElement): HTMLElement | null {
  const documentLike = titleEl.ownerDocument ?? getGlobalDocument();

  if (!documentLike) {
    return null;
  }

  const iconEl = documentLike.createElement("span");
  iconEl.classList.add(PINNED_FOLDER_ICON_CLASS);
  iconEl.setAttribute("aria-hidden", "true");
  return iconEl;
}

function getGlobalDocument(): Document | null {
  return typeof activeDocument === "undefined" ? null : activeDocument;
}

function getDocumentForItem(item: SortableTreeItem): Document | null {
  for (const key of FOLDER_TITLE_ELEMENT_KEYS) {
    const value = item[key];

    if (isHTMLElementLike(value)) {
      return value.ownerDocument ?? getGlobalDocument();
    }
  }

  return getGlobalDocument();
}

function getElementPath(element: HTMLElement): string {
  const ownPath = getElementAttribute(element, "data-path");

  if (ownPath) {
    return ownPath;
  }

  const closestWithPath = element.closest?.("[data-path]");
  return isHTMLElementLike(closestWithPath) ? getElementAttribute(closestWithPath, "data-path") : "";
}

function getElementAttribute(element: HTMLElement, attribute: string): string {
  const value = element.getAttribute?.(attribute);
  return typeof value === "string" ? value : "";
}

function findFolderTitleElementByText(title: string, root: Document): HTMLElement | null {
  if (!title) {
    return null;
  }

  for (const element of findAllInRoot(root, FOLDER_TITLE_SELECTOR)) {
    if (getFolderTitleText(element) === title) {
      return element;
    }
  }

  return null;
}

function getFolderTitleText(element: HTMLElement): string {
  const titleContent = element.querySelector?.(FOLDER_TITLE_TEXT_SELECTOR);
  const text = titleContent?.textContent ?? element.textContent ?? "";
  return text.trim();
}

function getPathBasename(path: string): string {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}

function scheduleAfterRender(callback: () => void): void {
  const activeWindowLike = getActiveWindow();
  const requestFrame = activeWindowLike?.requestAnimationFrame.bind(activeWindowLike);

  if (typeof requestFrame !== "function") {
    callback();
    return;
  }

  requestFrame(() => requestFrame(callback));
}

function cssEscape(value: string): string {
  const escape = getActiveWindow()?.CSS?.escape;

  if (escape) {
    return escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

function findAllInRoot(root: Document, selector: string): HTMLElement[] {
  return root.body?.findAll?.(selector) ?? [];
}

function getActiveWindow(): (Window & { CSS?: { escape?: (value: string) => string } }) | null {
  return typeof activeWindow === "undefined" ? null : activeWindow;
}

function getMenuTitleText(title: string | DocumentFragment): string | null {
  const text = typeof title === "string" ? title : title.textContent;
  const normalizedText = text?.trim();

  return normalizedText ? normalizedText : null;
}

function setMenuItemSection(item: MenuItemLike, section: string | null): void {
  if (section) {
    item.setSection?.(section);
  }
}

function isHTMLElementLike(value: unknown): value is HTMLElement {
  return (
    isRecord(value) &&
    typeof value.appendChild === "function" &&
    typeof value.classList === "object" &&
    typeof value.querySelector === "function"
  );
}
