"""Regenerate the responsive portrait files. Requires Pillow only for this command."""
from pathlib import Path
from PIL import Image, ImageOps

source = Path(__file__).resolve().parents[1] / 'assets/images/profile_pic.png'
with Image.open(source) as original:
    image = ImageOps.exif_transpose(original)
    if image.mode not in ('RGB', 'RGBA'):
        image = image.convert('RGBA' if 'transparency' in image.info else 'RGB')
    for width in (400, 480, 600, 800):
        size = (width, round(image.height * width / image.width))
        destination = source.with_name(f'{source.stem}-{width}.webp')
        image.resize(size, Image.Resampling.LANCZOS).save(destination, 'WEBP', quality=85, method=6)
        print(f'{destination.name}: {destination.stat().st_size:,} bytes')
