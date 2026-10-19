// Janome JEF thread chart colors, ported from pinned Ink/Stitch pystitch.
const colors = [
  [1, 0x000000], // Black
  [2, 0xffffff], // White
  [3, 0xffff17], // Yellow
  [4, 0xff6600], // Orange
  [5, 0x2f5933], // Olive Green
  [6, 0x237336], // Green
  [7, 0x65c2c8], // Sky
  [8, 0xab5a96], // Purple
  [9, 0xf669a0], // Pink
  [10, 0xff0000], // Red
  [11, 0xb1704e], // Brown
  [12, 0x0b2f84], // Blue
  [13, 0xe4c35d], // Gold
  [14, 0x481a05], // Dark Brown
  [15, 0xac9cc7], // Pale Violet
  [16, 0xfcf294], // Pale Yellow
  [17, 0xf999b7], // Pale Pink
  [18, 0xfab381], // Peach
  [19, 0xc9a480], // Beige
  [20, 0x970533], // Wine Red
  [21, 0xa0b8cc], // Pale Sky
  [22, 0x7fc21c], // Yellow Green
  [23, 0xe5e5e5], // Silver Gray
  [24, 0x889b9b], // Gray
  [25, 0x98d6bd], // Pale Aqua
  [26, 0xb2e1e3], // Baby Blue
  [27, 0x368ba0], // Powder Blue
  [28, 0x4f83ab], // Bright Blue
  [29, 0x386a91], // Slate Blue
  [30, 0x071650], // Navy Blue
  [31, 0xf999a2], // Salmon Pink
  [32, 0xf9676b], // Coral
  [33, 0xe3311f], // Burnt Orange
  [34, 0xe2a188], // Cinnamon
  [35, 0xb59474], // Umber
  [36, 0xe4cf99], // Blond
  [37, 0xffcb00], // Sunflower
  [38, 0xe1add4], // Orchid Pink
  [39, 0xc3007e], // Peony Purple
  [40, 0x80004b], // Burgundy
  [41, 0x540571], // Royal Purple
  [42, 0xb10525], // Cardinal Red
  [43, 0xcae0c0], // Opal Green
  [44, 0x899856], // Moss Green
  [45, 0x5c941a], // Meadow Green
  [46, 0x003114], // Dark Green
  [47, 0x5dae94], // Aquamarine
  [48, 0x4cbf8f], // Emerald Green
  [49, 0x007772], // Peacock Green
  [50, 0x595b61], // Dark Gray
  [51, 0xfffff2], // Ivory White
  [52, 0xb15818], // Hazel
  [53, 0xcb8a07], // Toast
  [54, 0x986c80], // Salmon
  [55, 0x98692d], // Cocoa Brown
  [56, 0x4d3419], // Sienna
  [57, 0x4c330b], // Sepia
  [58, 0x33200a], // Dark Sepia
  [59, 0x523a97], // Violet Blue
  [60, 0x0d217e], // Blue Ink
  [61, 0x1e77ac], // Sola Blue
  [62, 0xb2dd53], // Green Dust
  [63, 0xf33689], // Crimson
  [64, 0xde649e], // Floral Pink
  [65, 0x984161], // Wine
  [66, 0x4c5612], // Olive Drab
  [67, 0x4c881f], // Meadow
  [68, 0xe4de79], // Mustard
  [69, 0xcb8a1a], // Yellow Ocher
  [70, 0xcba21c], // Old Gold
  [71, 0xff9805], // Honey Dew
  [72, 0xfcb257], // Tangerine
  [73, 0xffe505], // Canary Yellow
  [74, 0xf0331f], // Vermilion
  [75, 0x1a842d], // Bright Green
  [76, 0x386cae], // Ocean Blue
  [77, 0xe3c4b4], // Beige Gray
  [78, 0xe3ac81], // Bamboo
];
const distance=(a,b)=>((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2);
export function nearestJefColor(hex){const rgb=hex.match(/[0-9a-f]{2}/gi)?.map(x=>parseInt(x,16))||[0,0,0];let best=colors[0],score=Infinity;for(const [index,c] of colors){const next=distance(rgb,[(c>>16)&255,(c>>8)&255,c&255]);if(next<score){best=[index,c];score=next;}}return best[0];}
