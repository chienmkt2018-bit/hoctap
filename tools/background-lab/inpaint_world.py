from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from simple_lama_inpainting import SimpleLama

SOURCE = Path(os.environ["SOURCE_IMAGE"])
OUT = Path(os.environ.get("OUTPUT_DIR", "artifacts/world-background-experiment"))
OUT.mkdir(parents=True, exist_ok=True)

# Coordinates are normalized (0..1) so the mask scales to the uploaded image.
# These are intentionally conservative first-pass regions; inspect mask-preview.png
# before treating the inpainted image as a usable background.
REGIONS = [
    # Shared top bars / headings in both mockup panels
    {"name": "top-overlay", "box": [0.00, 0.00, 1.00, 0.115]},
    # Mobile device: lower navigation, labels and quest cards
    {"name": "mobile-bottom-ui", "box": [0.00, 0.805, 0.335, 1.00]},
    # Desktop: lower quest / information panel
    {"name": "desktop-bottom-ui", "box": [0.56, 0.815, 1.00, 1.00]},
    # Desktop right-side text / controls area
    {"name": "desktop-right-ui", "box": [0.865, 0.12, 1.00, 0.82]},
]

image = Image.open(SOURCE).convert("RGB")
width, height = image.size
mask = Image.new("L", (width, height), 0)
draw = ImageDraw.Draw(mask)

for region in REGIONS:
    x0, y0, x1, y1 = region["box"]
    draw.rectangle(
        (
            round(x0 * width),
            round(y0 * height),
            round(x1 * width),
            round(y1 * height),
        ),
        fill=255,
    )

# A small dilation reduces text/UI edge halos without expanding the mask excessively.
from PIL import ImageFilter
mask = mask.filter(ImageFilter.MaxFilter( nine := 9 ))

image.save(OUT / "source-preview.jpg", quality=92)
mask.save(OUT / "mask-preview.png")
(OUT / "mask-regions.json").write_text(
    json.dumps(
        {
            "source": str(SOURCE),
            "image_size": [width, height],
            "regions": REGIONS,
            "note": "Approximate first-pass overlay masks. Adjust REGIONS after reviewing mask-preview.png.",
        },
        indent=2,
    ),
    encoding="utf-8",
)

lama = SimpleLama()
result = lama(image, mask)
result.save(OUT / "world-background-inpainted.png")

print(f"Source: {SOURCE} ({width}x{height})")
print(f"Mask coverage: {np.asarray(mask).mean() / 255:.1%}")
print(f"Outputs written to: {OUT}")
