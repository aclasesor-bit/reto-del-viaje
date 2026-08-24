# El Reto del Viaje ❤️⭐

Juego de comportamiento para el viaje en familia: Valeria, Alejandra y Paula.
Cada una empieza el día con 5 ❤️ (oportunidades) y va sumando ⭐ (buenas acciones).
Al llegar a 0 ❤️ sale **CASTIGADA**; al llegar al objetivo de ⭐ salta el confeti y la **RECOMPENSA**.

Publicado en GitHub Pages: https://aclasesor-bit.github.io/reto-del-viaje/

## Qué hace

- **Ranking arriba del todo**, con dos pestañas: **Hoy** y **Semana L–V** (suma de lunes a viernes,
  con una casilla por día: ⭐ del día, 🎁 si llegó al premio, ⛔ si se quedó sin corazones).
- **Foto de cada niña** (Ajustes → 📷): se recorta a una miniatura de 224 px, viaja por la API y se
  ve en los dos móviles. No está en el repositorio: vive en el buzón de la familia.
- **Premios que no se pierden**: al llegar al objetivo se apunta un premio de ese día (clave
  `nina|dia` con estado y marca de tiempo). Sobrevive a «empezar nuevo día»; solo se anula si se
  deshace la estrella que lo dio. Se marcan como entregados desde el panel 🎁.
- **Rachas**: días jugados seguidos sin quedarse sin corazones.
- **Pantalla para ellas** (botón 👀): vista grande de solo lectura, ordenada por quien va ganando y con medalla, sin botones de sumar ni restar;
  para salir hay que mantener pulsado.
- Botones grandes por niña, DESHACER por niña, historial del día, sonidos y ajustes.
- **Fogonazo a pantalla completa en cada toque.** Al verde: sol de rayos girando, estrella gigante
  que ocupa media pantalla, cartel («¡MUY BIEN!», «¡BRAVO!»…), tres ondas expansivas, 34 chispas que
  cruzan la pantalla, cortina de estrellas cayendo, la página da un botecito y suena una **fanfarria
  de victoria de casi 2 s**. Al rojo, lo mismo del revés: la pantalla se oscurece desde los bordes,
  corazón roto gigante que se sacude y se desploma, pedazos y lágrimas cayendo, **la página tiembla**
  y suena un tromboncito triste que se hunde. El premio de las 5 ⭐ y quedarse a 0 ❤️ tienen sus
  propias versiones, más largas. Se salta entero si el móvil pide menos movimiento.
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
node test.js http://127.0.0.1:8765/      # 175 comprobaciones en Chrome con tamaño de iPhone
MOTOR=webkit node test.js <url>          # las mismas en WebKit (motor de Safari)
node test.js https://aclasesor-bit.github.io/reto-del-viaje/   # comprobar lo publicado
```

Las pruebas usan la API de verdad con un código de familia de usar y tirar que borran al terminar,
y cubren también los dos móviles a la vez, el modo sin cobertura y el ranking semanal.

Desplegar la app: `git push` (Pages sirve `docs/` desde `main`).
Desplegar la API: `scp servidor/server.js finplan:/opt/reto-api/server.js && ssh finplan "pm2 restart reto-api"`.
