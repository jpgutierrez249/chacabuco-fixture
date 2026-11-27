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
// La tabla anual (Apertura + Clausura) se guarda aparte, bajo la clave "anual"
const VISTA_ANUAL = 'tabla-anual';

const apiUrl   = vista => `https://fefi.com.ar/wp-json/fefit/v1/vista?torneo=${TORNEO}&zona=${ZONA}&vista=${vista}`;
const fuente   = vista => `https://fefi.com.ar/2026-torneo-anual-baby-futbol/?zona=f&vista=${vista}`;
const FUENTE   = fuente(VISTA);
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

// Baja una vista del endpoint y devuelve { general, categorias }.
// Falla con error explícito si la respuesta no sirve, para no pisar el JSON.
async function bajarTablas(vista) {
  const url = apiUrl(vista);
  console.log(`Fetching ${url}`);
  const body = await get(url);

  let html;
  try {
    ({ html } = JSON.parse(body));
  } catch {
    throw new Error(`La respuesta no es JSON — ¿cambió el endpoint? Revisar ${fuente(vista)}`);
  }
  if (!html) throw new Error(`Respuesta sin html para zona=${ZONA} vista=${vista}`);

  const tablas = parsearTablas(cheerio.load(html));
  if (tablas.general.length === 0) throw new Error(`Tabla general vacía (${vista}) — abortando`);
  return tablas;
}

async function main() {
  const { general, categorias } = await bajarTablas(VISTA);
  const actual = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));

  // Si falla la anual no se frena la de la fase: queda la anual anterior
  // y el proceso termina con error para que el job quede en rojo
  let anual = actual.anual;
  try {
    anual = { fuente: fuente(VISTA_ANUAL), ...(await bajarTablas(VISTA_ANUAL)) };
  } catch (err) {
    console.error(`\n⚠️  Tabla anual: ${err.message} — se mantiene la anterior`);
    process.exitCode = 1;
  }

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
    anual,
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

  if (anual) {
    console.log(`\n   Anual: ${anual.general.length} equipos`);
    anual.general.slice(0, 3).forEach((f, i) =>
      console.log(`   ${i + 1}. ${f.equipo.padEnd(28)} ${f.pts} pts`)
    );
  }
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1); });
