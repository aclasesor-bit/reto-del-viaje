/* Prueba la app en un navegador real, con tamano de iPhone vertical.
   Uso:  node test.js                (prueba docs\index.html en local)
         node test.js <URL>          (prueba la version publicada)
*/
const { chromium, webkit } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const destino = process.argv[2] || ('file:///' + path.join(__dirname, 'docs', 'index.html').replace(/\\/g, '/'));
const IPHONE = { width: 390, height: 844 };          // iPhone 14 / 15 vertical
const IPHONE_SE = { width: 320, height: 568 };       // el iPhone mas estrecho que existe

let fallos = 0, hechos = 0;
function ok(nombre, condicion, detalle) {
  hechos++;
  if (condicion) console.log('  OK   ' + nombre);
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}

(async () => {
  const usarWebkit = process.env.MOTOR === 'webkit';
  const navegador = usarWebkit
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await navegador.newContext({
    viewport: IPHONE,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    locale: 'es-ES'
  });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('pageerror', e => errores.push(String(e)));
  pag.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errores.push(m.text()); });

  await pag.goto(destino, { waitUntil: 'load' });
  await pag.waitForTimeout(400);

  const tarjeta = n => pag.locator('[data-tarjeta="' + n + '"]');
  const corazones = async n => Number((await tarjeta(n).locator('[data-cuenta-corazones]').innerText()).split('/')[0].trim());
  const estrellas = async n => Number((await tarjeta(n).locator('[data-cuenta-estrellas]').innerText()).split('/')[0].trim());
  const pulsar = async (n, acc) => {
    await tarjeta(n).locator('[data-accion="' + acc + '"]').click();
    await pag.waitForTimeout(180);
  };

  console.log('\n=== ' + destino + ' ===\n');

  /* 1. las tres ninas */
  console.log('-- pantalla principal');
  ok('aparecen las 3 tarjetas', (await pag.locator('.tarjeta').count()) === 3);
  for (const n of ['Valeria', 'Alejandra', 'Paula']) {
    ok('se ve ' + n, await pag.locator('.nombre', { hasText: n }).first().isVisible());
  }
  ok('cada nina empieza con 5 corazones', (await corazones('valeria')) === 5 && (await corazones('paula')) === 5);
  ok('cada nina empieza con 0 estrellas', (await estrellas('alejandra')) === 0);
  ok('se pintan 5 corazones', (await tarjeta('valeria').locator('[data-corazones] .pip').count()) === 5);
  ok('se pintan 5 estrellas de objetivo', (await tarjeta('valeria').locator('[data-estrellas] .pip').count()) === 5);

  /* 2. botones pulsables y tamano */
  console.log('-- botones');
  for (const acc of ['bien', 'mal', 'deshacer']) {
    const b = tarjeta('valeria').locator('[data-accion="' + acc + '"]');
    const caja = await b.boundingBox();
    ok('boton ' + acc + ' visible y grande (' + Math.round(caja.height) + 'px)', caja && caja.height >= 44 && caja.width > 200);
  }
  const anchoVentana = await pag.evaluate(() => window.innerWidth);
  for (const acc of ['bien', 'mal']) {
    const caja = await tarjeta('paula').locator('[data-accion="' + acc + '"]').boundingBox();
    ok('boton ' + acc + ' de Paula cabe en pantalla', caja.x >= 0 && caja.x + caja.width <= anchoVentana + 1);
  }

  /* 3. corazones bajan */
  console.log('-- perder oportunidades');
  await pulsar('valeria', 'mal');
  ok('un toque en rojo deja 4 corazones', (await corazones('valeria')) === 4);
  ok('el 5o corazon se apaga', (await tarjeta('valeria').locator('[data-corazones] .pip.vacio').count()) === 1);
  ok('no toca a las hermanas', (await corazones('paula')) === 5 && (await corazones('alejandra')) === 5);

  /* 4. estrellas suben */
  console.log('-- buenas acciones');
  await pulsar('paula', 'bien');
  ok('un toque en verde da 1 estrella', (await estrellas('paula')) === 1);
  ok('la buena accion NO devuelve corazones', (await corazones('paula')) === 5);
  await pulsar('valeria', 'bien');
  ok('marcadores independientes (Valeria 4 corazones y 1 estrella)',
     (await corazones('valeria')) === 4 && (await estrellas('valeria')) === 1);

  /* 5. deshacer */
  console.log('-- deshacer');
  await pulsar('valeria', 'deshacer');                    // deshace la buena accion
  ok('deshacer quita la ultima estrella', (await estrellas('valeria')) === 0);
  ok('deshacer no toca los corazones', (await corazones('valeria')) === 4);
  await pulsar('valeria', 'deshacer');                    // deshace la mala
  ok('deshacer devuelve el corazon perdido', (await corazones('valeria')) === 5);
  ok('deshacer se desactiva cuando no queda nada',
     await tarjeta('valeria').locator('[data-accion="deshacer"]').isDisabled());
  await pulsar('paula', 'deshacer');
  ok('Paula vuelve a 0 estrellas', (await estrellas('paula')) === 0);

  /* 6. castigada */
  console.log('-- castigo');
  for (let i = 0; i < 5; i++) await pulsar('alejandra', 'mal');
  ok('llega a 0 corazones', (await corazones('alejandra')) === 0);
  const avisoMal = tarjeta('alejandra').locator('[data-castigada]');
  ok('aparece CASTIGADA', await avisoMal.isVisible());
  ok('el texto del castigo es el configurado', /CASTIGADA/.test(await avisoMal.innerText()));
  ok('el boton rojo se desactiva en 0', await tarjeta('alejandra').locator('[data-accion="mal"]').isDisabled());
  ok('las otras dos siguen intactas', (await corazones('valeria')) === 5);
  await pulsar('alejandra', 'deshacer');
  ok('deshacer saca del castigo', (await corazones('alejandra')) === 1 &&
     (await tarjeta('alejandra').locator('[data-castigada]').count()) === 0);

  /* 7. recompensa + confeti */
  console.log('-- recompensa');
  for (let i = 0; i < 5; i++) await pulsar('paula', 'bien');
  ok('llega a 5 estrellas', (await estrellas('paula')) === 5);
  const avisoBien = tarjeta('paula').locator('[data-premiada]');
  ok('aparece RECOMPENSA', await avisoBien.isVisible());
  ok('muestra el texto del premio', /RECOMPENSA/.test(await avisoBien.innerText()));
  const hayConfeti = await pag.evaluate(() => !document.getElementById('confeti').hidden);
  ok('salta el confeti', hayConfeti);

  /* 8. historial */
  console.log('-- historial');
  await pag.locator('#bloqueHistorial > summary').click();
  await pag.waitForTimeout(200);
  const filas = await pag.locator('#historial li').count();
  ok('el historial recoge las acciones (' + filas + ')', filas >= 6);
  const primera = await pag.locator('#historial li').first().innerText();
  ok('cada linea lleva hora, nombre y accion', /\d{2}:\d{2}/.test(primera) && /Paula|Valeria|Alejandra/.test(primera));
  await pag.locator('#bloqueHistorial > summary').click();
  await pag.waitForTimeout(150);
  ok('el historial se puede plegar', !(await pag.locator('#historial li').first().isVisible()));

  /* 9. persistencia */
  console.log('-- persistencia');
  const antesE = await estrellas('paula'), antesC = await corazones('alejandra');
  await pag.reload({ waitUntil: 'load' });
  await pag.waitForTimeout(350);
  ok('los datos sobreviven a recargar', (await estrellas('paula')) === antesE && (await corazones('alejandra')) === antesC);
  const otra = await ctx.newPage();          // misma sesion, como volver a abrir Safari
  await otra.goto(destino, { waitUntil: 'load' });
  await otra.waitForTimeout(300);
  const eOtra = Number((await otra.locator('[data-tarjeta="paula"] [data-cuenta-estrellas]').innerText()).split('/')[0].trim());
  ok('los datos siguen al abrir de nuevo la app', eOtra === antesE);
  await otra.close();

  /* 10. ajustes */
  console.log('-- ajustes');
  await pag.locator('#btnAjustes').click();
  await pag.waitForTimeout(320);
  ok('se abre el panel de ajustes', await pag.locator('#cfgOp').isVisible());
  await pag.locator('#cfgOp').fill('3');
  await pag.locator('#cfgOb').fill('2');
  await pag.locator('#cfgRe').fill('Helado doble');
  await pag.locator('#cfgCa').fill('Sin pantallas');
  await pag.locator('#cfgGuardar').click();
  await pag.waitForTimeout(300);
  ok('ahora se pintan 3 corazones', (await tarjeta('valeria').locator('[data-corazones] .pip').count()) === 3);
  ok('el objetivo baja a 2', /\/\s*2/.test(await tarjeta('valeria').locator('[data-cuenta-estrellas]').innerText()));
  ok('Paula sigue premiada con el texto nuevo', /HELADO DOBLE|Helado doble/.test(await tarjeta('paula').locator('[data-premiada]').innerText()));
  for (let i = 0; i < 3; i++) await pulsar('valeria', 'mal');
  ok('el castigo usa el texto nuevo', /SIN PANTALLAS/.test(await tarjeta('valeria').locator('[data-castigada]').innerText()));

  /* 11. nuevo dia */
  console.log('-- nuevo dia');
  await pag.locator('#btnNuevoDia').click();
  await pag.waitForTimeout(320);
  ok('pide confirmacion', await pag.locator('#siNuevoDia').isVisible());
  await pag.locator('[data-cerrar]').click();
  await pag.waitForTimeout(250);
  ok('si cancelo no se borra nada', (await corazones('valeria')) === 0);
  await pag.locator('#btnNuevoDia').click();
  await pag.waitForTimeout(320);
  await pag.locator('#siNuevoDia').click();
  await pag.waitForTimeout(320);
  ok('las tres vuelven a los corazones configurados',
     (await corazones('valeria')) === 3 && (await corazones('alejandra')) === 3 && (await corazones('paula')) === 3);
  ok('las estrellas vuelven a 0', (await estrellas('paula')) === 0);
  ok('se borra el historial', (await pag.locator('#historial .vacio').count()) === 1);
  const cfg = await pag.evaluate(() => JSON.parse(localStorage.getItem('reto-del-viaje-v1')).config);
  ok('se mantiene la configuracion', cfg.oportunidades === 3 && cfg.textoRecompensa === 'Helado doble');

  /* 12. cambio de dia automatico */
  console.log('-- cambio de dia automatico');
  await pulsar('paula', 'bien');
  await pag.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('reto-del-viaje-v1'));
    s.fecha = '2020-01-01';
    localStorage.setItem('reto-del-viaje-v1', JSON.stringify(s));
  });
  await pag.reload({ waitUntil: 'load' });
  await pag.waitForTimeout(350);
  ok('al cambiar el dia se reinicia solo',
     (await estrellas('paula')) === 0 && (await corazones('valeria')) === 3);

  /* dejarlo todo por defecto otra vez */
  await pag.evaluate(() => { localStorage.removeItem('reto-del-viaje-v1'); });
  await pag.reload({ waitUntil: 'load' });
  await pag.waitForTimeout(300);

  /* 13. sonido */
  console.log('-- sonido');
  ok('empieza con el sonido activado', (await pag.locator('#btnSonido').innerText()).indexOf('🔊') >= 0);
  await pag.locator('#btnSonido').click();
  await pag.waitForTimeout(150);
  ok('se puede silenciar', (await pag.locator('#btnSonido').innerText()).indexOf('🔇') >= 0);
  await pag.reload({ waitUntil: 'load' });
  await pag.waitForTimeout(300);
  ok('recuerda que esta silenciado', (await pag.locator('#btnSonido').innerText()).indexOf('🔇') >= 0);
  await pag.locator('#btnSonido').click();
  await pag.waitForTimeout(150);

  /* 14. movil: sin scroll horizontal, nada tapado */
  console.log('-- movil (iPhone vertical)');
  for (const medida of [IPHONE, IPHONE_SE, { width: 430, height: 932 }]) {
    await pag.setViewportSize(medida);
    await pag.waitForTimeout(250);
    const m = await pag.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      ancho: window.innerWidth,
      cuerpo: document.body.scrollWidth
    }));
    ok('sin scroll horizontal en ' + medida.width + 'px', m.scroll <= m.ancho + 1 && m.cuerpo <= m.ancho + 1,
       'scrollWidth=' + m.scroll + ' innerWidth=' + m.ancho);
    const dentro = await pag.evaluate(() => {
      const fuera = [];
      document.querySelectorAll('.tarjeta button, .nuevodia, .icono').forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.left < -1 || r.right > window.innerWidth + 1 || r.height < 40) fuera.push(b.textContent.trim().slice(0, 22));
      });
      return fuera;
    });
    ok('ningun boton se sale ni queda pequeno en ' + medida.width + 'px', dentro.length === 0, dentro.join(' | '));
  }
  /* el ultimo boton se alcanza haciendo scroll y no queda bajo nada */
  await pag.setViewportSize(IPHONE);
  await pag.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pag.waitForTimeout(300);
  const tapado = await pag.evaluate(() => {
    const b = document.getElementById('btnNuevoDia');
    const r = b.getBoundingClientRect();
    const arriba = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !(arriba === b || b.contains(arriba));
  });
  ok('el boton de nuevo dia queda accesible y sin tapar', !tapado);

  /* la cabecera pegada no tapa la primera tarjeta */
  await pag.evaluate(() => window.scrollTo(0, 0));
  await pag.waitForTimeout(200);
  const solape = await pag.evaluate(() => {
    const h = document.querySelector('.top').getBoundingClientRect();
    const t = document.querySelector('.tarjeta').getBoundingClientRect();
    return t.top < h.bottom - 1;
  });
  ok('la cabecera no tapa la primera tarjeta', !solape);

  /* 15. PWA */
  console.log('-- PWA');
  const man = await pag.evaluate(async () => {
    const u = document.querySelector('link[rel=manifest]').href;
    const r = await fetch(u);
    return r.ok ? await r.json() : null;
  });
  ok('el manifest carga', !!man);
  ok('nombre correcto', man && man.name === 'El Reto del Viaje');
  ok('modo standalone', man && man.display === 'standalone');
  ok('tiene iconos 192 y 512', man && man.icons.length >= 3);
  const iconos = await pag.evaluate(async () => {
    const res = {};
    for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'icon-512-maskable.png']) {
      const r = await fetch(f); res[f] = r.ok;
    }
    return res;
  });
  Object.keys(iconos).forEach(f => ok('existe ' + f, iconos[f]));
  ok('apple-touch-icon declarado', (await pag.locator('link[rel="apple-touch-icon"]').count()) === 1);
  ok('modo app en iOS declarado', (await pag.locator('meta[name="apple-mobile-web-app-capable"]').count()) === 1);
  if (/^http/.test(destino)) {
    const sw = await pag.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length));
    ok('service worker registrado', sw > 0);
  }

  /* 16. errores de JS */
  ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 3).join(' | '));

  /* capturas */
  const dirCap = path.join(__dirname, 'capturas');
  fs.mkdirSync(dirCap, { recursive: true });
  await pag.setViewportSize(IPHONE);
  await pulsar('valeria', 'mal');
  await pulsar('alejandra', 'bien');
  for (let i = 0; i < 5; i++) await pulsar('paula', 'bien');
  await pag.waitForTimeout(400);
  await pag.screenshot({ path: path.join(dirCap, 'iphone-arriba.png') });
  await pag.screenshot({ path: path.join(dirCap, 'iphone-completo.png'), fullPage: true });
  await pag.setViewportSize({ width: 1280, height: 900 });
  await pag.waitForTimeout(300);
  await pag.screenshot({ path: path.join(dirCap, 'escritorio.png') });
  await pag.evaluate(() => localStorage.removeItem('reto-del-viaje-v1'));

  await navegador.close();
  console.log('\n' + (fallos ? 'FALLOS: ' + fallos + ' de ' + hechos : 'TODO CORRECTO: ' + hechos + ' comprobaciones') + '\n');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
