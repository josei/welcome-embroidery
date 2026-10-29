// The icon sprite the editor's buttons point at. Rendered by React; ids match the markup it replaced, because app.js wires them by id.
export function EditorIcons() {
 return (
  <>
    <svg className={"icon-defs"} aria-hidden={"true"} focusable={"false"}>
      <defs>
        {" "}
        <symbol id={"i-new"} viewBox={"0 0 24 24"}>
          <path d={"M12 5v14M5 12h14"} />
        </symbol>
        {" "}
        <symbol id={"i-open"} viewBox={"0 0 24 24"}>
          <path d={"M3 7.5h7l2 2h9v9H3zM3 7.5V5h7l2 2.5"} />
        </symbol>
        {" "}
        <symbol id={"i-import"} viewBox={"0 0 24 24"}>
          <path d={"M12 3v12m0 0 4-4m-4 4-4-4M4 16v4h16v-4"} />
        </symbol>
        {" "}
        <symbol id={"i-save"} viewBox={"0 0 24 24"}>
          <path d={"M4 4h13l3 3v13H4zM8 4v6h8V4M8 20v-6h8v6"} />
        </symbol>
        {" "}
        <symbol id={"i-agent"} viewBox={"0 0 24 24"}>
          <rect x={"4"} y={"7"} width={"16"} height={"12"} rx={"3"} />
          <path d={"M12 3v4M9 13v1M15 13v1"} />
        </symbol>
        <symbol id={"i-gear"} viewBox={"0 0 24 24"}>
          <path d={"M19.00 12.00 L21.11 13.30 L20.70 14.98 L18.19 15.28 L16.95 16.95 L17.52 19.36 L16.05 20.26 L14.06 18.69 L12.00 19.00 L10.70 21.11 L9.02 20.70 L8.72 18.19 L7.05 16.95 L4.64 17.52 L3.74 16.05 L5.31 14.06 L5.00 12.00 L2.89 10.70 L3.30 9.02 L5.81 8.72 L7.05 7.05 L6.48 4.64 L7.95 3.74 L9.94 5.31 L12.00 5.00 L13.30 2.89 L14.98 3.30 L15.28 5.81 L16.95 7.05 L19.36 6.48 L20.26 7.95 L18.69 9.94 Z"} />
          <circle cx={"12"} cy={"12"} r={"2.8"} />
        </symbol>
        {" "}
        <symbol id={"i-rect"} viewBox={"0 0 24 24"}>
          <rect x={"4"} y={"5"} width={"16"} height={"14"} rx={"1"} />
        </symbol>
        {" "}
        <symbol id={"i-ellipse"} viewBox={"0 0 24 24"}>
          <ellipse cx={"12"} cy={"12"} rx={"8"} ry={"6"} />
        </symbol>
        {" "}
        <symbol id={"i-path"} viewBox={"0 0 24 24"}>
          <path d={"m4 19 5-13 4 9 7-8"} />
          <circle cx={"4"} cy={"19"} r={"1.5"} />
          <circle cx={"20"} cy={"7"} r={"1.5"} />
        </symbol>
        {" "}
        <symbol id={"i-text"} viewBox={"0 0 24 24"}>
          <path d={"M5 6V4h14v2M12 4v16M9 20h6"} />
        </symbol>
        {" "}
        <symbol id={"i-undo"} viewBox={"0 0 24 24"}>
          <path d={"m9 14-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-3"} />
        </symbol>
        {" "}
        <symbol id={"i-redo"} viewBox={"0 0 24 24"}>
          <path d={"m15 14 5-5-5-5m5 5H10a6 6 0 0 0 0 12h3"} />
        </symbol>
        {" "}
        <symbol id={"i-copy"} viewBox={"0 0 24 24"}>
          <rect x={"8"} y={"8"} width={"12"} height={"12"} rx={"2"} />
          <path d={"M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"} />
        </symbol>
        {" "}
        <symbol id={"i-delete"} viewBox={"0 0 24 24"}>
          <path d={"M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m3 3v7m6-7v7"} />
        </symbol>
        {" "}
        <symbol id={"i-reset"} viewBox={"0 0 24 24"}>
          <path d={"M4 4v6h6M5 10a8 8 0 1 1-1 5"} />
        </symbol>
        {" "}
        <symbol id={"i-play"} viewBox={"0 0 24 24"}>
          <path d={"M8 5v14l11-7Z"} fill={"currentColor"} stroke={"none"} />
        </symbol>
        {" "}
        <symbol id={"i-pause"} viewBox={"0 0 24 24"}>
          <path d={"M8 5v14M16 5v14"} strokeWidth={"3"} />
        </symbol>
        {" "}
        <symbol id={"i-al-left"} viewBox={"0 0 24 24"}>
          <path d={"M4 3v18M8 7h12v4H8zM8 14h7v4H8z"} />
        </symbol>
        {" "}
        <symbol id={"i-al-hcenter"} viewBox={"0 0 24 24"}>
          <path d={"M12 3v18M5 7h14v4H5zM8 14h8v4H8z"} />
        </symbol>
        {" "}
        <symbol id={"i-al-right"} viewBox={"0 0 24 24"}>
          <path d={"M20 3v18M4 7h12v4H4zM9 14h7v4H9z"} />
        </symbol>
        {" "}
        <symbol id={"i-al-top"} viewBox={"0 0 24 24"}>
          <path d={"M3 4h18M7 8v12h4V8zM14 8v7h4V8z"} />
        </symbol>
        {" "}
        <symbol id={"i-al-vcenter"} viewBox={"0 0 24 24"}>
          <path d={"M3 12h18M7 5v14h4V5zM14 8v8h4V8z"} />
        </symbol>
        {" "}
        <symbol id={"i-al-bottom"} viewBox={"0 0 24 24"}>
          <path d={"M3 20h18M7 4v12h4V4zM14 9v7h4V9z"} />
        </symbol>
        {" "}
        <symbol id={"i-dist-h"} viewBox={"0 0 24 24"}>
          <path d={"M4 3v18M20 3v18M9 8h6v8H9z"} />
        </symbol>
        {" "}
        <symbol id={"i-dist-v"} viewBox={"0 0 24 24"}>
          <path d={"M3 4h18M3 20h18M8 9h8v6H8z"} />
        </symbol>
        {" "}
        <symbol id={"i-snap"} viewBox={"0 0 24 24"}>
          <path d={"M4 4h16v16H4zM4 12h16M12 4v16"} />
        </symbol>
        {" "}
        <symbol id={"i-node-add"} viewBox={"0 0 24 24"}>
          <path d={"M4 18c4 0 4-12 8-12s4 12 8 12M18 3v6M15 6h6"} />
        </symbol>
        {" "}
        <symbol id={"i-node-del"} viewBox={"0 0 24 24"}>
          <path d={"M4 18c4 0 4-12 8-12s4 12 8 12M15 6h6"} />
        </symbol>
        {" "}
        <symbol id={"i-node-smooth"} viewBox={"0 0 24 24"}>
          <path d={"M3 17c5 0 5-10 9-10s4 10 9 10M6 17h-3M21 17h-3"} />
          <circle cx={"12"} cy={"7"} r={"1.6"} />
        </symbol>
        {" "}
        <symbol id={"i-node-corner"} viewBox={"0 0 24 24"}>
          <path d={"M3 18 12 6l9 12"} />
          <circle cx={"12"} cy={"6"} r={"1.6"} />
        </symbol>
        {" "}
        <symbol id={"i-group"} viewBox={"0 0 24 24"}>
          <path d={"M4 4h4M16 4h4M4 20h4M16 20h4M4 4v4M4 16v4M20 4v4M20 16v4"} />
          <rect x={"9"} y={"9"} width={"6"} height={"6"} />
        </symbol>
        {" "}
        <symbol id={"i-ungroup"} viewBox={"0 0 24 24"}>
          <rect x={"4"} y={"4"} width={"7"} height={"7"} />
          <rect x={"13"} y={"13"} width={"7"} height={"7"} />
        </symbol>
        {" "}
        <symbol id={"i-select"} viewBox={"0 0 24 24"}>
          <path d={"M6 3l12 8-5.5 1.5L10 18z"} />
        </symbol>
        {" "}
        <symbol id={"i-line"} viewBox={"0 0 24 24"}>
          <path d={"M5 19 19 5"} />
        </symbol>
        {" "}
        <symbol id={"i-polygon"} viewBox={"0 0 24 24"}>
          <path d={"M12 3l8 5v8l-8 5-8-5V8z"} />
        </symbol>
        {" "}
        <symbol id={"i-star"} viewBox={"0 0 24 24"}>
          <path d={"m12 3 2.7 6 6.3.6-4.8 4.3 1.4 6.4L12 17l-5.6 3.3 1.4-6.4L3 9.6 9.3 9z"} />
        </symbol>
        {" "}
        <symbol id={"i-pen"} viewBox={"0 0 24 24"}>
          <path d={"M4 20l2-6L16 4l4 4L10 18zM14 6l4 4M4 20l5-3"} />
        </symbol>
        {" "}
        <symbol id={"i-subtract"} viewBox={"0 0 24 24"}>
          <path d={"M4 4h12v4M4 4v12h4"} />
          <circle cx={"14"} cy={"14"} r={"6"} />
        </symbol>
        {" "}
        <symbol id={"i-union"} viewBox={"0 0 24 24"}>
          <path d={"M4 4h10v6h6v10H10v-6H4z"} />
        </symbol>
        {" "}
        <symbol id={"i-intersect"} viewBox={"0 0 24 24"}>
          <path d={"M4 4h10v10H4zM10 10h10v10H10z"} />
          <path d={"M10 10h4v4h-4z"} fill={"currentColor"} />
        </symbol>
        {" "}
        <symbol id={"i-text-path"} viewBox={"0 0 24 24"}>
          <path d={"M3 18C8 18 8 6 13 6s5 12 8 12"} />
          <path d={"M8 11l1-3 1 3M9 10h.01"} />
        </symbol>
        {" "}
        <symbol id={"i-text-detach"} viewBox={"0 0 24 24"}>
          <path d={"M3 18C8 18 8 6 13 6s5 12 8 12"} strokeDasharray={"2 3"} />
          <path d={"M12 12l6 6M18 12l-6 6"} />
        </symbol>
        {" "}
        <symbol id={"i-chevron"} viewBox={"0 0 24 24"}>
          <path d={"m6 9 6 6 6-6"} />
        </symbol>
        {" "}
        <symbol id={"i-minus"} viewBox={"0 0 24 24"}>
          <path d={"M5 12h14"} />
        </symbol>
        {" "}
        <symbol id={"i-eye"} viewBox={"0 0 24 24"}>
          <path d={"M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"} />
        </symbol>
        {" "}
        <symbol id={"i-eye-off"} viewBox={"0 0 24 24"}>
          <path
            d={"M3 3l18 18M10.6 6.2A9.6 9.6 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.8M6.5 7.8A17 17 0 0 0 2 12s4 7 10 7c1.6 0 3-.4 " +
"4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"}
          />
        </symbol>
        {" "}
        <symbol id={"i-lock"} viewBox={"0 0 24 24"}>
          <path d={"M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3"} />
        </symbol>
        {" "}
        <symbol id={"i-unlock"} viewBox={"0 0 24 24"}>
          <path d={"M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.5-2"} />
        </symbol>
        {" "}
        <symbol id={"i-chevron-right"} viewBox={"0 0 24 24"}>
          <path d={"m9 6 6 6-6 6"} />
        </symbol>
        {" "}
        <symbol id={"i-node-edit"} viewBox={"0 0 24 24"}>
          <path d={"M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"} />
        </symbol>
        {" "}
        <symbol id={"i-flip-h"} viewBox={"0 0 24 24"}>
          <path d={"M12 3v18M8 7 3 12l5 5zM16 7l5 5-5 5z"} />
        </symbol>
        {" "}
        <symbol id={"i-fill"} viewBox={"0 0 24 24"}>
          <rect x={"4"} y={"5"} width={"16"} height={"14"} rx={"1"} />
          <path d={"M4 9l4-4M4 14l9-9M4 19l14-14M9 19l11-11M14 19l6-6"} />
        </symbol>
        {" "}
        <symbol id={"i-run"} viewBox={"0 0 24 24"}>
          <path d={"M3 12h3M10 12h4M18 12h3"} strokeWidth={"2.4"} />
        </symbol>
        {" "}
        <symbol id={"i-satin"} viewBox={"0 0 24 24"}>
          <path d={"M3 6h18M3 18h18M5 6l3 12 3-12 3 12 3-12 2 12"} />
        </symbol>
        {" "}
        <symbol id={"i-rows"} viewBox={"0 0 24 24"}>
          <path d={"M4 6h16M4 10h16M4 14h16M4 18h16"} />
        </symbol>
        {" "}
        <symbol id={"i-contour"} viewBox={"0 0 24 24"}>
          <rect x={"3.5"} y={"4.5"} width={"17"} height={"15"} rx={"2"} />
          <rect x={"7.5"} y={"8.5"} width={"9"} height={"7"} rx={"1"} />
        </symbol>
        {" "}
        <symbol id={"i-spiral"} viewBox={"0 0 24 24"}>
          <path
            d={"M12 12.5a1.2 1.2 0 0 1 1.2-1.2 2.6 2.6 0 0 1 2.6 2.6 4 4 0 0 1-4 4 5.4 5.4 0 0 1-5.4-5.400 6.800 6.800 0 0 1 " +
"6.800-6.800 8.200 8.200 0 0 1 8.200 8.200"}
          />
        </symbol>
        {" "}
        <symbol id={"i-meander"} viewBox={"0 0 24 24"}>
          <path d={"M4 6h13a2 2 0 0 1 0 4H7a2 2 0 0 0 0 4h10a2 2 0 0 1 0 4H5"} />
        </symbol>
        {" "}
        <symbol id={"i-guided"} viewBox={"0 0 24 24"}>
          <path d={"M3 9q9-7 18 0M3 14q9-7 18 0M3 19q9-7 18 0"} />
        </symbol>
        {" "}
        <symbol id={"i-border"} viewBox={"0 0 24 24"}>
          <rect x={"4"} y={"4"} width={"16"} height={"16"} rx={"2"} />
          <rect x={"8"} y={"8"} width={"8"} height={"8"} fill={"currentColor"} />
        </symbol>
        {" "}
        <symbol id={"i-closed"} viewBox={"0 0 24 24"}>
          <path d={"M5 19 9 5l11 6-4 8z"} />
        </symbol>
        {" "}
        <symbol id={"i-smooth"} viewBox={"0 0 24 24"}>
          <path d={"M3 17C7 5 11 21 15 11c1.5-3.500 3.500-3 6-3"} />
        </symbol>
        {" "}
        <symbol id={"i-clip"} viewBox={"0 0 24 24"}>
          <rect x={"3.5"} y={"5.500"} width={"12"} height={"12"} rx={"1"} />
          <circle cx={"15"} cy={"13"} r={"6"} strokeDasharray={"3 2"} />
          <path d={"M11 10h6v6h-6z"} fill={"currentColor"} stroke={"none"} opacity={".5"} />
        </symbol>
        {" "}
        <symbol id={"i-unclip"} viewBox={"0 0 24 24"}>
          <rect x={"3.5"} y={"5.500"} width={"12"} height={"12"} rx={"1"} />
          <circle cx={"15"} cy={"13"} r={"6"} />
          <path d={"M4 4l16 16"} />
        </symbol>
        {" "}
        <symbol id={"i-snap-obj"} viewBox={"0 0 24 24"}>
          <circle cx={"12"} cy={"12"} r={"3"} />
          <path d={"M12 3v4M12 17v4M3 12h4M17 12h4"} />
          <rect x={"15"} y={"15"} width={"6"} height={"6"} rx={"1"} strokeDasharray={"2 1.500"} />
        </symbol>
        {" "}
        <symbol id={"i-cap-butt"} viewBox={"0 0 24 24"}>
          <path d={"M3 9h12v6H3z"} />
          <path d={"M15 7v10"} strokeWidth={"2.4"} />
        </symbol>
        {" "}
        <symbol id={"i-cap-round"} viewBox={"0 0 24 24"}>
          <path d={"M3 9h10a3 3 0 0 1 0 6H3z"} />
        </symbol>
        {" "}
        <symbol id={"i-cap-square"} viewBox={"0 0 24 24"}>
          <path d={"M3 9h15v6H3z"} />
        </symbol>
        {" "}
        <symbol id={"i-join-round"} viewBox={"0 0 24 24"}>
          <path d={"M4 20V10a6 6 0 0 1 6-6h10"} />
        </symbol>
        {" "}
        <symbol id={"i-join-miter"} viewBox={"0 0 24 24"}>
          <path d={"M4 20V5h16"} />
        </symbol>
        {" "}
        <symbol id={"i-join-bevel"} viewBox={"0 0 24 24"}>
          <path d={"M4 20V9l5-5h11"} />
        </symbol>
        {" "}
        <symbol id={"i-cross"} viewBox={"0 0 24 24"}>
          <rect x={"3.5"} y={"3.5"} width={"17"} height={"17"} rx={"1"} strokeDasharray={"2 2"} />
          <path d={"M7 7l10 10M17 7 7 17"} />
        </symbol>
        {" "}
        <symbol id={"i-bean"} viewBox={"0 0 24 24"}>
          <path d={"M3 9h18M3 12h18M3 15h18"} strokeWidth={"1.6"} />
        </symbol>
        {" "}
        <symbol id={"i-applique"} viewBox={"0 0 24 24"}>
          <path d={"M5 8c0-2 2-3 7-3s7 1 7 3v8c0 2-2 3-7 3s-7-1-7-3z"} strokeDasharray={"2.2 1.6"} />
          <path d={"M8 9c0-1 1.5-1.5 4-1.5s4 .5 4 1.5v6c0 1-1.5 1.5-4 1.5s-4-.5-4-1.5z"} fill={"currentColor"} opacity={".35"} />
        </symbol>
        {" "}
        <symbol id={"i-ripple"} viewBox={"0 0 24 24"}>
          <rect x={"3.5"} y={"5"} width={"17"} height={"14"} rx={"2"} />
          <rect x={"7"} y={"8"} width={"10"} height={"8"} rx={"1.500"} />
          <rect x={"10"} y={"10.500"} width={"4"} height={"3"} rx={".8"} />
        </symbol>
        {" "}
        <symbol id={"i-photo"} viewBox={"0 0 24 24"}>
          <rect x={"3.5"} y={"5"} width={"17"} height={"14"} rx={"2"} />
          <circle cx={"9"} cy={"10"} r={"1.800"} />
          <path d={"M4 17l5-4 3 2.500 3-3 5 4.500"} />
        </symbol>
        {" "}
        <symbol id={"i-trace"} viewBox={"0 0 24 24"}>
          <path d={"M4 18c0-6 3-11 8-11s8 4 8 8"} strokeDasharray={"2.5 2"} />
          <path d={"M5 19c1-4 3-7 7-7 3 0 5 2 6 5"} />
          <circle cx={"12"} cy={"12"} r={"1.600"} fill={"currentColor"} />
        </symbol>
        {" "}
        <symbol id={"i-keys"} viewBox={"0 0 24 24"}>
          <rect x={"3"} y={"6"} width={"18"} height={"12"} rx={"2"} />
          <path d={"M7 10h.01M11 10h.01M15 10h.01M7 14h10"} />
        </symbol>
        {" "}
        <symbol id={"i-flip-v"} viewBox={"0 0 24 24"}>
          <path d={"M3 12h18M7 8l5-5 5 5zM7 16l5 5 5-5z"} />
        </symbol>
        {" "}
        <symbol id={"i-hand"} viewBox={"0 0 24 24"}>
          <path
            d={"M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v7M10 10.5V6a2 2 0 0 0-4 0v9l-2.5-2.5a2 2 0 0 0-3 2.6L6.5 21h10a4 4 0 0 0 4-4v-4a2 2 0 0 0-4 0"}
          />
        </symbol>
        {" "}
        <symbol id={"i-measure"} viewBox={"0 0 24 24"}>
          <path d={"M3 17 17 3l4 4L7 21z"} />
          <path d={"M7 13l2 2M10 10l2 2M13 7l2 2"} />
        </symbol>
      </defs>
    </svg>
  </>
 );
}
