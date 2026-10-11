/**
 * Scraping de posiciones FEFI — tabla general + por categoría.
 * Ejecutado por GitHub Actions — actualiza posiciones.json automáticamente.
 */
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const cheerio = require('cheerio');

// ── De dónde se sacan las tablas ─────────────────────────────────────────
// En oct-2026 FEFI rediseñó la página del torneo: la vieja URL por zona
// (/2026-torneo-anual-baby-futbol/f/) ahora redirige a otra página, y el
// contenido se carga por JS desde un endpoint REST del plugin "fefit":
//
//   /wp-json/fefit/v1/vista?torneo=1&zona=14&vista=tablas-clausura
//
// Devuelve { html, vista } con una <section data-panel> por tabla: "general"
// y una por categoría ("Categoría 2019", etc.).
//
// zona = id numérico de la zona (14 = F; ver el <select> de zonas en la página)
// vista = "tablas-apertura" | "tablas-clausura" | "tabla-anual"
const FASE     = 'Clausura';
const TORNEO   = 1;
const ZONA     = 14;
const VISTA    = 'tablas-clausura';

const API_URL  = `https://fefi.com.ar/wp-json/fefit/v1/vista?torneo=${TORNEO}&zona=${ZONA}&vista=${VISTA}`;
const FUENTE   = `https://fefi.com.ar/2026-torneo-anual-baby-futbol/?zona=f&vista=${VISTA}`;
const OUTPUT   = path.join(__dirname, '..', 'posiciones.json');


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
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ── Tablas de posiciones — una <section data-panel> por tabla ────────────
// Cada fila: <td>#</td> <th>equipo</th> <td>PJ</td> <td>G</td> <td>E</td> <td>P</td> <td>Pts</td>
// En los empates la celda # viene vacía, por eso no se usa.
function parsearTablas($) {
  const general    = [];
  const categorias = {};

  $('section.fefit-tabla').each((_, section) => {
    const panel  = $(section).attr('data-panel');
    const titulo = $(section).find('h3').first().text().trim();

    let destino;
    if (panel === 'general') {
      destino = general;
    } else {
      const match = titulo.match(/\d{4}/);
      if (!match) {
        console.warn(`   ⚠️  Sección "${titulo}" (${panel}) sin año reconocible — se ignora`);
        return;
      }
      destino = categorias[match[0]] = [];
    }

    $(section).find('table.fefit-pos tbody tr').each((_, row) => {
      const equipo = $(row).find('th').text().trim();
      const nums   = $(row).find('td').not('.fefit-pos__n')
        .map((_, td) => parseInt($(td).text().trim(), 10) || 0).get();
      if (!equipo || nums.length < 5) return;

      const [pj, g, e, p, pts] = nums;
      const fila = { equipo, pj, g, e, p, pts };
      if (norm(equipo).includes('chacabuco')) fila.es_propio = true;
      destino.push(fila);
    });
  });

  return { general, categorias };
}

async function main() {
  console.log(`Fetching ${API_URL}`);
  const body = await get(API_URL);

  let html;
  try {
    ({ html } = JSON.parse(body));
  } catch {
    throw new Error(`La respuesta no es JSON — ¿cambió el endpoint? Revisar ${FUENTE}`);
  }
  if (!html) throw new Error(`Respuesta sin html para zona=${ZONA} vista=${VISTA}`);

  console.log('\nParsing tablas...');
  const { general, categorias } = parsearTablas(cheerio.load(html));

  if (general.length === 0) throw new Error('Tabla general vacía — abortando');

  const actual = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  const nuevo  = {
    ...actual,
    fase: FASE,
    fuente: FUENTE,
    // Fecha en hora argentina: toISOString() es UTC y a la tarde/noche ya
    // marca el día siguiente, así que el sitio mostraba una fecha futura
    ultima_actualizacion: new Date().toLocaleDateString('sv-SE', {
      timeZone: 'America/Argentina/Buenos_Aires',
    }),
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
