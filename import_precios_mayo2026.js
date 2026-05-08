// ============================================================
// IMPORTACIÓN DE PRECIOS — MAYO 2026
// Fuentes: Cotización Final, Eléctricos HN, El Baratillo, Larach y Cía
// Estrategia: para cada insumo, tomar el precio MAYOR entre fuentes
// ============================================================

process.chdir(__dirname);
const { getDb, saveDb } = require('./src/db/database');
const FECHA = '2026-05-05';

// ─────────────────────────────────────────────────────────────
// CONSOLIDADO DE PRECIOS (todas las fuentes)
// ─────────────────────────────────────────────────────────────
const allPrices = [
  // ── COTIZACIÓN FINAL MAYO 2026 (MI-F* directo) ──
  { cod: 'MI-F3317025', precio: 4136.00, fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F4502002', precio: 120.00,  fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3302001', precio: 5.22,    fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3302003', precio: 8.50,    fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3302002', precio: 5.02,    fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3211017', precio: 22.00,   fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3302023', precio: 8.00,    fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3302030', precio: 8.00,    fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F0101005', precio: 189.84,  fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3211029', precio: 35.00,   fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F4801001', precio: 843.75,  fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F2701001', precio: 176.87,  fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F2702002', precio: 170.00,  fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3206002', precio: 50.37,   fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3206003', precio: 30.16,   fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3206005', precio: 19.42,   fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3206006', precio: 30.16,   fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3206007', precio: 50.37,   fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3206011', precio: 70.75,   fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F0901003', precio: 341.51,  fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3402001', precio: 9661.00, fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3402002', precio: 4111.39, fuente: 'Cotizacion Mayo2026' },
  { cod: 'MI-F3402003', precio: 9661.00, fuente: 'Cotizacion Mayo2026' },
  // ── ELÉCTRICOS HN 2026 (mapeados) ──
  { cod: 'MN-F1902002', precio: 151.09,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1902003', precio: 267.05,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1902004', precio: 445.91,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1902005', precio: 634.16,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1902007', precio: 1106.23, fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1902006', precio: 813.00,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1902001', precio: 46.00,   fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1801001', precio: 22.83,   fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1801003', precio: 49.22,   fuente: 'Electricos HN 2026' },
  { cod: 'MI-F3501004', precio: 35.00,   fuente: 'Electricos HN 2026' },
  { cod: 'MI-F3501003', precio: 43.00,   fuente: 'Electricos HN 2026' },
  { cod: 'MI-F3501005', precio: 49.50,   fuente: 'Electricos HN 2026' },
  { cod: 'MN-F2602124', precio: 331.25,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F2602125', precio: 476.35,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F2602001', precio: 564.40,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F2602002', precio: 729.25,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F2608014', precio: 518.54,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F2609008', precio: 248.28,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F2605009', precio: 395.19,  fuente: 'Electricos HN 2026' },
  { cod: 'MI-F2605007', precio: 183.29,  fuente: 'Electricos HN 2026' },
  { cod: 'MI-F2605009', precio: 317.32,  fuente: 'Electricos HN 2026' },
  { cod: 'MI-F3206004', precio: 8.55,    fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1603002', precio: 374.05,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1603003', precio: 495.50,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F1603006', precio: 619.12,  fuente: 'Electricos HN 2026' },
  { cod: 'MN-F2301001', precio: 21.90,   fuente: 'Electricos HN 2026' },
  // ── EL BARATILLO — MAYO 2026 ──
  { cod: 'MN-F1402003', precio: 31.13,   fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F1801001', precio: 17.00,   fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F1801003', precio: 26.73,   fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F2602125', precio: 559.88,  fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F2602122', precio: 762.61,  fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F2602123', precio: 975.15,  fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F2602126', precio: 1297.35, fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F2602127', precio: 1463.26, fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F2602129', precio: 2971.09, fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F3309001', precio: 22.07,   fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F3303001', precio: 82.47,   fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F3311003', precio: 15.90,   fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F2602015', precio: 38.15,   fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F3302002', precio: 4.42,    fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F3302023', precio: 4.89,    fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F3309002', precio: 10.02,   fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F3312001', precio: 7.73,    fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F3314002', precio: 7.94,    fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F3315001', precio: 108.11,  fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F2801001', precio: 202.00,  fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F2308001', precio: 0.53,    fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F2308002', precio: 1.40,    fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F2308006', precio: 2.83,    fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F2306002', precio: 0.46,    fuente: 'El Baratillo Mayo2026' },
  { cod: 'MN-F2301010', precio: 25.00,   fuente: 'El Baratillo Mayo2026' },
  { cod: 'MI-F3402003', precio: 10262.44,fuente: 'El Baratillo Mayo2026' },
  // ── LARACH Y CÍA — MAYO 2026 ──
  { cod: 'MN-F0101001', precio: 205.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1902002', precio: 136.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1902003', precio: 237.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1902004', precio: 382.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1902005', precio: 584.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1902007', precio: 1037.00, fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1402001', precio: 17.75,   fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1402002', precio: 18.85,   fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1402003', precio: 26.00,   fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1603001', precio: 313.50,  fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1603002', precio: 413.25,  fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1603003', precio: 522.50,  fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1603006', precio: 627.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MN-F1603007', precio: 722.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MI-F1702001', precio: 291.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MI-F2801001', precio: 430.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MI-F2801002', precio: 430.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MI-F3206004', precio: 13.60,   fuente: 'Larach Mayo2026' },
  { cod: 'MI-F3206005', precio: 19.35,   fuente: 'Larach Mayo2026' },
  { cod: 'MI-F3206006', precio: 31.50,   fuente: 'Larach Mayo2026' },
  { cod: 'MI-F3206023', precio: 190.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MI-F3206013', precio: 300.00,  fuente: 'Larach Mayo2026' },
  { cod: 'MI-F2101001', precio: 32.50,   fuente: 'Larach Mayo2026' },
  { cod: 'MI-F2103005', precio: 56.00,   fuente: 'Larach Mayo2026' },
  { cod: 'MI-F4801001', precio: 786.25,  fuente: 'Larach Mayo2026' },
];

// ─── Consolidar: precio MÁXIMO por código ───
const priceMap = new Map();
for (const item of allPrices) {
  if (!item.precio || item.precio <= 0) continue;
  if (!priceMap.has(item.cod) || item.precio > priceMap.get(item.cod).precio) {
    priceMap.set(item.cod, { precio: item.precio, fuente: item.fuente });
  }
}

console.log(`\n📋 Insumos únicos a procesar: ${priceMap.size}`);

// ─── Aplicar a DB ───
async function main() {
  const db = await getDb();

  let actualizados = 0;
  let sinCambio = 0;
  let noEncontrados = [];

  for (const [codigo, { precio, fuente }] of priceMap.entries()) {
    const rows = db.exec(`SELECT id_insumo, precio_unitario FROM insumos WHERE codigo = '${codigo}'`);
    if (!rows.length || !rows[0].values.length) {
      noEncontrados.push(codigo);
      continue;
    }
    const [id_insumo, precio_anterior] = rows[0].values[0];
    if (Math.abs(precio_anterior - precio) < 0.005) {
      sinCambio++;
      continue;
    }
    db.run(
      `INSERT INTO historial_precios (id_insumo, precio_anterior, precio_nuevo, fecha_cambio) VALUES (${id_insumo}, ${precio_anterior}, ${precio}, '${FECHA} 00:00:00')`
    );
    db.run(
      `UPDATE insumos SET precio_unitario = ${precio}, fecha_actualizacion = '${FECHA}' WHERE id_insumo = ${id_insumo}`
    );
    actualizados++;
  }

  saveDb();

  const totRes = db.exec('SELECT COUNT(*) FROM insumos');
  const conPrecio = db.exec('SELECT COUNT(*) FROM insumos WHERE precio_unitario > 0');

  console.log(`\n✅ Actualizados:          ${actualizados}`);
  console.log(`⚪ Sin cambio (ya iguales): ${sinCambio}`);
  console.log(`⚠️  Códigos no en DB:       ${noEncontrados.length}`);
  if (noEncontrados.length) console.log('   ', noEncontrados.join(', '));
  console.log(`\n📊 Total insumos en DB: ${totRes[0].values[0][0]}`);
  console.log(`   Con precio > 0:      ${conPrecio[0].values[0][0]}`);

  // Show breakdown of what was updated
  console.log('\n🔍 Resumen de precios aplicados (MAX entre fuentes):');
  const sorted = [...priceMap.entries()].slice(0,10);
  for (const [cod, {precio, fuente}] of sorted) {
    console.log(`   ${cod.padEnd(18)} L ${precio.toFixed(2).padStart(9)} ← ${fuente}`);
  }
  console.log('   ...');
}

main().catch(console.error);
