# Club Chacabuco — Fixture FEFI 2026

## Descripción del proyecto

Sitio estático que muestra el fixture de **Club Gimnasio Chacabuco** en el torneo FEFI 2026.
No tiene backend ni build step. Se sirve directamente desde **GitHub Pages** leyendo archivos JSON locales.

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

```json
{
  "numero": 1,
  "fecha": "2026-04-18",
  "hora": "15:30",
  "local": "Chacabuco",
  "visitante": "Glorias Argentinas",
  "condicion": "local",        // "local" | "visitante" | "libre"
  "rival": "Glorias Argentinas",
  "cancha": "Chacabuco",
  "direccion": "Miró 750",
  "maps": "",
  "resultado": { "goles_local": null, "goles_visitante": null },
  "estado": "pendiente",       // "pendiente" | "jugado"
  "categorias": [
    { "cat": "2019", "hora": "14:00" },
    { "cat": "2015", "hora": "19:30" }
  ],
  "precio": 7000
}
```

**Regla clave:** `condicion` define si Chacabuco juega de local o visitante.
- `local` → `local = "Chacabuco"`, `visitante = rival`
- `visitante` → `local = rival`, `visitante = "Chacabuco"`
- Las direcciones se derivan automáticamente desde `clubs.json` al exportar desde el admin.

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

---

## GitHub Pages

El sitio público está en: `https://<usuario>.github.io/Fixture/`
Se actualiza automáticamente con cada push a `main`.
Puede tardar 1-2 minutos en reflejar los cambios.
