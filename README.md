# El Reto del Viaje ❤️⭐

Juego de comportamiento para el viaje en familia: Valeria, Alejandra y Paula.
Cada una empieza el día con 5 ❤️ (oportunidades) y va sumando ⭐ (buenas acciones).
Al llegar a 0 ❤️ sale **CASTIGADA**; al llegar al objetivo de ⭐ salta el confeti y la **RECOMPENSA**.

Publicado en GitHub Pages: https://aclasesor-bit.github.io/reto-del-viaje/

## Qué hace

- **Ranking arriba del todo**, con dos pestañas: **Hoy** y **Semana L–V** (suma de lunes a viernes,
  con una casilla por día: ⭐ del día, 🎁 si llegó al premio, ⛔ si se quedó sin corazones).
- Botones grandes por niña, DESHACER por niña, historial del día, sonidos y ajustes.
- **Los dos móviles a la vez.** Cada acción es un evento con su identificador; el servidor se queda
  con la unión de lo que manda cada móvil, así que da igual quién apunte. Sin cobertura se apunta
  igual y se envía solo al recuperarla.

## Cómo está montado

- `docs/` es lo que publica GitHub Pages (HTML + CSS + JS en un fichero, sin dependencias).
- `servidor/server.js` es la API de sincronización: Node puro, sin dependencias, en el VPS bajo PM2
  (`pm2 restart reto-api`) y expuesta por Traefik en **https://miplandeempresa.com/reto-api**
  (regla en `/docker/traefik/dynamic/reto-api.yml`). Los datos son un JSON por familia en
  `/opt/reto-api/datos`, con los últimos 28 días.
- Cada móvil guarda además su copia en `localStorage` (clave `reto-del-viaje-v2`), para que funcione
  sin conexión y como PWA en la pantalla de inicio.
- El **código de familia** no está en el repositorio: lo genera el móvil la primera vez y se comparte
  con el otro mediante el enlace `?f=<código>`.

## Trabajar con el proyecto

```bash
python make-icons.py                     # regenera los iconos de la PWA
cd docs && python -m http.server 8765    # servir en local
node test.js http://127.0.0.1:8765/      # 122 comprobaciones en Chrome con tamaño de iPhone
MOTOR=webkit node test.js <url>          # las mismas en WebKit (motor de Safari)
node test.js https://aclasesor-bit.github.io/reto-del-viaje/   # comprobar lo publicado
```

Las pruebas usan la API de verdad con un código de familia de usar y tirar que borran al terminar,
y cubren también los dos móviles a la vez, el modo sin cobertura y el ranking semanal.

Desplegar la app: `git push` (Pages sirve `docs/` desde `main`).
Desplegar la API: `scp servidor/server.js finplan:/opt/reto-api/server.js && ssh finplan "pm2 restart reto-api"`.
