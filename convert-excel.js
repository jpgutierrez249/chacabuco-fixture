/**
 * convert-excel.js
 * Convierte el Excel del fixture FEFI a fixture.json
 *
 * Uso:
 *   npm install xlsx
 *   node convert-excel.js
 *
 * El archivo fixture.json se genera automáticamente en la misma carpeta.
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const EXCEL_FILE = 'FEFI 2026.xlsx';
const OUTPUT_FILE = 'fixture.json';
const CLUB_NAME = 'Chacabuco';

// ─── Configuración del club (editar según corresponda) ────────────────────────
const CLUB_INFO = {
  nombre: 'Club Chacabuco',
  torneo: 'FEFI 2026',
  temporada: '2026',
  categoria: 'Completar categoría',
  estadio: 'Completar nombre del estadio',
  direccion_local: 'Completar dirección del estadio propio',
};
// ─────────────────────────────────────────────────────────────────────────────

function parseFixture() {
  const wb = XLSX.readFile(EXCEL_FILE);
  const ws = wb.Sheets['Sheet1'];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const partidos = [];
  const direcciones = {};

  let modoFechas = true;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Detectar sección de direcciones
    if (row[0] === 'Direcciones') {
      modoFechas = false;
      continue;
    }

    // Parsear direcciones
    if (!modoFechas && row[0] && row[1]) {
      direcciones[row[0]] = { direccion: row[1], maps: '' };
      continue;
    }

    // Parsear fechas del fixture (filas de encabezado "Fecha N")
    if (modoFechas && row[0] && String(row[0]).startsWith('Fecha')) {
      const headerRow = row;
      const matchRow = rows[i + 1] || [];

      // Cada par de columnas es un partido (fecha, equipo1, equipo2)
      for (let col = 0; col < headerRow.length; col += 2) {
        const label = headerRow[col];
        const dateRaw = headerRow[col + 1];
        const team1 = matchRow[col];
        const team2 = matchRow[col + 1];

        if (!label || !dateRaw || !team1 || !team2) continue;

        const numero = parseInt(label.replace('Fecha ', ''));
        const fecha = new Date(dateRaw);
        const fechaStr = fecha.toISOString().split('T')[0];

        const esLocal = team1 === CLUB_NAME;
        const esLibre = team1 === 'Libre' || team2 === 'Libre';
        const rival = esLocal ? team2 : team1;
        const cancha = team1; // el local siempre es el primero

        partidos.push({
          numero,
          fecha: fechaStr,
          hora: '15:30',
          local: team1,
          visitante: team2,
          condicion: esLibre ? 'libre' : esLocal ? 'local' : 'visitante',
          rival: esLibre ? 'Libre' : rival,
          cancha,
          direccion: '',
          maps: '',
          resultado: { goles_local: null, goles_visitante: null },
          estado: 'pendiente',
        });
      }
      i++; // saltear la fila de equipos
    }
  }

  // Inyectar direcciones en los partidos visitantes
  partidos.forEach((p) => {
    if (p.condicion === 'visitante' && direcciones[p.cancha]) {
      p.direccion = direcciones[p.cancha].direccion;
      p.maps = direcciones[p.cancha].maps || '';
    }
    if (p.condicion === 'local') {
      p.direccion = CLUB_INFO.direccion_local;
      p.maps = '';
    }
  });

  // Ordenar por número de fecha
  partidos.sort((a, b) => a.numero - b.numero);

  return { club: CLUB_INFO, fixture: partidos };
}

const data = parseFixture();
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
console.log(`✅ ${OUTPUT_FILE} generado con ${data.fixture.length} fechas.`);
