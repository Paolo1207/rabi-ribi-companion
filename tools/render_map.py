
import json
import sys
from pathlib import Path
from PIL import Image

# Project paths
PROJECT_DIR = Path(__file__).resolve().parent.parent
CONVERTER_DIR = Path(r"C:\Users\Admin\Desktop\rabi-ribi-converter")

TILESET_FILE = Path(
    r"C:\Users\Admin\Desktop\rabiribi-tilesets\TILE1_A.png"
)

# Map settings
TILE_SIZE = 32
TILESET_COLUMNS = 30

# Visual layer drawing order
LAYER_ORDER = [
    "tiles0",
    "tiles3",
    "tiles4",
    "tiles1",
    "tiles5",
    "tiles6",
    "tiles2",
]


def main():
    # Read area number from command line (default: 0)
    area_number = int(sys.argv[1]) if len(sys.argv) > 1 else 0

    if area_number < 0:
        raise ValueError("Area number cannot be negative.")

    MAP_FILE = (
        CONVERTER_DIR
        / "s2_editable_maps"
        / f"area{area_number}.json"
    )

    # Area 1 test JSON is stored separately for now
    if area_number == 1:
        test_map = CONVERTER_DIR / "area1_test_output" / "area1.json"
        if test_map.exists():
            MAP_FILE = test_map

    OUTPUT_FILE = PROJECT_DIR / "public" / "maps" / f"area{area_number}.png"
    TEST_OUTPUT_FILE = PROJECT_DIR / "public" / "maps" / f"area{area_number}_test.png"

    if not MAP_FILE.exists():
        raise FileNotFoundError(f"Map JSON not found: {MAP_FILE}")

    with open(MAP_FILE, "r", encoding="utf-8") as file:
        map_data = json.load(file)

    tileset = Image.open(TILESET_FILE).convert("RGBA")

    width = map_data["width"]
    height = map_data["height"]

    output = Image.new(
        "RGBA",
        (width * TILE_SIZE, height * TILE_SIZE),
        (0, 0, 0, 0),
    )

    layers = {
        layer["name"]: layer
        for layer in map_data["layers"]
        if layer["type"] == "tilelayer"
    }

    for layer_name in LAYER_ORDER:
        layer = layers.get(layer_name)

        if layer is None or not layer.get("visible", True):
            continue

        print(f"Rendering {layer_name}...")

        for index, raw_gid in enumerate(layer["data"]):
            gid = raw_gid & 0x1FFFFFFF

            if gid == 0:
                continue

            tile_index = gid - 1
            column = tile_index % TILESET_COLUMNS
            row = tile_index // TILESET_COLUMNS

            left = column * TILE_SIZE
            top = row * TILE_SIZE

            tile = tileset.crop((
                left,
                top,
                left + TILE_SIZE,
                top + TILE_SIZE,
            ))

            # Tiled flip flags
            flip_horizontal = bool(raw_gid & 0x80000000)
            flip_vertical = bool(raw_gid & 0x40000000)
            flip_diagonal = bool(raw_gid & 0x20000000)

            if flip_diagonal:
                tile = tile.transpose(Image.Transpose.TRANSPOSE)

            if flip_horizontal:
                tile = tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)

            if flip_vertical:
                tile = tile.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

            x = (index % width) * TILE_SIZE
            y = (index // width) * TILE_SIZE

            output.alpha_composite(tile, (x, y))

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Preserve full-resolution render for testing
    output.save(TEST_OUTPUT_FILE)

    # Flatten transparent pixels against black
    black_background = Image.new(
        "RGBA",
        output.size,
        (0, 0, 0, 255),
    )

    flattened = Image.alpha_composite(
        black_background,
        output,
    ).convert("RGB")

    # Resize to production dimensions
    final_image = flattened.resize(
        (2000, 800),
        Image.Resampling.NEAREST,
    )

    final_image.save(OUTPUT_FILE)

    print(f"\nFinished rendering Area {area_number}!")
    print(f"Production image: {OUTPUT_FILE}")
    print(f"Test image: {TEST_OUTPUT_FILE}")
    print(f"Dimensions: {output.width} x {output.height}")


if __name__ == "__main__":
    main()
