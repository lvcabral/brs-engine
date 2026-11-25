# Writes images/anim.webp: 200x200, four solid frames (white, grey, orange, cyan), 100 ms each, looping.
# Usage: python3 make-anim.py   (needs Pillow)
from PIL import Image
colors = [(255, 255, 255, 255), (128, 128, 128, 255), (255, 128, 0, 255), (0, 255, 255, 255)]
frames = [Image.new("RGBA", (200, 200), c) for c in colors]
frames[0].save("images/anim.webp", save_all=True, append_images=frames[1:], duration=100, loop=0, lossless=True)
