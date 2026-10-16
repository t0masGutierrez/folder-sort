import { afterEach, describe, expect, it, vi } from "vitest";
import { FileExplorerAdapter } from "../src/file-explorer-adapter";
import { sortFolderSiblings } from "../src/folder-sorter";
import type { SortableTreeItem } from "../src/types";

function folder(name: string, path = name): SortableTreeItem {
  return { file: { name, path, kind: "folder" } };
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("folder pinning and hiding", () => {
  it("hides folders and sorts pinned folders before unpinned folders", () => {
    const items = [file("note.md"), folder("zeta"), folder("alpha"), folder("pinned")];

    expect(
      sortFolderSiblings(items, "asc", "folders-first", {
        hiddenFolderPaths: new Set(["alpha"]),
        pinnedFolderPaths: new Set(["pinned"])
      })
    ).toEqual([folder("pinned"), folder("zeta"), file("note.md")]);
  });

  it("injects pin and hide actions after Move folder to in folder context menus", () => {
    class FakeMenuItem {
      click: (() => unknown) | null = null;
      section = "";
      title = "";

      setTitle(title: string | DocumentFragment) {
        this.title = typeof title === "string" ? title : title.textContent ?? "";
        return this;
      }

      setSection(section: string) {
        this.section = section;
        return this;
      }

      onClick(callback: () => unknown) {
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

    const toggleResult = Promise.resolve();
    const hideResult = Promise.resolve();
    const togglePinned = vi.fn(() => toggleResult);
    const hideFolder = vi.fn(() => hideResult);
    const adapter = new FileExplorerAdapter({
      app: makeApp({
        getSortedFolderItems: vi.fn((_folder: unknown) => []),
        requestSort: vi.fn()
      }),
      getDirection: () => "asc",
      getHiddenFolderPaths: () => new Set(),
      getPinnedFolderPaths: () => new Set(),
      isFolderPinned: () => false,
      menuConstructors: {
        Menu: FakeMenu
      },
      onHideFolder: hideFolder,
      onSelectDirection: vi.fn(),
      onTogglePinned: togglePinned
    });

    adapter.attach();

    const menu = new FakeMenu();
    adapter.registerFolderContextMenu(menu, {
      children: [],
      kind: "folder",
      name: "Linear Algebra",
      path: "7 Linear Algebra"
    });

    menu.addItem((item) => item.setTitle("Duplicate"));
    menu.addItem((item) => item.setTitle("Move folder to..."));
    menu.addItem((item) => item.setTitle("Search in folder"));

    expect(menu.items.map((item) => item.title)).toEqual([
      "Duplicate",
      "Move folder to...",
      "Pin folder",
      "Hide folder",
      "Search in folder"
    ]);

    expect(menu.items[2]?.click?.()).toBe(toggleResult);
    expect(menu.items[3]?.click?.()).toBe(hideResult);

    expect(togglePinned).toHaveBeenCalledWith("7 Linear Algebra");
    expect(hideFolder).toHaveBeenCalledWith("7 Linear Algebra");
    expect(menu.items[2]?.section).toBe("action");
    expect(menu.items[3]?.section).toBe("action");

    adapter.detach();
  });

  it("injects folder actions when menu context is registered after Move folder to is seen", () => {
    class FakeMenuItem {
      title = "";

      setTitle(title: string | DocumentFragment) {
        this.title = typeof title === "string" ? title : title.textContent ?? "";
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

    const adapter = new FileExplorerAdapter({
      app: makeApp({
        getSortedFolderItems: vi.fn((_folder: unknown) => []),
        requestSort: vi.fn()
      }),
      getDirection: () => "asc",
      getHiddenFolderPaths: () => new Set(),
      getPinnedFolderPaths: () => new Set(),
      isFolderPinned: () => true,
      menuConstructors: {
        Menu: FakeMenu
      },
      onHideFolder: vi.fn(),
      onSelectDirection: vi.fn(),
      onTogglePinned: vi.fn()
    });

    adapter.attach();

    const menu = new FakeMenu();
    menu.addItem((item) => item.setTitle("Move folder to..."));
    adapter.registerFolderContextMenu(menu, {
      children: [],
      kind: "folder",
      name: "Linear Algebra",
      path: "7 Linear Algebra"
    });

    expect(menu.items.map((item) => item.title)).toEqual([
      "Move folder to...",
      "Unpin folder",
      "Hide folder"
    ]);

    adapter.detach();
  });

  it("renders a pinned marker when only a mobile data-path title row is available", () => {
    class FakeClassList {
      private readonly classes = new Set<string>();

      constructor(classes: string[] = []) {
        for (const className of classes) {
          this.classes.add(className);
        }
      }

      add(className: string) {
        this.classes.add(className);
      }

      contains(className: string) {
        return this.classes.has(className);
      }

      toggle(className: string, force?: boolean) {
        const enabled = force ?? !this.classes.has(className);

        if (enabled) {
          this.classes.add(className);
        } else {
          this.classes.delete(className);
        }

        return enabled;
      }
    }

    class FakeElement {
      readonly children: FakeElement[] = [];
      readonly classList: FakeClassList;
      parentElement: FakeElement | null = null;

      constructor(
        readonly ownerDocument: Document,
        classes: string[] = []
      ) {
        this.classList = new FakeClassList(classes);
      }

      appendChild(child: FakeElement) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      }

      createEl(_tagName: string, _options: { cls?: string } = {}) {
        throw new Error("Pinned icons must use Obsidian's createSpan helper");
      }

      createSpan(options: { cls?: string } = {}) {
        const child = new FakeElement(this.ownerDocument);

        if (options.cls) {
          child.classList.add(options.cls);
        }

        this.appendChild(child);
        return child;
      }

      querySelector(_selector: string) {
        return null;
      }

      remove() {
        if (!this.parentElement) {
          return;
        }

        const index = this.parentElement.children.indexOf(this);

        if (index >= 0) {
          this.parentElement.children.splice(index, 1);
        }
      }

      setAttribute(_name: string, _value: string) {
        return undefined;
      }
    }

    class FakeDocument {
      readonly titleEl = new FakeElement(this as unknown as Document, ["nav-folder-title"]);

      readonly querySelector = vi.fn((selector: string) => {
        return selector.includes('[data-path="Projects/Pinned"]')
          ? (this.titleEl as unknown as HTMLElement)
          : null;
      });

      createElement(_tagName: string) {
        throw new Error("Pinned icons must use Obsidian's createEl helper");
      }
    }

    const documentLike = new FakeDocument();
    vi.stubGlobal("document", documentLike);
    vi.stubGlobal("activeDocument", documentLike);

    const setIcon = vi.fn();
    const items = [folder("Pinned", "Projects/Pinned")];
    const view = {
      getSortedFolderItems: vi.fn(() => items),
      requestSort: vi.fn()
    };
    const adapter = new FileExplorerAdapter({
      app: makeApp(view),
      getDirection: () => "asc",
      getHiddenFolderPaths: () => new Set(),
      getPinnedFolderPaths: () => new Set(["Projects/Pinned"]),
      onSelectDirection: vi.fn(),
      setIcon
    });

    adapter.attach();
    view.getSortedFolderItems();

    expect(documentLike.querySelector).toHaveBeenCalledWith(
      expect.stringContaining('[data-path="Projects/Pinned"]')
    );
    expect(documentLike.titleEl.classList.contains("folder-sort-is-pinned")).toBe(true);
    expect(documentLike.titleEl.children).toHaveLength(1);
    expect(setIcon).toHaveBeenCalledWith(documentLike.titleEl.children[0], "pin");

    adapter.detach();
  });

  it("clears stale pin markers from rows without an exact folder path", () => {
    class FakeClassList {
      private readonly classes = new Set<string>();

      constructor(classes: string[] = []) {
        for (const className of classes) {
          this.classes.add(className);
        }
      }

      add(className: string) {
        this.classes.add(className);
      }

      contains(className: string) {
        return this.classes.has(className);
      }

      remove(className: string) {
        this.classes.delete(className);
      }

      toggle(className: string, force?: boolean) {
        const enabled = force ?? !this.classes.has(className);

        if (enabled) {
          this.classes.add(className);
        } else {
          this.classes.delete(className);
        }

        return enabled;
      }
    }

    class FakeElement {
      readonly children: FakeElement[] = [];
      readonly classList: FakeClassList;
      parentElement: FakeElement | null = null;

      constructor(classes: string[] = []) {
        this.classList = new FakeClassList(classes);
      }

      appendChild(child: FakeElement) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      }

      closest(_selector: string) {
        return null;
      }

      getAttribute(_name: string) {
        return "";
      }

      querySelector(_selector: string) {
        return null;
      }

      remove() {
        if (!this.parentElement) {
          return;
        }

        const index = this.parentElement.children.indexOf(this);

        if (index >= 0) {
          this.parentElement.children.splice(index, 1);
        }
      }

      setAttribute(_name: string, _value: string) {
        return undefined;
      }
    }

    class FakeDocument {
      readonly physicsTitle = new FakeElement(["nav-folder-title", "folder-sort-is-pinned"]);
      readonly researchTitle = new FakeElement(["nav-folder-title"]);

      readonly body = {
        findAll: vi.fn((selector: string) => {
          if (selector === ".folder-sort-pinned-icon") {
            return this.physicsTitle.children as unknown as HTMLElement[];
          }

          if (selector === ".folder-sort-is-pinned") {
            return [this.physicsTitle] as unknown as HTMLElement[];
          }

          if (selector === ".nav-folder-title, .tree-item-self") {
            return [this.physicsTitle, this.researchTitle] as unknown as HTMLElement[];
          }

          return [];
        })
      };

      createElement(_tagName: string) {
        return new FakeElement() as unknown as HTMLElement;
      }
    }

    const documentLike = new FakeDocument();
    const staleIcon = new FakeElement(["folder-sort-pinned-icon"]);
    documentLike.physicsTitle.appendChild(staleIcon);
    vi.stubGlobal("document", documentLike);
    vi.stubGlobal("activeDocument", documentLike);

    const adapter = new FileExplorerAdapter({
      app: makeApp({
        getSortedFolderItems: vi.fn((_folder: unknown) => []),
        requestSort: vi.fn()
      }),
      getDirection: () => "asc",
      getHiddenFolderPaths: () => new Set(),
      getPinnedFolderPaths: () => new Set(["Research"]),
      onSelectDirection: vi.fn(),
      setIcon: vi.fn()
    });

    adapter.attach();

    expect(documentLike.physicsTitle.classList.contains("folder-sort-is-pinned")).toBe(false);
    expect(documentLike.physicsTitle.children).toHaveLength(0);
    expect(documentLike.researchTitle.children).toHaveLength(0);

    adapter.detach();
  });

  it("clears a stale pin marker after the pinned folder is deleted", () => {
    class FakeClassList {
      private readonly classes = new Set<string>();

      constructor(classes: string[] = []) {
        for (const className of classes) {
          this.classes.add(className);
        }
      }

      add(className: string) {
        this.classes.add(className);
      }

      contains(className: string) {
        return this.classes.has(className);
      }

      remove(className: string) {
        this.classes.delete(className);
      }

      toggle(className: string, force?: boolean) {
        const enabled = force ?? !this.classes.has(className);

        if (enabled) {
          this.classes.add(className);
        } else {
          this.classes.delete(className);
        }

        return enabled;
      }
    }

    class FakeElement {
      readonly children: FakeElement[] = [];
      readonly classList: FakeClassList;
      parentElement: FakeElement | null = null;

      constructor(classes: string[] = []) {
        this.classList = new FakeClassList(classes);
      }

      appendChild(child: FakeElement) {
        child.parentElement = this;
        this.children.push(child);
        return child;
      }

      closest(_selector: string) {
        return null;
      }

      getAttribute(_name: string) {
        return "";
      }

      querySelector(_selector: string) {
        return null;
      }

      remove() {
        if (!this.parentElement) {
          return;
        }

        const index = this.parentElement.children.indexOf(this);

        if (index >= 0) {
          this.parentElement.children.splice(index, 1);
        }
      }

      setAttribute(_name: string, _value: string) {
        return undefined;
      }
    }

    class FakeDocument {
      readonly belowDeletedTitle = new FakeElement(["nav-folder-title"]);

      readonly body = {
        findAll: vi.fn((selector: string) => {
          if (selector === ".folder-sort-pinned-icon") {
            return this.belowDeletedTitle.children as unknown as HTMLElement[];
          }

          if (selector === ".folder-sort-is-pinned") {
            return this.belowDeletedTitle.classList.contains("folder-sort-is-pinned")
              ? ([this.belowDeletedTitle] as unknown as HTMLElement[])
              : [];
          }

          return [];
        })
      };

      readonly querySelector = vi.fn(() => null);

      createElement(_tagName: string) {
        return new FakeElement() as unknown as HTMLElement;
      }
    }

    const documentLike = new FakeDocument();
    vi.stubGlobal("document", documentLike);
    vi.stubGlobal("activeDocument", documentLike);

    const view = {
      getSortedFolderItems: vi.fn((_folder: unknown) => [folder("4 Physics")]),
      requestSort: vi.fn()
    };
    const adapter = new FileExplorerAdapter({
      app: makeApp(view),
      getDirection: () => "asc",
      getHiddenFolderPaths: () => new Set(),
      getPinnedFolderPaths: () => new Set(["Deleted pinned folder"]),
      onSelectDirection: vi.fn(),
      setIcon: vi.fn()
    });

    adapter.attach();

    const staleIcon = new FakeElement(["folder-sort-pinned-icon"]);
    documentLike.belowDeletedTitle.classList.add("folder-sort-is-pinned");
    documentLike.belowDeletedTitle.appendChild(staleIcon);

    view.getSortedFolderItems(null);

    expect(documentLike.belowDeletedTitle.classList.contains("folder-sort-is-pinned")).toBe(false);
    expect(documentLike.belowDeletedTitle.children).toHaveLength(0);

    adapter.detach();
  });

  it("keeps folder actions directly below Move folder to when later native menu items already exist", () => {
    class FakeMenuParent {
      constructor(private readonly menu: FakeMenu) {}

      insertBefore(element: FakeMenuElement, reference: FakeMenuElement | null) {
        const currentIndex = this.menu.elements.indexOf(element);

        if (currentIndex >= 0) {
          this.menu.elements.splice(currentIndex, 1);
        }

        const referenceIndex = reference ? this.menu.elements.indexOf(reference) : -1;
        const nextIndex = referenceIndex >= 0 ? referenceIndex : this.menu.elements.length;
        this.menu.elements.splice(nextIndex, 0, element);
        this.menu.items = this.menu.elements.map((child) => child.item);
      }
    }

    class FakeMenuElement {
      classList = {
        contains: () => false
      };
      parentElement: FakeMenuParent;

      constructor(
        readonly item: FakeMenuItem,
        private readonly menu: FakeMenu
      ) {
        this.parentElement = menu.parent;
      }

      appendChild(_child: unknown) {
        return null;
      }

      querySelector(_selector: string) {
        return null;
      }

      get nextSibling(): FakeMenuElement | null {
        const index = this.menu.elements.indexOf(this);
        return index >= 0 ? this.menu.elements[index + 1] ?? null : null;
      }

      get previousSibling(): FakeMenuElement | null {
        const index = this.menu.elements.indexOf(this);
        return index > 0 ? this.menu.elements[index - 1] ?? null : null;
      }
    }

    class FakeMenuItem {
      dom: FakeMenuElement;
      title = "";

      constructor(menu: FakeMenu) {
        this.dom = new FakeMenuElement(this, menu);
      }

      setIcon(_icon: string | null) {
        return this;
      }

      setTitle(title: string | DocumentFragment) {
        this.title = typeof title === "string" ? title : title.textContent ?? "";
        return this;
      }

      onClick(_callback: () => void) {
        return this;
      }
    }

    class FakeMenu {
      elements: FakeMenuElement[] = [];
      items: FakeMenuItem[] = [];
      parent = new FakeMenuParent(this);

      addItem(callback: (item: FakeMenuItem) => unknown) {
        const item = new FakeMenuItem(this);
        this.elements.push(item.dom);
        this.items = this.elements.map((element) => element.item);
        callback(item);
        return this;
      }
    }

    const adapter = new FileExplorerAdapter({
      app: makeApp({
        getSortedFolderItems: vi.fn((_folder: unknown) => []),
        requestSort: vi.fn()
      }),
      getDirection: () => "asc",
      getHiddenFolderPaths: () => new Set(),
      getPinnedFolderPaths: () => new Set(),
      isFolderPinned: () => false,
      menuConstructors: {
        Menu: FakeMenu
      },
      onHideFolder: vi.fn(),
      onSelectDirection: vi.fn(),
      onTogglePinned: vi.fn()
    });

    adapter.attach();

    const menu = new FakeMenu();
    menu.addItem((item) => item.setTitle("Move folder to..."));
    menu.addItem((item) => item.setTitle("Search in folder"));
    adapter.registerFolderContextMenu(menu, {
      children: [],
      kind: "folder",
      name: "Linear Algebra",
      path: "7 Linear Algebra"
    });

    expect(menu.items.map((item) => item.title)).toEqual([
      "Move folder to...",
      "Pin folder",
      "Hide folder",
      "Search in folder"
    ]);

    adapter.detach();
  });

  it("inserts folder actions before Search in folder even when item elements are created late", () => {
    class FakeMenuParent {
      constructor(private readonly menu: FakeMenu) {}

      insertBefore(element: FakeMenuElement, reference: FakeMenuElement | null) {
        const currentIndex = this.menu.elements.indexOf(element);

        if (currentIndex >= 0) {
          this.menu.elements.splice(currentIndex, 1);
        }

        const referenceIndex = reference ? this.menu.elements.indexOf(reference) : -1;
        const nextIndex = referenceIndex >= 0 ? referenceIndex : this.menu.elements.length;
        this.menu.elements.splice(nextIndex, 0, element);
        this.menu.items = this.menu.elements.map((child) => child.item);
      }
    }

    class FakeMenuElement {
      classList = {
        contains: () => false
      };
      parentElement: FakeMenuParent;

      constructor(
        readonly item: FakeMenuItem,
        private readonly menu: FakeMenu
      ) {
        this.parentElement = menu.parent;
      }

      appendChild(_child: unknown) {
        return null;
      }

      querySelector(_selector: string) {
        return null;
      }

      get nextSibling(): FakeMenuElement | null {
        const index = this.menu.elements.indexOf(this);
        return index >= 0 ? this.menu.elements[index + 1] ?? null : null;
      }

      get previousSibling(): FakeMenuElement | null {
        const index = this.menu.elements.indexOf(this);
        return index > 0 ? this.menu.elements[index - 1] ?? null : null;
      }
    }

    class FakeMenuItem {
      dom: FakeMenuElement | null = null;
      title = "";

      setIcon(_icon: string | null) {
        return this;
      }

      setTitle(title: string | DocumentFragment) {
        this.title = typeof title === "string" ? title : title.textContent ?? "";
        return this;
      }

      onClick(_callback: () => void) {
        return this;
      }
    }

    class FakeMenu {
      elements: FakeMenuElement[] = [];
      items: FakeMenuItem[] = [];
      parent = new FakeMenuParent(this);

      addItem(callback: (item: FakeMenuItem) => unknown) {
        const item = new FakeMenuItem();
        this.items.push(item);
        callback(item);
        return this;
      }

      showAtPosition(_position: unknown) {
        this.elements = this.items.map((item) => {
          const element = new FakeMenuElement(item, this);
          item.dom = element;
          return element;
        });
        return this;
      }
    }

    const adapter = new FileExplorerAdapter({
      app: makeApp({
        getSortedFolderItems: vi.fn((_folder: unknown) => []),
        requestSort: vi.fn()
      }),
      getDirection: () => "asc",
      getHiddenFolderPaths: () => new Set(),
      getPinnedFolderPaths: () => new Set(),
      isFolderPinned: () => false,
      menuConstructors: {
        Menu: FakeMenu
      },
      onHideFolder: vi.fn(),
      onSelectDirection: vi.fn(),
      onTogglePinned: vi.fn()
    });

    adapter.attach();

    const menu = new FakeMenu();
    menu.addItem((item) => item.setTitle("Move folder to..."));
    menu.addItem((item) => item.setTitle("Search in folder"));
    adapter.registerFolderContextMenu(menu, {
      children: [],
      kind: "folder",
      name: "Linear Algebra",
      path: "7 Linear Algebra"
    });

    expect(menu.items.map((item) => item.title)).toEqual([
      "Move folder to...",
      "Pin folder",
      "Hide folder",
      "Search in folder"
    ]);

    menu.showAtPosition({ x: 0, y: 0 });

    expect(menu.items.map((item) => item.title)).toEqual([
      "Move folder to...",
      "Pin folder",
      "Hide folder",
      "Search in folder"
    ]);

    adapter.detach();
  });
});
