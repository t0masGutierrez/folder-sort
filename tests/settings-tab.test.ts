import { describe, expect, it, vi } from "vitest";
import { FolderSortSettingTab } from "../src/settings-tab";

vi.mock("obsidian", () => {
  class PluginSettingTab {
    update = vi.fn();

    constructor(_app: unknown, _plugin: unknown) {}
  }

  class Setting {}

  return { PluginSettingTab, Setting };
});

interface SettingDefinition {
  name?: string;
  render?: (setting: unknown) => void;
  [key: string]: unknown;
}

interface RenderedButton {
  destructive: boolean;
  onClickCallback?: () => unknown;
  setButtonText: (text: string) => RenderedButton;
  setDestructive: () => RenderedButton;
  onClick: (callback: () => unknown) => RenderedButton;
}

function makePlugin(hiddenFolderPaths: string[]) {
  return {
    app: {},
    settings: {
      folderPlacement: "folders-first",
      hiddenFolderPaths
    },
    setFolderPlacement: vi.fn(() => Promise.resolve()),
    unhideFolder: vi.fn(() => Promise.resolve()),
    showHiddenFolders: vi.fn(() => Promise.resolve())
  };
}

function getDefinitions(tab: FolderSortSettingTab): SettingDefinition[] {
  return (
    tab as unknown as { getSettingDefinitions: () => SettingDefinition[] }
  ).getSettingDefinitions();
}

function renderButton(definition: SettingDefinition): RenderedButton {
  const button: RenderedButton = {
    destructive: false,
    setButtonText: () => button,
    setDestructive: () => {
      button.destructive = true;
      return button;
    },
    onClick: (callback) => {
      button.onClickCallback = callback;
      return button;
    }
  };
  const setting = {
    addButton: (callback: (button: RenderedButton) => unknown) => {
      callback(button);
      return setting;
    }
  };

  definition.render?.(setting);
  return button;
}

describe("hidden folder settings", () => {
  it("declares searchable placement and grouped hidden-folder settings", () => {
    const tab = new FolderSortSettingTab(makePlugin(["Archive", "Templates"]) as never);
    const definitions = getDefinitions(tab);

    expect(definitions[0]).toMatchObject({
      name: "Folder placement",
      control: {
        key: "folderPlacement",
        options: {
          "folders-first": "Folders first",
          "folders-last": "Folders last"
        },
        type: "dropdown"
      }
    });

    expect(definitions[1]).toMatchObject({
      cls: "folder-sort-hidden-folders",
      heading: "Hidden folders",
      type: "group"
    });
    expect(definitions[1]?.items).toEqual([
      expect.objectContaining({ name: "Archive" }),
      expect.objectContaining({ name: "Templates" }),
      expect.objectContaining({ name: "Unhide all folders" })
    ]);
  });

  it("uses destructive styling and refreshes after hidden-folder actions", async () => {
    const plugin = makePlugin(["Archive"]);
    const tab = new FolderSortSettingTab(plugin as never);
    const hiddenGroup = getDefinitions(tab)[1] as SettingDefinition;
    const items = hiddenGroup.items as SettingDefinition[];

    const unhideButton = renderButton(items[0] as SettingDefinition);
    await unhideButton.onClickCallback?.();
    expect(plugin.unhideFolder).toHaveBeenCalledWith("Archive");
    expect((tab as unknown as { update: ReturnType<typeof vi.fn> }).update).toHaveBeenCalledTimes(1);

    const clearButton = renderButton(items[1] as SettingDefinition);
    expect(clearButton.destructive).toBe(true);
    await clearButton.onClickCallback?.();
    expect(plugin.showHiddenFolders).toHaveBeenCalledTimes(1);
    expect((tab as unknown as { update: ReturnType<typeof vi.fn> }).update).toHaveBeenCalledTimes(2);
  });

  it("shows the empty state when no folders are hidden", () => {
    const tab = new FolderSortSettingTab(makePlugin([]) as never);
    const hiddenGroup = getDefinitions(tab)[1] as SettingDefinition;

    expect(hiddenGroup.items).toEqual([
      { name: "No folders are hidden.", searchable: false }
    ]);
  });

  it("does not keep the deprecated display fallback", () => {
    const tab = new FolderSortSettingTab(makePlugin([]) as never);

    expect("display" in tab).toBe(false);
  });
});
