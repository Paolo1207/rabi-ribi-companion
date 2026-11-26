
import struct

path = r"C:\Program Files (x86)\Steam\steamapps\common\Rabi-Ribi\data\area\area0.map"

with open(path, "rb") as f:
    data = f.read()

offsets = {
    "tiles0": 602704,
    "tiles1": 802704,
    "tiles2": 1002704,
    "tiles3": 1202704,
    "tiles4": 1402704,
    "tiles5": 1602704,
}

for name, offset in offsets.items():
    values = struct.unpack_from("<100000h", data, offset)
    print(f"\n{name}")

    for index, value in enumerate(values):
        if value != 0:
            print(
                f"Index: {index}, "
                f"X: {index % 500}, "
                f"Y: {index // 500}, "
                f"Value: {value}"
            )

            if index > 0:
                break
