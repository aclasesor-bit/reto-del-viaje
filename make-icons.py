# Genera los iconos de la PWA: un corazon y una estrella sobre fondo claro.
# Uso: python make-icons.py
import math, os
from PIL import Image, ImageDraw

DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs")
FONDO = (253, 240, 231)
BORDE = (247, 226, 212)
ROJO = (224, 87, 79)
ORO = (240, 169, 44)


def corazon(d, cx, cy, w, color):
    r = w / 4.0
    d.ellipse([cx - w / 2, cy - r, cx, cy + r], fill=color)
    d.ellipse([cx, cy - r, cx + w / 2, cy + r], fill=color)
    d.polygon([(cx - w / 2, cy + r * 0.15), (cx + w / 2, cy + r * 0.15), (cx, cy + w * 0.72)], fill=color)


def estrella(d, cx, cy, r, color):
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.45
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    d.polygon(pts, fill=color)


def icono(size, escala=1.0):
    S = size * 4  # supersampling
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=FONDO, outline=BORDE, width=max(2, int(S * 0.01)))
    w = S * 0.40 * escala
    corazon(d, S * 0.37, S * 0.38, w, ROJO)
    estrella(d, S * 0.67, S * 0.67, S * 0.275 * escala, FONDO)
    estrella(d, S * 0.67, S * 0.67, S * 0.24 * escala, ORO)
    return img.resize((size, size), Image.LANCZOS)


os.makedirs(DEST, exist_ok=True)
icono(192).save(os.path.join(DEST, "icon-192.png"))
icono(512).save(os.path.join(DEST, "icon-512.png"))
# maskable: el dibujo mas pequeno para que quepa en la zona segura del recorte
icono(512, 0.78).save(os.path.join(DEST, "icon-512-maskable.png"))
icono(180).save(os.path.join(DEST, "apple-touch-icon.png"))
# favicon
icono(32).save(os.path.join(DEST, "favicon.png"))
print("iconos generados en", DEST)
