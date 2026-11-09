# Glossary: terms and spelling

One term per concept, one spelling, in both languages. Strings live in the string table in `src/i18n.js` (Spanish is the value, English the key) and in the UI sources under `src/`. A term that changes here must change in every place it appears: the UI, the tests, and the string table.

## Spelling rule

- English uses **US spelling** everywhere: color, center, license, beveled, gray, millimeter, minimize, canceled.
- Spanish uses its own standard spelling; the rule above is for English only.
- Exceptions are listed at the end of this file.

## Concepts

| Concept | English | Spanish | Notes |
| --- | --- | --- | --- |
| Hoop (the frame the fabric sits in) | Hoop | Bastidor | Never "aro" and never "costura". |
| Default hoop | the size, e.g. 110 × 110 mm | the size, e.g. 110 × 110 mm | Never "Default". The worksheet shows `Hoop: 110 mm` (size only). |
| Standard hoop name | Standard | Estándar | Only where a name is needed instead of a size. No string uses it yet. |
| Document default | Default | Predeterminado | "Default" is used only for a document default, e.g. "Default for objects without their own value". |
| Embroidery | embroidery | bordado | |
| Worksheet | sewing worksheet | hoja de bordado | Never "hoja de costura". |
| Sewing tips | Sewing tips | Consejos de bordado | Never "Consejos de costura". |
| Lettering (tool, panel and section name) | Lettering | Lettering | Proper tool name, kept in English in both languages. |
| Text (the object the Lettering tool creates) | Text | Texto | Object name shown as `Text: <first line>`. |
| Text style (the style name) | Text style | Estilo de texto | |
| Object (any drawn or imported item) | object | objeto | Used in messages when the type does not matter. |
| Shape | shape | forma | Rectangle, ellipse, star and similar. |
| Path | path | trazado | Open or closed outline drawn with points. |
| Stitch layer (imported machine stitches) | stitch layer | capa de puntadas | Used on the object list row, the inspector ("JEF stitch layer" / "JEF capa de puntadas") and in messages. |
| Thread | thread | hilo | |
| Thread color | thread color | color de hilo | |
| Stitch | stitch | puntada | |

### Object-type nouns

The same noun is used on the object list, in the inspector and on the status line:

- A text object is "Text" / "Texto" everywhere, in lowercase inside sentences ("this text", "another text", "Select one shape, path or text first.").
- "Lettering" is never an object type. It names the tool and the panel only.
- Stitch layers are "stitch layer" / "capa de puntadas".
- "Object" is the fallback when the type does not matter.

## Verbs

One verb per action. Use the verb for the object named in the table.

| Verb | Applies to | Meaning | Examples |
| --- | --- | --- | --- |
| Delete | objects, text, stitch layers, files in the document | Takes the object out of the document for good (undoable). | Delete selected object / Eliminar |
| Remove | things inside an object or setting, or from a list, where the object itself stays | Takes one item out but leaves the rest. | Remove small holes / Quitar agujeros pequeños |
| Discard | unsaved changes and unsaved objects | Throws away work that was not saved. | Discard {objects}? / ¿Descartar {objects}? |
| Clear | the value of a field or a list | Empties it; the field stays. | (no string needs it yet) |
| Hide | panels, tips and tip categories | Stops showing it; nothing is removed. | Hiding a section in the layout settings; the section is kept. |

## Changed terms in this build

Every term below changed in this build. Spanish changes are in `src/i18n.js`; English changes are the same strings in the sources (the English is the table key). Line-level detail: `git diff HEAD -- src/i18n.js`.

### Terms (both languages)

| Concept | Before (EN / ES) | After (EN / ES) |
| --- | --- | --- |
| Hoop | Hoop / aro (batch export) | Hoop / bastidor |
| Outside the hoop (tip category) | Outside the hoop / Fuera del aro | Outside the hoop / Fuera del bastidor |
| Worksheet | sewing worksheet / hoja de costura | sewing worksheet / hoja de bordado |
| Sewing tips | Sewing tips / Consejos de costura | Sewing tips / Consejos de bordado |
| Lettering (the tool) | Add lettering / Añadir texto bordado; Lettering / Texto bordado | Add lettering / Añadir Lettering; Lettering / Lettering |
| Text (the object the tool makes) | Lettering / Texto bordado (object name); Lettering text / Texto del bordado | Text / Texto; Text content / Contenido del texto |
| Text (object, in messages) | this lettering / Este texto (old), another lettering / otro texto (old) | this text / Este texto; another text / otro texto |
| Text: object name prefix | Lettering: {t} / Texto: {t} | Text: {t} / Texto: {t} |
| Small text (tip category) | Small lettering / Letra pequeña | Small text / Texto pequeño |
| Vertical text (checkbox and messages) | Vertical lettering … / Letras verticales … | Vertical text … / Texto vertical … |
| Thread color | colour / color (ES unchanged) | color |
| Colors (list heading, stock) | Colours / Colores (heading); one hex colour per line | Colors / Colores; one hex color per line |
| Color change | colour change / cambio de color (ES unchanged) | color change |
| Center (pivot, ripple, run, placement) | centre / centro, Centre run, Ripple centre | center / centro, Center run, Ripple center |
| Gray (swatch name) | Grey, Light grey | Gray, Light gray |
| Default hoop preset | Default (preset option) / Estándar | 110 × 110 mm (named by size) |
| Canceled (dialog messages) | cancelled | canceled |
| Object-type nouns in messages | Select one shape, path or lettering first. | Select one shape, path or text first. |
| Stitch layer, object list row | machine stitches | stitch layer / puntadas de máquina; capa de puntadas | Was "machine stitches" on the object list only. |
| Stitch layer, inspector format line | JEF stitch layer (hardcoded English) | {fmt} stitch layer / {fmt} capa de puntadas | Now translated through the string table. |
| Stitch layer, error message | Imported machine stitches cannot be converted to a path. | Imported stitch layers cannot be converted to a path. | Spanish: no key existed. |
| Text object, font usage (Organize fonts) | used by N lettering object(s); Fonts used by lettering are kept… / (bundled, not removed): used by {n} text object (hardcoded English) | used by N text object(s); Fonts used by text objects are kept… / (bundled, not removed): used by … (translated) | Lettering is never an object type. |
| Text object, validation message | …on lettering only. | …on text objects only. | |
| Text object, error messages | Unknown lettering object; Name drop needs a lettering object | Unknown text object; Name drop needs a text object | English only, no Spanish key existed. |
| Redwork by color (button) | Redwork by colour / Punto de ida y vuelta por color | Redwork by color / Punto de ida y vuelta por color |
| Licenses (font notices) | licence / licencia | license / licencia |
| Text on a path | Put the selected lettering on the selected path; Detach lettering from its path | Put the selected text on the selected path; Detach text from its path |
| Empty text message | Lettering needs some text. | A text object needs some text. |
| Vertical font message | Vertical lettering needs a bundled or loaded font. | Vertical text needs a bundled or loaded font. |
| Name drop example | … with BLOOM lettering … | … with BLOOM text … |

### Spelling (English only, same strings)

Strings changed from British to US spelling: colour→color, centre→center, grey→gray, cancelled→canceled, licence→license, millimetre(s)→millimeter(s), minimise→minimize.  Code identifiers are not renamed (see Exceptions).

### Single-string edits made in this build (on top of the sweep)

| Where | Change |
| --- | --- |
| `src/components/TransformPanel.tsx` | Use centre → Use center |
| `src/components/StitchPathRows.tsx` | Ripple centre → Ripple center |
| `src/components/SewingOrder.tsx` | Sort by colour → Sort by color; title minimise → minimize |
| `src/components/PathPanel.tsx` | Redwork by colour → Redwork by color |
| `src/components/ThreadPlan.tsx` | thread colours → thread colors |
| `src/components/HoopFields.tsx` | preset title "the default" → "110 × 110 mm" |
| `src/components/EditorLayout.tsx` | the two text-on-path labels: lettering → text |
| `src/components/EditorOverlays.tsx` | name-drop example: BLOOM lettering → BLOOM text |
| `src/toolbarCommands.ts` | Select one shape, path or lettering first. → … or text first. |
| `src/letteringFonts.ts` | Vertical lettering fitted → Vertical text fitted; Lettering needs some text. → A text object needs some text. |
| `src/designChecks.js` | Small lettering → Small text; "lettering under about 5 mm" → "text under about 5 mm" |
| `src/transforms.js` | error messages: lettering → text; Lettering and imported stitches → Text and imported stitch layers |
| `src/validate.js` | validation messages: lettering <id> → text <id> |
| `server.js` | MCP descriptions: millimetre(s), centre, licences → millimeter(s), center, licenses |
| `src/i18n.js` | added keys: Redwork by color, the text-example line |
| `test/editor.spec.js` | object-row selectors Lettering → Text; toast "Vertical lettering fitted" → "Vertical text fitted" |

Already consistent, checked and left as they are (with the object-type nouns now aligned across the object list, inspector and status line):

- Spanish "aro", "costura", "hoja de costura", "Consejos de costura", "Fuera del aro": none in `src/i18n.js` now. Batch export uses "bastidor" (`i18n.js` lines for "{perHoop} copias caben en un bastidor"). The worksheet uses "Hoja de bordado" and "Consejos de bordado".
- "Hoop: Default 110 × 110 mm": no such string. The hoop is named by its size (`hoopLabel` in `src/hoops.js`).
- "Fuera del bastidor" (tips) is the Spanish for "Outside the hoop".

## Exceptions

These spellings are kept on purpose. Each is a code identifier, a file's legal text, or a value that is not a UI string.

- `Lettering`: the tool, panel and section name. Proper name, same in both languages. It is never used as an object-type noun in UI text.
- Code comments and identifiers still say "lettering" (for example `lettering object`, `isRegistryFont`, `letteringFonts.ts`, the `lettering` engine type). They are not shown to users and renaming them is out of scope.
- Code identifiers that use British spelling are not renamed: `colours`, `colourChanges`, `sortByColour`, `colourList`, `centre` and `millimetre` in variable names, `labelled` (the prop and the `.labelled` class), `metres` (the worksheet and playback helper names), `grey` (the `greyscale` names). Renaming them is out of scope and touches the public engine API.
- Source comments may use British spelling (for example "centre", "millimetre", "colour"). They are not shown to users.
- CSS keyword `grey` in `styles.css` and the comment "grey samples" in `src/photoCommands.ts` (a traced grey placeholder, not a label).
- License text and license metadata: `THIRD_PARTY_NOTICES.md`, `LICENSE-THIRD-PARTY-*.txt`, the font JSON files under `fonts/` (their own "licence" fields), `vite.config.js` (a comment about copying "licence notices"), and the `licence` JSDoc in `src/ttf.js`. These quote third-party files and are not written by the product.
- Spanish strings are not checked against the English spelling rule.
- Pre-existing, not touched in this build: "Redwork by color" and other strings with no Spanish key yet. Adding a Spanish key is a translation task, not a spelling one.
