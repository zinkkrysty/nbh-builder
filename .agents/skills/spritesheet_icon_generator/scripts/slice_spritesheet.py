#!/usr/bin/env python3
import os
import math
import argparse
import json
from PIL import Image

def slice_spritesheet(img_path, out_dir, rows, cols, names, threshold=75, padding=24, resize_dim=128):
    if not os.path.exists(img_path):
        print(f"Error: Spritesheet image not found at: {img_path}")
        return False
        
    os.makedirs(out_dir, exist_ok=True)
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    print(f"Processing spritesheet: {width}x{height} pixels, splitting into {rows} rows x {cols} cols.")
    
    # Sample chroma key color from the top-left corner (0,0)
    key_r, key_g, key_b, _ = img.getpixel((0, 0))
    print(f"Chroma key color sampled at (0,0): R={key_r}, G={key_g}, B={key_b}")
    
    # Apply transparency to pixels near the key color
    data = img.getdata()
    new_data = []
    for item in data:
        r, g, b, a = item
        dist = math.sqrt((r - key_r)**2 + (g - key_g)**2 + (b - key_b)**2)
        if dist < threshold:
            new_data.append((0, 0, 0, 0)) # fully transparent
        else:
            new_data.append((r, g, b, a))
    img.putdata(new_data)
    
    # Calculate cell dimensions
    cell_w = width // cols
    cell_h = height // rows
    
    # Crop and save each cell
    for r in range(rows):
        for c in range(cols):
            # Safe boundary check
            idx = r * cols + c
            if idx >= len(names):
                print(f"Warning: No name mapped for row {r}, col {c}. Skipping.")
                continue
                
            out_name = names[idx]
            if not out_name:
                continue
                
            left = c * cell_w
            top = r * cell_h
            right = left + cell_w
            bottom = top + cell_h
            
            cell = img.crop((left, top, right, bottom))
            bbox = cell.getbbox()
            
            if bbox:
                # Trim transparent edges and pad to square center
                x0, y0, x1, y1 = bbox
                w = x1 - x0
                h = y1 - y0
                max_dim = max(w, h)
                
                square_cell = Image.new("RGBA", (max_dim + padding, max_dim + padding), (0, 0, 0, 0))
                offset_x = (max_dim + padding - w) // 2
                offset_y = (max_dim + padding - h) // 2
                square_cell.paste(cell.crop(bbox), (offset_x, offset_y))
                out_img = square_cell
            else:
                out_img = cell
                
            # Resize for crisp UI rendering
            out_img = out_img.resize((resize_dim, resize_dim), Image.Resampling.LANCZOS)
            out_path = os.path.join(out_dir, out_name)
            out_img.save(out_path, "PNG")
            print(f"Successfully saved transparent cell to: {out_path}")
            
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean, trim, and slice spritesheet cells programmatically with chroma-key keying.")
    parser.add_argument("--image", required=True, help="Path to input spritesheet JPEG/PNG image")
    parser.add_argument("--outdir", required=True, help="Directory to output the sliced PNGs")
    parser.add_argument("--rows", type=int, required=True, help="Number of rows in the spritesheet grid")
    parser.add_argument("--cols", type=int, required=True, help="Number of columns in the spritesheet grid")
    parser.add_argument("--names", required=True, help="JSON array list of filenames mapping index to name (e.g. '[\"a.png\", \"b.png\"]')")
    parser.add_argument("--threshold", type=int, default=75, help="Euclidean color distance threshold for chroma keying")
    parser.add_argument("--padding", type=int, default=24, help="Border padding around trimmed icon bounds")
    parser.add_argument("--resize", type=int, default=128, help="Output image width/height dimension")
    
    args = parser.parse_args()
    try:
        name_list = json.loads(args.names)
    except Exception as e:
        print(f"Error parsing names JSON array: {e}")
        exit(1)
        
    slice_spritesheet(args.image, args.outdir, args.rows, args.cols, name_list, args.threshold, args.padding, args.resize)
