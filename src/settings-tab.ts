import { ButtonComponent, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinition, SettingDefinitionItem } from "obsidian";
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

  override getSettingDefinitions(): SettingDefinitionItem[] {
    const hiddenFolderPaths = this.plugin.settings.hiddenFolderPaths;
    const hiddenFolderItems: SettingDefinition[] = hiddenFolderPaths.length
      ? hiddenFolderPaths.map((path) => ({
          name: path,
          render: (setting: Setting) => {
            setting.addButton((button) => {
              button.setButtonText("Unhide").onClick(() => {
                void this.plugin.unhideFolder(path).then(() => this.update());
              });
            });
          }
        }))
      : [
          {
            name: "No folders are hidden.",
            searchable: false
          }
        ];

    if (hiddenFolderPaths.length > 0) {
      hiddenFolderItems.push({
        name: "Unhide all folders",
        render: (setting: Setting) => {
          setting.addButton((button) => {
            button.setButtonText("Unhide all folders").setWarning().onClick(() => {
              void this.plugin.showHiddenFolders().then(() => this.update());
            });
          });
        }
      });
    }

    return [
      {
        name: "Folder placement",
        desc: "Choose where folders appear relative to files.",
        control: {
          type: "dropdown",
          key: "folderPlacement",
          options: PLACEMENT_LABELS,
          defaultValue: "folders-first"
        }
      },
      {
        type: "group",
        heading: "Hidden folders",
        cls: "folder-sort-hidden-folders",
        items: hiddenFolderItems
      }
    ];
  }

  override getControlValue(key: string): unknown {
    return key === "folderPlacement" ? this.plugin.settings.folderPlacement : undefined;
  }

  override setControlValue(key: string, value: unknown): Promise<void> | void {
    if (key !== "folderPlacement" || !isFolderPlacement(value)) {
      return;
    }

    return this.plugin.setFolderPlacement(value);
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
