import { ButtonComponent, PluginSettingTab, Setting } from "obsidian";
import { isFolderPlacement } from "./settings";
import type FolderSortPlugin from "./main";
import type { FolderPlacement } from "./types";

const PLACEMENT_LABELS: Record<FolderPlacement, string> = {
  "folders-first": "Folders first",
  "folders-last": "Folders last"
};

export class FolderSortSettingTab extends PluginSettingTab {
  constructor(private readonly plugin: FolderSortPlugin) {
    super(plugin.app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Direction controls live in the File explorer menu and command palette.
    new Setting(containerEl)
      .setName("Folder placement")
      .setDesc("Choose where folders appear relative to files.")
      .addDropdown((dropdown) => {
        dropdown
          .addOptions(PLACEMENT_LABELS)
          .setValue(this.plugin.settings.folderPlacement)
          .onChange(async (value) => {
            if (!isFolderPlacement(value)) {
              return;
            }

            await this.plugin.setFolderPlacement(value);
          });
      });

    this.renderHiddenFolders(containerEl);
  }

  private renderHiddenFolders(containerEl: HTMLElement): void {
    const hiddenFolderPaths = this.plugin.settings.hiddenFolderPaths;
    const sectionEl = containerEl.createDiv({ cls: "folder-sort-hidden-folders" });
    const headerEl = sectionEl.createDiv({ cls: "folder-sort-hidden-folders-header" });

    headerEl.createDiv({
      cls: "folder-sort-hidden-folders-title",
      text: "Hidden folders"
    });
    headerEl.createDiv({
      cls: "folder-sort-hidden-folders-description",
      text: "Folders hidden from the File explorer."
    });

    const listEl = sectionEl.createDiv({ cls: "folder-sort-hidden-folders-list" });

    if (hiddenFolderPaths.length === 0) {
      listEl.createDiv({
        cls: "folder-sort-hidden-folders-empty",
        text: "No folders are hidden."
      });
      return;
    }

    for (const path of hiddenFolderPaths) {
      const rowEl = listEl.createDiv({ cls: "folder-sort-hidden-folder-row" });
      rowEl.createDiv({ cls: "folder-sort-hidden-folder-path", text: path });
      const actionEl = rowEl.createDiv({ cls: "folder-sort-hidden-folder-action" });

      new ButtonComponent(actionEl).setButtonText("Unhide").onClick(async () => {
        await this.plugin.unhideFolder(path);
        this.display();
      });
    }

    const footerEl = sectionEl.createDiv({ cls: "folder-sort-hidden-folders-footer" });
    const actionEl = footerEl.createDiv({ cls: "folder-sort-hidden-folders-action" });

    new ButtonComponent(actionEl)
      .setButtonText("Unhide all folders")
      .setWarning()
      .onClick(async () => {
        await this.plugin.showHiddenFolders();
        this.display();
      });
  }
}
