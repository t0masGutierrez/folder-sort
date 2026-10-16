import { expect, it } from 'vitest';
import { sortFolderSiblings } from '../src/folder-sorter';

it.each(['asc', 'desc'] as const)('sorts nested numbered names with files and folder actions: %s', direction => {
  for (const parent of ['', 'Parent/', 'Parent/Child/']) {
    const folder = (name: string) => ({ file: { name, path: parent + name, children: [] } });
    const files = ['z.md', 'a.md'].map(name => ({ file: { name, path: parent + name } }));
    const folders = ['item10', 'Item2', 'alpha', 'Pinned', 'Hidden'].map(folder);
    const items = [files[0], ...folders, files[1]];
    const before = [...items];
    for (const placement of ['folders-first', 'folders-last'] as const) {
      const result = sortFolderSiblings(items, direction, placement, {
        pinnedFolderPaths: new Set([parent + 'Pinned']), hiddenFolderPaths: new Set([parent + 'Hidden'])
      });
      const names = direction === 'asc' ? ['Pinned', 'alpha', 'Item2', 'item10'] : ['Pinned', 'item10', 'Item2', 'alpha'];
      expect(result.map(item => item.file.name)).toEqual(placement === 'folders-first' ? [...names, 'z.md', 'a.md'] : ['z.md', 'a.md', ...names]);
      expect(items).toEqual(before);
    }
  }
});
