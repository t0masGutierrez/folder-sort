# Folder Rename Handling and Ignore Patterns

## Goal

Keep pinned and hidden folder choices attached when a folder is renamed or moved, and let users hide folders with simple vault-relative path patterns.

This change does not add per-folder sort directions or any other File explorer menu options.

## Current behavior

- `FolderSortSettings` stores pinned and manually hidden folder paths.
- `FolderSortPlugin` removes saved paths when a folder is deleted, but it does not listen for vault rename events.
- `sortFolderSiblings` receives exact hidden paths and removes matching folder items.
- The settings tab has one folder-placement dropdown.

## Design decisions

### 1. Rename and move handling

Listen to Obsidian's `vault` `rename` event. When the renamed item is a non-root `TFolder`, use its new `file.path` and the event's `oldPath` to update both `hiddenFolderPaths` and `pinnedFolderPaths`.

Path replacement must match either the exact old path or a child path beginning with `${oldPath}/`. This prevents `Projects` from changing an unrelated path such as `Projects-2025`.

For example:

```text
old path: Projects/Old Name
new path: Projects/New Name

Projects/Old Name                 -> Projects/New Name
Projects/Old Name/Design          -> Projects/New Name/Design
Projects-2025/Old Name            -> unchanged
```

If no saved path changes, do not save or refresh. If paths change, normalize them, save once, and refresh once. Do not rewrite ignore-pattern text because it is user-authored and may express a broader rule than the renamed folder.

Keep the current startup behavior: do not remove saved paths only because the vault is not ready when settings load.

### 2. Ignore patterns

Add `ignoredFolderPatterns: string[]` to the saved settings. Patterns are entered one per line in a settings text area. Blank lines are removed, surrounding whitespace is trimmed, and duplicates are removed.

Patterns match vault-relative folder paths:

- `Templates` matches only the root folder named `Templates`.
- `**/Templates` matches a `Templates` folder at any depth.
- `Archive/**` matches `Archive` and every folder below it.
- `Projects/*/Drafts` matches one folder between `Projects` and `Drafts`.

The matcher supports two wildcards:

- `*` matches characters within one path segment.
- `**` matches across path separators.

Patterns are matched against folder paths only. Files remain under Obsidian's normal sorting and visibility behavior.

An ignored folder is removed before pin sorting. Therefore an ignore pattern wins over a pin, and a manual hide also remains hidden. Existing pin and hide actions remain separate from ignore-pattern settings.

The first version will not add a temporary reveal command. Users can remove or edit patterns in Settings, and the existing command continues to restore manually hidden folders only.

### 3. Settings and refresh flow

The settings tab will add an `Ignore folder patterns` text area with a short description and examples. Changes save when the text area emits its normal `change` event, not on every keystroke. A changed list refreshes all attached File explorer views.

The adapter will read the current pattern list through `getIgnoredFolderPatterns` and pass it to the existing folder-sorting policy. No additional menu item is needed.

## Data compatibility

Missing or invalid `ignoredFolderPatterns` values normalize to an empty list. Existing settings without this field continue to load unchanged. The plugin version and release files do not change in this feature pass.

## Testing

Add tests for:

- Pattern normalization and invalid saved data.
- Exact paths, single-segment `*`, multi-segment `**`, and prefix patterns ending in `/**`.
- Ignored folders being removed while files remain in their original order.
- Pinned ignored folders not appearing.
- Rename updates for exact paths and descendants.
- Rename boundary safety for similarly named paths.
- Rename events that do not affect saved state.
- Save and refresh occurring only when a rename changes saved paths.
- Existing delete cleanup, persistence, placement, menu actions, pin markers, and build checks remaining green.
