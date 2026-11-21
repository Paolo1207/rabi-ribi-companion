// Small hand-drawn 12x12 pixel-art icons.
//   "#" = current text colour    "o" = accent colour (--icon-accent)    "." = empty
// Each icon is rendered as two merged SVG paths, so it stays crisp at any size.

export type PixelIconName =
  | "home"
  | "game"
  | "book"
  | "clock"
  | "note"
  | "settings"
  | "star"
  | "heart"
  | "carrot"
  | "bunny"
  | "hourglass"
  | "cursor";

const ART: Record<PixelIconName, string[]> = {
  home: [
    ".....##.....",
    "....####....",
    "...######...",
    "..########..",
    ".##########.",
    "############",
    "..########..",
    "..###oo###..",
    "..###oo###..",
    "..###oo###..",
    "..########..",
    "............",
  ],
  game: [
    "............",
    "............",
    ".##########.",
    "############",
    "###o#####o##",
    "##ooo###o#o#",
    "###o#####o##",
    "..###..###..",
    "............",
    "............",
    "............",
    "............",
  ],
  book: [
    "............",
    "##########..",
    "###ooooo###.",
    "###ooooo###.",
    "###ooooo###.",
    "############",
    "#oooooooooo#",
    "#oooooooooo#",
    "#oooooooooo#",
    "#oooooooooo#",
    "############",
    "............",
  ],
  clock: [
    "............",
    "...######...",
    "..########..",
    ".####oo####.",
    "#####oo#####",
    "#####oo#####",
    "#####ooooo##",
    "############",
    ".##########.",
    "..########..",
    "...######...",
    "............",
  ],
  note: [
    "............",
    ".##########.",
    ".#........#.",
    ".#.oooooo.#.",
    ".#........#.",
    ".#.oooooo.#.",
    ".#........#.",
    ".#.oooo...#.",
    ".#........#.",
    ".##########.",
    "............",
    "............",
  ],
  settings: [
    ".....##.....",
    ".##.####.##.",
    ".##########.",
    "..###..###..",
    "####....####",
    "####....####",
    "..###..###..",
    ".##########.",
    ".##.####.##.",
    ".....##.....",
    "............",
    "............",
  ],
  star: [
    ".....##.....",
    ".....##.....",
    "....####....",
    "############",
    ".##########.",
    "..########..",
    "..########..",
    ".####..####.",
    ".###....###.",
    ".#........#.",
    "............",
    "............",
  ],
  heart: [
    "............",
    ".###....###.",
    "#o###..#####",
    "############",
    "############",
    ".##########.",
    "..########..",
    "...######...",
    "....####....",
    ".....##.....",
    "............",
    "............",
  ],
  carrot: [
    "........o.o.",
    ".......ooo..",
    ".....#####..",
    "....######..",
    "...######...",
    "..######....",
    ".######.....",
    ".#####......",
    "#####.......",
    "###.........",
    "............",
    "............",
  ],
  bunny: [
    "..##....##..",
    "..##....##..",
    "..##....##..",
    "..##....##..",
    "..########..",
    ".##########.",
    ".##o####o##.",
    ".##########.",
    ".###.oo.###.",
    "..########..",
    "............",
    "............",
  ],
  hourglass: [
    ".##########.",
    "..#oooooo#..",
    "...#oooo#...",
    "....#oo#....",
    ".....##.....",
    ".....##.....",
    "....#..#....",
    "...#oooo#...",
    "..#oooooo#..",
    ".##########.",
    "............",
    "............",
  ],
  cursor: [
    "............",
    "##..........",
    "####........",
    "######......",
    "########....",
    "##########..",
    "########....",
    "######......",
    "####........",
    "##..........",
    "............",
    "............",
  ],
};

// Merge horizontal runs of the same colour into single path segments.
function buildPaths(rows: string[]): { main: string; accent: string } {
  let main = "";
  let accent = "";

  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      if (char !== "#" && char !== "o") {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] === char) end += 1;
      const segment = `M${x} ${y}h${end - x}v1h-${end - x}z`;
      if (char === "#") main += segment;
      else accent += segment;
      x = end;
    }
  });

  return { main, accent };
}

const PATHS = Object.fromEntries(
  (Object.keys(ART) as PixelIconName[]).map((name) => [name, buildPaths(ART[name])])
) as Record<PixelIconName, { main: string; accent: string }>;

export function PixelIcon({
  name,
  className = "",
}: {
  name: PixelIconName;
  className?: string;
}) {
  const { main, accent } = PATHS[name];

  return (
    <svg
      className={`px-icon ${className}`.trim()}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <path d={main} fill="currentColor" />
      <path d={accent} fill="var(--icon-accent, currentColor)" />
    </svg>
  );
}
