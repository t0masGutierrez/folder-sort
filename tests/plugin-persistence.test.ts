import { describe, expect, it, vi } from "vitest";

import { TFolder } from "obsidian";

const TFolderForTest = TFolder as unknown as new (path: string) => TFolder;

vi.mock("obsidian", () => {
  class Plugin {
    app: unknown;
    manifest: unknown;

    constructor(app: unknown, manifest: unknown) {
      this.app = app;
      this.manifest = manifest;
    }

    addCommand(_command: unknown) {
      return _command;
    }

    addSettingTab(_settingTab: unknown) {
      return undefined;
    }

    loadData(): Promise<unknown> {
      return Promise.resolve(null);
    }

    register(_callback: unknown) {
      return undefined;
    }

    registerEvent(_eventRef: unknown) {
      return undefined;
    }

    saveData(_data: unknown): Promise<void> {
      return Promise.resolve();
    }
  }

  class PluginSettingTab {
    containerEl = {
      empty: vi.fn()
    };

    constructor(_app: unknown, _plugin: unknown) {}
  }

  class Setting {
    constructor(_containerEl: unknown) {}

    addDropdown(_callback: unknown) {
      return this;
    }

    setDesc(_description: string) {
      return this;
    }

    setName(_name: string) {
      return this;
    }
  }

  class Menu {
    addItem(_callback: unknown) {
      return this;
    }
  }

  class Notice {
    constructor(_message: string, _timeout?: number) {}
  }

  class TFolder {
    constructor(
      readonly path = "",
      private readonly root = false
    ) {}

    isRoot() {
      return this.root;
    }
  }

  return {
    Menu,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TFolder,
    setIcon: vi.fn()
  };
});

describe("plugin persistence", () => {
  it("keeps saved folder actions on startup when vault paths are not available yet", async () => {
    const { default: FolderSortPlugin } = await import("../src/main");
    const savedData = {
      compatibilityNoticeShown: true,
      folderPlacement: "folders-first",
      folderSortDirection: "desc",
      hiddenFolderPaths: ["Templates"],
      ignoredFolderPatterns: ["Archive/**"],
      pinnedFolderPaths: ["4 Physics"]
    };
    const saveData = vi.fn(() => Promise.resolve());
    const app = {
      vault: {
        getAbstractFileByPath: vi.fn(() => null),
        on: vi.fn(() => ({}))
      },
      workspace: {
        getLeavesOfType: vi.fn(() => []),
        on: vi.fn(() => ({})),
        onLayoutReady: vi.fn()
      }
    };
    const plugin = new FolderSortPlugin(app as never, {
      id: "folder-sort",
      name: "Folder Sort",
      version: "0.1.6"
    } as never);

    plugin.loadData = vi.fn(() => Promise.resolve(savedData));
    plugin.saveData = saveData;

    await plugin.onload();

    expect(plugin.settings.hiddenFolderPaths).toEqual(["Templates"]);
    expect(plugin.settings.pinnedFolderPaths).toEqual(["4 Physics"]);
    expect("ignoredFolderPatterns" in plugin.settings).toBe(false);
    expect(saveData).not.toHaveBeenCalled();
  });

  it("supports individual unhide and clear-all without unnecessary saves", async () => {
    const { default: FolderSortPlugin } = await import("../src/main");
    const savedData = {
      hiddenFolderPaths: ["Archive", "Templates"],
      pinnedFolderPaths: []
    };
    const saveData = vi.fn(() => Promise.resolve());
    const app = {
      vault: {
        getAbstractFileByPath: vi.fn(() => null),
        on: vi.fn(() => ({}))
      },
      workspace: {
        getLeavesOfType: vi.fn(() => []),
        on: vi.fn(() => ({})),
        onLayoutReady: vi.fn()
      }
    };
    const plugin = new FolderSortPlugin(app as never, {
      id: "folder-sort",
      name: "Folder Sort",
      version: "0.1.6"
    } as never);

    plugin.loadData = vi.fn(() => Promise.resolve(savedData));
    plugin.saveData = saveData;

    await plugin.onload();
    const refresh = vi.fn();
    (plugin as unknown as { adapter: { refresh: () => void } }).adapter = { refresh };

    await plugin.unhideFolder("Archive");
    expect(plugin.settings.hiddenFolderPaths).toEqual(["Templates"]);
    expect(saveData).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    await plugin.unhideFolder("Missing");
    expect(saveData).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    await plugin.showHiddenFolders();
    expect(plugin.settings.hiddenFolderPaths).toEqual([]);
    expect(saveData).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);

    await plugin.showHiddenFolders();
    expect(saveData).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("updates pinned and hidden descendants when a folder is renamed", async () => {
    const { default: FolderSortPlugin } = await import("../src/main");
    const savedData = {
      compatibilityNoticeShown: true,
      folderPlacement: "folders-first",
      folderSortDirection: "desc",
      hiddenFolderPaths: ["Projects/Old Name", "Projects/Old Name/Private", "Projects-2025/Important"],
      pinnedFolderPaths: ["Projects/Old Name/Important", "Projects-2025/Important"]
    };
    const saveData = vi.fn(() => Promise.resolve());
    const callbacks = new Map<string, (...args: unknown[]) => unknown>();
    const app = {
      vault: {
        on: vi.fn((event: string, callback: (...args: unknown[]) => unknown) => {
          callbacks.set(event, callback);
          return {};
        })
      },
      workspace: {
        getLeavesOfType: vi.fn(() => []),
        on: vi.fn(() => ({})),
        onLayoutReady: vi.fn()
      }
    };
    const plugin = new FolderSortPlugin(app as never, {
      id: "folder-sort",
      name: "Folder Sort",
      version: "0.1.6"
    } as never);

    plugin.loadData = vi.fn(() => Promise.resolve(savedData));
    plugin.saveData = saveData;

    await plugin.onload();
    callbacks.get("rename")?.(new TFolderForTest("Projects/New Name"), "Projects/Old Name");
    await Promise.resolve();

    expect(plugin.settings.hiddenFolderPaths).toEqual(
      ["Projects-2025/Important", "Projects/New Name", "Projects/New Name/Private"].sort()
    );
    expect(plugin.settings.pinnedFolderPaths).toEqual(
      ["Projects-2025/Important", "Projects/New Name/Important"].sort()
    );
    expect(saveData).toHaveBeenCalledTimes(1);
  });

  it("does not save when a folder rename does not affect saved paths", async () => {
    const { default: FolderSortPlugin } = await import("../src/main");
    const savedData = {
      hiddenFolderPaths: ["Research"],
      pinnedFolderPaths: ["Projects-2025/Important"]
    };
    const saveData = vi.fn(() => Promise.resolve());
    const callbacks = new Map<string, (...args: unknown[]) => unknown>();
    const app = {
      vault: {
        on: vi.fn((event: string, callback: (...args: unknown[]) => unknown) => {
          callbacks.set(event, callback);
          return {};
        })
      },
      workspace: {
        getLeavesOfType: vi.fn(() => []),
        on: vi.fn(() => ({})),
        onLayoutReady: vi.fn()
      }
    };
    const plugin = new FolderSortPlugin(app as never, {
      id: "folder-sort",
      name: "Folder Sort",
      version: "0.1.6"
    } as never);

    plugin.loadData = vi.fn(() => Promise.resolve(savedData));
    plugin.saveData = saveData;

    await plugin.onload();
    callbacks.get("rename")?.(new TFolderForTest("Projects/New Name"), "Projects/Old Name");
    await Promise.resolve();

    expect(plugin.settings.hiddenFolderPaths).toEqual(["Research"]);
    expect(plugin.settings.pinnedFolderPaths).toEqual(["Projects-2025/Important"]);
    expect(saveData).not.toHaveBeenCalled();
  });
});

it('does not attach after stop when layout becomes ready late', async () => {
  const { default: FolderSortPlugin } = await import('../src/main');
  let ready = () => {};
  const getLeavesOfType = vi.fn(() => []);
  const plugin = new FolderSortPlugin({
    vault: { on: vi.fn() },
    workspace: { on: vi.fn(), getLeavesOfType, onLayoutReady: (callback: () => void) => { ready = callback; } }
  } as never, {} as never);
  await plugin.onload();
  plugin.onunload();
  ready();
  await Promise.resolve();
  expect(getLeavesOfType).not.toHaveBeenCalled();
});

it('saves folder moves and restores choices in a new plugin session', async () => {
  const { default: FolderSortPlugin } = await import('../src/main');
  const callbacks = new Map<string, (...args: unknown[]) => unknown>();
  const app = {
    vault: { on: (event: string, callback: (...args: unknown[]) => unknown) => { callbacks.set(event, callback); } },
    workspace: { on: vi.fn(), getLeavesOfType: () => [], onLayoutReady: vi.fn() }
  };
  let stored: unknown = { hiddenFolderPaths: ['Old/Private'], pinnedFolderPaths: ['Old/Pin', 'Oldish/Pin'] };
  const create = () => {
    const plugin = new FolderSortPlugin(app as never, {} as never);
    plugin.loadData = async () => structuredClone(stored);
    plugin.saveData = async data => { stored = structuredClone(data); };
    return plugin;
  };
  const first = create();
  await first.onload();
  callbacks.get('rename')!(new TFolderForTest('New/Old'), 'Old');
  await Promise.resolve();
  await first.setFolderPlacement('folders-last');
  await first.setFolderSortDirection('desc');
  first.onunload();
  const second = create();
  await second.onload();
  expect(second.settings).toMatchObject({ hiddenFolderPaths: ['New/Old/Private'], pinnedFolderPaths: ['New/Old/Pin', 'Oldish/Pin'], folderPlacement: 'folders-last', folderSortDirection: 'desc' });
  callbacks.get('delete')!(new TFolderForTest('New/Old'));
  await Promise.resolve();
  expect(second.settings.hiddenFolderPaths).toEqual([]);
  expect(second.settings.pinnedFolderPaths).toEqual(['Oldish/Pin']);
  second.onunload();
});

it('keeps command palette choices connected to saved settings', async () => {
  const { default: FolderSortPlugin } = await import('../src/main');
  const plugin = new FolderSortPlugin({
    vault: { on: vi.fn() },
    workspace: { on: vi.fn(), getLeavesOfType: () => [], onLayoutReady: vi.fn() }
  } as never, {} as never);
  const commands = new Map<string, () => unknown>();
  plugin.addCommand = command => { commands.set(command.id, command.callback!); return command; };
  plugin.loadData = async () => ({ hiddenFolderPaths: ['Private'] });
  const save = vi.spyOn(plugin, 'saveData');
  await plugin.onload();
  commands.get('set-z-to-a')!();
  await Promise.resolve();
  expect(plugin.settings.folderSortDirection).toBe('desc');
  commands.get('toggle-direction')!();
  await Promise.resolve();
  expect(plugin.settings.folderSortDirection).toBe('asc');
  commands.get('show-hidden-folders')!();
  await Promise.resolve();
  expect(plugin.settings.hiddenFolderPaths).toEqual([]);
  expect(save).toHaveBeenCalledTimes(3);
  plugin.onunload();
});
