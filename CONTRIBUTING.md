# Contributing

Thanks for helping improve Folder Sort.

## Local checks

Run these checks before opening a pull request or publishing a release:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

`main.js` is generated from `src/main.ts` and should not be committed.

## Release assets

Obsidian releases should include only:

- `main.js`
- `manifest.json`
- `styles.css`, if the plugin adds styles

Do not upload `versions.json` as a release asset.

## Local installation

Run `npm run install:vault -- /absolute/path/to/vault` with an existing vault.
The vault must contain `.obsidian`. The script uses the locked dependencies.
It copies the built plugin files and preserves `data.json` and notes.
Use a temporary vault to test changes.

Tests use simulated Obsidian menus, folders, and screen rows. They do not prove
that the current Obsidian interface or a mobile device works. Check those in
Obsidian before a release. The pin update test counts screen work on the same
200-row tree in two panes, with 10 pinned paths and 20 refreshes.
