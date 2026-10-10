#!/usr/bin/env python3
"""Rebuild the scroll sequence from your own video.
Only asset rebuilding needs Python packages: pip install opencv-python pillow numpy
Normal website use needs no Python packages or build step.
"""
from __future__ import annotations
import argparse
import json
import shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]

def remove_studio_background(rgb: Image.Image) -> Image.Image:
    """Remove connected neutral studio background; retain enclosed highlights."""
    a = np.asarray(rgb).astype(np.int16)
    neutral = ((a.max(2) - a.min(2)) < 34) & (a.min(2) > 184)
    _, labels, _, _ = cv2.connectedComponentsWithStats(neutral.astype(np.uint8), 8)
    edge = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
    edge = edge[edge != 0]
    foreground = (~np.isin(labels, edge)).astype(np.uint8) * 255
    n, components, stats, _ = cv2.connectedComponentsWithStats(foreground, 8)
    for component in range(1, n):
        if stats[component, cv2.CC_STAT_AREA] < 12:
            foreground[components == component] = 0
    alpha = Image.fromarray(foreground).filter(ImageFilter.GaussianBlur(0.4))
    result = rgb.convert('RGBA')
    result.putalpha(alpha)
    return result

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('video', type=Path, help='Path to your replacement video')
    parser.add_argument('--keep-background', action='store_true', help='Do not remove white studio backdrop')
    args = parser.parse_args()
    if not args.video.is_file():
        raise SystemExit(f'Video not found: {args.video}')
    cap = cv2.VideoCapture(str(args.video))
    if not cap.isOpened():
        raise SystemExit('Unable to open video. Check the path and codec.')
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width, height = int(cap.get(3)), int(cap.get(4))
    for tier in ['desktop', 'mobile']:
        target = ROOT / 'assets' / 'frames' / tier
        target.mkdir(parents=True, exist_ok=True)
        for old in target.glob('frame-*.webp'):
            old.unlink()
    (ROOT / 'assets' / 'images').mkdir(parents=True, exist_ok=True)
    (ROOT / 'assets' / 'video').mkdir(parents=True, exist_ok=True)

    def save_frame(index: int, frame: np.ndarray) -> None:
        rgb = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        rgb = rgb.resize((640, round(640 * height / width)), Image.Resampling.LANCZOS)
        cutout = rgb.convert('RGBA') if args.keep_background else remove_studio_background(rgb)
        filename = f'frame-{index:04d}.webp'
        cutout.save(ROOT / 'assets/frames/desktop' / filename, quality=86, method=4)
        small = cutout.resize((384, round(384 * height / width)), Image.Resampling.LANCZOS)
        small.save(ROOT / 'assets/frames/mobile' / filename, quality=81, method=4)
        if index == 0:
            cutout.save(ROOT / 'assets/images/poster.webp', quality=92, method=6)
        # Editorial images are stills of the supplied film, not replacement art.
        for name, fraction in [('twist', 0.61), ('pour', 0.80), ('finale', 0.98)]:
            if index == round((count - 1) * fraction):
                cutout.save(ROOT / 'assets/images' / f'{name}.webp', quality=89, method=5)

    futures = []
    actual = 0
    with ThreadPoolExecutor(max_workers=4) as workers:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            futures.append(workers.submit(save_frame, actual, frame))
            actual += 1
            # Keep the queue bounded while decoding long videos.
            if len(futures) >= 12:
                futures.pop(0).result()
        for future in futures:
            future.result()
    cap.release()
    target_video = ROOT / 'assets/video/frooti-original.mp4'
    if args.video.resolve() != target_video.resolve():
        shutil.copy2(args.video, target_video)
    config = {
        'frameCount': actual,
        'fps': round(fps, 4),
        'duration': round((actual - 1) / fps, 5),
        'width': 640,
        'height': round(640 * height / width),
        'desktopPath': 'assets/frames/desktop/frame-',
        'mobilePath': 'assets/frames/mobile/frame-',
        'extension': '.webp'
    }
    (ROOT / 'js').mkdir(exist_ok=True)
    (ROOT / 'js/sequence.js').write_text('window.FROOTI_SEQUENCE = ' + json.dumps(config, indent=2) + ';\n')
    print(f'Built {actual} frames per tier, {fps:.2f} fps. Original MP4 retained.')

if __name__ == '__main__':
    main()
