import { PluginSettingTab, Setting } from "obsidian";
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
            button.setButtonText("Unhide all folders").setDestructive().onClick(() => {
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

}
