import { describe, expect, it, vi } from "vitest";
import { FileExplorerAdapter } from "../src/file-explorer-adapter";
import type { FolderPlacement, FolderSortDirection, SortableTreeItem } from "../src/types";

function folder(name: string): SortableTreeItem {
  return { file: { name, path: name, kind: "folder" } };
}

function file(name: string): SortableTreeItem {
  return { file: { name, path: name, kind: "file" } };
}

function makeApp(view: Record<string, unknown>) {
  return {
    workspace: {
      getLeavesOfType: vi.fn(() => [{ view }])
    }
  };
}

describe("FileExplorerAdapter", () => {
  it("reports unsupported when the File explorer view does not expose expected hooks", () => {
    const adapter = new FileExplorerAdapter({
      app: makeApp({}),
      getDirection: () => "asc",
      onSelectDirection: vi.fn()
    });

    expect(adapter.attach()).toEqual({
      attachedViews: 0,
      supported: false
    });
  });

  it("patches and restores getSortedFolderItems when supported", () => {
    const originalItems = [folder("z"), file("note.md"), folder("a")];
    const originalGetSortedFolderItems = vi.fn((_folder: unknown) => originalItems);
    const requestSort = vi.fn();
    const view = {
      getSortedFolderItems: originalGetSortedFolderItems,
      requestSort
    };
    const adapter = new FileExplorerAdapter({
      app: makeApp(view),
      getDirection: () => "asc",
      onSelectDirection: vi.fn()
    });

    expect(adapter.attach()).toEqual({
      attachedViews: 1,
      supported: true
    });
    expect(view.getSortedFolderItems({})).toEqual([
      folder("a"),
      file("note.md"),
      folder("z")
    ]);

    adapter.detach();

    expect(view.getSortedFolderItems).toBe(originalGetSortedFolderItems);
  });

  it("updates every attached view after direction changes", () => {
    let direction: FolderSortDirection = "asc";
    const requestSort = vi.fn();
    const view = {
      getSortedFolderItems: vi.fn((_folder: unknown) => [folder("a"), folder("b")]),
      requestSort
    };
    const adapter = new FileExplorerAdapter({
      app: makeApp(view),
      getDirection: () => direction,
      onSelectDirection: (nextDirection) => {
        direction = nextDirection;
      }
    });

    adapter.attach();
    adapter.setDirection("desc");

    expect(direction).toBe("desc");
    expect(requestSort).toHaveBeenCalled();
    expect(view.getSortedFolderItems({})).toEqual([folder("b"), folder("a")]);
  });

  it("uses the configured folder placement when sorting explorer items", () => {
    let placement: FolderPlacement = "folders-first";
    const view = {
      getSortedFolderItems: vi.fn((_folder: unknown) => [
        file("note.md"),
        folder("z"),
        folder("a")
      ]),
      requestSort: vi.fn()
    };
    const adapter = new FileExplorerAdapter({
      app: makeApp(view),
      getDirection: () => "asc",
      getPlacement: () => placement,
      onSelectDirection: vi.fn()
    });

    adapter.attach();
    expect(view.getSortedFolderItems({})).toEqual([
      folder("a"),
      folder("z"),
      file("note.md")
    ]);

    placement = "folders-last";
    expect(view.getSortedFolderItems({})).toEqual([
      file("note.md"),
      folder("a"),
      folder("z")
    ]);
  });

  it("injects folder sort choices after the native file-name sort choices", () => {
    class FakeMenuItem {
      checked: boolean | null = null;
      click: (() => void) | null = null;
      title = "";

      setTitle(title: string | DocumentFragment) {
        this.title = typeof title === "string" ? title : "";
        return this;
      }

      setChecked(checked: boolean | null) {
        this.checked = checked;
        return this;
      }

      onClick(callback: () => void) {
        this.click = callback;
        return this;
      }
    }

    class FakeMenu {
      items: FakeMenuItem[] = [];

      addItem(callback: (item: FakeMenuItem) => unknown) {
        const item = new FakeMenuItem();
        this.items.push(item);
        callback(item);
        return this;
      }
    }

    let direction: FolderSortDirection = "asc";
    const view = {
      getSortedFolderItems: vi.fn((_folder: unknown) => []),
      requestSort: vi.fn()
    };
    const adapter = new FileExplorerAdapter({
      app: makeApp(view),
      getDirection: () => direction,
      menuConstructors: {
        Menu: FakeMenu
      },
      onSelectDirection: (nextDirection) => {
        direction = nextDirection;
      }
    });

    adapter.attach();

    const menu = new FakeMenu();
    menu.addItem((item) => item.setTitle("File name (A to Z)"));
    menu.addItem((item) => item.setTitle("File name (Z to A)"));

    expect(menu.items.map((item) => item.title)).toEqual([
      "File name (A to Z)",
      "File name (Z to A)",
      "Folder name (A to Z)",
      "Folder name (Z to A)"
    ]);
    expect(menu.items[2]?.checked).toBe(true);
    expect(menu.items[3]?.checked).toBe(false);

    menu.items[3]?.click?.();

    expect(direction).toBe("desc");

    adapter.detach();
  });

  it("injects folder sort choices when native menu titles are document fragments", () => {
    class FakeMenuItem {
      title = "";

      setTitle(title: string | DocumentFragment) {
        this.title = typeof title === "string" ? title : title.textContent ?? "";
        return this;
      }

      setChecked(_checked: boolean | null) {
        return this;
      }

      onClick(_callback: () => void) {
        return this;
      }
    }

    class FakeMenu {
      items: FakeMenuItem[] = [];

      addItem(callback: (item: FakeMenuItem) => unknown) {
        const item = new FakeMenuItem();
        this.items.push(item);
        callback(item);
        return this;
      }
    }

    const view = {
      getSortedFolderItems: vi.fn((_folder: unknown) => []),
      requestSort: vi.fn()
    };
    const adapter = new FileExplorerAdapter({
      app: makeApp(view),
      getDirection: () => "asc",
      menuConstructors: {
        Menu: FakeMenu
      },
      onSelectDirection: vi.fn()
    });

    adapter.attach();

    const menu = new FakeMenu();
    menu.addItem((item) => item.setTitle({ textContent: "File name (A to Z)" } as DocumentFragment));
    menu.addItem((item) => item.setTitle({ textContent: "File name (Z to A)" } as DocumentFragment));

    expect(menu.items.map((item) => item.title)).toEqual([
      "File name (A to Z)",
      "File name (Z to A)",
      "Folder name (A to Z)",
      "Folder name (Z to A)"
    ]);

    adapter.detach();
  });
});
