/* API de sincronizacion de "El Super Reto" (antes "El Reto del Viaje").
 *
 * Guarda, por codigo de familia, los eventos de cada dia (una buena accion o una
 * oportunidad perdida). Los dos moviles mandan lo suyo y se quedan con la union:
 * asi da igual quien apunte, y quien no tenga cobertura lo manda cuando vuelva.
 *
 * Node puro, sin dependencias. Detras de Traefik en https://miplandeempresa.com/reto-api/
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUERTO = Number(process.env.PUERTO || 8091);
const DATOS = process.env.DATOS || path.join(__dirname, 'datos');
const BASE = '/reto-api';
const DIAS_GUARDADOS = 28;
const MAX_CUERPO = 1024 * 1024;   // las fotos en miniatura viajan aqui dentro
const MAX_EVENTOS_DIA = 2000;

fs.mkdirSync(DATOS, { recursive: true });

/* ---------- utilidades ---------- */
const esFamilia = f => typeof f === 'string' && /^[a-z0-9][a-z0-9-]{3,39}$/.test(f);
const esDia = d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
const recorta = (s, n) => String(s == null ? '' : s).slice(0, n);

function ficheroDe(familia) { return path.join(DATOS, familia + '.json'); }

function docVacio() { return { v: 1, config: null, fotos: {}, premios: {}, dias: {}, ts: 0 }; }

function leer(familia) {
  try {
    const doc = JSON.parse(fs.readFileSync(ficheroDe(familia), 'utf8'));
    if (!doc || typeof doc !== 'object') return docVacio();
    doc.dias = doc.dias && typeof doc.dias === 'object' ? doc.dias : {};
    doc.fotos = doc.fotos && typeof doc.fotos === 'object' ? doc.fotos : {};
    doc.premios = doc.premios && typeof doc.premios === 'object' ? doc.premios : {};
    return doc;
  } catch (e) { return docVacio(); }
}

function escribir(familia, doc) {
  const tmp = ficheroDe(familia) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(doc), 'utf8');
  fs.renameSync(tmp, ficheroDe(familia));
}

/* una escritura cada vez por familia, para que dos moviles a la vez no se pisen */
const colas = new Map();
function enCola(familia, tarea) {
  const anterior = colas.get(familia) || Promise.resolve();
  const siguiente = anterior.then(tarea, tarea);
  colas.set(familia, siguiente.catch(() => {}));
  return siguiente;
}

function podar(doc) {
  const dias = Object.keys(doc.dias).sort();
  while (dias.length > DIAS_GUARDADOS) delete doc.dias[dias.shift()];
}

function eventoLimpio(ev) {
  if (!ev || typeof ev !== 'object') return null;
  if (!esDia(ev.dia)) return null;
  if (ev.tipo !== 'bien' && ev.tipo !== 'mal') return null;
  const id = recorta(ev.id, 40);
  const nina = recorta(ev.nina, 24);
  if (!id || !nina) return null;
  return { id: id, nina: nina, tipo: ev.tipo, hora: recorta(ev.hora, 5), ts: Number(ev.ts) || Date.now(), dia: ev.dia };
}

function fusionar(doc, cambios) {
  if (cambios.config && typeof cambios.config === 'object') {
    const ts = Number(cambios.config.ts) || 0;
    if (!doc.config || ts > (Number(doc.config.ts) || 0)) {
      doc.config = {
        oportunidades: Math.max(1, Math.min(10, parseInt(cambios.config.oportunidades, 10) || 5)),
        objetivo: Math.max(1, Math.min(10, parseInt(cambios.config.objetivo, 10) || 5)),
        textoRecompensa: recorta(cambios.config.textoRecompensa, 60) || '¡Premio especial!',
        textoCastigo: recorta(cambios.config.textoCastigo, 30) || 'Castigada',
        ts: ts
      };
    }
  }
  if (cambios.fotos && typeof cambios.fotos === 'object') {
    doc.fotos = doc.fotos || {};
    Object.keys(cambios.fotos).slice(0, 10).forEach(k => {
      const f = cambios.fotos[k];
      if (!f || typeof f !== 'object') return;
      const nina = recorta(k, 24);
      const ts = Number(f.ts) || 0;
      const img = typeof f.img === 'string' ? f.img.slice(0, 90000) : '';
      if (img && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img)) return;
      const actual = doc.fotos[nina];
      if (!actual || ts > (Number(actual.ts) || 0)) doc.fotos[nina] = { img: img, ts: ts };
    });
  }
  /* premios ganados: una clave "nina|dia" por premio, gana la marca de tiempo mas nueva */
  if (cambios.premios && typeof cambios.premios === 'object') {
    doc.premios = doc.premios || {};
    Object.keys(cambios.premios).slice(0, 400).forEach(k => {
      const p = cambios.premios[k];
      if (!p || typeof p !== 'object') return;
      const clave = recorta(k, 40);
      if (!/^[a-z0-9-]{1,24}\|\d{4}-\d{2}-\d{2}$/.test(clave)) return;
      if (['ganado', 'entregado', 'anulado'].indexOf(p.estado) < 0) return;
      const ts = Number(p.ts) || 0;
      const actual = doc.premios[clave];
      if (!actual || ts > (Number(actual.ts) || 0)) doc.premios[clave] = { estado: p.estado, ts: ts };
    });
    const claves = Object.keys(doc.premios).sort();
    while (claves.length > 400) delete doc.premios[claves.shift()];
  }
  const dia = d => doc.dias[d] || (doc.dias[d] = { eventos: [], borrados: [] });

  (Array.isArray(cambios.borrados) ? cambios.borrados : []).slice(0, 500).forEach(b => {
    if (!b || !esDia(b.dia)) return;
    const id = recorta(b.id, 40); if (!id) return;
    const d = dia(b.dia);
    if (d.borrados.indexOf(id) < 0) d.borrados.push(id);
    d.eventos = d.eventos.filter(x => x.id !== id);
  });

  (Array.isArray(cambios.nuevos) ? cambios.nuevos : []).slice(0, 500).forEach(raw => {
    const ev = eventoLimpio(raw); if (!ev) return;
    const d = dia(ev.dia);
    if (d.borrados.indexOf(ev.id) >= 0) return;          // ya lo deshizo el otro movil
    if (d.eventos.some(x => x.id === ev.id)) return;     // repetido
    if (d.eventos.length >= MAX_EVENTOS_DIA) return;
    delete ev.dia;
    d.eventos.push(ev);
  });

  Object.keys(doc.dias).forEach(k => {
    const d = doc.dias[k];
    d.eventos.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    if (d.borrados.length > MAX_EVENTOS_DIA) d.borrados = d.borrados.slice(-MAX_EVENTOS_DIA);
  });
  podar(doc);
  doc.ts = Date.now();
  return doc;
}

/* ---------- http ---------- */
function cors(req, res) {
  const origen = req.headers.origin || '';
  const vale = /^https:\/\/[a-z0-9-]+\.github\.io$/.test(origen) ||
               /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origen);
  res.setHeader('Access-Control-Allow-Origin', vale ? origen : 'https://aclasesor-bit.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Vary', 'Origin');
}
function json(res, codigo, cuerpo) {
  const txt = JSON.stringify(cuerpo);
  res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(txt);
}
function cuerpoDe(req) {
  return new Promise((resolver, rechazar) => {
    let total = 0; const trozos = [];
    req.on('data', c => {
      total += c.length;
      if (total > MAX_CUERPO) { rechazar(new Error('cuerpo demasiado grande')); req.destroy(); return; }
      trozos.push(c);
    });
    req.on('end', () => {
      if (!trozos.length) return resolver({});
      try { resolver(JSON.parse(Buffer.concat(trozos).toString('utf8'))); }
      catch (e) { rechazar(new Error('json invalido')); }
    });
    req.on('error', rechazar);
  });
}

const servidor = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, 'http://x');
  let ruta = url.pathname;
  if (ruta.indexOf(BASE) === 0) ruta = ruta.slice(BASE.length) || '/';

  if (ruta === '/salud') return json(res, 200, { ok: true, ts: Date.now() });

  const m = ruta.match(/^\/f\/([^/]+)\/?$/);
  if (!m) return json(res, 404, { error: 'no existe' });
  const familia = decodeURIComponent(m[1]).toLowerCase();
  if (!esFamilia(familia)) return json(res, 400, { error: 'codigo de familia invalido' });

  if (req.method === 'GET') {
    return json(res, 200, leer(familia));
  }
  if (req.method === 'POST') {
    let cambios;
    try { cambios = await cuerpoDe(req); }
    catch (e) { return json(res, 400, { error: e.message }); }
    try {
      const doc = await enCola(familia, () => {
        const d = fusionar(leer(familia), cambios || {});
        escribir(familia, d);
        return d;
      });
      return json(res, 200, doc);
    } catch (e) {
      console.error('[error]', familia, e.message);
      return json(res, 500, { error: 'no se ha podido guardar' });
    }
  }
  if (req.method === 'DELETE') {
    // solo lo usan las pruebas: borra el buzon entero de esa familia
    try { fs.unlinkSync(ficheroDe(familia)); } catch (e) {}
    return json(res, 200, { borrado: true });
  }
  return json(res, 405, { error: 'metodo no permitido' });
});

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log('reto-api escuchando en 127.0.0.1:' + PUERTO + ' · datos en ' + DATOS);
});
