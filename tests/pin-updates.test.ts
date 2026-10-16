import { afterEach, expect, it, vi } from 'vitest';
import { FileExplorerAdapter } from '../src/file-explorer-adapter';

// A fixed tree with two panes, 100 folders per pane, and 10 pinned paths.
// Count screen work instead of timing the test double.
function tree() {
  let creates = 0;
  let removes = 0;
  let scans = 0;
  let iconWrites = 0;
  class Row {
    children: Row[] = [];
    classes = new Set<string>(['nav-folder-title']);
    classList = {
      contains: (value: string) => this.classes.has(value),
      remove: (value: string) => this.classes.delete(value),
      toggle: (value: string, enabled: boolean) => enabled ? this.classes.add(value) : this.classes.delete(value)
    };
    constructor(readonly path: string, readonly parent?: Row) {}
    appendChild() {}
    querySelector() { return null; }
    getAttribute() { return this.path; }
    createSpan(options: { cls: string }) {
      creates++;
      const icon = new Row('', this);
      icon.classes = new Set([options.cls]);
      this.children.push(icon);
      return icon;
    }
    remove() {
      removes++;
      if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
    }
  }
  const rows = Array.from({ length: 200 }, (_, i) => new Row(`Folder${i % 100}`));
  const document = {
    body: { findAll: (selector: string) => {
      scans++;
      if (selector === '.folder-sort-pinned-icon') return rows.flatMap(row => row.children);
      if (selector === '.folder-sort-is-pinned') return rows.filter(row => row.classes.has('folder-sort-is-pinned'));
      return rows;
    } },
    querySelector: () => null
  };
  vi.stubGlobal('activeDocument', document);
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('activeWindow', { requestAnimationFrame: (cb: FrameRequestCallback) => frames.push(cb) });
  const flush = () => { while (frames.length) frames.shift()!(0); };
  const pins = new Set(Array.from({ length: 10 }, (_, i) => `Folder${i}`));
  const adapter = new FileExplorerAdapter({
    app: { workspace: { getLeavesOfType: () => [] } }, getDirection: () => 'asc',
    getPinnedFolderPaths: () => pins, onSelectDirection: () => {}, setIcon: () => { iconWrites++; }
  });
  return { adapter, rows, pins, flush, counts: () => ({ creates, removes, scans, iconWrites }) };
}
afterEach(() => vi.unstubAllGlobals());

it('keeps existing pin icons during repeated screen updates in both panes', () => {
  const f = tree();
  f.adapter.attach();
  f.flush();
  const original = f.rows[0].children[0];
  for (let i = 0; i < 20; i++) { f.adapter.refresh(); f.flush(); }
  console.log('fixed tree screen work:', f.counts());
  expect(f.rows[0].children[0]).toBe(original);
  expect(f.rows[100].children).toHaveLength(1);
  expect(f.counts().iconWrites).toBe(20);
  f.pins.clear();
  f.adapter.refresh();
  f.flush();
  expect(f.rows.every(row => row.children.length === 0)).toBe(true);
  f.adapter.detach();
});
