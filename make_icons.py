import struct, zlib, math, os

def make_png(size):
    """Generate a valid RGBA PNG: green circle with white centre dot."""
    bg = (44, 122, 75)      # #2c7a4b  brand green
    fg = (255, 255, 255)    # white centre dot
    pixels = []
    cx = cy = size / 2
    r_outer = size * 0.46
    r_inner = size * 0.12

    for y in range(size):
        row = []
        for x in range(size):
            dx = x - cx + 0.5
            dy = y - cy + 0.5
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= r_outer:
                colour = fg if dist <= r_inner else bg
                row += list(colour) + [255]
            else:
                row += [0, 0, 0, 0]   # transparent outside circle
        pixels.append(bytes(row))

    def chunk(tag, data):
        body = tag + data
        return (struct.pack('>I', len(data)) + body +
                struct.pack('>I', zlib.crc32(body) & 0xFFFFFFFF))

    sig  = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    raw  = b''.join(b'\x00' + row for row in pixels)
    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


icons_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icons')
os.makedirs(icons_dir, exist_ok=True)

for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
    path = os.path.join(icons_dir, name)
    with open(path, 'wb') as f:
        f.write(make_png(size))
    print(f'  {name}  ({os.path.getsize(path):,} bytes)  ->  {path}')

print('Done.')
