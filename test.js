/* Prueba la app en un navegador real, con tamano de iPhone vertical.
   Uso:  node test.js                (prueba docs\index.html en local)
         node test.js <URL>          (prueba la version publicada)
         MOTOR=webkit node test.js <URL>   (con el motor de Safari)

   Usa la API de verdad (https://miplandeempresa.com/reto-api) con un codigo de
   familia de usar y tirar, que se borra al terminar.
*/
const { chromium, webkit } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const API = 'https://miplandeempresa.com/reto-api';
const destino = process.argv[2] || ('file:///' + path.join(__dirname, 'docs', 'index.html').replace(/\\/g, '/'));
const SUFIJO = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const FAMILIA = 'casa-t' + SUFIJO;          // para las pruebas del dia a dia
const FAMILIA_SEM = 'casa-s' + SUFIJO;      // para las pruebas de la semana
const IPHONE = { width: 390, height: 844 };
const IPHONE_SE = { width: 320, height: 568 };
const CONTEXTO = {
  viewport: IPHONE, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-ES',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
};

let fallos = 0, hechos = 0;
function ok(nombre, condicion, detalle) {
  hechos++;
  if (condicion) console.log('  OK   ' + nombre);
  else { fallos++; console.log('  FALLA ' + nombre + (detalle ? '  -> ' + detalle : '')); }
}
const conFamilia = f => destino + (destino.indexOf('?') >= 0 ? '&' : '?') + 'f=' + f;
const borrarFamilia = f => fetch(API + '/f/' + f, { method: 'DELETE' }).catch(() => {});
const dos = n => String(n).padStart(2, '0');
const clave = d => d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
function diasDeLaSemanaHastaHoy() {
  const x = new Date(); x.setHours(0, 0, 0, 0);
  const lunes = new Date(x); lunes.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  const dias = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(lunes); d.setDate(lunes.getDate() + i);
    if (d <= x) dias.push(clave(d));
  }
  return dias;
}
async function esperarA(fn, ms, cada) {
  const fin = Date.now() + (ms || 8000);
  for (;;) {
    if (await fn()) return true;
    if (Date.now() > fin) return false;
    await new Promise(r => setTimeout(r, cada || 250));
  }
}

(async () => {
  const usarWebkit = process.env.MOTOR === 'webkit';
  const navegador = usarWebkit
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ executablePath: CHROME, headless: true });

  await borrarFamilia(FAMILIA);
  await borrarFamilia(FAMILIA_SEM);

  const ctx = await navegador.newContext(CONTEXTO);
  const pag = await ctx.newPage();
  const errores = [];
  let sinCobertura = false;   // durante la prueba offline los fallos de red los provoco yo
  pag.on('pageerror', e => errores.push(String(e)));
  pag.on('console', m => {
    if (m.type() !== 'error') return;
    if (/favicon/i.test(m.text())) return;
    if (sinCobertura && /ERR_FAILED|Failed to load resource|Load failed|NetworkError/i.test(m.text())) return;
    errores.push(m.text());
  });

  await pag.goto(conFamilia(FAMILIA), { waitUntil: 'load' });
  await pag.waitForTimeout(600);

  const tarjeta = n => pag.locator('[data-tarjeta="' + n + '"]');
  const corazones = async n => Number((await tarjeta(n).locator('[data-cuenta-corazones]').innerText()).split('/')[0].trim());
  const estrellas = async n => Number((await tarjeta(n).locator('[data-cuenta-estrellas]').innerText()).split('/')[0].trim());
  const pulsar = async (n, acc) => {
    await tarjeta(n).locator('[data-accion="' + acc + '"]').click();
    await pag.waitForTimeout(180);
  };

  console.log('\n=== ' + destino + ' ===');
  console.log('    familia de prueba: ' + FAMILIA + (usarWebkit ? ' · motor WebKit' : ' · motor Chrome') + '\n');

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
  ok('el ranking sale arriba del todo', await pag.locator('#ranking').isVisible());
  ok('al empezar el dia van las tres igualadas, sin medallas',
     (await pag.locator('#listaRanking .puesto.igualados').count()) === 3);

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
  ok('el rojo lanza el fogonazo del corazon roto',
     await pag.locator('#fogonazo .astro.pierde').isVisible());
  ok('el fogonazo del rojo tira pedazos y cortina',
     (await pag.locator('#fogonazo .chispa').count()) === 34 &&
     (await pag.locator('#fogonazo .gota').count()) === 22);
  ok('el rojo cierra la pantalla en oscuro', await pag.locator('#fogonazo .vineta').isVisible());
  ok('el rojo NO lanza fuegos artificiales (eso es solo de la estrella)',
     await pag.evaluate(() => document.getElementById('fuegos').hidden));
  ok('el rojo sacude la pagina', await pag.evaluate(() => document.body.classList.contains('sacude')));
  ok('el rojo canta un aviso a lo grande', /OH|VAYA|UY/.test(await pag.locator('#fogonazo .cartel').innerText()));

  /* 4. estrellas suben */
  console.log('-- buenas acciones');
  await pulsar('paula', 'bien');
  ok('un toque en verde da 1 estrella', (await estrellas('paula')) === 1);
  ok('la buena accion NO devuelve corazones', (await corazones('paula')) === 5);
  ok('el verde lanza el fogonazo de la estrella',
     await pag.locator('#fogonazo .astro.gana').isVisible());
  ok('el verde abre el sol de rayos', await pag.locator('#fogonazo .rayos').isVisible());
  ok('el verde enciende los fuegos artificiales',
     await pag.evaluate(() => !document.getElementById('fuegos').hidden));
  ok('y apaga la luz para que se vean',
     await pag.evaluate(() => !document.getElementById('noche').hidden));
  ok('hay cohetes y confeti volando de verdad', await pag.evaluate(() => {
    const c = document.getElementById('fuegos');
    return c.width > 0 && c.height > 0;
  }));
  ok('ni los fuegos ni la noche interceptan los toques', await pag.evaluate(() =>
     getComputedStyle(document.getElementById('fuegos')).pointerEvents === 'none' &&
     getComputedStyle(document.getElementById('noche')).pointerEvents === 'none'));
  ok('el cartel saluda a la nina por su nombre',
     /PAULA/.test(await pag.locator('#fogonazo .cartel').innerText()));
  ok('sale el +1 de la estrella', await pag.locator('#fogonazo .masuno').isVisible());
  ok('el verde canta un aviso a lo grande', /BIEN|GENIAL|BRAVO|CAMPEONA|HACE/.test(await pag.locator('#fogonazo .cartel').innerText()));
  /* se mide el cuerpo de letra y no el rectangulo, porque la estrella gira en 3D
     y a mitad de giro su ancho proyectado es pequeno */
  ok('la estrella ocupa media pantalla de ancho', await pag.evaluate(() => {
    const t = parseFloat(getComputedStyle(document.querySelector('#fogonazo .astro')).fontSize);
    return t > window.innerWidth * 0.45;
  }));
  ok('el fogonazo sale de la tarjeta de esa nina', await pag.evaluate(() => {
    const capa = document.getElementById('fogonazo');
    const cx = parseFloat(capa.style.getPropertyValue('--cx'));
    const r = document.querySelector('[data-tarjeta="paula"]').getBoundingClientRect();
    return Math.abs(cx - (r.left + r.width / 2)) < 2;
  }));
  ok('el fogonazo no intercepta los toques', await pag.evaluate(() =>
     getComputedStyle(document.getElementById('fogonazo')).pointerEvents === 'none'));
  ok('el fogonazo se apaga solo', await esperarA(async () =>
     await pag.evaluate(() => document.getElementById('fogonazo').hidden), 5000, 150));
  ok('la pagina deja de temblar sola', await esperarA(async () =>
     await pag.evaluate(() => !document.body.className.match(/celebra|sacude/)), 3000, 150));
  ok('los fuegos se apagan solos y sueltan el lienzo', await esperarA(async () =>
     await pag.evaluate(() => document.getElementById('fuegos').hidden), 8000, 200));
  ok('y vuelve la luz', await esperarA(async () =>
     await pag.evaluate(() => document.getElementById('noche').hidden), 3000, 150));
  await pulsar('valeria', 'bien');
  ok('marcadores independientes (Valeria 4 corazones y 1 estrella)',
     (await corazones('valeria')) === 4 && (await estrellas('valeria')) === 1);

  /* 5. deshacer */
  console.log('-- deshacer');
  await pulsar('valeria', 'deshacer');
  ok('deshacer quita la ultima estrella', (await estrellas('valeria')) === 0);
  ok('deshacer no toca los corazones', (await corazones('valeria')) === 4);
  await pulsar('valeria', 'deshacer');
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
  ok('salta el confeti', await pag.evaluate(() => !document.getElementById('confeti').hidden));

  /* 8. ranking del dia */
  console.log('-- ranking de hoy');
  const rankNombres = async () => pag.locator('#listaRanking .rank .quien').allInnerTexts();
  ok('el ranking lista a las tres', (await pag.locator('#listaRanking .rank').count()) === 3);
  let orden = await rankNombres();
  ok('Paula (5 estrellas) va la primera', /Paula/.test(orden[0]), orden.join(' > '));
  ok('hay medallas cuando no estan empatadas', (await pag.locator('#listaRanking .puesto').first().innerText()).indexOf('🥇') >= 0);
  const marcaPaula = await pag.locator('#listaRanking .rank', { hasText: 'Paula' }).innerText();
  ok('el ranking canta estrellas y corazones', /⭐\s*5/.test(marcaPaula) && /❤️\s*5/.test(marcaPaula), marcaPaula.replace(/\n/g, ' '));
  ok('marca a la premiada con el regalo', /🎁/.test(marcaPaula));
  ok('de partida Alejandra va la ultima', /Alejandra/.test(orden[2]), orden.join(' > '));
  ok('el ranking canta el neto de Paula (5 ⭐ y ningun ❤️ perdido)',
     (await pag.locator('#listaRanking .rank', { hasText: 'Paula' }).locator('.neto').innerText()).trim() === '+5',
     await pag.locator('#listaRanking .rank', { hasText: 'Paula' }).locator('.neto').innerText());
  /* manda el neto, no las estrellas sueltas: Alejandra hace 3 ⭐ pero lleva 4 ❤️ perdidos */
  for (let i = 0; i < 3; i++) await pulsar('alejandra', 'bien');
  orden = await rankNombres();
  ok('con 3 ⭐ y 4 ❤️ perdidos (neto -1) Alejandra sigue por detras de Valeria (neto 0)',
     /Alejandra/.test(orden[2]), orden.join(' > '));
  for (let i = 0; i < 2; i++) await pulsar('valeria', 'mal');
  orden = await rankNombres();
  ok('perder corazones te hunde aunque no toques las estrellas',
     /Valeria/.test(orden[2]), orden.join(' > '));
  for (let i = 0; i < 2; i++) await pulsar('valeria', 'deshacer');
  for (let i = 0; i < 3; i++) await pulsar('alejandra', 'deshacer');
  orden = await rankNombres();
  ok('deshacer tambien recoloca el ranking', /Alejandra/.test(orden[2]), orden.join(' > '));
  await pag.locator('#listaRanking .rank', { hasText: 'Paula' }).click();
  await pag.waitForTimeout(700);
  ok('tocar en el ranking lleva a la tarjeta de esa nina', await pag.evaluate(() => {
    const r = document.querySelector('[data-tarjeta="paula"]').getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }));

  /* 9. historial */
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

  /* 10. persistencia local */
  console.log('-- persistencia');
  const antesE = await estrellas('paula'), antesC = await corazones('alejandra');
  await pag.reload({ waitUntil: 'load' });
  await pag.waitForTimeout(600);
  ok('los datos sobreviven a recargar', (await estrellas('paula')) === antesE && (await corazones('alejandra')) === antesC);
  const otra = await ctx.newPage();
  await otra.goto(destino, { waitUntil: 'load' });
  await otra.waitForTimeout(500);
  const eOtra = Number((await otra.locator('[data-tarjeta="paula"] [data-cuenta-estrellas]').innerText()).split('/')[0].trim());
  ok('los datos siguen al abrir de nuevo la app', eOtra === antesE);
  await otra.close();

  /* 11. se guarda tambien en el servidor */
  console.log('-- sincronizacion');
  ok('el estado dice que esta al dia', await esperarA(async () =>
     /Al día/.test(await pag.locator('#btnSync').innerText()), 10000),
     await pag.locator('#btnSync').innerText());
  const enServidor = await (await fetch(API + '/f/' + FAMILIA)).json();
  const hoyClave = clave(new Date());
  const evServidor = (enServidor.dias[hoyClave] || { eventos: [] }).eventos;
  ok('el servidor tiene los eventos de hoy (' + evServidor.length + ')', evServidor.length >= 6);
  ok('el servidor cuadra con la pantalla',
     evServidor.filter(e => e.nina === 'paula' && e.tipo === 'bien').length === antesE);

  /* 12. el otro movil: otro navegador limpio con el mismo codigo */
  const ctxB = await navegador.newContext(CONTEXTO);
  const movilB = await ctxB.newPage();
  await movilB.goto(conFamilia(FAMILIA), { waitUntil: 'load' });
  await movilB.waitForTimeout(800);
  const estrellasB = async n => Number((await movilB.locator('[data-tarjeta="' + n + '"] [data-cuenta-estrellas]').innerText()).split('/')[0].trim());
  const corazonesB = async n => Number((await movilB.locator('[data-tarjeta="' + n + '"] [data-cuenta-corazones]').innerText()).split('/')[0].trim());
  ok('el segundo movil ve lo que apunto el primero',
     await esperarA(async () => (await estrellasB('paula')) === antesE, 10000),
     'esperaba ' + antesE + ' y veo ' + (await estrellasB('paula')));
  ok('tambien ve los corazones', (await corazonesB('alejandra')) === antesC);

  await movilB.locator('[data-tarjeta="valeria"] [data-accion="mal"]').click();
  await movilB.waitForTimeout(400);
  await pag.evaluate(() => window.__reto.sincronizar());
  ok('lo que apunta el segundo movil llega al primero',
     await esperarA(async () => (await corazones('valeria')) === 4, 10000),
     'Valeria tiene ' + (await corazones('valeria')) + ' corazones');

  await pulsar('valeria', 'bien');
  await pag.waitForTimeout(900);
  await movilB.evaluate(() => window.__reto.sincronizar());
  ok('y al reves: lo del primero llega al segundo',
     await esperarA(async () => (await estrellasB('valeria')) === 1, 10000),
     'Valeria tiene ' + (await estrellasB('valeria')) + ' estrellas en el segundo movil');

  await pulsar('valeria', 'deshacer');
  await pag.waitForTimeout(900);
  await movilB.evaluate(() => window.__reto.sincronizar());
  ok('deshacer en un movil tambien se deshace en el otro',
     await esperarA(async () => (await estrellasB('valeria')) === 0, 10000),
     'Valeria tiene ' + (await estrellasB('valeria')) + ' estrellas en el segundo movil');

  /* 13. sin cobertura: se apunta igual y se manda al volver */
  console.log('-- sin cobertura');
  sinCobertura = true;
  await ctx.setOffline(true);            // modo avion de verdad, no un filtro de urls
  await pulsar('paula', 'mal');
  ok('sin conexion se sigue pudiendo apuntar', (await corazones('paula')) === 4);
  ok('avisa de que no hay conexion',
     await esperarA(async () => /Sin conexión/.test(await pag.locator('#btnSync').innerText()), 8000),
     await pag.locator('#btnSync').innerText());
  let recargoSinRed = true;
  try { await pag.reload({ waitUntil: 'load', timeout: 15000 }); }
  catch (e) { recargoSinRed = false; }   /* sin service worker no se puede recargar sin red */
  await pag.waitForTimeout(600);
  ok('lo apuntado sin conexion no se pierde al cerrar la app',
     !recargoSinRed || (await corazones('paula')) === 4,
     recargoSinRed ? '' : 'no se pudo recargar sin red');
  await ctx.setOffline(false);
  await pag.waitForTimeout(300);
  sinCobertura = false;
  if (!recargoSinRed) await pag.reload({ waitUntil: 'load' });
  await pag.waitForTimeout(400);
  await pag.evaluate(() => window.__reto.sincronizar());
  ok('al volver la conexion se envia solo',
     await esperarA(async () => /Al día/.test(await pag.locator('#btnSync').innerText()), 12000),
     await pag.locator('#btnSync').innerText());
  await movilB.evaluate(() => window.__reto.sincronizar());
  ok('y el otro movil lo acaba viendo',
     await esperarA(async () => (await corazonesB('paula')) === 4, 12000),
     'Paula tiene ' + (await corazonesB('paula')) + ' corazones en el segundo movil');
  await movilB.close(); await ctxB.close();

  /* 14. compartir con el otro movil */
  console.log('-- compartir');
  await pag.locator('#btnSync').click();
  await pag.waitForTimeout(350);
  ok('el panel de compartir ensena el codigo', (await pag.locator('#codigoFamilia').innerText()).indexOf(FAMILIA) >= 0);
  ok('hay boton para mandar el enlace al otro movil', await pag.locator('#btnEnlace').isVisible());
  ok('y sitio para escribir otro codigo', await pag.locator('#cfgFam').isVisible());
  await pag.locator('[data-cerrar]').click();
  await pag.waitForTimeout(250);

  /* 14 bis. fotos de las ninas */
  console.log('-- fotos');
  const ficheroFoto = path.join(__dirname, 'pruebas', 'foto-prueba.jpg');
  await pag.locator('#btnAjustes').click();
  await pag.waitForTimeout(350);
  await pag.locator('#cfgFotos').click();
  await pag.waitForTimeout(300);
  ok('hay una fila por nina para poner su foto', (await pag.locator('[data-fotofila]').count()) === 3);
  ok('de partida sale la inicial y no una foto', (await pag.locator('.fotofila .inicial.confoto').count()) === 0);
  await pag.locator('input[data-foto="paula"]').setInputFiles(ficheroFoto);
  await esperarA(async () => (await pag.locator('.fotofila .inicial.confoto').count()) === 1, 8000);
  ok('al elegir una foto se ve en el panel', (await pag.locator('.fotofila .inicial.confoto').count()) === 1);
  await pag.locator('[data-cerrar]').first().click();
  await pag.waitForTimeout(300);
  const avatarPaula = await tarjeta('paula').locator('.inicial').getAttribute('style');
  ok('la miniatura sale en la tarjeta de Paula', !!avatarPaula && /data:image\/jpeg;base64,/.test(avatarPaula));
  ok('solo cambia la de Paula', !(await tarjeta('valeria').locator('.inicial').getAttribute('style') || '').match(/data:image/));
  ok('y tambien en el ranking', (await pag.locator('#listaRanking .rank', { hasText: 'Paula' }).locator('.carita').count()) === 1);
  const tam = await pag.evaluate(() => {
    const f = JSON.parse(localStorage.getItem('reto-del-viaje-v2')).doc.fotos.paula;
    return f.img.length;
  });
  ok('la miniatura pesa poco (' + Math.round(tam / 1024) + ' KB)', tam > 500 && tam < 90000);
  ok('la foto llega al servidor', await esperarA(async () => {
    const d = await (await fetch(API + '/f/' + FAMILIA)).json();
    return d.fotos && d.fotos.paula && /^data:image\/jpeg;base64,/.test(d.fotos.paula.img);
  }, 12000));

  const ctxF = await navegador.newContext(CONTEXTO);
  const movilF = await ctxF.newPage();
  await movilF.goto(conFamilia(FAMILIA), { waitUntil: 'load' });
  ok('el otro movil ve la foto sin hacer nada', await esperarA(async () => {
    const st = await movilF.locator('[data-tarjeta="paula"] .inicial').getAttribute('style');
    return !!st && /data:image/.test(st);
  }, 12000));
  await movilF.close(); await ctxF.close();

  await pag.locator('#btnAjustes').click();
  await pag.waitForTimeout(300);
  await pag.locator('#cfgFotos').click();
  await pag.waitForTimeout(300);
  await pag.locator('[data-quitarfoto="paula"]').click();
  await pag.waitForTimeout(500);
  ok('se puede quitar la foto', (await pag.locator('.fotofila .inicial.confoto').count()) === 0);
  await pag.locator('[data-cerrar]').first().click();
  await pag.waitForTimeout(300);
  ok('al quitarla vuelve la inicial', !((await tarjeta('paula').locator('.inicial').getAttribute('style')) || '').match(/data:image/));

  /* 14 ter. premios que no se pierden y rachas */
  console.log('-- premios y rachas');
  const chipsPremio = n => tarjeta(n).locator('[data-premios]');
  ok('al llegar al objetivo se apunta un premio', await esperarA(async () => (await chipsPremio('paula').count()) === 1, 6000));
  ok('el chip dice cuantos premios lleva', /1 por dar/.test(await chipsPremio('paula').innerText()));
  ok('quien no ha llegado no tiene premio', (await chipsPremio('valeria').count()) === 0);
  ok('el premio llega al servidor', await esperarA(async () => {
    const d = await (await fetch(API + '/f/' + FAMILIA)).json();
    return d.premios && d.premios['paula|' + hoyClave] && d.premios['paula|' + hoyClave].estado === 'ganado';
  }, 12000));

  /* deshacer hasta bajar del objetivo: el premio se cae */
  for (let i = 0; i < 8 && (await estrellas('paula')) >= 5; i++) await pulsar('paula', 'deshacer');
  ok('si deshago y baja del objetivo, el premio se cae',
     await esperarA(async () => (await chipsPremio('paula').count()) === 0, 6000),
     'Paula tiene ' + (await estrellas('paula')) + ' estrellas');
  await pulsar('paula', 'bien');
  ok('y si vuelve a llegar, se apunta otra vez',
     await esperarA(async () => (await chipsPremio('paula').count()) === 1, 6000),
     'Paula tiene ' + (await estrellas('paula')) + ' estrellas');

  /* entregar el de Alejandra, y dejar el de Paula pendiente para la prueba del nuevo dia */
  for (let i = 0; i < 8 && (await estrellas('alejandra')) < 5; i++) await pulsar('alejandra', 'bien');
  ok('Alejandra tambien gana el suyo', await esperarA(async () => (await chipsPremio('alejandra').count()) === 1, 6000));
  await chipsPremio('alejandra').click();
  await pag.waitForTimeout(350);
  ok('el chip abre el panel de premios', await pag.locator('[data-entregado]').first().isVisible());
  ok('el panel dice de que dia es cada premio', /ganado el/.test(await pag.locator('.hoja').innerText()));
  ok('en el panel estan los dos premios pendientes', (await pag.locator('[data-entregado]').count()) === 2);
  await pag.locator('[data-entregado="alejandra|' + hoyClave + '"]').click();
  await pag.waitForTimeout(500);
  ok('al marcarlo como entregado deja de estar pendiente', (await pag.locator('[data-entregado]').count()) === 1);
  ok('y queda constancia de que se entrego', /entregado/.test(await pag.locator('.hoja').innerText()));
  await pag.locator('[data-cerrar]').first().click();
  await pag.waitForTimeout(300);
  ok('el chip desaparece de la tarjeta al entregarlo', (await chipsPremio('alejandra').count()) === 0);
  await pulsar('alejandra', 'bien');
  await pag.waitForTimeout(300);
  ok('no se apunta otro premio el mismo dia si ya se lo dieron', (await chipsPremio('alejandra').count()) === 0);
  ok('el de Paula sigue pendiente', (await chipsPremio('paula').count()) === 1);


  /* 15. ajustes */
  console.log('-- ajustes');
  await pag.locator('#btnAjustes').click();
  await pag.waitForTimeout(350);
  ok('se abre el panel de ajustes', await pag.locator('#cfgOp').isVisible());
  await pag.locator('#cfgOp').fill('3');
  await pag.locator('#cfgOb').fill('2');
  await pag.locator('#cfgRe').fill('Helado doble');
  await pag.locator('#cfgCa').fill('Sin pantallas');
  await pag.locator('#cfgGuardar').click();
  await pag.waitForTimeout(400);
  ok('ahora se pintan 3 corazones', (await tarjeta('valeria').locator('[data-corazones] .pip').count()) === 3);
  ok('el objetivo baja a 2', /\/\s*2/.test(await tarjeta('valeria').locator('[data-cuenta-estrellas]').innerText()));
  ok('Paula sigue premiada con el texto nuevo', /Helado doble/i.test(await tarjeta('paula').locator('[data-premiada]').innerText()));
  for (let i = 0; i < 10 && (await corazones('valeria')) > 0; i++) await pulsar('valeria', 'mal');
  ok('el castigo usa el texto nuevo', /SIN PANTALLAS/.test(await tarjeta('valeria').locator('[data-castigada]').innerText()));
  ok('los ajustes tambien viajan al servidor', await esperarA(async () => {
    const d = await (await fetch(API + '/f/' + FAMILIA)).json();
    return d.config && d.config.oportunidades === 3 && d.config.textoRecompensa === 'Helado doble';
  }, 12000));

  /* 16. nuevo dia */
  console.log('-- nuevo dia');
  await pag.locator('#btnNuevoDia').click();
  await pag.waitForTimeout(350);
  ok('pide confirmacion', await pag.locator('#siNuevoDia').isVisible());
  await pag.locator('[data-cerrar]').click();
  await pag.waitForTimeout(250);
  ok('si cancelo no se borra nada', (await corazones('valeria')) === 0);
  await pag.locator('#btnNuevoDia').click();
  await pag.waitForTimeout(350);
  await pag.locator('#siNuevoDia').click();
  await pag.waitForTimeout(500);
  ok('las tres vuelven a los corazones configurados',
     (await corazones('valeria')) === 3 && (await corazones('alejandra')) === 3 && (await corazones('paula')) === 3);
  ok('las estrellas vuelven a 0', (await estrellas('paula')) === 0);
  ok('se borra el historial', (await pag.locator('#historial .vacio').count()) === 1);
  const guardado = await pag.evaluate(() => JSON.parse(localStorage.getItem('reto-del-viaje-v2')));
  ok('se mantiene la configuracion', guardado.doc.config.oportunidades === 3 && guardado.doc.config.textoRecompensa === 'Helado doble');
  ok('EL PREMIO NO SE PIERDE al empezar un dia nuevo', (await tarjeta('paula').locator('[data-premios]').count()) === 1,
     'chips de premio: ' + (await tarjeta('paula').locator('[data-premios]').count()));
  ok('el borrado del dia tambien llega al servidor', await esperarA(async () => {
    const d = await (await fetch(API + '/f/' + FAMILIA)).json();
    const dh = d.dias[hoyClave] || { eventos: [] };
    return dh.eventos.length === 0;
  }, 12000));

  /* 17. ranking de la semana, con datos sembrados de lunes a hoy */
  console.log('-- ranking de la semana (L-V)');
  const dias = diasDeLaSemanaHastaHoy();
  const esperado = { valeria: { e: 0, p: 0 }, alejandra: { e: 0, p: 0 }, paula: { e: 0, p: 0 } };
  const siembra = [];
  let sello = 1;
  dias.forEach((d, i) => {
    const mete = (nina, tipo, veces) => {
      for (let k = 0; k < veces; k++) {
        siembra.push({ id: 'x' + (sello++), dia: d, nina: nina, tipo: tipo, hora: '1' + dos(k) + ':0' + (i % 10), ts: sello });
        esperado[nina][tipo === 'bien' ? 'e' : 'p']++;
      }
    };
    mete('valeria', 'bien', i + 1);
    mete('alejandra', 'bien', 1);
    mete('alejandra', 'mal', i === 0 ? 5 : 1);
    if (i === 0) mete('paula', 'bien', 5);
  });
  await fetch(API + '/f/' + FAMILIA_SEM, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nuevos: siembra })
  });
  const ctxS = await navegador.newContext(CONTEXTO);
  const pagS = await ctxS.newPage();
  pagS.on('pageerror', e => errores.push(String(e)));
  await pagS.goto(conFamilia(FAMILIA_SEM), { waitUntil: 'load' });
  await pagS.waitForTimeout(900);
  ok('hay pestanas Hoy y Semana', (await pagS.locator('.pest').count()) === 2);
  await pagS.locator('.pest[data-vista="semana"]').click();
  await pagS.waitForTimeout(350);
  ok('el titulo cambia a la semana', /semana/i.test(await pagS.locator('#tituloRanking').innerText()));
  ok('la pestana de la semana queda marcada', await pagS.locator('.pest[data-vista="semana"]').evaluate(e => e.className.indexOf('activa') >= 0));
  ok('salen las tres ninas en la semana', (await pagS.locator('.semanera').count()) === 3);
  const letras = await pagS.locator('.semanera').first().locator('.dia b').allInnerTexts();
  ok('cinco columnas de lunes a viernes: ' + letras.join(''), letras.join('') === 'LMXJV');
  for (const n of ['valeria', 'alejandra', 'paula']) {
    const nombre = n.charAt(0).toUpperCase() + n.slice(1);
    const fila = await pagS.locator('.semanera', { hasText: nombre }).locator('.marca').innerText();
    const est = Number((fila.match(/⭐\s*(\d+)/) || [])[1]);
    const per = Number((fila.match(/💔\s*(\d+)/) || [])[1]);
    ok('suma la semana de ' + nombre + ' (⭐' + est + ' 💔' + per + ')',
       est === esperado[n].e && per === esperado[n].p,
       'esperaba ⭐' + esperado[n].e + ' 💔' + esperado[n].p);
  }
  for (const n of ['valeria', 'alejandra', 'paula']) {
    const nombre = n.charAt(0).toUpperCase() + n.slice(1);
    const chapa = (await pagS.locator('.semanera', { hasText: nombre }).locator('.neto').innerText()).trim();
    ok('canta el neto de la semana de ' + nombre + ' (' + chapa + ')',
       Number(chapa.replace('+', '')) === esperado[n].e - esperado[n].p,
       'esperaba ' + (esperado[n].e - esperado[n].p));
    const porDia = await pagS.locator('.semanera', { hasText: nombre }).locator('.dia u').allInnerTexts();
    ok('cada casilla de dia de ' + nombre + ' lleva su neto', porDia.length === 5, porDia.join(' '));
    const suma = porDia.reduce((a, t) => a + (Number(t.trim().replace('+', '')) || 0), 0);
    ok('los netos por dia de ' + nombre + ' suman el de la semana (' + suma + ')',
       suma === esperado[n].e - esperado[n].p,
       porDia.join(' ') + ' · esperaba ' + (esperado[n].e - esperado[n].p));
  }
  const ordenSem = await pagS.locator('.semanera .quien').allInnerTexts();
  const neto = n => esperado[n].e - esperado[n].p;
  const porNeto = Object.keys(esperado).sort((a, b) => neto(b) - neto(a) || esperado[b].e - esperado[a].e);
  ok('la semana va ordenada por el neto, no por las estrellas',
     porNeto.every((n, i) => new RegExp(n, 'i').test(ordenSem[i])),
     ordenSem.join(' > ') + ' · esperaba ' + porNeto.map(n => n + '(' + neto(n) + ')').join(' > '));
  const lunesAlejandra = await pagS.locator('.semanera', { hasText: 'Alejandra' }).locator('.dia').first().innerText();
  ok('el lunes que se quedo sin corazones sale ⛔', /⛔/.test(lunesAlejandra), lunesAlejandra.replace(/\n/g, ''));
  const lunesPaula = await pagS.locator('.semanera', { hasText: 'Paula' }).locator('.dia').first().innerText();
  ok('el lunes que llego al premio sale 🎁', /🎁/.test(lunesPaula), lunesPaula.replace(/\n/g, ''));
  const finde = [0, 6].indexOf(new Date().getDay()) >= 0;
  const casillasHoy = await pagS.locator('.semanera').first().locator('.dia.hoy').count();
  ok(finde ? 'en fin de semana no hay casilla de hoy, que la semana es L-V'
           : 'el dia de hoy va resaltado',
     casillasHoy === (finde ? 0 : 1), 'casillas marcadas como hoy: ' + casillasHoy);
  ok('los dias que aun no han llegado salen apagados',
     (await pagS.locator('.semanera').first().locator('.dia.futuro').count()) === 5 - dias.length);
  ok('hoy sigue estando a cero pese al historial de la semana',
     Number((await pagS.locator('[data-tarjeta="paula"] [data-cuenta-corazones]').innerText()).split('/')[0].trim()) === 5 ||
     dias.length === 1);
  await pagS.locator('.pest[data-vista="hoy"]').click();
  await pagS.waitForTimeout(300);
  ok('se puede volver a la vista de hoy', /hoy/i.test(await pagS.locator('#tituloRanking').innerText()));
  ok('la pestana elegida se recuerda al recargar', await (async () => {
    await pagS.locator('.pest[data-vista="semana"]').click();
    await pagS.waitForTimeout(200);
    await pagS.reload({ waitUntil: 'load' });
    await pagS.waitForTimeout(600);
    return /semana/i.test(await pagS.locator('#tituloRanking').innerText());
  })());
  /* racha: dias seguidos sin castigo, con la semana ya sembrada */
  await pagS.locator('.pest[data-vista="hoy"]').click();
  await pagS.waitForTimeout(300);
  const chipRacha = pagS.locator('[data-tarjeta="valeria"] .logro', { hasText: 'días' });
  if (dias.length >= 2) {
    ok('Valeria, que nunca se quedo sin corazones, luce racha',
       await esperarA(async () => (await chipRacha.count()) === 1, 8000));
    if (await chipRacha.count()) {
      ok('la racha cuenta los ' + dias.length + ' dias jugados',
         new RegExp('🔥 ' + dias.length + ' días').test(await chipRacha.innerText()),
         await chipRacha.innerText());
    }
    const chipAle = pagS.locator('[data-tarjeta="alejandra"] .logro', { hasText: 'días' });
    ok('Alejandra, castigada el lunes, no arrastra la racha entera',
       (await chipAle.count()) === 0 || !new RegExp('🔥 ' + dias.length + ' días').test(await chipAle.innerText()));
  } else {
    ok('hoy es lunes: todavia no hay racha que ensenar', (await chipRacha.count()) === 0);
  }
  await pagS.close(); await ctxS.close();

  /* 17 bis. pantalla para las ninas */
  console.log('-- pantalla para ellas');
  await pag.locator('#btnEscaparate').click();
  await pag.waitForTimeout(400);
  const esc = pag.locator('#escaparate');
  ok('se abre la pantalla para ellas', await esc.isVisible());
  ok('salen las tres', (await esc.locator('.esc-nina').count()) === 3);
  ok('con sus corazones y sus estrellas',
     (await esc.locator('.esc-nina').first().locator('.esc-pips').count()) === 2);
  ok('NO hay ningun boton de sumar o restar dentro',
     (await esc.locator('[data-accion]').count()) === 0);
  /* mismo orden que el ranking de hoy: primero la que va ganando */
  const soloNombre = t => (t.match(/Valeria|Alejandra|Paula/) || [''])[0];
  const ordenEsc = (await esc.locator('.esc-nombre').allInnerTexts()).map(soloNombre);
  await pag.locator('#btnSalirEscaparate').click({ delay: 1200 });
  await pag.waitForTimeout(400);
  const ordenRanking = (await pag.locator('#listaRanking .rank .quien').allInnerTexts()).map(soloNombre);
  ok('las ninas salen en el orden del ranking', ordenEsc.join('>') === ordenRanking.join('>'),
     'pantalla: ' + ordenEsc.join('>') + ' · ranking: ' + ordenRanking.join('>'));
  await pag.locator('#btnEscaparate').click();
  await pag.waitForTimeout(400);
  const medallas = await esc.locator('.esc-puesto').allInnerTexts();
  ok('la primera lleva medalla de oro', medallas.length === 0 || medallas[0].indexOf('🥇') >= 0,
     medallas.join(' '));
  ok('o no hay medallas si van las tres igualadas',
     medallas.length === 3 || medallas.length === 0, 'medallas: ' + medallas.length);
  const antesToque = await pag.evaluate(() => JSON.stringify(window.__reto.marcador(new Date().toISOString().slice(0,10), 'valeria')));
  await esc.locator('.esc-nina').first().click({ position: { x: 60, y: 40 } });
  await esc.locator('.esc-nina').nth(1).click();
  await pag.waitForTimeout(300);
  const despuesToque = await pag.evaluate(() => JSON.stringify(window.__reto.marcador(new Date().toISOString().slice(0,10), 'valeria')));
  ok('si la tocan no cambia nada', antesToque === despuesToque);
  const mEsc = await pag.evaluate(() => ({ scroll: document.documentElement.scrollWidth, ancho: window.innerWidth }));
  ok('no desborda a lo ancho', mEsc.scroll <= mEsc.ancho + 1);

  await pag.locator('#btnSalirEscaparate').click({ delay: 120 });
  await pag.waitForTimeout(300);
  ok('un toque suelto NO la cierra', await esc.isVisible());
  await pag.locator('#btnSalirEscaparate').click({ delay: 1200 });
  await pag.waitForTimeout(400);
  ok('manteniendo pulsado si se sale', !(await esc.isVisible()));

  /* se actualiza sola con lo que apunte el otro movil */
  await pag.locator('#btnEscaparate').click();
  await pag.waitForTimeout(300);
  const corazonesEsc = async () => (await esc.locator('.esc-nina').first().locator('.esc-pips').first().innerText()).replace(/\s/g, '').indexOf('🖤');
  const antesFuera = await esc.locator('.esc-nina').first().innerText();
  await fetch(API + '/f/' + FAMILIA, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nuevos: [{ id: 'desdeFuera1', dia: hoyClave, nina: 'valeria', tipo: 'mal', hora: '20:00', ts: Date.now() }] })
  });
  await pag.evaluate(() => window.__reto.sincronizar());
  ok('se actualiza sola cuando apunta el otro movil',
     await esperarA(async () => (await esc.locator('.esc-nina').first().innerText()) !== antesFuera, 12000));
  await pag.locator('#btnSalirEscaparate').click({ delay: 1200 });
  await pag.waitForTimeout(300);

  /* 18. sonido */
  console.log('-- sonido');
  ok('empieza con el sonido activado', (await pag.locator('#btnSonido').innerText()).indexOf('🔊') >= 0);
  await pag.locator('#btnSonido').click();
  await pag.waitForTimeout(150);
  ok('se puede silenciar', (await pag.locator('#btnSonido').innerText()).indexOf('🔇') >= 0);
  await pag.reload({ waitUntil: 'load' });
  await pag.waitForTimeout(500);
  ok('recuerda que esta silenciado', (await pag.locator('#btnSonido').innerText()).indexOf('🔇') >= 0);
  await pag.locator('#btnSonido').click();
  await pag.waitForTimeout(150);

  /* 19. movil: sin scroll horizontal, nada tapado */
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
    const fuera = await pag.evaluate(() => {
      const malos = [];
      document.querySelectorAll('.tarjeta button, .nuevodia, .icono, .pest').forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.left < -1 || r.right > window.innerWidth + 1 || r.height < 40) malos.push(b.textContent.trim().slice(0, 22));
      });
      return malos;
    });
    ok('ningun boton se sale ni queda pequeno en ' + medida.width + 'px', fuera.length === 0, fuera.join(' | '));
  }
  /* con la vista de semana tampoco */
  await pag.setViewportSize(IPHONE_SE);
  await pag.locator('.pest[data-vista="semana"]').click();
  await pag.waitForTimeout(300);
  const mSem = await pag.evaluate(() => ({ scroll: document.documentElement.scrollWidth, ancho: window.innerWidth }));
  ok('la vista de semana tampoco desborda a lo ancho en 320px', mSem.scroll <= mSem.ancho + 1,
     'scrollWidth=' + mSem.scroll);
  await pag.locator('.pest[data-vista="hoy"]').click();
  await pag.waitForTimeout(200);

  await pag.setViewportSize(IPHONE);
  await pag.evaluate(() => window.scrollTo(0, 0));
  await pag.waitForTimeout(300);
  const arriba = await pag.evaluate(() => {
    const r = document.getElementById('ranking').getBoundingClientRect();
    const b = document.getElementById('btnNuevoDia').getBoundingClientRect();
    const t = document.querySelector('.tarjeta').getBoundingClientRect();
    const h = document.querySelector('.top').getBoundingClientRect();
    return {
      rankingVisible: r.top >= h.bottom - 1 && r.bottom <= window.innerHeight,
      botonVisible: b.top >= h.bottom - 1 && b.bottom <= window.innerHeight,
      enOrden: r.bottom <= b.top + 1 && b.bottom <= t.top + 1,
      tapaCabecera: r.top < h.bottom - 1
    };
  });
  ok('el ranking se ve sin desplazar', arriba.rankingVisible);
  ok('el boton de nuevo dia se ve sin desplazar', arriba.botonVisible);
  ok('orden: ranking, nuevo dia y luego las tarjetas', arriba.enOrden);
  ok('la cabecera no tapa el ranking', !arriba.tapaCabecera);
  ok('el boton de nuevo dia queda accesible y sin tapar', await pag.evaluate(() => {
    const b = document.getElementById('btnNuevoDia');
    const r = b.getBoundingClientRect();
    const encima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return encima === b || b.contains(encima);
  }));

  /* 20. PWA */
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

  ok('sin errores de JavaScript', errores.length === 0, errores.slice(0, 3).join(' | '));

  /* capturas */
  const dirCap = path.join(__dirname, 'capturas');
  fs.mkdirSync(dirCap, { recursive: true });
  await pag.screenshot({ path: path.join(dirCap, 'iphone-arriba.png') });
  await pag.locator('.pest[data-vista="semana"]').click();
  await pag.waitForTimeout(400);
  await pag.screenshot({ path: path.join(dirCap, 'iphone-semana.png') });
  await pag.screenshot({ path: path.join(dirCap, 'iphone-completo.png'), fullPage: true });
  await pag.setViewportSize({ width: 1280, height: 900 });
  await pag.waitForTimeout(300);
  await pag.screenshot({ path: path.join(dirCap, 'escritorio.png') });

  await pag.evaluate(() => localStorage.clear());
  await navegador.close();
  await borrarFamilia(FAMILIA);
  await borrarFamilia(FAMILIA_SEM);

  console.log('\n' + (fallos ? 'FALLOS: ' + fallos + ' de ' + hechos : 'TODO CORRECTO: ' + hechos + ' comprobaciones') + '\n');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
