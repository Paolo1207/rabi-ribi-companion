// Room-grid geometry for the Interactive World Map.
//
// Verified (save3.sav + area0.map + the rendered areaN.png files):
//   * every area is a 25 x 18 grid of rooms
//   * the same index is used by the save file and by `roomtype` in the .map files:
//       index = rx * ROOMS_Y + ry
//   * a room is 20 x 11.25 tiles, so in the 4 px/tile world images (2000 x 800)
//     every room is exactly 80 x 45 px and starts at (rx * 80, ry * 45)
//   * 18 rows * 45 px = 810 px, but the image is 800 px tall, so the last room
//     row (ry = 17) is only 35 px tall.

export const ROOMS_X = 25;
export const ROOMS_Y = 18;

export const WORLD_IMAGE_WIDTH = 2000;
export const WORLD_IMAGE_HEIGHT = 800;
export const ROOM_PX_W = 80;
export const ROOM_PX_H = 45;

export type RoomRect = { x: number; y: number; w: number; h: number };
export type RoomId = { rx: number; ry: number };

export function roomIndex(rx: number, ry: number): number {
  return rx * ROOMS_Y + ry;
}

/** Pixel rectangle of a room inside the 2000 x 800 world image. */
export function roomRect(rx: number, ry: number): RoomRect {
  const x = rx * ROOM_PX_W;
  const y = ry * ROOM_PX_H;
  return { x, y, w: ROOM_PX_W, h: Math.min(ROOM_PX_H, WORLD_IMAGE_HEIGHT - y) };
}

/** Room under a pixel position of the world image, or null when outside the grid. */
export function roomAt(x: number, y: number): RoomId | null {
  if (x < 0 || y < 0 || x >= WORLD_IMAGE_WIDTH || y >= WORLD_IMAGE_HEIGHT) {
    return null;
  }
  const rx = Math.floor(x / ROOM_PX_W);
  const ry = Math.floor(y / ROOM_PX_H);
  if (rx >= ROOMS_X || ry >= ROOMS_Y) return null;
  return { rx, ry };
}

/**
 * HYPOTHESIS (supported by the data, not proven by the game): a nonzero save
 * value means the room was discovered. The extra bits (3, 7, 13, 15) are
 * deliberately ignored until they are verified.
 */
export function isDiscovered(value: number | undefined): boolean {
  return value !== undefined && value !== 0;
}
