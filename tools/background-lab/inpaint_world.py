from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SOURCE = Path(os.environ["SOURCE_IMAGE"])
OUT = Path(os.environ.get("OUTPUT_DIR", "artifacts/world-background-experiment"))
OUT.mkdir(parents=True, exist_ok=True)

REGIONS = [
    {"name": "top-overlay", "box": [0.00, 0.00, 1.00, 0.115]},
    {"name": "mobile-bottom-ui", "box": [0.00, 0.805, 0.335, 1.00]},
    {"name": "desktop-bottom-ui", "box": [0.56, 0.815, 1.00, 1.00]},
    {"name": "desktop-right-ui", "box": [0.865, 0.12, 1.00, 0.82]},
]

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("mask-qa", "inpaint"), required=True)
    args = parser.parse_args()

    image = Image.open(SOURCE).convert("RGB")
    width, height = image.size
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)

    for region in REGIONS:
        x0, y0, x1, y1 = region["box"]
        draw.rectangle(
            (round(x0 * width), round(y0 * height),
             round(x1 * width), round(y1 * height)),
            fill=255,
        )

    mask = mask.filter(ImageFilter.MaxFilter(9))
    image.save(OUT / "source-preview.jpg", quality=92)
    mask.save(OUT / "mask-preview.png")

    coverage = sum(mask.histogram()[1:]) / (width * height)
    metadata = {
        "source": str(SOURCE),
        "image_size": [width, height],
        "mask_coverage": round(coverage, 5),
        "regions": REGIONS,
        "stage": args.stage,
        "note": "Review mask-preview.png against source-preview.jpg. White pixels are selected for removal/inpainting.",
    }
    (OUT / "mask-regions.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    print(f"Source: {SOURCE} ({width}x{height})")
    print(f"Mask coverage: {coverage:.1%}")
    print(f"Mask QA outputs written to: {OUT}")

    if args.stage == "mask-qa":
        print("Mask QA stage complete; LaMa was not imported or executed.")
        return

    if os.environ.get("MASK_APPROVED", "").lower() != "yes":
        raise SystemExit("Inpainting blocked: set MASK_APPROVED=yes only after reviewing the mask artifact.")

    from simple_lama_inpainting import SimpleLama

    result = SimpleLama()(image, mask)
    result.save(OUT / "world-background-inpainted.png")
    print(f"Inpainted result written to: {OUT / 'world-background-inpainted.png'}")

if __name__ == "__main__":
    main()
