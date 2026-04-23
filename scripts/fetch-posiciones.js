/**
 * Scraping de posiciones FEFI — tabla general + por categoría.
 * Ejecutado por GitHub Actions — actualiza posiciones.json automáticamente.
 */
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const cheerio = require('cheerio');

const FEFI_URL = 'https://fefi.com.ar/2026-torneo-anual-baby-futbol/f/';
const OUTPUT   = path.join(__dirname, '..', 'posiciones.json');


function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (fixture-updater/1.0)' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return get(res.headers.location).then(resolve, reject);
      }
      let body = '';
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

// ── Tabla de posiciones (Table 3) — parsea todas las secciones ───────────
// La tabla tiene secciones separadas por filas colspan: "GENERAL", "2019", "2013", etc.
function parsearTablaPosiciones($) {
  let tablaEl = null;

  $('table').each((_, table) => {
    const headers = [];
    $(table).find('thead th').each((_, th) => headers.push(norm($(th).text())));
    if (headers.includes('pj') && headers.includes('pts.') && headers.includes('equipos')) {
      tablaEl = table;
      return false;
    }
  });

  if (!tablaEl) throw new Error('Tabla de posiciones no encontrada');

  const secciones = {}; // { 'GENERAL': [...], '2019': [...], ... }
  let seccionActual = null;

  $(tablaEl).find('tbody tr').each((_, row) => {
    const celdas = $(row).find('td');
    if (!celdas.length) return;

    // Fila de título de sección (colspan)
    if ($(celdas[0]).attr('colspan')) {
      seccionActual = $(celdas[0]).text().trim().toUpperCase();
      secciones[seccionActual] = [];
      return;
    }

    if (!seccionActual || celdas.length < 5) return;

    const equipo = $(celdas[0]).text().trim();
    if (!equipo || equipo.length < 2) return;

    const num = i => parseInt($(celdas[i]).text().trim()) || 0;
    const fila = { equipo, pj: num(1), g: num(2), e: num(3), p: num(4), pts: num(5) };
    if (norm(equipo).includes('chacabuco')) fila.es_propio = true;
    secciones[seccionActual].push(fila);
  });

  // Separar general de categorías
  const general    = secciones['GENERAL'] || [];
  const categorias = {};
  Object.keys(secciones).forEach(k => {
    if (k !== 'GENERAL' && secciones[k].length > 0) {
      // Normalizar nombre: "2019", "CAT 2019", etc. → "2019"
      const match = k.match(/\d{4}/);
      if (match) categorias[match[0]] = secciones[k];
    }
  });

  return { general, categorias };
}

async function main() {
  console.log(`Fetching ${FEFI_URL}`);
  const html = await get(FEFI_URL);
  const $    = cheerio.load(html);

  console.log('\nParsing tablas...');
  const { general, categorias } = parsearTablaPosiciones($);

  if (general.length === 0) throw new Error('Tabla general vacía — abortando');

  const actual = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  const nuevo  = {
    ...actual,
    ultima_actualizacion: new Date().toISOString().split('T')[0],
    general,
    categorias,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(nuevo, null, 2) + '\n');

  console.log(`\n✅ posiciones.json actualizado`);
  console.log(`   General: ${general.length} equipos`);
  general.slice(0, 5).forEach((f, i) =>
    console.log(`   ${i + 1}. ${f.equipo.padEnd(28)} ${f.pts} pts`)
  );

  const catsEncontradas = Object.keys(categorias);
  console.log(`\n   Categorías: ${catsEncontradas.length > 0 ? catsEncontradas.join(', ') : 'ninguna (sin datos aún)'}`);
  catsEncontradas.forEach(cat => {
    const top = categorias[cat].slice(0, 3).map(e => `${e.equipo}(${e.pts})`).join(', ');
    console.log(`   ${cat}: ${top}`);
  });
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
