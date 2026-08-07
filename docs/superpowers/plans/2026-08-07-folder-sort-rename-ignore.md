# Folder Rename Handling and Ignore Patterns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve folder actions across renames and add safe vault-relative ignore patterns without adding File explorer menu clutter.

**Architecture:** Keep path migration in the plugin's settings flow and keep pattern matching in the existing pure folder-sorting policy. The adapter passes current patterns into that policy, while the settings tab edits a normalized list. No new dependency or Obsidian menu patch is needed.

**Tech Stack:** TypeScript, Obsidian API 1.12.3 typings, Vitest, esbuild.

## Global Constraints

- Keep TypeScript strict mode and the existing `npm test`, `npm run typecheck`, and `npm run build` commands passing.
- Do not add a runtime dependency.
- Preserve the current global sort direction and folder-placement behavior.
- Keep manual hidden paths, pinned paths, and ignore patterns as separate settings.
- Do not rewrite user-authored ignore patterns during a folder rename.
- Keep the existing `.gitignore` policy for local verification tests; do not force-add `tests/`.
- Do not commit generated `main.js`.

---

### Task 1: Define ignore-pattern settings and pure matching behavior

**Files:**
- Modify: `src/types.ts`
- Modify: `src/settings.ts`
- Modify: `src/folder-sorter.ts`
- Test: `tests/settings.test.ts`
- Test: `tests/ignore-patterns.test.ts`

**Interfaces:**
- Consumes: Existing `FolderSortSettings`, `SortableTreeItem`, and `sortFolderSiblings` inputs.
- Produces: `ignoredFolderPatterns` settings, `normalizeIgnoredFolderPatterns`, and pattern-aware folder filtering in `sortFolderSiblings`.

- [x] **Step 1: Write failing normalization tests.**

Pass `ignoredFolderPatterns: ["  **/Templates ", "", "**/Templates", 42]` through `normalizeSettings` and expect `["**/Templates"]`. Also test that a missing field becomes an empty list.

- [x] **Step 2: Run the settings tests and verify failure.**

Run:

```bash
npm test -- tests/settings.test.ts
```

Expected: the new assertions fail because the settings type, default, and normalizer do not include `ignoredFolderPatterns`.

- [x] **Step 3: Write failing pattern tests.**

Create `tests/ignore-patterns.test.ts` covering exact paths, `*`, `**`, a pattern ending in `/**`, non-matching patterns, files remaining visible, and ignored pinned folders being removed.

- [x] **Step 4: Run the pattern tests and verify failure.**

Run:

```bash
npm test -- tests/ignore-patterns.test.ts
```

Expected: TypeScript or assertion failures because `FolderActionState` and `sortFolderSiblings` do not accept ignore patterns.

- [x] **Step 5: Implement the minimal settings and matcher.**

Add `ignoredFolderPatterns: string[]` to `FolderSortSettings`, add the optional read-only list to `FolderActionState`, add an empty default, and export `normalizeIgnoredFolderPatterns(value: unknown): string[]`. The normalizer must trim strings, remove blank values and duplicates, and sort the result.

Add a pure `isIgnoredFolderPath(path, patterns)` helper in `src/folder-sorter.ts`. Convert patterns to anchored safe matchers where `*` matches within one path segment and `**` matches across path separators. Treat a pattern ending in `/**` as matching its prefix folder as well as descendants. Invalid pattern construction must return no match. Use the helper in the existing hidden-folder filter.

- [x] **Step 6: Run focused tests and refactor only after green.**

Run:

```bash
npm test -- tests/settings.test.ts tests/ignore-patterns.test.ts
```

Expected: all focused tests pass. Remove duplication only if the tests remain green.

### Task 2: Preserve pinned and hidden paths across folder rename and move events

**Files:**
- Modify: `src/main.ts`
- Test: `tests/plugin-persistence.test.ts`

**Interfaces:**
- Consumes: Obsidian `vault` rename events with `(file: TAbstractFile, oldPath: string)`.
- Produces: Rename-aware updates to `hiddenFolderPaths` and `pinnedFolderPaths`.

- [x] **Step 1: Extend the plugin test harness.**

Make the fake `vault.on` store callbacks by event name while still returning an event reference. Keep the existing startup persistence test unchanged.

- [x] **Step 2: Write failing rename tests.**

Load saved paths, invoke the captured `rename` callback with a fake non-root `TFolder` whose new path is `Projects/New Name`, and assert that the exact old path and all descendants move to the new prefix. Add a boundary case proving `Projects-2025/Important` is unchanged and a no-op case proving `saveData` is not called when no saved path matches.

- [x] **Step 3: Run the persistence tests and verify failure.**

Run:

```bash
npm test -- tests/plugin-persistence.test.ts
```

Expected: the captured rename callback is missing or saved paths remain unchanged.

- [x] **Step 4: Implement boundary-safe path replacement.**

Register the vault `rename` event for non-root `TFolder` values. Implement `updateFolderActionPaths(oldPath, newPath)` with a helper that replaces only `path === oldPath` or `path.startsWith(`${oldPath}/`)`, preserves descendant suffixes, sorts and de-duplicates the result, and saves and refreshes only when either setting changes.

- [x] **Step 5: Run persistence and existing action tests.**

Run:

```bash
npm test -- tests/plugin-persistence.test.ts tests/folder-actions.test.ts
```

Expected: all startup, rename, boundary, delete, pin, hide, menu, and marker tests pass.

### Task 3: Wire ignore patterns into the adapter and settings UI

**Files:**
- Modify: `src/main.ts`
- Modify: `src/file-explorer-adapter.ts`
- Modify: `src/settings-tab.ts`
- Test: `tests/ignore-patterns.test.ts`

**Interfaces:**
- Consumes: `FolderSortSettings.ignoredFolderPatterns` and pattern filtering from Task 1.
- Produces: Live settings updates and refreshes for all attached File explorer views.

- [x] **Step 1: Write a failing adapter wiring test.**

Create an adapter with `getIgnoredFolderPatterns: () => ["Archive/**"]`, invoke the patched view's `getSortedFolderItems`, and assert that the matching folder is absent while a file remains. The test must fail until the adapter passes patterns to `sortFolderSiblings`.

- [x] **Step 2: Run the wiring test and verify failure.**

Run:

```bash
npm test -- tests/ignore-patterns.test.ts
```

Expected: the ignored folder is still present because the adapter does not pass patterns yet.

- [x] **Step 3: Add the adapter getter and plugin setter.**

Add `getIgnoredFolderPatterns?: () => readonly string[]` to the adapter options and include its current value in the `FolderActionState` passed to `sortFolderSiblings`. Pass the getter from `src/main.ts`.

Add `async setIgnoredFolderPatterns(patterns: readonly string[]): Promise<void>` to the plugin. Normalize the list, skip saving when unchanged, otherwise save once and refresh once.

- [x] **Step 4: Add the settings text area.**

Add an `Ignore folder patterns` setting with a description containing `**/Templates` and `Archive/**`. Use `addTextArea`, show one pattern per line, and listen to the element's `change` event so saving does not happen on every keystroke. Pass trimmed lines to `setIgnoredFolderPatterns`.

- [x] **Step 5: Run focused tests and typecheck.**

Run:

```bash
npm test -- tests/ignore-patterns.test.ts tests/plugin-persistence.test.ts
npm run typecheck
```

Expected: all focused tests and typecheck pass.

### Task 4: Document and verify the complete change

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-08-07-folder-sort-rename-ignore-design.md`
- Modify: `docs/superpowers/plans/2026-08-07-folder-sort-rename-ignore.md`

**Interfaces:**
- Consumes: The implemented settings names, pattern syntax, and rename behavior.
- Produces: User-facing documentation and a verified source tree.

- [x] **Step 1: Update the README.**

Document ignore patterns, wildcard examples, folder-only matching, and the fact that pins and manual hides follow folder renames and moves.

- [x] **Step 2: Run the complete test suite.**

Run:

```bash
npm test
```

Expected: every test file passes.

- [x] **Step 3: Run typecheck and production build.**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands pass. Confirm `main.js` remains ignored and no generated file is staged.

- [x] **Step 4: Review the final diff.**

Run:

```bash
git diff --check
git status --short
git diff -- src tests README.md
```

Confirm that the diff contains only rename handling, ignore patterns, tests, documentation, and the required design and plan files.

- [x] **Step 5: Commit the completed implementation.**

After all checks pass, create one lowercase commit:

```bash
git add src README.md docs/superpowers/specs/2026-08-07-folder-sort-rename-ignore-design.md docs/superpowers/plans/2026-08-07-folder-sort-rename-ignore.md
git commit -m "add folder rename handling and ignore patterns"
```
