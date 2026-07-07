---
name: spritesheet-icon-generator
description: Guides the generation, programmatic chroma-key transparentization, and slicing of low-poly 3D game icons from spritesheets.
---

# Spritesheet Icon Generator Skill

This skill documents the process for generating visually consistent low-poly game icons in a single batch spritesheet, transparentizing the background, and programmatically slicing them into standard transparent PNG assets.

## 1. Generation Step (via imagegen)

When prompting `generate_image`, always request a grid format (e.g. 3x3, 4x3, or 2x2 depending on counts) and structure the prompt carefully:
- **Reference Image**: If a visual reference like `splash.jpg` exists, describe the colors/aesthetic in the text prompt instead of using `ImagePaths` to avoid double exposure/blending errors.
- **Solid Chroma-Key Background**: Explicitly request a solid bright neon magenta chroma key background (`#FF00FF`).
- **No Divider Lines**: Explicitly specify: `"Absolutely no grid lines, no separating borders, no frames, no boxes between the icons, and no background overlays. The background must be completely solid magenta."`
- **Descriptions**: Provide a clean list of the icons in grid cell order (e.g. Row 1: 1, 2, 3...).

## 2. Programmatic Slicing & Transparency (Pillow)

We provide a Python helper script at `scripts/slice_spritesheet.py` to automate background removal, bounding-box trimming, square padding, centering, and cell slicing.

### Requirements
Ensure Pillow is installed:
```bash
pip install pillow
```

### Execution Example
To slice a 2x2 grid from a generated spritesheet JPEG:
```bash
python .agents/skills/spritesheet_icon_generator/scripts/slice_spritesheet.py \
  --image "path/to/spritesheet.jpg" \
  --outdir "public/" \
  --rows 2 \
  --cols 2 \
  --names '["sun_icon.png", "moon_icon.png", "dawn_icon.png", "dusk_icon.png"]' \
  --threshold 75 \
  --padding 24 \
  --resize 128
```

- `--names`: A JSON array string mapping each index (row major order) to a filename.
- `--threshold`: Tolerant Euclidean distance value in RGB space (default 75) to resolve compression artifacts near magenta boundaries.
- `--padding`: Padding border pixel value (default 24) around trimmed icon boundaries to keep icons from looking squeezed.
- `--resize`: Output width/height dimensions (default 128px).
