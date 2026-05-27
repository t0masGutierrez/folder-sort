import { PluginSettingTab, Setting } from "obsidian";
import { isFolderPlacement } from "./settings";
import type FolderSortPlugin from "./main";
import type { FolderPlacement } from "./types";

const PLACEMENT_LABELS: Record<FolderPlacement, string> = {
  keep: "Existing order",
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

  }
}
