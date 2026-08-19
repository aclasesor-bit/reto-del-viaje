# El Reto del Viaje ❤️⭐

Juego de comportamiento para el viaje en familia: Valeria, Alejandra y Paula.
Cada una empieza el día con 5 ❤️ (oportunidades) y va sumando ⭐ (buenas acciones).
Al llegar a 0 ❤️ sale **CASTIGADA**; al llegar al objetivo de ⭐ salta el confeti y la **RECOMPENSA**.

Publicado en GitHub Pages: https://aclasesor-bit.github.io/reto-del-viaje/

## Cómo está montado

- `docs/` es exactamente lo que se publica (HTML + CSS + JS en un solo fichero, sin dependencias).
- PWA: `manifest.webmanifest`, `sw.js` e iconos → se puede añadir a la pantalla de inicio del iPhone.
- Los datos se guardan en el `localStorage` del propio móvil. No hay servidor, ni cuentas, ni login.
- Reinicio automático al cambiar de día (compara la fecha guardada al abrir, al volver a la app y cada minuto).

## Trabajar con el proyecto

```bash
python make-icons.py                     # regenera los iconos de la PWA
cd docs && python -m http.server 8765    # servir en local
node test.js http://127.0.0.1:8765/      # 74 comprobaciones en Chrome con tamaño de iPhone
node test.js https://aclasesor-bit.github.io/reto-del-viaje/   # comprobar lo publicado
```

Desplegar: `git add -A && git commit -m "..." && git push` (GitHub Pages sirve `docs/` desde la rama `main`).
Las capturas de las pruebas se dejan en `capturas/`.
