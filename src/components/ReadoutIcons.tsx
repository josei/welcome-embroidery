// The sprite for the phone and tablet status readouts: thread length, colours used, colour changes, trims, the stitch
// count and the sewing-tip chip. Each has its own drawing so no two readouts share a glyph. Rendered beside EditorIcons; the ids are unique.
export function ReadoutIcons() {
 return (
  <svg className={"icon-defs"} aria-hidden={"true"} focusable={"false"}>
    <defs>
        <symbol id={"i-spool"} viewBox={"0 0 24 24"}>
          <rect x={"4"} y={"3"} width={"16"} height={"2.5"} rx={"1"} />
          <rect x={"4"} y={"18.5"} width={"16"} height={"2.5"} rx={"1"} />
          <path d={"M7.5 5.5v13M16.5 5.5v13M7.5 9.5h9M7.5 14.5h9M16.5 14.5c2 0 2.5 1.5 1.5 3"} />
        </symbol>
        {" "}
        <symbol id={"i-colours"} viewBox={"0 0 24 24"}>
          <circle cx={"9"} cy={"9.5"} r={"4.5"} />
          <circle cx={"15"} cy={"9.5"} r={"4.5"} />
          <circle cx={"12"} cy={"14.5"} r={"4.5"} />
        </symbol>
        {" "}
        <symbol id={"i-swap"} viewBox={"0 0 24 24"}>
          <path d={"M4 8h13l-3-3M20 16H7l3 3"} />
        </symbol>
        {" "}
        <symbol id={"i-scissors"} viewBox={"0 0 24 24"}>
          <circle cx={"6"} cy={"6"} r={"2.5"} />
          <circle cx={"6"} cy={"18"} r={"2.5"} />
          <path d={"M8 8l12 10M8 16L20 6"} />
        </symbol>
        {" "}
        <symbol id={"i-needle"} viewBox={"0 0 24 24"}>
          <path transform={"translate(-1.4 0)"}  d={"M12 21.5V8"} />
          <ellipse transform={"translate(-1.4 0)"}  cx={"12"} cy={"5.5"} rx={"2.2"} ry={"3"} />
          <path transform={"translate(-1.4 0)"}  d={"M12 8c3.5 0 5 1.8 5 4.2S15 16 12 16"} />
        </symbol>
        {" "}
        <symbol id={"i-tip"} viewBox={"0 0 24 24"}>
          <path d={"M8.5 14.5C7 13.3 6.5 11.5 6.5 10a5.5 5.5 0 0 1 11 0c0 1.5-.5 3.3-2 4.5-.6.5-1 1.2-1 2h-5c0-.8-.4-1.5-1-2zM9.5 20h5"} />
        </symbol>
    </defs>
  </svg>
 );
}
