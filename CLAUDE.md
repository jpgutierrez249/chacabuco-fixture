# Club Chacabuco — Fixture FEFI

## Descripción del proyecto

Sitio estático que muestra el fixture y la tabla de posiciones de **Club Gimnasio Chacabuco**
en el torneo FEFI (zona Vespertino-F).
No tiene backend ni build step. Se sirve directamente desde **GitHub Pages** leyendo archivos JSON locales.

**Fase actual: Clausura 2026** — 15 fechas, 8-ago a 14-nov-2026.
El Apertura ya terminó; sus datos quedaron en el historial de git.

Hay dos orígenes de datos distintos, y conviene no confundirlos:

- **Fixture y clubes** → se cargan a mano desde `admin.html`
- **Posiciones** → se scrapean de la web de FEFI (ver sección *Posiciones*)

---

## Stack

- HTML / CSS / JavaScript vanilla (sin frameworks, sin bundler)
- JSON como base de datos
- GitHub Pages como hosting público
- Live Server (VSCode) para desarrollo local

---

## Archivos principales

| Archivo | Rol |
|---|---|
| `index.html` | Página pública — solo lectura, se expone en GitHub Pages |
| `admin.html` | Panel de administración — solo uso local (no se expone) |
| `fixture.json` | Datos de partidos, resultados y horarios de categorías |
| `clubs.json` | Maestro de clubes: direcciones y links de Google Maps |
| `posiciones.json` | Tabla de posiciones — **autogenerado, no editar a mano** |
| `scripts/fetch-posiciones.js` | Scraper de la tabla de FEFI (usa `cheerio`) |
| `.github/workflows/update-posiciones.yml` | Cron que corre el scraper y commitea |
| `convert-excel.js` | Script auxiliar para importar desde el Excel de la FEFI |

---

## Modelo de datos

### clubs.json

```json
{
  "Chacabuco": {
    "es_propio": true,
    "estadio": "Club Gimnasio Chacabuco",
    "direccion": "Miró 750",
    "maps": ""
  },
  "Rival FC": {
    "direccion": "Calle 1234, Barrio",
    "maps": "https://maps.google.com/?q=..."
  }
}
```

### fixture.json — estructura de cada partido

El archivo tiene dos claves de primer nivel: `club` (metadatos) y `fixture` (array de partidos).

```json
{
  "club": {
    "nombre": "Club Chacabuco",
    "torneo": "FEFI 2026 Clausura",
    "temporada": "2026",
    "categoria": "Vespertino-F"
  },
  "fixture": [
    {
      "numero": 1,
      "fecha": "2026-08-08",
      "hora": "15:30",
      "local": "Glorias Argentinas",
      "visitante": "Chacabuco",
      "condicion": "visitante",   // "local" | "visitante" | "libre"
      "rival": "Glorias Argentinas",
      "cancha": "Glorias Argentinas",
      "resultado": { "goles_local": null, "goles_visitante": null },
      "estado": "pendiente",      // "pendiente" | "jugado"
      "categorias": [
        { "cat": "2019", "hora": "14:00" },
        { "cat": "2015", "hora": "19:30" }
      ],
      "precio": 7000
    }
  ]
}
```

`club.torneo` alimenta el header, el `<title>` y el footer de `index.html` — no hay
ningún nombre de torneo hardcodeado en el HTML.

**Regla clave:** `condicion` define si Chacabuco juega de local o visitante.
- `local` → `local = "Chacabuco"`, `visitante = rival`, `cancha = "Chacabuco"`
- `visitante` → `local = rival`, `visitante = "Chacabuco"`, `cancha = rival`

**Los partidos NO llevan `direccion` ni `maps`.** `index.html` los resuelve en runtime
con `infoClub(p.cancha)`, que busca `clubsData[cancha]`. Por eso el valor de `cancha`
y `rival` **tiene que coincidir exactamente con una clave de `clubs.json`**; si no
matchea, la dirección sale vacía sin ningún error visible.

**Nombres de clubes:** la FEFI escribe los equipos distinto que `clubs.json`
(`C.A. Nueva Era` vs `Nueva Era`, `Semillero F.C` vs `Semillero FC`, `Club Corvalan`
vs `Corvalan`). Al importar datos nuevos hay que mapear a las claves existentes,
no crear entradas nuevas — duplicarlas deja partidos sin dirección.

### posiciones.json

```json
{
  "torneo": "FEFI 2026",
  "fase": "Clausura",
  "zona": "Vespertino-F",
  "ultima_actualizacion": "2026-08-06",
  "fuente": "https://fefi.com.ar/2026-torneo-anual-baby-futbol/f/#botonera",
  "general":    [ { "equipo": "GIMNASIO CHACABUCO", "pj": 0, "g": 0, "e": 0, "p": 0, "pts": 0, "es_propio": true } ],
  "categorias": { "2013": [ /* mismo formato */ ], "2019": [] }
}
```

`es_propio: true` marca la fila de Chacabuco (el scraper lo pone buscando "chacabuco"
en el nombre). El front la destaca con ⭐ y la usa para el banner de resumen.

---

## Posiciones — scraping automático

`posiciones.json` **se autogenera**. Editarlo a mano no sirve: el cron lo pisa.

### Cómo está armada la página de FEFI

Las dos fases del torneo conviven en la **misma URL**, en solapas que Elementor
muestra y oculta por JS. Los botones de la botonera son todos `href="#botonera"`,
así que no se puede linkear a una fase directamente — hay que ubicar la tabla por
el `id` de su contenedor:

| Contenedor | Contenido |
|---|---|
| `#cont2` | Fixture completo de la zona |
| `#cont3` | Equipos con dirección y localidad |
| `#cont5` | **Tablas Apertura** |
| `#cont7` | **Tablas Clausura** ← el que se scrapea hoy |

Cada tabla de posiciones trae adentro secciones separadas por filas con `colspan`:
`GENERAL` primero y después una por categoría (2013–2019), 16 equipos cada una.

### Cambiar de fase

En `scripts/fetch-posiciones.js`, arriba de todo:

```js
const FASE          = 'Clausura';
const FASE_SELECTOR = '#cont7';
const FASE_ORDEN    = 2;   // fallback: 2ª tabla de posiciones del documento
```

Si FEFI reordena la página y el `id` cambia, el scraper cae al fallback por orden
(1ª tabla = Apertura, 2ª = Clausura) y avisa por consola. Si tampoco encuentra,
falla con error explícito en vez de traer datos de la fase equivocada.

### Estado del cron

**Pausado.** El Clausura arrancó y FEFI ya publica la tabla, pero está entera en
cero — no tiene sentido commitear a diario un JSON que no cambia. Se reactiva
descomentando el bloque `schedule` en `.github/workflows/update-posiciones.yml`
cuando haya resultados reales (después de la fecha 1, 8-ago-2026).

Mientras esté pausado se puede correr a mano:

```bash
npm install --no-save cheerio
node scripts/fetch-posiciones.js
```

o desde GitHub → Actions → *Actualizar posiciones FEFI* → **Run workflow**
(el `workflow_dispatch` sigue habilitado).

### El front tolera la tabla en cero

`index.html` ya contempla el torneo sin empezar: si nadie jugó muestra `—` en vez
de inventar un "1°", no pone medallas, y omite el separador "Sin partidos
disputados". El banner lee `data.fase` + la temporada, no tiene la fase hardcodeada.

---

## Flujo de trabajo

### Editar datos (normal)

1. Abrir `admin.html` con **Live Server** en VSCode
2. Editar en las pestañas **Equipos** o **Fixture**
3. Descargar `fixture.json` y/o `clubs.json` con los botones de exportar
4. Reemplazar los archivos descargados en esta carpeta
5. Hacer commit y push → GitHub Pages se actualiza automáticamente

### Levantar el sitio localmente

```bash
# Con Live Server (recomendado): clic derecho en index.html → "Open with Live Server"
# O con Node:
npx serve .
# O con Python:
python3 -m http.server 8080
```

### Importar fixture desde Excel de la FEFI

```bash
npm install xlsx
node convert-excel.js
# Genera fixture.json nuevo. Luego completar categorías y precios desde admin.html
```

---

## Git — convenciones

### Ramas

- `main` → producción (GitHub Pages sirve desde aquí)
- No hay ramas de feature por ahora; todo va directo a main

### Mensajes de commit

Usar prefijos claros:

```
data: actualizar fixture fecha 3 — resultado y horarios
data: agregar dirección Semillero FC en clubs.json
fix: corregir dirección local en partidos de Chacabuco
feat: agregar modal de info en tarjetas de partido
style: ajustes visuales en admin.html
```

### Flujo típico de actualización

```bash
git add fixture.json clubs.json
git commit -m "data: actualizar resultado fecha 1 y horarios fecha 2"
git push origin main
```

### Ver estado antes de subir

```bash
git status
git diff fixture.json
```

### Si hay conflictos con fixture.json o clubs.json

Siempre quedarse con la versión local (la que acaba de editarse en admin):

```bash
git checkout --theirs fixture.json
git add fixture.json
git commit -m "fix: resolver conflicto — usar versión local del fixture"
```

---

## Tareas frecuentes para el agente

- **Subir cambios del fixture:** `git add fixture.json && git commit -m "data: <descripción>" && git push`
- **Subir cambios de clubes:** `git add clubs.json && git commit -m "data: <descripción>" && git push`
- **Ver últimos commits:** `git log --oneline -10`
- **Ver qué cambió:** `git diff HEAD`
- **Deshacer último commit (sin perder cambios):** `git reset --soft HEAD~1`
- **Ver en qué branch estoy:** `git branch`

---

## Lo que NO hacer

- No tocar `index.html` para editar datos del fixture — los datos viven en los JSON
- No exponer `admin.html` en producción — es solo para uso local
- No commitear archivos descargados del browser con nombre `fixture (1).json` etc — siempre reemplazar el archivo original
- No correr `node convert-excel.js` si ya hay datos de categorías/precios cargados — sobreescribe el fixture
- **No editar `posiciones.json` a mano** — es autogenerado; si el cron está activo lo pisa a la madrugada siguiente
- No agregar claves nuevas a `clubs.json` para un club que ya existe con otro nombre — mapear al nombre existente
- No poner `direccion` ni `maps` dentro de los partidos de `fixture.json` — salen de `clubs.json` vía `cancha`

---

## GitHub Pages

El sitio público está en: `https://jpgutierrez249.github.io/chacabuco-fixture/`
Repo: `git@github.com:jpgutierrez249/chacabuco-fixture.git` (remote SSH).
Se actualiza automáticamente con cada push a `main`.
Puede tardar 1-2 minutos en reflejar los cambios.
