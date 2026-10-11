/**
 * Resultados de Chacabuco desde FEFI → fixture.json.
 * Ejecutado por GitHub Actions junto con fetch-posiciones.js.
 *
 * Solo toca `resultado` y `estado` de los partidos que FEFI marca como
 * "Verificado". Horarios, categorías, precio y todo lo demás sigue siendo
 * manual (admin.html). Un partido sin verificar en FEFI no se modifica,
 * así que un resultado cargado a mano no se pisa con vacío.
 *
 * En `goles_local` / `goles_visitante` se guardan los PUNTOS totales del
 * partido (suma de las 7 categorías), que es lo que define quién ganó.
 */
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const cheerio = require('cheerio');

// Mismo endpoint que fetch-posiciones.js, otra vista (ver CLAUDE.md)
const TORNEO = 1;
const ZONA   = 14;
const VISTA  = 'fechas-clausura';

const API_URL = `https://fefi.com.ar/wp-json/fefit/v1/vista?torneo=${TORNEO}&zona=${ZONA}&vista=${VISTA}`;
const OUTPUT  = path.join(__dirname, '..', 'fixture.json');


function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (fixture-updater/1.0)' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return get(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} en ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

function norm(t) {
  return t.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim();
}

// ── Partidos de Chacabuco — uno por <section data-panel="N"> (N = fecha) ──
// Cada partido es un <article> con una tabla de 2 filas: local primero,
// visitante después. La última celda de cada fila son los puntos totales.
function parsearPartidos($) {
  const partidos = {};

  $('section.fefit-fecha').each((_, section) => {
    const numero = parseInt($(section).attr('data-panel'), 10);

    $(section).find('article.fefit-partido').each((_, article) => {
      const tabla = $(article).find('table.fefit-res');
      const filas = tabla.find('tbody tr').map((_, tr) => ({
        equipo: $(tr).find('th').text().trim(),
        pts:    parseInt($(tr).find('td').last().text().trim(), 10),
      })).get();

      if (filas.length !== 2) return;
      const idx = filas.findIndex(f => norm(f.equipo).includes('chacabuco'));
      if (idx === -1) return;

      partidos[numero] = {
        estado:    tabla.find('thead .fefit-estado').text().trim(),
        condicion: idx === 0 ? 'local' : 'visitante',
        rival:     filas[1 - idx].equipo,
        local:     filas[0].pts,
        visitante: filas[1].pts,
      };
    });
  });

  return partidos;
}

async function main() {
  console.log(`Fetching ${API_URL}`);
  const body = await get(API_URL);

  let html;
  try {
    ({ html } = JSON.parse(body));
  } catch {
    throw new Error('La respuesta no es JSON — ¿cambió el endpoint?');
  }
  if (!html) throw new Error(`Respuesta sin html para zona=${ZONA} vista=${VISTA}`);

  const partidos = parsearPartidos(cheerio.load(html));
  if (Object.keys(partidos).length === 0) {
    throw new Error('No se encontró ningún partido de Chacabuco — revisar la estructura de la página');
  }

  const raw  = fs.readFileSync(OUTPUT, 'utf8');
  const data = JSON.parse(raw);
  let cambios = 0;

  console.log('');
  for (const p of data.fixture) {
    if (p.condicion === 'libre') continue;
    const fefi = partidos[p.numero];

    if (!fefi) {
      console.warn(`   ⚠️  Fecha ${p.numero}: no está en FEFI`);
      continue;
    }
    if (fefi.estado !== 'Verificado') continue;
    if (!Number.isInteger(fefi.local) || !Number.isInteger(fefi.visitante)) {
      console.warn(`   ⚠️  Fecha ${p.numero}: verificado pero sin puntos — se omite`);
      continue;
    }
    // Si local/visitante no coincide, el fixture cargado no corresponde con
    // el de FEFI: mejor no escribir un resultado invertido
    if (fefi.condicion !== p.condicion) {
      console.warn(
        `   ⚠️  Fecha ${p.numero}: fixture.json dice ${p.condicion} vs ${p.rival}, ` +
        `FEFI dice ${fefi.condicion} vs ${fefi.rival} — se omite`
      );
      continue;
    }

    const r = p.resultado || {};
    if (p.estado === 'jugado' && r.goles_local === fefi.local && r.goles_visitante === fefi.visitante) continue;

    p.resultado = { goles_local: fefi.local, goles_visitante: fefi.visitante };
    p.estado    = 'jugado';
    cambios++;
    console.log(`   Fecha ${String(p.numero).padStart(2)}: ${p.local} ${fefi.local} – ${fefi.visitante} ${p.visitante}`);
  }

  if (cambios === 0) {
    console.log('✅ fixture.json sin cambios');
    return;
  }

  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + (raw.endsWith('\n') ? '\n' : ''));
  console.log(`\n✅ fixture.json actualizado — ${cambios} resultado(s)`);
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
