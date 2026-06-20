// Script de sincronización del catálogo de Insumos FHIS
// Fuente: Insumos_FHIS_Final.txt (catálogo oficial corregido por el usuario)
// Acciones:
//   1) Actualiza descripcion y unidad de insumos existentes que difieren del TXT
//   2) Inserta como nuevos los insumos del TXT que no existen en la DB (precio_unitario = 0)
//   3) NO toca insumos que solo existen en la DB (no se borran ni desactivan)
//
// Ejecutar: node sync_insumos_fhis.js [--dry-run]

const fs = require('fs');
const path = require('path');
const { getDb, saveDb } = require('./src/db/database');

const TXT_PATH = process.argv[3] || '/mnt/user-data/uploads/Insumos_FHIS_Final.txt';
const DRY_RUN = process.argv.includes('--dry-run');

// Parser CSV respetando comillas dobles, delimitador TAB, escape "" -> "
function parseCSV(text, delim) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      } else { field += c; i++; continue; }
    } else {
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === delim) { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++; continue;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function main() {
  console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (sin guardar cambios)' : 'EJECUCIÓN REAL'}`);
  console.log(`Leyendo: ${TXT_PATH}`);

  const buf = fs.readFileSync(TXT_PATH);
  const text = buf.toString('latin1'); // archivo viene en ISO-8859-1
  const allRows = parseCSV(text, '\t').filter(r => r.length > 1 && r[0].trim().length > 0);
  const rows = allRows.slice(1).map(r => ({
    codigo: r[0].trim(),
    descripcion: r[1].trim(),
    unidad: r[2].trim(),
    categoria: r[3].trim(),
  }));
  console.log(`Filas leídas del TXT: ${rows.length}`);

  const db = await getDb();

  const catMap = {};
  db.exec('SELECT id_categoria, nombre FROM categorias_insumo')[0].values.forEach(([id, nombre]) => {
    catMap[nombre] = id;
  });
  // El TXT usa nombres de categoría distintos a los de la DB en algunos casos
  catMap['Herramienta y Equipo'] = catMap['Equipo'];
  catMap['General'] = catMap['Equipo'];

  const dbRes = db.exec('SELECT codigo, descripcion, unidad, id_categoria, precio_unitario FROM insumos');
  const dbMap = {};
  if (dbRes.length) {
    dbRes[0].values.forEach(([codigo, descripcion, unidad, id_categoria, precio]) => {
      dbMap[codigo] = { descripcion, unidad, id_categoria, precio };
    });
  }

  let actualizados = 0;
  let insertados = 0;
  let sinCambios = 0;
  const errores = [];
  const logActualizados = [];
  const logInsertados = [];

  const today = new Date().toISOString().slice(0, 10);

  for (const r of rows) {
    const catId = catMap[r.categoria];
    if (!catId) {
      errores.push(`Categoría desconocida "${r.categoria}" para código ${r.codigo}`);
      continue;
    }

    const existing = dbMap[r.codigo];

    if (existing) {
      const descDistinta = existing.descripcion.trim() !== r.descripcion;
      const unidadDistinta = existing.unidad.trim().toUpperCase() !== r.unidad.toUpperCase();

      if (descDistinta || unidadDistinta) {
        if (!DRY_RUN) {
          db.run(
            'UPDATE insumos SET descripcion = ?, unidad = ?, fecha_actualizacion = fecha_actualizacion WHERE codigo = ?',
            [r.descripcion, r.unidad, r.codigo]
          );
        }
        actualizados++;
        logActualizados.push({
          codigo: r.codigo,
          descripcion_anterior: existing.descripcion,
          descripcion_nueva: r.descripcion,
          unidad_anterior: existing.unidad,
          unidad_nueva: r.unidad,
        });
      } else {
        sinCambios++;
      }
    } else {
      if (!DRY_RUN) {
        db.run(
          'INSERT INTO insumos (codigo, descripcion, unidad, id_categoria, precio_unitario, fecha_actualizacion, activo) VALUES (?,?,?,?,0,?,1)',
          [r.codigo, r.descripcion, r.unidad, catId, today]
        );
      }
      insertados++;
      logInsertados.push({ codigo: r.codigo, descripcion: r.descripcion, unidad: r.unidad, categoria: r.categoria });
    }
  }

  if (!DRY_RUN) {
    saveDb();
  }

  console.log('\n=== RESUMEN ===');
  console.log('Sin cambios (ya coincidían):', sinCambios);
  console.log('Actualizados (descripción/unidad):', actualizados);
  console.log('Insertados (nuevos, precio=0):', insertados);
  console.log('Errores de categoría:', errores.length);
  if (errores.length) console.log(errores.slice(0, 20));

  fs.writeFileSync(path.join(__dirname, 'sync_log_actualizados.json'), JSON.stringify(logActualizados, null, 1));
  fs.writeFileSync(path.join(__dirname, 'sync_log_insertados.json'), JSON.stringify(logInsertados, null, 1));
  console.log('\nLogs guardados: sync_log_actualizados.json, sync_log_insertados.json');

  if (DRY_RUN) {
    console.log('\n⚠️  DRY-RUN: no se modificó la base de datos. Ejecutar sin --dry-run para aplicar.');
  } else {
    console.log('\n✅ Cambios aplicados y guardados en data/costos.db');
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
