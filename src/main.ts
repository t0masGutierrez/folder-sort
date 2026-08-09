import { Menu, Notice, Plugin, setIcon, TFolder } from "obsidian";
import { FileExplorerAdapter } from "./file-explorer-adapter";
import { FolderSortSettingTab } from "./settings-tab";
import {
  DEFAULT_SETTINGS,
  normalizeSettings
} from "./settings";
import type {
  AttachResult,
  FolderPlacement,
  FolderSortDirection,
  FolderSortSettings
} from "./types";

const COMPATIBILITY_NOTICE =
  "Folder Sort could not attach to Obsidian's File explorer internals. Command and settings controls remain available, but the native sort menu may not include folder sort choices.";

export default class FolderSortPlugin extends Plugin {
  settings: FolderSortSettings = DEFAULT_SETTINGS;
  private adapter: FileExplorerAdapter | null = null;

  override async onload(): Promise<void> {
    await this.loadSettings();

    this.adapter = new FileExplorerAdapter({
      app: this.app,
      getDirection: () => this.settings.folderSortDirection,
      getHiddenFolderPaths: () => new Set(this.settings.hiddenFolderPaths),
      getPlacement: () => this.settings.folderPlacement,
      getPinnedFolderPaths: () => new Set(this.settings.pinnedFolderPaths),
      isFolderPinned: (path) => this.settings.pinnedFolderPaths.includes(path),
      menuConstructors: {
        Menu
      },
      onHideFolder: (path) => this.hideFolder(path),
      onSelectDirection: (direction) => this.setFolderSortDirection(direction),
      setIcon,
      onTogglePinned: (path) => this.togglePinnedFolder(path)
    });

    this.addCommands();
    this.addSettingTab(new FolderSortSettingTab(this));

    this.app.workspace.onLayoutReady(() => {
      void this.retryFileExplorerHook();
    });

    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        void this.retryFileExplorerHook({ silent: true });
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (file instanceof TFolder && !file.isRoot()) {
          this.adapter?.registerFolderContextMenu(menu, file);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFolder && !file.isRoot()) {
          void this.removeFolderActionPath(file.path);
        }
      })
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (file instanceof TFolder && !file.isRoot()) {
          void this.updateFolderActionPaths(oldPath, file.path);
        }
      })
    );

    this.register(() => this.adapter?.detach());
  }

  override onunload(): void {
    this.adapter?.detach();
  }

  async setFolderSortDirection(direction: FolderSortDirection): Promise<void> {
    if (this.settings.folderSortDirection !== direction) {
      this.settings.folderSortDirection = direction;
      await this.saveSettings();
    }

    this.adapter?.refresh();
  }

  async setFolderPlacement(placement: FolderPlacement): Promise<void> {
    if (this.settings.folderPlacement !== placement) {
      this.settings.folderPlacement = placement;
      await this.saveSettings();
    }

    this.adapter?.refresh();
  }

  async toggleFolderSortDirection(): Promise<void> {
    await this.setFolderSortDirection(this.settings.folderSortDirection === "asc" ? "desc" : "asc");
  }

  async togglePinnedFolder(path: string): Promise<void> {
    this.settings.pinnedFolderPaths = togglePath(this.settings.pinnedFolderPaths, path);
    await this.saveSettings();
    this.adapter?.refresh();
  }

  async hideFolder(path: string): Promise<void> {
    this.settings.hiddenFolderPaths = addPath(this.settings.hiddenFolderPaths, path);
    this.settings.pinnedFolderPaths = removePath(this.settings.pinnedFolderPaths, path);
    await this.saveSettings();
    this.adapter?.refresh();
  }

  async unhideFolder(path: string): Promise<void> {
    const hiddenFolderPaths = removePath(this.settings.hiddenFolderPaths, path);

    if (arraysEqual(hiddenFolderPaths, this.settings.hiddenFolderPaths)) {
      return;
    }

    this.settings.hiddenFolderPaths = hiddenFolderPaths;
    await this.saveSettings();
    this.adapter?.refresh();
  }

  async showHiddenFolders(): Promise<void> {
    if (this.settings.hiddenFolderPaths.length === 0) {
      return;
    }

    this.settings.hiddenFolderPaths = [];
    await this.saveSettings();
    this.adapter?.refresh();
  }

  async retryFileExplorerHook(options: { silent?: boolean } = {}): Promise<AttachResult> {
    const result = this.adapter?.attach() ?? {
      attachedViews: 0,
      supported: false
    };

    await this.handleAttachResult(result, options);
    return result;
  }

  private async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
  }

  private async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async removeFolderActionPath(path: string): Promise<void> {
    const hiddenFolderPaths = removePathAndDescendants(this.settings.hiddenFolderPaths, path);
    const pinnedFolderPaths = removePathAndDescendants(this.settings.pinnedFolderPaths, path);

    if (
      arraysEqual(hiddenFolderPaths, this.settings.hiddenFolderPaths) &&
      arraysEqual(pinnedFolderPaths, this.settings.pinnedFolderPaths)
    ) {
      return;
    }

    this.settings.hiddenFolderPaths = hiddenFolderPaths;
    this.settings.pinnedFolderPaths = pinnedFolderPaths;
    await this.saveSettings();
    this.adapter?.refresh();
  }

  private async updateFolderActionPaths(oldPath: string, newPath: string): Promise<void> {
    if (!oldPath || !newPath || oldPath === newPath) {
      return;
    }

    const hiddenFolderPaths = replacePathPrefix(
      this.settings.hiddenFolderPaths,
      oldPath,
      newPath
    );
    const pinnedFolderPaths = replacePathPrefix(
      this.settings.pinnedFolderPaths,
      oldPath,
      newPath
    );

    if (
      arraysEqual(hiddenFolderPaths, this.settings.hiddenFolderPaths) &&
      arraysEqual(pinnedFolderPaths, this.settings.pinnedFolderPaths)
    ) {
      return;
    }

    this.settings.hiddenFolderPaths = hiddenFolderPaths;
    this.settings.pinnedFolderPaths = pinnedFolderPaths;
    await this.saveSettings();
    this.adapter?.refresh();
  }

  private addCommands(): void {
    // Obsidian prefixes these with the plugin name in the command palette.
    this.addCommand({
      id: "set-a-to-z",
      name: "A to z",
      callback: () => {
        void this.setFolderSortDirection("asc");
      }
    });

    this.addCommand({
      id: "set-z-to-a",
      name: "Z to a",
      callback: () => {
        void this.setFolderSortDirection("desc");
      }
    });

    this.addCommand({
      id: "toggle-direction",
      name: "Toggle",
      callback: () => {
        void this.toggleFolderSortDirection();
      }
    });

    this.addCommand({
      id: "show-hidden-folders",
      name: "Show hidden folders",
      callback: () => {
        void this.showHiddenFolders();
      }
    });
  }

  private async handleAttachResult(
    result: AttachResult,
    options: { silent?: boolean }
  ): Promise<void> {
    if (result.supported || options.silent || this.settings.compatibilityNoticeShown) {
      return;
    }

    new Notice(COMPATIBILITY_NOTICE, 8000);
    this.settings.compatibilityNoticeShown = true;
    await this.saveSettings();
  }
}

function addPath(paths: readonly string[], path: string): string[] {
  return [...new Set([...paths, path])].sort();
}

function removePath(paths: readonly string[], path: string): string[] {
  return paths.filter((existingPath) => existingPath !== path);
}

function removePathAndDescendants(paths: readonly string[], path: string): string[] {
  const childPathPrefix = `${path}/`;
  return paths.filter(
    (existingPath) => existingPath !== path && !existingPath.startsWith(childPathPrefix)
  );
}

function replacePathPrefix(
  paths: readonly string[],
  oldPath: string,
  newPath: string
): string[] {
  const oldPathPrefix = `${oldPath}/`;

  return [
    ...new Set(
      paths.map((path) => {
        if (path === oldPath) {
          return newPath;
        }

        if (path.startsWith(oldPathPrefix)) {
          return `${newPath}/${path.slice(oldPathPrefix.length)}`;
        }

        return path;
      })
    )
  ].sort();
}

function togglePath(paths: readonly string[], path: string): string[] {
  return paths.includes(path) ? removePath(paths, path) : addPath(paths, path);
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
