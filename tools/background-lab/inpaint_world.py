from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw

SOURCE = Path(os.environ["SOURCE_IMAGE"])
OUT = Path(os.environ.get("OUTPUT_DIR", "artifacts/world-background-mask-qa"))
OUT.mkdir(parents=True, exist_ok=True)

# Coordinates are normalized to the full 1536x1024 reference canvas.
# The left phone and right desktop are segmented independently.
# Polygons follow visible UI silhouettes; they intentionally avoid broad
# rectangular sweeps across the illustrated landscape.
PHONE_UI = [
    {"name": "phone-status-island", "points": [(0.035,0.025),(0.295,0.025),(0.305,0.075),(0.285,0.095),(0.055,0.095),(0.035,0.075)]},
    {"name": "phone-brand-and-gems", "points": [(0.035,0.095),(0.300,0.095),(0.300,0.160),(0.275,0.185),(0.055,0.185),(0.035,0.155)]},
    {"name": "phone-profile-panel", "points": [(0.040,0.168),(0.286,0.168),(0.294,0.235),(0.280,0.255),(0.050,0.255),(0.035,0.235)]},
    {"name": "phone-chapter-scroll", "points": [(0.035,0.258),(0.292,0.258),(0.292,0.350),(0.275,0.365),(0.050,0.365),(0.035,0.345)]},
    {"name": "phone-boss-badge-and-label", "points": [(0.145,0.360),(0.290,0.360),(0.290,0.455),(0.270,0.475),(0.185,0.475),(0.145,0.445)]},
    {"name": "phone-speech-bubble", "points": [(0.045,0.425),(0.145,0.425),(0.160,0.455),(0.145,0.480),(0.075,0.480),(0.045,0.465)]},
    {"name": "phone-character", "points": [(0.045,0.495),(0.170,0.495),(0.190,0.535),(0.185,0.690),(0.170,0.755),(0.145,0.780),(0.055,0.780),(0.035,0.735),(0.035,0.555)]},
    {"name": "phone-quest-lock-one-and-label", "points": [(0.135,0.485),(0.290,0.485),(0.290,0.580),(0.270,0.600),(0.155,0.600),(0.135,0.575)]},
    {"name": "phone-quest-lock-two-and-label", "points": [(0.130,0.590),(0.290,0.590),(0.290,0.690),(0.270,0.710),(0.145,0.710),(0.125,0.685)]},
    {"name": "phone-quest-open-node-and-label", "points": [(0.115,0.680),(0.290,0.680),(0.290,0.775),(0.270,0.790),(0.135,0.790),(0.115,0.765)]},
    {"name": "phone-start-quest-button", "points": [(0.052,0.780),(0.290,0.780),(0.300,0.835),(0.285,0.855),(0.060,0.855),(0.045,0.835)]},
    {"name": "phone-daily-challenge-card", "points": [(0.045,0.858),(0.290,0.858),(0.295,0.915),(0.280,0.930),(0.055,0.930),(0.040,0.910)]},
    {"name": "phone-bottom-navigation", "points": [(0.020,0.925),(0.305,0.925),(0.310,0.985),(0.290,1.000),(0.030,1.000),(0.015,0.980)]},
]

DESKTOP_UI = [
    {"name": "desktop-brand-sidebar", "points": [(0.320,0.035),(0.430,0.035),(0.435,0.205),(0.420,0.225),(0.325,0.225),(0.315,0.205)]},
    {"name": "desktop-left-navigation", "points": [(0.320,0.215),(0.430,0.215),(0.435,0.600),(0.420,0.620),(0.325,0.620),(0.315,0.600)]},
    {"name": "desktop-top-player-hud", "points": [(0.730,0.030),(0.975,0.030),(0.990,0.055),(0.990,0.105),(0.975,0.125),(0.735,0.125),(0.720,0.105)]},
    {"name": "desktop-chapter-scroll", "points": [(0.445,0.145),(0.780,0.145),(0.790,0.165),(0.780,0.230),(0.760,0.245),(0.460,0.245),(0.440,0.225)]},
    {"name": "desktop-character-and-speech", "points": [(0.455,0.335),(0.585,0.335),(0.605,0.375),(0.600,0.650),(0.585,0.690),(0.475,0.690),(0.450,0.655),(0.445,0.390)]},
    {"name": "desktop-quest-star-node", "points": [(0.685,0.510),(0.735,0.510),(0.750,0.550),(0.740,0.590),(0.695,0.590),(0.680,0.555)]},
    {"name": "desktop-quest-star-label", "points": [(0.650,0.555),(0.770,0.555),(0.775,0.615),(0.755,0.635),(0.660,0.635),(0.645,0.615)]},
    {"name": "desktop-quest-lock-mid", "points": [(0.670,0.360),(0.720,0.360),(0.735,0.405),(0.720,0.445),(0.675,0.445),(0.660,0.405)]},
    {"name": "desktop-quest-lock-mid-label", "points": [(0.720,0.390),(0.805,0.390),(0.810,0.465),(0.795,0.485),(0.725,0.485),(0.710,0.465)]},
    {"name": "desktop-quest-lock-low", "points": [(0.590,0.500),(0.640,0.500),(0.655,0.545),(0.640,0.585),(0.595,0.585),(0.580,0.545)]},
    {"name": "desktop-quest-lock-low-label", "points": [(0.640,0.515),(0.735,0.515),(0.740,0.580),(0.725,0.600),(0.645,0.600),(0.630,0.580)]},
    {"name": "desktop-boss-crown-and-label", "points": [(0.835,0.220),(0.925,0.220),(0.940,0.265),(0.935,0.365),(0.915,0.385),(0.840,0.385),(0.820,0.360)]},
    {"name": "desktop-daily-challenge-card", "points": [(0.830,0.485),(0.975,0.485),(0.985,0.510),(0.985,0.665),(0.965,0.685),(0.845,0.685),(0.825,0.665)]},
    {"name": "desktop-start-quest-button", "points": [(0.590,0.665),(0.820,0.665),(0.835,0.690),(0.830,0.735),(0.810,0.750),(0.600,0.750),(0.580,0.730)]},
    {"name": "desktop-bottom-xp-card", "points": [(0.450,0.750),(0.665,0.750),(0.680,0.775),(0.675,0.855),(0.655,0.875),(0.465,0.875),(0.445,0.855)]},
    {"name": "desktop-bottom-streak-card", "points": [(0.675,0.750),(0.800,0.750),(0.815,0.775),(0.810,0.855),(0.795,0.875),(0.690,0.875),(0.670,0.855)]},
    {"name": "desktop-bottom-gems-card", "points": [(0.805,0.750),(0.955,0.750),(0.970,0.775),(0.965,0.855),(0.950,0.875),(0.820,0.875),(0.800,0.855)]},
    {"name": "desktop-achievements-panel", "points": [(0.390,0.875),(0.975,0.875),(0.990,0.900),(0.990,0.975),(0.970,0.995),(0.405,0.995),(0.385,0.975)]},
]

# Protected landmarks are drawn after removal polygons and therefore win on overlap.
# They are deliberately conservative scenic anchors, not a claim of semantic segmentation.
PROTECTED_SCENERY = [
    {"name": "castle-and-skyline-right", "points": [(0.735,0.125),(0.985,0.125),(0.985,0.340),(0.955,0.355),(0.900,0.330),(0.850,0.350),(0.790,0.315),(0.735,0.270)]},
    {"name": "distant-castle-center", "points": [(0.635,0.035),(0.735,0.035),(0.755,0.135),(0.725,0.155),(0.650,0.145),(0.625,0.105)]},
    {"name": "mountains-and-waterfalls-mid", "points": [(0.445,0.245),(0.825,0.245),(0.850,0.465),(0.790,0.520),(0.730,0.500),(0.660,0.535),(0.600,0.500),(0.535,0.530),(0.445,0.475)]},
    {"name": "foreground-cliffs-and-trees", "points": [(0.315,0.600),(0.445,0.600),(0.455,0.745),(0.440,0.875),(0.315,0.875)]},
    {"name": "phone-scenery-gaps", "points": [(0.020,0.365),(0.310,0.365),(0.310,0.425),(0.020,0.425)]},
]

def polygon_mask(size: tuple[int, int], regions: list[dict]) -> Image.Image:
    layer = Image.new("L", size, 0)
    draw = ImageDraw.Draw(layer)
    width, height = size
    for region in regions:
        points = [(round(x * width), round(y * height)) for x, y in region["points"]]
        draw.polygon(points, fill=255)
    return layer

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("mask-qa", "inpaint"), required=True)
    args = parser.parse_args()

    image = Image.open(SOURCE).convert("RGB")
    size = image.size
    if size != (1536, 1024):
        raise SystemExit(f"Unexpected source dimensions {size}; polygon map was authored for 1536x1024.")

    removal_regions = PHONE_UI + DESKTOP_UI
    removal = polygon_mask(size, removal_regions)
    protected = polygon_mask(size, PROTECTED_SCENERY)

    # Scenic protection has precedence over UI removal.
    mask = Image.eval(removal, lambda p: p)
    mask.paste(0, mask=protected)

    # Red = remove/inpaint; green = protected scenery; amber = split boundary.
    overlay = image.convert("RGBA")
    tint = Image.new("RGBA", size, (0, 0, 0, 0))
    tint_pixels = tint.load()
    mask_pixels = mask.load()
    protected_pixels = protected.load()
    for y in range(size[1]):
        for x in range(size[0]):
            if mask_pixels[x, y]:
                tint_pixels[x, y] = (255, 45, 65, 112)
            elif protected_pixels[x, y]:
                tint_pixels[x, y] = (35, 220, 125, 82)
    overlay = Image.alpha_composite(overlay, tint)
    draw = ImageDraw.Draw(overlay)
    split_x = round(0.315 * size[0])
    draw.line((split_x, 0, split_x, size[1]), fill=(255, 210, 70, 255), width=3)
    draw.text((12, 8), "PHONE ZONE", fill=(255, 235, 150, 255), stroke_width=2, stroke_fill=(20, 20, 40, 220))
    draw.text((split_x + 12, 8), "DESKTOP ZONE", fill=(255, 235, 150, 255), stroke_width=2, stroke_fill=(20, 20, 40, 220))

    image.save(OUT / "source-preview.jpg", quality=94)
    mask.save(OUT / "mask-preview.png")
    overlay.convert("RGB").save(OUT / "overlay-preview.jpg", quality=94)

    coverage = sum(mask.histogram()[1:]) / (size[0] * size[1])
    protected_coverage = sum(protected.histogram()[1:]) / (size[0] * size[1])
    metadata = {
        "source": str(SOURCE),
        "image_size": list(size),
        "mask_coverage": round(coverage, 5),
        "protected_coverage": round(protected_coverage, 5),
        "split": {"phone": [0.0, 0.0, 0.315, 1.0], "desktop": [0.315, 0.0, 1.0, 1.0]},
        "removal_regions": [{"name": r["name"], "polygon": r["points"]} for r in removal_regions],
        "protected_regions": [{"name": r["name"], "polygon": r["points"]} for r in PROTECTED_SCENERY],
        "legend": {"red": "selected for removal/inpainting", "green": "protected scenic region", "amber_line": "phone/desktop split"},
        "stage": args.stage,
        "review_required": True,
        "note": "Polygon mask preview only. Review overlay-preview.jpg and mask-preview.png; LaMa must not run until explicit approval.",
    }
    (OUT / "mask-regions.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(f"Source: {SOURCE} ({size[0]}x{size[1]})")
    print(f"Removal mask coverage: {coverage:.1%}; protected scenery coverage: {protected_coverage:.1%}")
    print(f"Polygon regions: {len(removal_regions)} removal, {len(PROTECTED_SCENERY)} protected")
    print(f"Mask QA outputs written to: {OUT}")

    if args.stage == "mask-qa":
        print("Mask QA stage complete; LaMa was not imported or executed.")
        return

    if os.environ.get("MASK_APPROVED", "").lower() != "yes":
        raise SystemExit("Inpainting blocked: set MASK_APPROVED=yes only after reviewing and approving the mask artifact.")
    from simple_lama_inpainting import SimpleLama
    result = SimpleLama()(image, mask)
    result.save(OUT / "world-background-inpainted.png")
    print(f"Inpainted result written to: {OUT / 'world-background-inpainted.png'}")

if __name__ == "__main__":
    main()
