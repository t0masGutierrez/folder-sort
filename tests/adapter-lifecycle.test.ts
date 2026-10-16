import { afterEach, expect, it, vi } from 'vitest';
import { FileExplorerAdapter } from '../src/file-explorer-adapter';

function fixture() {
  const callbacks: FrameRequestCallback[] = [];
  vi.stubGlobal('activeWindow', { requestAnimationFrame: (cb: FrameRequestCallback) => callbacks.push(cb) });
  const findAll = vi.fn(() => []);
  vi.stubGlobal('activeDocument', { body: { findAll } });
  const original = () => [];
  const first = { getSortedFolderItems: original, requestSort: vi.fn() };
  const second = { getSortedFolderItems: original, requestSort: vi.fn() };
  let leaves = [{ view: first }, { view: second }];
  const adapter = new FileExplorerAdapter({
    app: { workspace: { getLeavesOfType: () => leaves } },
    getDirection: () => 'asc', onSelectDirection: vi.fn()
  });
  const flush = () => { while (callbacks.length) callbacks.shift()!(0); };
  return { adapter, first, second, original, findAll, flush, step: () => callbacks.shift()?.(0), closeFirst: () => { leaves = [{ view: second }]; } };
}

afterEach(() => vi.unstubAllGlobals());

it.each([false, true])('does not scan after detach; first frame ran: %s', firstFrameRan => {
  const f = fixture();
  f.adapter.attach();
  if (firstFrameRan) f.step();
  f.adapter.detach();
  f.findAll.mockClear();
  f.flush();
  expect(f.findAll).not.toHaveBeenCalled();
  expect(f.first.getSortedFolderItems).toBe(f.original);
  f.adapter.attach();
  expect(f.first.getSortedFolderItems).not.toBe(f.original);
  f.adapter.detach();
});

it('releases a closed pane and does not request more sorts from it', () => {
  const f = fixture();
  f.adapter.attach();
  f.closeFirst();
  f.adapter.attach();
  f.first.requestSort.mockClear();
  f.adapter.refresh();
  expect(f.first.getSortedFolderItems).toBe(f.original);
  expect(f.first.requestSort).not.toHaveBeenCalled();
  expect(f.second.getSortedFolderItems).not.toBe(f.original);
  f.adapter.detach();
});

it('uses one refresh for a native sort menu choice and restores the menu on stop', () => {
  class Item {
    title = '';
    click = () => {};
    setTitle(value: string | DocumentFragment) { this.title = String(value); return this; }
    onClick(callback: () => void) { this.click = callback; return this; }
    setChecked() { return this; }
  }
  class Menu {
    items: Item[] = [];
    addItem(callback: (item: Item) => unknown) { const item = new Item(); this.items.push(item); callback(item); return this; }
  }
  const originalMenu = Menu.prototype.addItem;
  const requestSort = vi.fn();
  let direction: 'asc' | 'desc' = 'asc';
  const adapter = new FileExplorerAdapter({
    app: { workspace: { getLeavesOfType: () => [{ view: { getSortedFolderItems: () => [], requestSort } }] } },
    getDirection: () => direction,
    onSelectDirection: value => { direction = value; adapter.refresh(); },
    menuConstructors: { Menu }
  });
  adapter.attach();
  requestSort.mockClear();
  const menu = new Menu();
  menu.addItem(item => item.setTitle('File name (A to Z)'));
  menu.addItem(item => item.setTitle('File name (Z to A)'));
  menu.items.find(item => item.title === 'Folder name (z to a)')!.click();
  expect(direction).toBe('desc');
  expect(requestSort).toHaveBeenCalledTimes(1);
  adapter.detach();
  expect(Menu.prototype.addItem).toBe(originalMenu);
});
