import { Menu, Notice, Plugin } from "obsidian";
import { FileExplorerAdapter } from "./file-explorer-adapter";
import { FolderSortSettingTab } from "./settings-tab";
import { DEFAULT_SETTINGS, normalizeSettings } from "./settings";
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
      getPlacement: () => this.settings.folderPlacement,
      menuConstructors: {
        Menu
      },
      onSelectDirection: (direction) => this.setFolderSortDirection(direction)
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

  private addCommands(): void {
    // Obsidian prefixes these with the plugin name in the command palette.
    this.addCommand({
      id: "set-a-to-z",
      name: "A to Z",
      callback: () => {
        void this.setFolderSortDirection("asc");
      }
    });

    this.addCommand({
      id: "set-z-to-a",
      name: "Z to A",
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
