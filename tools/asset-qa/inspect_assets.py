from pathlib import Path
from collections import defaultdict
from PIL import Image, ImageDraw, ImageFont
import csv, hashlib, os, sys

root = Path("frontend/public/assets/incoming")
out = Path("asset-qa")
out.mkdir(parents=True, exist_ok=True)
supported = {".png", ".webp", ".jpg", ".jpeg"}
files = sorted((p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in supported), key=lambda p: p.as_posix().lower())
rows, errors, hashes, previews = [], [], defaultdict(list), []

for path in files:
    rel = path.as_posix()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    hashes[digest].append(rel)
    try:
        with Image.open(path) as im:
            im.verify()
        with Image.open(path) as im:
            rgba = im.convert("RGBA")
            hist = rgba.getchannel("A").histogram()
            total = im.width * im.height
            magenta = sum(1 for r,g,b,a in rgba.getdata() if r >= 200 and g <= 80 and b >= 200 and a > 0)
            rows.append({
                "file": rel, "format": im.format, "width": im.width, "height": im.height,
                "mode": im.mode, "has_alpha_channel": "yes" if "A" in im.getbands() else "no",
                "alpha_transparent_pct": round(hist[0]*100/total,4),
                "alpha_partial_pct": round(sum(hist[1:255])*100/total,4),
                "alpha_opaque_pct": round(hist[255]*100/total,4),
                "magenta_pixels": magenta, "sha256": digest, "status": "PASS", "notes": ""
            })
            thumb = rgba.copy()
            thumb.thumbnail((280,180))
            previews.append((rel,thumb))
    except Exception as exc:
        errors.append(f"{rel}: {type(exc).__name__}: {exc}")
        rows.append({"file":rel,"format":path.suffix.lower(),"width":"","height":"","mode":"",
                     "has_alpha_channel":"","alpha_transparent_pct":"","alpha_partial_pct":"",
                     "alpha_opaque_pct":"","magenta_pixels":"","sha256":digest,"status":"FAIL","notes":str(exc)})

fields = list(rows[0]) if rows else ["file","format","width","height","mode","has_alpha_channel","alpha_transparent_pct","alpha_partial_pct","alpha_opaque_pct","magenta_pixels","sha256","status","notes"]
with (out/"asset-inventory.csv").open("w",newline="",encoding="utf-8") as f:
    w=csv.DictWriter(f,fieldnames=fields); w.writeheader(); w.writerows(rows)

cols,cw,ch,lh=3,320,220,42
sheet=Image.new("RGB",(cols*cw,max(1,(len(previews)+cols-1)//cols)*(ch+lh)),(35,31,48))
draw=ImageDraw.Draw(sheet)
try: font=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",11)
except OSError: font=ImageFont.load_default()
for i,(name,thumb) in enumerate(previews):
    x,y=(i%cols)*cw,(i//cols)*(ch+lh)
    draw.rectangle((x+8,y+8,x+cw-8,y+ch-8),fill=(220,220,220))
    tile=Image.new("RGBA",(cw-24,ch-24),(245,245,245,255)); d=ImageDraw.Draw(tile)
    for yy in range(0,tile.height,16):
        for xx in range(0,tile.width,16):
            if (xx//16+yy//16)%2: d.rectangle((xx,yy,xx+15,yy+15),fill=(205,205,205,255))
    tile.alpha_composite(thumb,((tile.width-thumb.width)//2,(tile.height-thumb.height)//2))
    sheet.paste(tile.convert("RGB"),(x+12,y+12))
    draw.text((x+10,y+ch+8),name[:48],fill="white",font=font)
sheet.save(out/"asset-contact-sheet.png")

duplicates=[v for v in hashes.values() if len(v)>1]
report=[
"# P0.1 — Asset QA report","",
f"- Commit: `{os.environ.get('GITHUB_SHA','unknown')}`",
f"- Branch: `{os.environ.get('GITHUB_REF_NAME','unknown')}`",
f"- Scan root: `{root.as_posix()}`",
f"- Assets discovered: **{len(files)}**",
f"- PNG: **{sum(p.suffix.lower()=='.png' for p in files)}**",
f"- WebP: **{sum(p.suffix.lower()=='.webp' for p in files)}**",
f"- Successfully decoded: **{sum(r['status']=='PASS' for r in rows)}**",
f"- Decode failures: **{len(errors)}**",
"- Original assets are read-only; no source image is edited, renamed, cropped, deleted or re-encoded.",
"",
"## Technical inventory","","See `asset-inventory.csv` for dimensions, format, color mode, alpha distribution, magenta-pixel heuristic and SHA-256.",
"",
"## Byte-identical duplicates",""
]
report += (["- "+"; ".join(f"`{p}`" for p in group) for group in duplicates] if duplicates else ["- None detected by SHA-256."])
report += ["","## Contact sheet","","See `asset-contact-sheet.png`. Transparency is composited over a checkerboard only in the preview; source files remain unchanged.",
"","## Interpretation notes",
"- Alpha percentages describe pixel alpha; they do not establish whether transparency is semantically correct.",
"- Magenta (R ≥ 200, G ≤ 80, B ≥ 200, alpha > 0) is a heuristic flag, not proof of a defect.",
"- Visual matching against `frontend/concept.png` still requires human review; no semantic asset mapping is inferred."]
if errors: report += ["","## Decode failures",""] + [f"- **FAIL:** {e}" for e in errors]
(out/"asset-qa-report.md").write_text("\n".join(report)+"\n",encoding="utf-8")
print(f"ASSETS_DISCOVERED={len(files)}")
print(f"DECODE_FAILURES={len(errors)}")
if not root.exists() or not files or errors: sys.exit(1)
