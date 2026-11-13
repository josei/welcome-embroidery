# Top bar layout

The written spec for the editor's top bar (`src/components/Header.tsx`, with the menus in `src/components/MenuBar.tsx`). A change to the top bar is checked against this file, not against memory.

**Rule:** any change to the top bar updates this table and `test/top-bar.spec.js` in the same commit. A row that is added, removed, or changed in kind, label rule, or width must have the matching assertion in the spec, and the spec's `GROUP_OF` map and group order must match the table below.

## Group order and dividers

Left to right, the bar is one row of five groups:

1. **Brand**: the logo and the three menus (File, Edit, Arrange). The menus share the logo's line.
2. **Name**: the unsaved marker, the design name field, and the save status.
3. **File**: New, Open, Import JEF / VP3, Save.
4. **Edit**: Undo, Redo, Duplicate, Delete.
5. **Export**: Export, the blank-design reason (when shown), Keyboard shortcuts, Settings.

Divider rule: exactly one divider (`.sep`) sits between each pair of adjacent groups, four in all, and none at the ends. Dividers are not controls and have no group of their own.

Control rule: every control is 36 px tall and its centre is within 1 px of the menus' centre line.

## Items

"Icon-only" means the control shows no visible text. Every icon-only control has an `aria-label` (its accessible name) and a `title` (its tooltip). Where a shortcut exists, the tooltip adds it in brackets.

| Item | Group | Kind | Label rule | Width |
| --- | --- | --- | --- | --- |
| Logo (home link) | Brand | link (logo, not a control) | Accessible name "Welcome". Icon only. | 1280, 1440, 1920 px (the spec checks these) |
| File menu | Brand | menu | Visible text "File" (translated) | 1280, 1440, 1920 px |
| Edit menu | Brand | menu | Visible text "Edit" (translated) | 1280, 1440, 1920 px |
| Arrange menu | Brand | menu | Visible text "Arrange" (translated) | 1280, 1440, 1920 px |
| Design name | Name | field (`#name`) | Input with accessible name "Design name" (translated). Shows the document name; no visible label. | 1280, 1440, 1920 px |
| Unsaved marker | Name | status (`#unsavedMarker`) | Dot with accessible name and tooltip "Unsaved changes". Shown only while dirty. Not a control; the spec does not count it. | 1280, 1440, 1920 px when shown |
| Save status | Name | status (`#unsavedMark` or `#savedStatus`) | Visible text: the autosave or unsaved message, or "Saved HH:MM" (with the file name if known). Hidden until a save or change. | 1280, 1440, 1920 px when shown (the spec does not check its text) |
| New | File | icon button (`#new`) | Icon only. Name and tooltip "New design (shortcut)". | 1280, 1440, 1920 px |
| Open | File | icon button (`#open`) | Icon only. Name and tooltip "Open project or SVG (shortcut)". | 1280, 1440, 1920 px |
| Import JEF / VP3 | File | icon button (`#importMachine`) | Icon only. Name and tooltip "Import JEF / VP3…". | 1280, 1440, 1920 px |
| Save | File | icon button (`#save`) | Icon only. Name and tooltip "Save (shortcut)". | 1280, 1440, 1920 px |
| Undo | Edit | icon button (`#undo`, in `.edit-tools`) | Icon only. Name says the action, e.g. "Undo delete Rectangle", or "Nothing to undo" (disabled). Tooltip adds the shortcut. | 1280, 1440, 1920 px |
| Redo | Edit | icon button (`#redo`, in `.edit-tools`) | Icon only. Name says the action, or "Nothing to redo" (disabled). Tooltip adds the shortcut. | 1280, 1440, 1920 px |
| Duplicate | Edit | icon button (`#duplicate`, in `.edit-tools`) | Icon only. Name and tooltip "Duplicate (shortcut)". | 1280, 1440, 1920 px |
| Delete | Edit | icon button (`#remove`, in `.edit-tools`) | Icon only. Name and tooltip "Delete (shortcut)". | 1280, 1440, 1920 px |
| Export | Export | text button (`#export`) | Visible text "Export", never changes with the format. Tooltip "Export (shortcut)". Blank design: stays focusable with `aria-disabled`, and the reason shows beside it. | 1280, 1440, 1920 px |
| Export reason | Export | status (`#exportReason`) | Visible text, shown only while the design is blank. Not a control; the spec does not count it. | 1280, 1440, 1920 px when shown |
| Keyboard shortcuts | Export | icon button (`#helpBtn`) | Icon only. Name and tooltip "Keyboard shortcuts (?)". | 1280, 1440, 1920 px |
| Settings | Export | icon button (`#settingsBtn`) | Icon only. Name "Settings". Tooltip says "Settings", "Settings: waiting for agent", or "Settings: agent connected". | 1280, 1440, 1920 px |

Hidden helpers: the file inputs (`#file`, `#machineFile`) are hidden and belong to no group. The menu rows are hidden until a menu opens and are not checked.

## Widths

- The spec (`test/top-bar.spec.js`) checks every row above at 1280, 1440 and 1920 px, in English (`?lang=en`) and Spanish (`?lang=es`).
- Below 900 px (or on a short, touch-only screen), `src/styles.css` hides the dividers and the Keyboard shortcuts button and lets the bar wrap. The spec does not check those widths, so a change there is checked by hand against this table.
- Between 900 and 1000 px the CSS shrinks icon buttons to 32 px. The spec does not check that band either.

## Related

- `test/top-bar-1280.spec.js` covers the Spanish save status and the label fit at 1280 px.
- `test/label-fit.spec.js` and `test/target-size.spec.js` cover label fit and target sizes.
- `knowledge/glossary.md` holds the terms used in the labels.
