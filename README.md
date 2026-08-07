# Folder Sort

Folder Sort is an Obsidian plugin that adds folder sorting to the native File explorer sort menu.

It adds two options directly under Obsidian's file-name sort options:

- Folder name (A to Z)
- Folder name (Z to A)

Folder Sort only reorders folders. Files use Obsidian's built-in file sorting behavior, and the existing folder/file placement is preserved.

## Features

- Sort folders A-Z or Z-A at every File explorer tree level.
- Keep Obsidian's file sorting untouched.
- Use natural, case-insensitive sorting, so `2 Folder` sorts before `10 Folder`.
- Persist the folder sort direction per vault.
- Configure Folder placement as `Existing order`, `Folders first`, or `Folders last`.
- Pin folders above other folders with a purple pin marker, or hide folders from the File explorer.
- Hide folders automatically with vault-relative ignore patterns.
- Use the existing File explorer sort menu and command palette commands for sorting.
- Load on desktop and mobile.

![Folder Sort options in the File explorer sort menu](assets/file-explorer-menu.png)

![Folder Sort commands in the command palette](assets/cmd-palette.png)

## Usage

Open the File explorer sort menu and choose either `Folder name (A to Z)` or `Folder name (Z to A)`.

You can also run these commands from the command palette:

- Folder Sort: A to Z
- Folder Sort: Z to A
- Folder Sort: Toggle

The default direction is A-Z.

Use Settings > Community plugins > Folder Sort to choose the Folder placement mode:

- `Existing order`: sort folders only within their existing folder positions.
- `Folders first`: move sorted folders above files.
- `Folders last`: move sorted folders below files.

Use Settings > Community plugins > Folder Sort > Ignore folder patterns to hide folders by path. Enter one pattern per line:

- `Templates` matches the root `Templates` folder.
- `**/Templates` matches a `Templates` folder at any depth.
- `Archive/**` matches `Archive` and all folders below it.
- `Projects/*/Drafts` matches one folder between `Projects` and `Drafts`.

Patterns use `*` within one path segment and `**` across path separators. They hide folders only; files keep Obsidian's normal behavior. An ignored folder stays hidden even if it is pinned.

Right-click a folder in the File explorer and use `Pin folder` or `Hide folder` below `Move folder to...`.
Pinned folders stay above other folders and show a purple pin marker on the right. Hidden folders can be restored with the `Folder Sort: Show hidden folders` command. Pinned and hidden folder choices follow folder renames and moves.
