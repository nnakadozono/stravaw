#!/usr/bin/env python3
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "dist" / "lambda" / "stravaw-sync.zip"
INCLUDE = [
    ROOT / "scripts" / "aggregate.py",
    ROOT / "scripts" / "aws_sync_lambda.py",
    ROOT / "scripts" / "strava_sync.py",
]


def main() -> int:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUTPUT_PATH, "w", compression=zipfile.ZIP_DEFLATED) as package:
        for path in INCLUDE:
            package.write(path, path.relative_to(ROOT))
    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
