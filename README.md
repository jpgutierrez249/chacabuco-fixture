# Club Chacabuco — Fixture FEFI 2026

Landing page pública con el fixture del torneo FEFI 2026. Gratis en GitHub Pages.

---

## 🚀 Publicar en GitHub Pages (paso a paso)

1. Crear un repo en GitHub: `github.com/new`
   - Nombre sugerido: `fixture-chacabuco`
   - Visibilidad: **Public**

2. Subir estos archivos al repo:
   - `index.html`
   - `fixture.json`

3. Ir a **Settings → Pages → Source: Deploy from a branch → main → / (root) → Save**

4. En ~1 minuto la página estará en:
   `https://TU_USUARIO.github.io/fixture-chacabuco/`

---

## 📝 Actualizar resultados o el fixture

### Opción A — Editar fixture.json a mano (más simple)

Abrí `fixture.json` y modificá los campos del partido:

```json
{
  "estado": "jugado",
  "resultado": {
    "goles_local": 2,
    "goles_visitante": 1
  }
}
```

Valores posibles para `estado`: `"pendiente"` / `"jugado"`

### Opción B — Actualizar el Excel y regenerar

1. Editá `FEFI 2026.xlsx`
2. Ejecutá:
   ```bash
   npm install xlsx
   node convert-excel.js
   ```
3. Subí el nuevo `fixture.json` a GitHub.

---

## 📁 Estructura del proyecto

```
fixture-chacabuco/
├── index.html          ← La landing page completa
├── fixture.json        ← Datos del torneo (editar acá)
├── convert-excel.js    ← Script opcional: Excel → JSON
└── FEFI 2026.xlsx      ← Excel original (no se sube a GitHub si no querés)
```

---

## ✏️ Datos a completar en fixture.json

Abrí `fixture.json` y completá estos campos del club:

```json
"club": {
  "categoria": "Completar categoría",
  "estadio": "Completar nombre del estadio",
  "direccion_local": "Completar dirección del estadio propio"
}
```

Y para los rivales sin dirección confirmada:
- **Social Club** → dirección de Villa Sarmiento a confirmar
- **Semillero FC** → dirección en Benavídez a confirmar
