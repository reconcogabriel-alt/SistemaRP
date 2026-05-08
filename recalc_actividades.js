process.chdir('/home/claude/costos-unitarios');
const { getDb, saveDb } = require('./src/db/database');

async function recalc() {
  const db = await getDb();
  const acts = db.exec('SELECT id_actividad FROM actividades');
  if (!acts.length) { process.exit(0); }
  
  let updated = 0;
  for (const [id] of acts[0].values) {
    // Recalculate each detail
    const dets = db.exec(`
      SELECT ai.id_detalle, ai.cantidad, ai.rendimiento, ai.desperdicio, i.precio_unitario
      FROM actividad_insumos ai JOIN insumos i ON ai.id_insumo = i.id_insumo
      WHERE ai.id_actividad = ?`, [id]);
    
    if (!dets.length || !dets[0].values.length) continue;
    
    let total = 0;
    for (const [detId, cant, rend, desp, precio] of dets[0].values) {
      const cp = (cant / (rend || 1)) * (1 + (desp || 0) / 100) * precio;
      db.run('UPDATE actividad_insumos SET costo_parcial=? WHERE id_detalle=?', [cp, detId]);
      total += cp;
    }
    db.run('UPDATE actividades SET costo_total=? WHERE id_actividad=?', [total, id]);
    updated++;
  }
  
  saveDb();
  console.log(`Recalculadas ${updated} actividades`);
  
  // Sample
  const sample = db.exec(`SELECT codigo, descripcion, unidad, costo_total 
    FROM actividades WHERE costo_total > 0 ORDER BY id_actividad LIMIT 5`);
  if (sample.length) {
    console.log('\nEjemplos costos actualizados:');
    sample[0].values.forEach(r => console.log(`  ${r[0]} | ${r[1]} | ${r[2]} | L ${r[3]?.toFixed(2)}`));
  }
  process.exit(0);
}

recalc().catch(e => { console.error(e); process.exit(1); });
