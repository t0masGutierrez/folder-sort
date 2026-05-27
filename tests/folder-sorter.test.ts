import { describe, expect, it } from "vitest";
import { sortFolderSiblings } from "../src/folder-sorter";
import type { SortableTreeItem } from "../src/types";

function folder(name: string): SortableTreeItem {
  return { file: { name, path: name, kind: "folder" } };
}

function file(name: string): SortableTreeItem {
  return { file: { name, path: name, kind: "file" } };
}

describe("sortFolderSiblings", () => {
  it("sorts only folders A-Z while preserving file positions", () => {
    const input = [
      folder("Zeta"),
      file("b-note.md"),
      folder("alpha"),
      folder("10 Projects"),
      file("a-note.md"),
      folder("2 Projects")
    ];

    expect(sortFolderSiblings(input, "asc")).toEqual([
      folder("2 Projects"),
      file("b-note.md"),
      folder("10 Projects"),
      folder("alpha"),
      file("a-note.md"),
      folder("Zeta")
    ]);
  });

  it("sorts only folders Z-A using natural case-insensitive comparison", () => {
    const input = [
      folder("alpha"),
      file("middle.md"),
      folder("10 Projects"),
      folder("Beta"),
      folder("2 Projects")
    ];

    expect(sortFolderSiblings(input, "desc")).toEqual([
      folder("Beta"),
      file("middle.md"),
      folder("alpha"),
      folder("10 Projects"),
      folder("2 Projects")
    ]);
  });

  it("returns a new array without mutating the original sibling list", () => {
    const input = [folder("b"), folder("a")];
    const sorted = sortFolderSiblings(input, "asc");

    expect(sorted).toEqual([folder("a"), folder("b")]);
    expect(input).toEqual([folder("b"), folder("a")]);
  });

  it("can place sorted folders before files", () => {
    const input = [
      file("b-note.md"),
      folder("Zeta"),
      file("a-note.md"),
      folder("alpha"),
      folder("2 Projects")
    ];

    expect(sortFolderSiblings(input, "asc", "folders-first")).toEqual([
      folder("2 Projects"),
      folder("alpha"),
      folder("Zeta"),
      file("b-note.md"),
      file("a-note.md")
    ]);
  });

  it("can place sorted folders after files", () => {
    const input = [
      folder("alpha"),
      file("b-note.md"),
      folder("Zeta"),
      file("a-note.md"),
      folder("2 Projects")
    ];

    expect(sortFolderSiblings(input, "desc", "folders-last")).toEqual([
      file("b-note.md"),
      file("a-note.md"),
      folder("Zeta"),
      folder("alpha"),
      folder("2 Projects")
    ]);
  });
});
