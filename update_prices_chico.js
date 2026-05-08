// ============================================================
// ACTUALIZACIÓN DE PRECIOS — CHICO Boletín Estadístico IV-2025
// Fuente: Cámara Hondureña de la Industria de la Construcción
// Periodo: Diciembre 2025 | Tegucigalpa (precios promedio usados)
// ============================================================
process.chdir(__dirname);
const { getDb, saveDb } = require('./src/db/database');

// Usar precio "TENDENCIA Dic 25" (promedio de mercado Tegucigalpa)
// Para insumos sin código FHIS exacto: buscar por descripción similar
const FUENTE = 'CHICO Boletín IV-2025 Dic.25 Tegucigalpa';

// ── MATERIALES ────────────────────────────────────────────
// Estrategia de matching: código FHIS → precio CHICO correspondiente
const precios = [

  // ─── CEMENTO ───
  // CHICO p.25: Cemento Gris BOLSA = L 212.33 promedio (Tendencia Dic 25)
  { cod: 'MN-F0101001', precio: 212.33, desc: 'CEMENTO GRIS TIPO PORTLAND bolsa 42.5kg' },

  // ─── AGREGADOS ───
  // CHICO p.25: Arena de Río (Sin Flete) M3 = L 797.80 Tgú; Arena de Tope M3 = 700.00
  { cod: 'MN-F0201001', precio: 797.80, desc: 'ARENA DE RIO LAVADA M3 (CHICO sin flete Tgú)' },
  { cod: 'MN-F0201002', precio: 700.00, desc: 'ARENA M3' },
  // CHICO p.25: Grava de Río M3 = 777.50; Grava de Fábrica 3/4 M3 = 857.80
  { cod: 'MN-F0301001', precio: 777.50, desc: 'GRAVA DE RIO M3' },
  { cod: 'MN-F0301002', precio: 857.80, desc: 'GRAVA DE FABRICA 3/4 M3' },
  // CHICO p.25: Agua M3 = 165.24
  { cod: 'MN-F0601001', precio: 165.24, desc: 'AGUA M3' },
  // CHICO p.25: Material Selecto M3 = 583.33
  { cod: 'MN-F0401001', precio: 583.33, desc: 'MATERIAL SELECTO M3' },
  // CHICO p.25: Piedra de Río M3 = 650.00; Piedra Ripión M3 = 733.33
  { cod: 'MN-F0501001', precio: 650.00, desc: 'PIEDRA DE RIO M3' },
  { cod: 'MN-F0501002', precio: 733.33, desc: 'PIEDRA RIPON M3' },
  // CHICO p.25: Sub-Base M3 NCI → mantener estimado
  // CHICO p.25: Gravín 3/8 M3 = 850.00
  { cod: 'MN-F0301003', precio: 850.00, desc: 'GRAVIN 3/8 M3' },
  // CHICO p.25: Base Triturada M3 NCI

  // ─── HIERRO / ACERO (C/U = lance/varilla) ───
  // CHICO p.25: varillas Grado 60, por C/U (lance):
  // Varilla 1/4" x30' (lisa) = L 46.00 Tgú; 1/2" x30' = L 267.05; 3/8" x30' = L 151.09; 3/4" x30' = L 634.16; 5/8" = L 445.91; 7/8" = L 813.00; 1" = L 1106.23
  { cod: 'MN-F1901001', precio: 46.00,   desc: 'VARILLA HIERRO LISA 1/4"x30\' (CHICO dic25)' },
  { cod: 'MN-F1902001', precio: 46.00,   desc: 'VARILLA CORRUGADA 1/4"x30\' Gr.60' },
  { cod: 'MN-F1902002', precio: 151.09,  desc: 'VARILLA CORRUGADA 3/8"x30\' Gr.60' },
  { cod: 'MN-F1902003', precio: 267.05,  desc: 'VARILLA CORRUGADA 1/2"x30\' Gr.60' },
  { cod: 'MN-F1902004', precio: 445.91,  desc: 'VARILLA CORRUGADA 5/8"x30\' Gr.60' },
  { cod: 'MN-F1902005', precio: 634.16,  desc: 'VARILLA CORRUGADA 3/4"x30\' Gr.60' },
  { cod: 'MN-F1902006', precio: 813.00,  desc: 'VARILLA CORRUGADA 7/8"x30\' Gr.60' },
  { cod: 'MN-F1902007', precio: 1106.23, desc: 'VARILLA CORRUGADA 1"x30\' Gr.60' },
  // CHICO p.25: Alambre de Amarre LIBRA = 22.83
  { cod: 'MN-F1801001', precio: 22.83,   desc: 'ALAMBRE DE AMARRE LIBRA' },

  // ─── BLOQUES / LADRILLO ───
  // CHICO p.27: Bloque 4.5"x8"x16" C/U = 19.45; Bloque 6"x8"x16" = 21.77; Bloque 8"x8"x16" = 26.38
  // Ladrillo Rafón C/U = 5.30
  { cod: 'MN-F0402001', precio: 19.45,  desc: 'BLOQUE DE CONCRETO 10x20x40cm C/U (CHICO 4.5x8x16)' },
  { cod: 'MN-F0402002', precio: 21.77,  desc: 'BLOQUE DE CONCRETO 15x20x40cm C/U (CHICO 6x8x16)' },
  { cod: 'MN-F0402003', precio: 26.38,  desc: 'BLOQUE DE CONCRETO 20x20x40cm C/U (CHICO 8x8x16)' },
  { cod: 'MN-F0403001', precio: 5.30,   desc: 'LADRILLO RAFON C/U' },

  // ─── MADERA ───
  // CHICO p.27: Madera Pino Rústica PT = 37.50; Madera Pino Cepillada PT = 41.32
  { cod: 'MN-F2901001', precio: 37.50,  desc: 'MADERA RUSTICA DE PINO PT' },
  { cod: 'MN-F2801001', precio: 41.32,  desc: 'MADERA CEPILLADA DE PINO PT' },

  // ─── CLAVOS ───
  // CHICO p.27: Clavos Con Cabeza LIBRA = 21.90
  { cod: 'MN-F2301001', precio: 21.90,  desc: 'CLAVOS LIBRA' },

  // ─── PVC FONTANERÍA ───
  // CHICO p.32: Tubería PVC por LANCE (aprox 6m o 9m — precios por lance)
  // SDR-26: 1" = 100.68; 2" = 254.14; 3" = 571.01; 4" = 949.17; 6" = 2177.22
  // SDR-41: 2" = 190.48; 3" = 394.25; 4" = 633.50; 6" = 1387.53
  // SDR-64: 2" = 136.68; 4" = 347.71; 6" = 973.44
  // Precio por ML = precio/lance / 6m
  { cod: 'MN-F0701001', precio: 158.37, desc: 'TUBO PVC 4" SDR-41 ML (CHICO 633.50/4m aprox)' },
  { cod: 'MN-F0701002', precio: 131.42, desc: 'TUBO PVC 3" SDR-41 ML (CHICO 394.25/3m aprox)' },
  { cod: 'MN-F0701003', precio: 95.24,  desc: 'TUBO PVC 2" SDR-41 ML (CHICO 190.48/2m aprox)' },
  { cod: 'MN-F0702001', precio: 362.87, desc: 'TUBO PVC 6" SDR-26 ML (CHICO 2177.22/6m)' },
  { cod: 'MN-F0702002', precio: 158.19, desc: 'TUBO PVC 4" SDR-26 ML (CHICO 949.17/6m)' },
  { cod: 'MN-F0702003', precio: 95.17,  desc: 'TUBO PVC 3" SDR-26 ML (CHICO 571.01/6m)' },
  { cod: 'MN-F0702004', precio: 42.36,  desc: 'TUBO PVC 2" SDR-26 ML (CHICO 254.14/6m)' },
  { cod: 'MN-F0702005', precio: 16.78,  desc: 'TUBO PVC 1" SDR-26 ML (CHICO 100.68/6m)' },

  // ─── CONCRETO PREMEZCLADO ───
  // CHICO p.27: Concreto Premezclado 3000 PSI M3 = 4547.09; 4000 PSI = 4795.05; 5000 PSI = 5118.31
  { cod: 'MN-F0901001', precio: 4547.09, desc: 'CONCRETO PREMEZCLADO 3000 PSI M3' },
  { cod: 'MN-F0901002', precio: 4795.05, desc: 'CONCRETO PREMEZCLADO 4000 PSI M3' },
  { cod: 'MN-F0901003', precio: 5118.31, desc: 'CONCRETO PREMEZCLADO 5000 PSI M3' },

  // ─── PEGAMENTO PVC ───
  // CHICO p.29: Pegamento PVC GALÓN = 1366.04
  { cod: 'MN-F0703001', precio: 341.51, desc: 'PEGAMENTO PVC 1/4 GALÓN (CHICO 1366.04/gal÷4)' },

  // ─── GRIFERÍA ───
  // CHICO p.29: Válvula de Globo 1/2" = 170.00; Válvula Check 1/2" = 193.89; Válvula Compuerta 1/2" = 176.87
  { cod: 'MN-F0801001', precio: 170.00,  desc: 'VALVULA DE GLOBO 1/2" C/U' },
  { cod: 'MN-F0801002', precio: 193.89,  desc: 'VALVULA CHECK 1/2" C/U' },
  { cod: 'MN-F0801003', precio: 176.87,  desc: 'VALVULA COMPUERTA 1/2" C/U' },
  // Medidor de 1/2" para agua potable = 1075.68
  { cod: 'MN-F0802001', precio: 1075.68, desc: 'MEDIDOR DE AGUA 1/2" C/U' },

  // ─── LÁMINAS ───
  // CHICO p.31: Lámina Aluzinc Troquelada 42"x8' Cal.26 C/U = 319.07; Cal.28 = 271.52; 6' = 406.33
  { cod: 'MN-F1101001', precio: 319.07,  desc: 'LAMINA ALUZINC TROQUELADA 42"x8\' Cal.26 C/U' },
  { cod: 'MN-F1101002', precio: 271.52,  desc: 'LAMINA ALUZINC TROQUELADA 42"x8\' Cal.28 C/U' },

  // ─── TANQUES DE AGUA ───
  // CHICO p.31: Tinaco 2500L = 9661.00; 750L = 4111.39
  { cod: 'MN-F1201001', precio: 9661.00, desc: 'TANQUE/TINACO POLIETILENO 2500L C/U' },
  { cod: 'MN-F1201002', precio: 4111.39, desc: 'TANQUE/TINACO POLIETILENO 750L C/U' },

  // ─── ELÉCTRICOS ───
  // CHICO p.28: Cable Eléctrico #12 ML = 19.42; #10 = 30.16; #8 = 50.37; #6 = 70.75
  { cod: 'MN-F1301001', precio: 19.42,  desc: 'CABLE ELECTRICO #12 ML' },
  { cod: 'MN-F1301002', precio: 30.16,  desc: 'CABLE ELECTRICO #10 ML' },
  { cod: 'MN-F1301003', precio: 50.37,  desc: 'CABLE ELECTRICO #8 ML' },
  { cod: 'MN-F1301004', precio: 70.75,  desc: 'CABLE ELECTRICO #6 ML' },
  // Breaker 15A = 182.63; 20A = 415.07; 30A = 203.07; 40A = 251.14
  { cod: 'MN-F1302001', precio: 182.63, desc: 'BREAKER 15A 1 POLO C/U' },
  { cod: 'MN-F1302002', precio: 415.07, desc: 'BREAKER 20A 2 POLOS C/U' },
  { cod: 'MN-F1302003', precio: 203.07, desc: 'BREAKER 30A 1 POLO C/U' },

  // ─── IMPERMEABILIZANTE / PINTURA ───
  // CHICO p.30: Impermeabilizante GALÓN = 843.75; Impermeabilizante Blanco P/Fibra Cemento = 895.99
  { cod: 'MN-F1401001', precio: 843.75,  desc: 'IMPERMEABILIZANTE GALÓN' },
  { cod: 'MN-F1402001', precio: 970.67,  desc: 'PINTURA ACRILICA ALTA CALIDAD GALÓN' },
  { cod: 'MN-F1402002', precio: 1069.67, desc: 'PINTURA DE ACEITE ALTA CALIDAD GALÓN' },

  // ─── MANO DE OBRA (por jornada diaria) ───
  // CHICO p.44 — Precios Tegucigalpa Dic 2025:
  { cod: 'OC-F01001', precio: 700.00,  desc: 'ALBANIL jornal/día Tgú (CHICO Dic25)' },
  { cod: 'OC-F01002', precio: 680.00,  desc: 'ARMADOR DE HIERRO jornal/día Tgú' },
  { cod: 'OC-F01003', precio: 700.00,  desc: 'CARPINTERO jornal/día Tgú' },
  { cod: 'OC-F01004', precio: 700.00,  desc: 'FONTANERO jornal/día Tgú' },
  { cod: 'OC-F01005', precio: 850.00,  desc: 'ELECTRICISTA jornal/día Tgú' },
  { cod: 'OC-F01006', precio: 950.00,  desc: 'MAESTRO DE OBRAS jornal/día Tgú' },
  { cod: 'OC-F01007', precio: 675.00,  desc: 'SOLDADOR jornal/día Tgú' },
  { cod: 'OC-F01008', precio: 900.00,  desc: 'CAPATAZ jornal/día Tgú' },
  { cod: 'OC-F01009', precio: 700.00,  desc: 'PINTOR jornal/día Tgú' },
  { cod: 'OC-F01010', precio: 700.00,  desc: 'TABLAYESERO jornal/día Tgú' },
  { cod: 'OC-F01029', precio: 1100.00, desc: 'TOPOGRAFO jornal/día Tgú (CHICO Dic25)' },
  { cod: 'ON-F01001', precio: 480.00,  desc: 'AYUDANTE jornal/día Tgú' },
  { cod: 'ON-F01002', precio: 450.00,  desc: 'PEON DE MERCADO jornal/día Tgú' },
  { cod: 'ON-F01003', precio: 500.00,  desc: 'CADENERO jornal/día Tgú' },
  // Operadores
  { cod: 'OC-F02001', precio: 800.00,  desc: 'OPERADOR RETROEXCAVADORA jornal Tgú' },
  { cod: 'OC-F02002', precio: 1100.00, desc: 'OPERADOR MOTONIVELADORA jornal Tgú' },
  { cod: 'OC-F02003', precio: 950.00,  desc: 'OPERADOR EXCAVADORA jornal Tgú' },
  { cod: 'OC-F02004', precio: 800.00,  desc: 'OPERADORA VIBROCOMPACTADORA jornal Tgú' },

  // ─── EQUIPO (por hora) ───
  // CHICO p.43 — San Pedro Sula (referencia, datos Tgú no publicados separados)
  // Retroexcavadora tipo 420E/416E = L 1,537.90/h
  { cod: 'HE-F01010', precio: 1537.90, desc: 'RETROEXCAVADORA tipo 420E/416E (CHICO Dic25 SPS)' },
  // Excavadora 20T tipo 320DL = L 2,033.18/h
  { cod: 'HE-F01001', precio: 2033.18, desc: 'EXCAVADORA DE ORUGAS 20T (CHICO Dic25)' },
  // Motoniveladora 170HP = L 3,037.97/h
  { cod: 'HE-F06001', precio: 3037.97, desc: 'MOTONIVELADORA 170HP (CHICO Dic25)' },
  // Cargadora 2.5-3M3 tipo 950H = L 2,448.37/h
  { cod: 'HE-F07001', precio: 2448.37, desc: 'CARGADOR FRONTAL 2.5-3M3 (CHICO Dic25)' },
  // Vibrocompactador 7-8T = L 1,131.56/h; Pata de Cabra 10-12T = L 1,772.11/h
  { cod: 'HE-F02001', precio: 1131.56, desc: 'COMPACTADORA VIBRATORIA 7-8T (CHICO Dic25)' },
  // Compactadora sapo = L 588.58/h; compactadora vibratoria de plato = L 615.25
  { cod: 'HE-F05001', precio: 615.25,  desc: 'COMPACTADORA VIBRATORIA DE PLATO (CHICO Dic25)' },
  // Volqueta 5M3 = L 1,095.13/h; 12-14M3 = L 1,669.68/h
  { cod: 'HE-F03001', precio: 1095.13, desc: 'VOLQUETA 5M3 (CHICO Dic25)' },
  // Camión mezclador 7M3 = L 1,582.43/h
  { cod: 'HE-F03013', precio: 1582.43, desc: 'CAMION MEZCLADOR CONCRETO 7M3 (CHICO Dic25)' },
  // Equipo de topografía — estimar 2 jornales operador + equipo: L 1,100/día
  { cod: 'HE-F04001', precio: 1100.00, desc: 'EQUIPO TOPOGRAFIA por día (est. Tgú 2025)' },
];

// ────────────────────────────────────────────────────────
// BÚSQUEDA INTELIGENTE: código exacto → descripción fuzzy
// ────────────────────────────────────────────────────────
function buscarInsumo(db, cod, desc) {
  // 1. Por código exacto
  let r = db.exec('SELECT id_insumo, codigo, descripcion, precio_unitario FROM insumos WHERE codigo = ?', [cod]);
  if (r.length && r[0].values.length) return r[0].values[0];

  // 2. Por descripción similar (primeras 3 palabras)
  const palabras = desc.replace(/[()\/]/g, ' ').split(/\s+/).filter(p => p.length > 2).slice(0, 3);
  for (const pal of palabras) {
    r = db.exec(`SELECT id_insumo, codigo, descripcion, precio_unitario FROM insumos WHERE UPPER(descripcion) LIKE UPPER(?) LIMIT 1`, [`%${pal}%`]);
    if (r.length && r[0].values.length) {
      // Verify at least 2 words match
      const found = r[0].values[0][2].toUpperCase();
      const hits = palabras.filter(p => found.includes(p.toUpperCase())).length;
      if (hits >= 2) return r[0].values[0];
    }
  }
  return null;
}

async function actualizarPrecios() {
  const db = await getDb();
  let actualizados = 0, noEncontrados = 0, sinCambio = 0;
  const log = [];

  for (const item of precios) {
    const found = buscarInsumo(db, item.cod, item.desc);
    if (!found) {
      noEncontrados++;
      log.push(`  ⚠ NO ENCONTRADO: ${item.cod} — ${item.desc}`);
      continue;
    }
    const [id, codReal, descReal, precioAnterior] = found;

    if (Math.abs(Number(precioAnterior) - item.precio) < 0.01) {
      sinCambio++;
      continue;
    }

    // Guardar historial
    db.run('INSERT INTO historial_precios (id_insumo, precio_anterior, precio_nuevo) VALUES (?,?,?)',
      [id, precioAnterior, item.precio]);
    // Actualizar precio
    db.run("UPDATE insumos SET precio_unitario=?, fecha_actualizacion=date('now') WHERE id_insumo=?",
      [item.precio, id]);

    actualizados++;
    log.push(`  ✓ ${codReal} | ${descReal.substring(0,40)} | L ${Number(precioAnterior).toFixed(2)} → L ${item.precio.toFixed(2)}`);
  }

  saveDb();

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  ACTUALIZACIÓN CHICO Boletín IV-2025 — Diciembre 2025        ║`);
  console.log(`╠══════════════════════════════════════════════════════════════╣`);
  console.log(`║  ✓ Actualizados:      ${String(actualizados).padEnd(39)}║`);
  console.log(`║  — Sin cambio:        ${String(sinCambio).padEnd(39)}║`);
  console.log(`║  ⚠ No encontrados:    ${String(noEncontrados).padEnd(39)}║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);

  if (log.length > 0) {
    console.log('DETALLE:');
    log.forEach(l => console.log(l));
  }
  process.exit(0);
}

actualizarPrecios().catch(e => { console.error(e); process.exit(1); });
