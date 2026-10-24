# Agent access (MCP) and the relay

Welcome has no accounts. Several people can use the same server (welcome.design, a self-hosted copy, or the macOS app's local service) at once, each with their own local files. Agent access is therefore a **private, revocable link per browser tab**, not a login.

## How it works

1. In the editor press the **Agent** button. The tab asks the server for a session and receives two secrets:
   - a **link token**, embedded in the MCP URL `https://<host>/mcp/<token>`. This is what you give your agent.
   - an **owner key**, kept only in that tab's `sessionStorage`. It is required to poll, reply and revoke; the agent never sees it.
2. The tab long-polls `POST /api/relay/poll`. When an agent calls an MCP tool with `documentId: "live"`, the server queues a job (`get_document` or `apply_ops`) for the tab, the tab answers via `POST /api/relay/reply`, and the result goes back to the agent. Edits appear live in the open editor, go through undo/redo and mark the project unsaved.
3. **The design never lives on the server.** Only exports/previews/saves that the agent asks for are written as UUID-named artifacts. Headless `document_create` documents are kept in memory per link (max 50) and are invisible to other links.
4. **Revoke** from the Agent dialog ("Revoke & make new link"): the old token stops working immediately and a new one is issued. Closing the tab stops polling, so agents get "No Welcome browser tab is attached"; sessions also expire after 12 h of inactivity. Only hashes of the token and owner key are persisted (`var/sessions.json`, or `WELCOME_SESSION_FILE`; set it to an empty string to disable), so links and revocations survive a server restart; headless documents do not.

Long-polling (25 s) is used instead of SSE/WebSocket because Cloudflare quick tunnels cannot stream SSE and it needs no extra dependency.

## Hardening

- `/mcp` without a token returns 401. The old anonymous endpoint exists only when the server runs with `WELCOME_ANONYMOUS_MCP=1` (used by the local test suite).
- Tokens and owner keys are 192-bit random values; the server stores only SHA-256 hashes in memory.
- `/api/*` accepts only `application/json` POSTs carrying an `x-welcome-client: 1` header. A custom header forces a CORS preflight that the server never answers, so other websites cannot create, poll or revoke sessions from a visitor's browser (this also works behind proxies and tunnels that rewrite the Host header).
- Limits: 30 new links per address per hour, 5,000 live sessions, 16 queued jobs per tab, 20 s per job, 100 kB API bodies (40 MB for a document reply).
- The server has no TLS or auth of its own beyond this. Put it behind HTTPS (welcome.design, Cloudflare tunnel, a reverse proxy). Treat the MCP URL like a password: it is in the URL, so it can appear in your agent's config and logs.

## Tools

`document_inspect`, `document_apply`, `embroidery_compile`, `embroidery_preview`, `embroidery_export`, `document_save` accept `documentId: "live"` for the open browser document. `document_import_embroidery` is not available on live documents yet. `document_create` makes a headless document.

Example prompt: "Use the Welcome MCP on the live document to draw a leaf badge with BLOOM lettering, then export JEF."

## Stitch-quality keys (`set_object`, `set_settings`)
`stitchLength` (0.5–7 mm), `stagger` (1–8 phases), `underlayType` (`none`, `auto`, `contour`, `fill`, `laydown` (a light fill at 4 mm rows, fills only), `contour+fill` for fills; `center`, `zigzag`, `contour`, and combinations for satin), `underlayInset`, `underlaySpacing`, `fillMethod` (`rows`, `contour`, `spiral`, `meander` or `guided`), `guide` (2–50 `[u, v]` points, fractions of the bounding box, for `guided`), `startAt` / `endAt` (`[u, v]` fractions 0–1 of the object's bounding box, null clears). Pass `null` to return a key to the document default.

## Vector-editing keys
`add_shape` accepts `radius` (rectangle corner radius, mm); `set_object` accepts `radius`, `satinWidthEnd` (tapers a satin path from `satinWidth` to this width), and `borderWidth` (0 = running outline, more = satin border of that width). `round_corners {id, radius, indexes?}` rounds the straight corner nodes of a path. `text_on_path` now keeps the lettering attached: when the path is edited or moved the lettering follows; `text_off_path` detaches it.

## Roadmap-tool keys
`set_object`: `cap` (`butt`/`round`/`square`) and `join` (`round`/`miter`/`bevel`) for satin paths (join also for satin borders); `widthStops` (sorted `[position 0–1, width mm]` pairs, a smooth width profile for a satin path) or `set_width_at_node {id, index, width|null}`; `blendThread`, `blendStart`, `blendEnd` (a second thread shares the rows of a rows-pattern fill by an ordered dither, from start to end of the shape height). `clip {ids, maskId}` sews the objects only inside the mask (a rectangle, ellipse or closed path, which is then not sewn itself); `release_clip {ids}` undoes it.

## Embroidery option keys
`set_object`: `fillMethod: "cross"` with `crossSize` (1–8 mm); `applique: true` with `appliqueWidth` (1–8 mm) on closed filled shapes (placement line, machine stop, tack-down, stop, satin cover; the area itself is not filled; `borderThread` colours the cover); `runStyle: "bean"` and `stitchLength` for running stitches; `lengthVariance` (0–0.5) for rows fills; `compensation` (0–2 mm) to override the document pull compensation for one object; `blingShape: "round"` (default) or `"square"` for the stone shape of a bling object.

## More pattern keys
`fillMethod: "ripple"` with `rippleCenter` (`[u, v]` fractions); `blendAngle` (degrees) blends along any direction and works with every fill pattern; `underpath: false` turns off hiding longer travel under later rows (on by default); `photo: {pw, ph, data (base64 grey bytes, pw×ph, up to 320×320), spacing, contrast, invert}` on a filled rectangle sews the picture as zigzag rows whose width follows the darkness.

`photo.thread2` (hex colour) makes a two-tone photo: that thread sews the light tones first, the main thread adds the dark detail.

## Embellishment and motif keys
`stitch` on `add_path` and `set_object` takes `motif` (loops along a path), `sequin`, `bead` or `bling` as well as `fill`, `run` and `satin`. `set_object` then accepts `motifShape` (`circle` or `leaf`), `motifSpacing` (1–20 mm between loops, stones or beads), `motifSize` (0.4–6 mm), `motifWarp` (`none`, `x`, `y` or `along`; `along` shrinks the loops from the start of a path to the end), `motifPair` (loops on each side of a satin column; needs `satinWidth`) and `blingShape` (`round`, `square`, `oval`, `hexagon`, `star` or `heart`). Sequins and beads use the same `motifSpacing` and `motifSize`, with their own defaults when omitted. `sequinTwin: true` sews sequins in pairs, side by side across the path, each pair a sequin's width apart.
`set_settings { fabric: "woven" | "knit" | "towel" }` applies a fabric preset: woven (the defaults), knit (pull compensation 0.5 mm), or towel (pull compensation 0.4 mm, 2.5 mm stitch length, stagger 8, auto underlay). Explicit keys in the same operation win. `pullLeft` and `pullRight` (0–2 mm, or null to clear) set the satin pull on each side of a satin path, as seen walking along the path; an unset side uses the object's pull compensation. `beadTwin: true` sews two beads side by side across the path, one either side of the centre line. `beadShape` (`dash` or `dot`, default `dash`) sets how beads are sewn: a dash is a short pass across the path, a dot a small round bead the size of `motifSize`. `blingRings` (1 or 2, default 2) sews a bling stone with one fixing ring or two. `stoneTurn: false` keeps square, hexagon and star stones in one orientation; the default turns them to follow the path (oval and heart stones always do).
`fillMethod: "motif"` fills a closed shape with the motif loops on a staggered grid, using the same `motifSpacing` and `motifSize`.

## Reference image
`set_reference {data?, x, y, w, h, opacity, visible, locked, name}` sets or adjusts a background picture (a PNG, JPEG, WebP or GIF data URL under 1.5 MB, positioned in millimetres) that the live editor shows under the shapes; `clear_reference` removes it. It is never sewn. Documents returned to agents carry a 1×1 placeholder with `pictureOmitted: true` instead of the picture, to save space; use `reference_image` to see it.

`reference_image {documentId, view: "annotated" | "raw", includeShapes}` returns the placement in millimetres (x right, y down, origin at the hoop centre) and the picture as an MCP image. `annotated` (live document) shows the picture where it sits with a millimetre grid (labels every 20 mm), the red dashed hoop outline, the origin and, optionally, the current shapes as coloured outlines; the text part gives the image's `imageBox` and `pixelsPerMm` so a pixel can be converted to millimetres. `raw` returns just the picture, which fills `placement.w × placement.h` mm from `placement.x, placement.y`. `document_inspect` reports the placement too.

`document_import_embroidery` now reads DST as well as JEF and VP3; DST has no thread colours, so placeholder colours are assigned. It also reads SEW, whose colours come from the Janome thread chart.

## Agent experience tools
- `document_create` returns the `documentId` in its text as well as in structured content; `document_list` lists the live document and every headless one.
- `document_render {documentId, view: "design" | "stitches", size}` returns a PNG (design: shapes before compiling; stitches: the compiled thread lines) over a millimetre grid with the hoop outline and origin, plus the pixel to millimetre mapping. `embroidery_preview` now returns the same kind of picture inline, and `document_export_svg` returns the SVG text inline (under 200 KB).
- `document_apply` results list created objects (id, kind, bounding box, size), changed and deleted ids, and sewing warnings (fills that are too small or narrow, satin under 1 mm or over 7 mm, tiny lettering, duplicates, objects outside the hoop). `embroidery_compile` includes the same warnings. The `clear` operation deletes every object.
- `document_snapshot` / `document_restore` save and bring back a design (one undoable step in the live browser document); `document_push_live` replaces the browser design with a headless one (undo returns the previous design).
- `embroidery_help {topic}` holds the long reference (operations, coordinates, stitching, sewing rules, lettering, workflow); the `document_apply` description now only states the coordinate conventions: x right, y down, origin at the hoop centre; rectangles and ellipses by top-left corner; path points absolute; lettering by baseline-left.

`photo.thread3` (with `thread2`) adds a mid-tone thread: light (thread2), mid (thread3), then dark (the object's thread), each on its own offset rows.

`photo.thread4` (with `thread3`) adds a fourth tone: light (thread2), light-mid (thread3), mid-dark (thread4), then dark (the object's thread).
