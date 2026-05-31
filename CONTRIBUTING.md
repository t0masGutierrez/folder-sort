# Contributing

Thanks for helping improve Folder Sort.

## Local checks

Run these checks before opening a pull request or publishing a release:

```bash
npm ci
npm test
npm run build
```

`main.js` is generated from `src/main.ts` and should not be committed.

## Release assets

Obsidian releases should include only:

- `main.js`
- `manifest.json`
- `styles.css`, if the plugin adds styles

Do not upload `versions.json` as a release asset.
