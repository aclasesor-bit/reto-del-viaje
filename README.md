# El Súper Reto ❤️⭐

Juego de comportamiento del día a día para Valeria, Alejandra y Paula.
Cada una empieza el día con 5 ❤️ (oportunidades) y va sumando ⭐ (buenas acciones).
Al llegar a 0 ❤️ sale **CASTIGADA**; al llegar al objetivo de ⭐ salta el confeti y la **RECOMPENSA**.

Publicado en GitHub Pages: https://aclasesor-bit.github.io/reto-del-viaje/

> Nació como «El Reto del Viaje» para el viaje familiar de agosto de 2026 y se quedó para siempre.
> **La URL y la clave de `localStorage` conservan el nombre viejo a propósito**: cambiarlas rompería
> el icono ya instalado en las pantallas de inicio, los enlaces `?f=` ya compartidos y los datos
> guardados en los dos móviles. Lo único que cambió es el nombre que se ve.

## Qué hace

- **Ranking arriba del todo**, con dos pestañas: **Hoy** y **Semana L–V** (suma de lunes a viernes,
  con una casilla por día: ⭐ del día, 🎁 si llegó al premio, ⛔ si se quedó sin corazones, y
  debajo el **neto de ese día** en una chapita verde o roja).
  **Manda el neto: las ⭐ ganadas menos los ❤️ perdidos**, y se canta en una chapa a la derecha
  (verde si va en positivo, roja si va en negativo). Si dos empatan a neto, va delante quien más ⭐
  ha hecho; y si también empatan ahí, quien menos ❤️ ha perdido.
- **Foto de cada niña** (Ajustes → 📷): se recorta a una miniatura de 224 px, viaja por la API y se
  ve en los dos móviles. No está en el repositorio: vive en el buzón de la familia.
- **Premios que no se pierden**: al llegar al objetivo se apunta un premio de ese día (clave
  `nina|dia` con estado y marca de tiempo). Sobrevive a «empezar nuevo día»; solo se anula si se
  deshace la estrella que lo dio. Se marcan como entregados desde el panel 🎁.
- **Rachas**: días jugados seguidos sin quedarse sin corazones.
- **Pantalla para ellas** (botón 👀): vista grande de solo lectura, ordenada por quien va ganando y con medalla, sin botones de sumar ni restar;
  para salir hay que mantener pulsado.
- Botones grandes por niña, DESHACER por niña, historial del día, sonidos y ajustes.
- **Traca de fuegos artificiales al dar la estrella.** Fogonazo blanco, sol de rayos, estrella
  gigante que gira en 3D con su «+1», cartel con el nombre de la niña («¡BRAVO! PAULA») y, acto
  seguido, **se apaga la luz**: la pantalla se hace noche y salen dos cañones de confeti desde las
  esquinas y tres cohetes que suben, estallan con estela y truenan, el último en traca final. Es un
  motor de partículas propio en `<canvas>` (brillo aditivo, estelas por borrado parcial) que **avanza
  por reloj y no por fotograma**, así que en un móvil lento se ve a saltos pero dura lo mismo y no se
  desengancha de la música; hay además un tope duro a los 3,4 s. La fanfarria lleva los truenos
  sincronizados con los estallidos.
- **Tormenta al dar el rojo**, con el mismo motor y la misma ambición: **la pantalla se raja como un
  cristal roto** (grietas quebradas desde el punto del golpe, con ramas y anillos, que se repintan
  enteras cada fotograma), se hace de noche azul, **caen tres relámpagos**, **llueve de verdad** y los
  **trozos del corazón salen disparados, rebotan en el suelo** y se apagan. Suena el cristal al
  rajarse, el tromboncito que se hunde y **dos truenos**. La página tiembla. La lluvia amaina antes de
  que vuelva la luz.
- El premio de las 5 ⭐ y quedarse a 0 ❤️ tienen sus propias versiones, más largas. Todo se salta
  entero si el móvil pide menos movimiento.
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
node test.js http://127.0.0.1:8765/      # 200 comprobaciones en Chrome con tamaño de iPhone
MOTOR=webkit node test.js <url>          # las mismas en WebKit (motor de Safari)
node test.js https://aclasesor-bit.github.io/reto-del-viaje/   # comprobar lo publicado
```

Las pruebas usan la API de verdad con un código de familia de usar y tirar que borran al terminar,
y cubren también los dos móviles a la vez, el modo sin cobertura y el ranking semanal.

Desplegar la app: `git push` (Pages sirve `docs/` desde `main`).
Desplegar la API: `scp servidor/server.js finplan:/opt/reto-api/server.js && ssh finplan "pm2 restart reto-api"`.
