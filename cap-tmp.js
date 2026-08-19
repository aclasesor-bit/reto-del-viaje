const { chromium } = require('playwright-core');
const path = require('path');
const F = 'casa-demo' + Date.now().toString(36).slice(-5);
const API = 'https://miplandeempresa.com/reto-api';
(async () => {
  const nav = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'es-ES' });
  const p = await ctx.newPage();
  // sembrar tres dias para que haya racha y premios de dias anteriores
  const hoy = new Date();
  const dos = n => String(n).padStart(2, '0');
  const clave = d => d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  const nuevos = [], premios = {};
  let k = 0;
  for (let i = 2; i >= 1; i--) {
    const d = new Date(hoy); d.setDate(hoy.getDate() - i);
    const f = clave(d);
    for (let j = 0; j < 5; j++) nuevos.push({ id: 'a' + (k++), dia: f, nina: 'valeria', tipo: 'bien', hora: '18:0' + j, ts: k });
    for (let j = 0; j < 3; j++) nuevos.push({ id: 'a' + (k++), dia: f, nina: 'alejandra', tipo: 'bien', hora: '18:0' + j, ts: k });
    nuevos.push({ id: 'a' + (k++), dia: f, nina: 'paula', tipo: 'mal', hora: '19:00', ts: k });
    premios['valeria|' + f] = { estado: 'ganado', ts: Date.now() - i * 1000 };
  }
  const f0 = clave(hoy);
  for (let j = 0; j < 3; j++) nuevos.push({ id: 'b' + (k++), dia: f0, nina: 'valeria', tipo: 'bien', hora: '19:1' + j, ts: k });
  for (let j = 0; j < 2; j++) nuevos.push({ id: 'c' + (k++), dia: f0, nina: 'paula', tipo: 'mal', hora: '19:2' + j, ts: k });
  nuevos.push({ id: 'd' + (k++), dia: f0, nina: 'alejandra', tipo: 'bien', hora: '19:30', ts: k });
  await fetch(API + '/f/' + F, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nuevos, premios }) });

  await p.goto('https://aclasesor-bit.github.io/reto-del-viaje/?f=' + F, { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(__dirname, 'capturas', 'logros.png'), fullPage: true });
  await p.locator('#btnEscaparate').click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(__dirname, 'capturas', 'escaparate.png') });
  await nav.close();
  await fetch(API + '/f/' + F, { method: 'DELETE' });
})();
