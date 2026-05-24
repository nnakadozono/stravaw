#!/usr/bin/env python3
from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "apple-touch-icon.png"
SIZE = 180

GREEN = (103, 193, 93, 255)
BLUE = (86, 183, 230, 255)
RED = (234, 120, 100, 255)


def main() -> int:
    pixels = bytearray()
    for y in range(SIZE):
        pixels.append(0)
        for x in range(SIZE):
            nx = x / (SIZE - 1)
            ny = y / (SIZE - 1)
            pixels.extend(color_for(nx, ny))

    OUTPUT.write_bytes(png_bytes(SIZE, SIZE, bytes(pixels)))
    print(f"Wrote {OUTPUT.relative_to(ROOT)}")
    return 0


def color_for(x: float, y: float) -> tuple[int, int, int, int]:
    if y >= 0.5 + abs(x - 0.5):
        return RED
    if x < 0.5:
        return GREEN
    return BLUE


def png_bytes(width: int, height: int, raw_scanlines: bytes) -> bytes:
    signature = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    compressed = zlib.compress(raw_scanlines, level=9)
    return signature + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")


def chunk(kind: bytes, data: bytes) -> bytes:
    checksum = zlib.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


if __name__ == "__main__":
    raise SystemExit(main())
