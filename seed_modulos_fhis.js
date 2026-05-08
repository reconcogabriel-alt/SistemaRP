// ============================================================
// Importa módulos FHIS como actividades de referencia
// Fuente: FHIS — Fondo Hondureño de Inversión Social
//         "Listado General de Módulos"
// Se importan solo los relevantes para agua, saneamiento,
// infraestructura y edificaciones (los más usados en PUSAP/PAU)
// ============================================================
process.chdir(__dirname);
const { getDb, saveDb } = require('./src/db/database');

const modulos = [
  // ─── AGUA POTABLE ───────────────────────────────────────
  { codigo: 'AP-0002', desc: 'MODULO DE AGUA POTABLE',                               unidad: 'GLOBAL' },
  { codigo: 'AP-0003', desc: 'SIEMBRA DE AGUA',                                      unidad: 'GLOBAL' },
  { codigo: 'AP-0004', desc: 'VIGILANCIA Y CONTROL DE CALIDAD DE AGUA',              unidad: 'GLOBAL' },
  { codigo: 'AP-0005', desc: 'CLORACION',                                            unidad: 'GLOBAL' },
  { codigo: 'M-2305',  desc: 'TANQUES DE ALMACENAMIENTO',                            unidad: 'GLOBAL' },
  { codigo: 'M-2304',  desc: 'TANQUES ROMPECARGAS',                                  unidad: 'GLOBAL' },
  { codigo: 'M-2303',  desc: 'DESARENADORES',                                        unidad: 'GLOBAL' },
  { codigo: 'M-000057',desc: 'DESARENADOR (MODULO)',                                  unidad: 'GLOBAL' },
  { codigo: 'M-0000571',desc:'CAMARA DE DISTRIBUCION',                               unidad: 'GLOBAL' },
  { codigo: 'M-0000572',desc:'TANQUE ROMPECARGA',                                    unidad: 'GLOBAL' },
  { codigo: 'M-0000573',desc:'HIPOCLORADOR',                                         unidad: 'GLOBAL' },
  { codigo: 'M-000058', desc:'LINEA DE CONDUCCION',                                  unidad: 'ML' },
  { codigo: 'M-000059', desc:'TANQUE DE DISTRIBUCION',                               unidad: 'GLOBAL' },
  { codigo: 'M-000060', desc:'TANQUE DE ALMACENAMIENTO',                             unidad: 'GLOBAL' },
  { codigo: 'M-000043', desc:'TANQUE 35000 GLNS. SUPERFICIAL',                       unidad: 'GLOBAL' },
  { codigo: 'M-000044', desc:'TANQUE 40000 GLNS. ELEVADO',                           unidad: 'GLOBAL' },
  { codigo: 'M-0000440',desc:'TANQUE ELEVADO',                                       unidad: 'GLOBAL' },
  { codigo: 'M-0000441',desc:'TANQUE ELEVADO 5,000 GALONES',                         unidad: 'GLOBAL' },
  { codigo: 'M-23000',  desc:'TANQUE DE 25000 GALONES',                              unidad: 'GLOBAL' },
  { codigo: 'PRD-T5G',  desc:'TANQUE SUPERFICIAL DE 5,000 GLNS',                     unidad: 'GLOBAL' },
  { codigo: 'PRD-T10G', desc:'TANQUE SUPERFICIAL DE 10,000 GLNS',                    unidad: 'GLOBAL' },
  { codigo: 'PRD-T15G', desc:'TANQUE SUPERFICIAL DE 15,000 GLNS',                    unidad: 'GLOBAL' },
  { codigo: 'PRD-T20G', desc:'TANQUE SUPERFICIAL DE 20,000 GALONES',                 unidad: 'GLOBAL' },
  { codigo: 'PRD-T25G', desc:'TANQUE SUPERFICIAL DE 25,000 GLNS',                    unidad: 'GLOBAL' },
  { codigo: 'PRD-TE10G',desc:'TANQUE ELEVADO DE 10,000 GALONES',                     unidad: 'GLOBAL' },
  { codigo: 'PRD-TR1',  desc:'TANQUE ROMPECARGA TIPO 1',                             unidad: 'GLOBAL' },
  { codigo: 'PRD-TR2',  desc:'TANQUE ROMPECARGA TIPO 2',                             unidad: 'GLOBAL' },
  { codigo: 'PRD-PT',   desc:'PRESA TIPO',                                           unidad: 'GLOBAL' },
  { codigo: 'PRD-D47G', desc:'DESARENADOR DE 47 GPM',                                unidad: 'GLOBAL' },
  { codigo: 'PRD-D79G', desc:'DESARENADOR DE 79 GPM',                                unidad: 'GLOBAL' },
  { codigo: 'PRD-D99G', desc:'DESARENADOR DE 99 GPM',                                unidad: 'GLOBAL' },
  { codigo: 'PRD-D158G',desc:'DESARENADOR DE 158 GPM',                               unidad: 'GLOBAL' },
  { codigo: 'PRD-HIPO', desc:'HIPOCLORADOR',                                         unidad: 'GLOBAL' },
  { codigo: 'M-230000', desc:'CASETA DE BOMBEO',                                     unidad: 'GLOBAL' },
  { codigo: 'PRD-CEB',  desc:'CASETAS ESTACION DE BOMBEO',                           unidad: 'GLOBAL' },
  { codigo: 'PRD-BDPM', desc:'BOMBEO A DISTANCIA POZO MEJORADO',                     unidad: 'GLOBAL' },
  { codigo: 'PRD-BDPE', desc:'BOMBEO A DISTANCIA POZO EXISTENTE',                    unidad: 'GLOBAL' },
  { codigo: 'PRD-CALL', desc:'CAPTACION DE AGUAS LLUVIAS',                           unidad: 'GLOBAL' },
  // Tuberías por módulo
  { codigo: 'PRD-TPVC1"',  desc:'INSTALACION TUBERIA PVC 1"',                        unidad: 'ML' },
  { codigo: 'PRD-TPVC11/2"',desc:'INSTALACION TUBERIA PVC 1 1/2"',                   unidad: 'ML' },
  { codigo: 'PRD-TPVC2"',  desc:'INSTALACION DE TUBERIA PVC 2"',                     unidad: 'ML' },
  { codigo: 'PRD-TPVC3"',  desc:'INSTALACION DE TUBERIA PVC 3"',                     unidad: 'ML' },
  { codigo: 'PRD-TPVC4"',  desc:'INSTALACION DE TUBERIA PVC 4"',                     unidad: 'ML' },
  { codigo: 'PRD-TPVC6"',  desc:'INSTALACION DE TUBERIA PVC 6"',                     unidad: 'ML' },
  { codigo: 'PRD-THG1"',   desc:'INSTALACION DE TUBERIA HG 1"',                      unidad: 'ML' },
  { codigo: 'PRD-THG11/2"',desc:'INSTALACION DE TUBERIA HG 1 1/2"',                  unidad: 'ML' },
  { codigo: 'PRD-THG2"',   desc:'INSTALACION DE TUBERIA HG 2"',                      unidad: 'ML' },
  { codigo: 'PRD-THG3"',   desc:'INSTALACION DE TUBERIA HG 3"',                      unidad: 'ML' },
  { codigo: 'PRD-THG4"',   desc:'INSTALACION DE TUBERIA HG 4"',                      unidad: 'ML' },
  { codigo: 'PRD-THG6"',   desc:'INSTALACION DE TUBERIA HG 6"',                      unidad: 'ML' },
  // Conexiones y accesorios
  { codigo: 'C-0001',   desc:'CONEXIONES DOMICILIARIAS',                              unidad: 'GLOBAL' },
  { codigo: 'PRD-CDOM', desc:'MODULO DE CONEXIONES DOMICILIARIAS',                    unidad: 'C/U' },
  { codigo: 'M-2306',   desc:'CONEXIONES DOMICILIARIAS (AP)',                         unidad: 'C/U' },
  { codigo: 'M-2307',   desc:'HIDRANTES',                                             unidad: 'C/U' },
  { codigo: 'M-2308',   desc:'CAJAS DE VALVULA',                                      unidad: 'C/U' },
  { codigo: 'M-2311',   desc:'VALVULAS',                                              unidad: 'C/U' },
  { codigo: 'M-2310',   desc:'PRUEBAS HIDROSTATICAS',                                 unidad: 'GLOBAL' },
  { codigo: 'PRD-CV',   desc:'CAJA DE VALVULA',                                       unidad: 'C/U' },
  { codigo: 'PRD-CYA',  desc:'PROTECCION DE TUBERIA Y ANCLAJES',                      unidad: 'GLOBAL' },
  { codigo: 'M-3001',   desc:'ANCLAJES',                                              unidad: 'C/U' },
  { codigo: 'C-0004',   desc:'CISTERNA',                                              unidad: 'GLOBAL' },
  { codigo: 'PRD-ZF',   desc:'ZANJAS FILTRANTES',                                     unidad: 'ML' },
  { codigo: 'PRD-CMC',  desc:'CERCO DE MALLA CICLON (AP)',                            unidad: 'ML' },

  // ─── AGUAS NEGRAS / SANEAMIENTO ─────────────────────────
  { codigo: 'AN-0001',  desc:'MODULO DE AGUAS NEGRAS',                               unidad: 'GLOBAL' },
  { codigo: 'SC-0001',  desc:'SUB-COLECTOR ALCANTARILLADO',                           unidad: 'ML' },
  { codigo: 'SC-0002',  desc:'COLECTOR ALCANTARILLADO SANITARIO',                     unidad: 'ML' },
  { codigo: 'U-0001',   desc:'ACOMETIDAS DOMICILIARIO ZONA 1',                        unidad: 'C/U' },
  { codigo: 'U-0002',   desc:'POZOS DE INSPECCION ZONA 1',                            unidad: 'C/U' },
  { codigo: 'C-0003',   desc:'CONEXION RED DE AGUAS NEGRAS',                          unidad: 'C/U' },
  { codigo: 'M-1102',   desc:'FOSAS SEPTICAS',                                        unidad: 'C/U' },
  { codigo: 'M-1103',   desc:'LETRINAS',                                              unidad: 'C/U' },
  { codigo: 'M-1104',   desc:'POZO DE ABSORCION',                                     unidad: 'C/U' },
  { codigo: 'M-0000998',desc:'TANQUE SEPTICO Y CAMPO DE ABSORCION',                   unidad: 'GLOBAL' },
  { codigo: 'M-0000999',desc:'TANQUE SEPTICO FILTRO ANAEROBICO 2 AULAS',              unidad: 'GLOBAL' },
  { codigo: 'M-0001000',desc:'TANQUE SEPTICO FILTRO ANAEROBICO 4 AULAS',              unidad: 'GLOBAL' },
  { codigo: 'M-0001001',desc:'TANQUE SEPTICO FILTRO ANAEROBICO 6 AULAS',              unidad: 'GLOBAL' },
  { codigo: 'T-0001',   desc:'TRAMPA DE GRASA',                                       unidad: 'C/U' },
  { codigo: 'PRD-LFSAB',desc:'LETRINA FOSA SIMPLE ADOBE/ADEM. BLOQUE',               unidad: 'C/U' },
  { codigo: 'PRD-LFSAP',desc:'LETRINA FOSA SIMPLE ADOBE/ADEM. PIEDRA',               unidad: 'C/U' },
  { codigo: 'PRD-LCHAB',desc:'LETRINA C.H. ADOBE/ADEMADO BLOQUE',                    unidad: 'C/U' },
  { codigo: 'M-000063', desc:'OBRAS DE DRENAJE',                                      unidad: 'GLOBAL' },
  { codigo: 'ALL-0001', desc:'MODULO DE AGUAS LLUVIAS',                               unidad: 'GLOBAL' },

  // ─── EDIFICACIONES / MÓDULOS ESCOLARES ──────────────────
  { codigo: 'M-000001', desc:'AULA ESCOLAR DE 6X8',                                   unidad: 'C/U' },
  { codigo: 'M-000002', desc:'2 AULAS ESCOLARES DE 6X8',                              unidad: 'GLOBAL' },
  { codigo: 'M-000003', desc:'3 AULAS ESCOLARES DE 6X8',                              unidad: 'GLOBAL' },
  { codigo: 'M-000009', desc:'COCINA BODEGA DE 48 M2',                                unidad: 'GLOBAL' },
  { codigo: 'M-000010', desc:'COCINA BODEGA DE 24 M2',                                unidad: 'GLOBAL' },
  { codigo: 'M-000011', desc:'AULA DE INSTITUTO DE 7X8',                              unidad: 'C/U' },
  { codigo: 'M-000017', desc:'CENTRO DE SALUD CESAR AC/95',                           unidad: 'GLOBAL' },
  { codigo: 'M-000019', desc:'CENTRO DE SALUD CESAMO BB/95',                          unidad: 'GLOBAL' },
  { codigo: 'M-000027', desc:'MODULO DE 2 SERVICIOS SANITARIOS',                      unidad: 'GLOBAL' },
  { codigo: 'M-000028', desc:'MODULO DE 3 SERVICIOS SANITARIOS',                      unidad: 'GLOBAL' },
  { codigo: 'M-000029', desc:'MODULO DE 4 SERVICIOS SANITARIOS',                      unidad: 'GLOBAL' },
  { codigo: 'M-000030', desc:'MODULO DE 5 SERVICIOS SANITARIOS',                      unidad: 'GLOBAL' },

  // ─── PRELIMINARES / MOVIMIENTO DE TIERRA ────────────────
  { codigo: 'M-0101',   desc:'LIMPIEZA',                                               unidad: 'M2' },
  { codigo: 'M-0102',   desc:'DEMOLICIONES',                                           unidad: 'GLOBAL' },
  { codigo: 'M-0103',   desc:'TRAZADOS',                                               unidad: 'M2' },
  { codigo: 'M-0104',   desc:'EXCAVACIONES',                                           unidad: 'M3' },
  { codigo: 'M-0105',   desc:'RELLENOS',                                               unidad: 'M3' },
  { codigo: 'M-0106',   desc:'ACARREOS',                                               unidad: 'M3' },
  { codigo: 'M-2501',   desc:'MOVIMIENTOS DE TIERRA',                                  unidad: 'M3' },

  // ─── ESTRUCTURA / CIMENTACIONES ─────────────────────────
  { codigo: 'M-0201',   desc:'MAMPOSTERIA (CIMENTACION)',                              unidad: 'M3' },
  { codigo: 'M-0202',   desc:'BLOQUE EN CIMENTACIONES',                                unidad: 'M3' },
  { codigo: 'M-0203',   desc:'ZAPATA CORRIDA',                                         unidad: 'ML' },
  { codigo: 'M-0204',   desc:'ZAPATA AISLADA',                                         unidad: 'C/U' },
  { codigo: 'M-0205',   desc:'PEDESTALES DE CONCRETO',                                 unidad: 'C/U' },
  { codigo: 'M-0301',   desc:'SOLERAS',                                                unidad: 'ML' },
  { codigo: 'M-0302',   desc:'CASTILLOS',                                              unidad: 'ML' },
  { codigo: 'M-0304',   desc:'COLUMNAS',                                               unidad: 'ML' },
  { codigo: 'M-0307',   desc:'VIGAS',                                                  unidad: 'ML' },
  { codigo: 'M-0501',   desc:'CONCRETO HIDRAULICO',                                    unidad: 'M3' },
  { codigo: 'M-0502',   desc:'CONCRETO CICLOPEO',                                      unidad: 'M3' },
  { codigo: 'M-0503',   desc:'ACERO DE REFUERZO',                                      unidad: 'KG' },

  // ─── PAREDES / ACABADOS ──────────────────────────────────
  { codigo: 'M-0401',   desc:'PAREDES DE LADRILLO',                                    unidad: 'M2' },
  { codigo: 'M-0402',   desc:'BLOQUE EN PAREDES',                                      unidad: 'M2' },
  { codigo: 'M-0601',   desc:'REPELLOS Y PULIDOS',                                     unidad: 'M2' },
  { codigo: 'M-0602',   desc:'ENCHAPE EN PAREDES',                                     unidad: 'M2' },
  { codigo: 'M-0701',   desc:'CONCRETO EN PISOS',                                      unidad: 'M2' },
  { codigo: 'M-0702',   desc:'PISOS DE LADRILLO',                                      unidad: 'M2' },
  { codigo: 'M-0703',   desc:'CERAMICAS',                                              unidad: 'M2' },

  // ─── TECHOS ─────────────────────────────────────────────
  { codigo: 'M-0801',   desc:'CUBIERTA DE FIBROCEMENTO',                               unidad: 'M2' },
  { codigo: 'M-0802',   desc:'CUBIERTA DE LAMINA METALICA',                            unidad: 'M2' },
  { codigo: 'M-0804',   desc:'CIELOS FALSOS',                                          unidad: 'M2' },

  // ─── INSTALACIONES ───────────────────────────────────────
  { codigo: 'M-000042', desc:'INSTALACIONES ELECTRICAS',                               unidad: 'GLOBAL' },
  { codigo: 'M-000051', desc:'INSTALACIONES HIDROSANITARIAS',                          unidad: 'GLOBAL' },
  { codigo: 'M-2101',   desc:'CIRCUITOS DE ILUMINACION',                               unidad: 'GLOBAL' },
  { codigo: 'M-2102',   desc:'CIRCUITOS DE FUERZA',                                    unidad: 'GLOBAL' },
  { codigo: 'M-2103',   desc:'CENTRO DE CARGA',                                        unidad: 'C/U' },
  { codigo: 'M-2104',   desc:'ACOMETIDAS ELECTRICAS',                                  unidad: 'GLOBAL' },

  // ─── PUERTAS / VENTANAS ──────────────────────────────────
  { codigo: 'M-1201',   desc:'PUERTAS',                                                unidad: 'C/U' },
  { codigo: 'M-1202',   desc:'VENTANAS',                                               unidad: 'C/U' },
  { codigo: 'M-1204',   desc:'PIZARRONES',                                             unidad: 'C/U' },

  // ─── CERCOS / ACCESOS ────────────────────────────────────
  { codigo: 'M-000020', desc:'CERCO DE ALAMBRE DE PUAS',                               unidad: 'ML' },
  { codigo: 'M-000021', desc:'CERCO DE MALLA CICLON',                                  unidad: 'ML' },
  { codigo: 'M-000022', desc:'CERCO DE BLOQUE',                                        unidad: 'ML' },
  { codigo: 'M-000023', desc:'CERCO DE LADRILLO RAFON',                                unidad: 'ML' },
  { codigo: 'M-000025', desc:'ACERAS',                                                 unidad: 'M2' },
  { codigo: 'M-1401',   desc:'POSTES',                                                 unidad: 'C/U' },
  { codigo: 'M-1402',   desc:'MALLA CICLON',                                           unidad: 'ML' },
  { codigo: 'M-1403',   desc:'ALAMBRE DE PUAS',                                        unidad: 'ML' },
  { codigo: 'M-1404',   desc:'PORTONES',                                               unidad: 'C/U' },

  // ─── PAVIMENTOS ─────────────────────────────────────────
  { codigo: 'M-1501',   desc:'EMPEDRADOS',                                             unidad: 'M2' },
  { codigo: 'M-1502',   desc:'ADOQUINADOS',                                            unidad: 'M2' },
  { codigo: 'M-1503',   desc:'PAVIMENTOS ASFALTICOS',                                  unidad: 'M2' },
  { codigo: 'M-1504',   desc:'BORDILLOS',                                              unidad: 'ML' },
  { codigo: 'M-1505',   desc:'CONCRETO HIDRAULICO (PAVIMENTO)',                        unidad: 'M2' },

  // ─── CUNETAS / DRENAJE ──────────────────────────────────
  { codigo: 'M-1901',   desc:'MAMPOSTERIA (CUNETAS)',                                  unidad: 'ML' },
  { codigo: 'M-1903',   desc:'CONCRETO (CUNETAS)',                                     unidad: 'ML' },
  { codigo: 'M-1904',   desc:'REJILLAS',                                               unidad: 'C/U' },
  { codigo: 'M-2201',   desc:'TRAGANTES',                                              unidad: 'C/U' },
  { codigo: 'M-2202',   desc:'CANALES DE AGUAS LLUVIAS',                               unidad: 'ML' },
  { codigo: 'M-2203',   desc:'BAJANTES',                                               unidad: 'ML' },

  // ─── PUENTES COLGANTES ───────────────────────────────────
  { codigo: 'P-0001',   desc:'PUENTES COLGANTES',                                     unidad: 'GLOBAL' },
  { codigo: 'M-3001',   desc:'ANCLAJES (PUENTES)',                                     unidad: 'C/U' },
  { codigo: 'M-3003',   desc:'CABLES',                                                 unidad: 'ML' },

  // ─── GENERALES ───────────────────────────────────────────
  { codigo: 'M-1801',   desc:'DIRECCION Y SUPERVISION',                               unidad: 'GLOBAL' },
  { codigo: 'M-000050', desc:'MEDIDAS AMBIENTALES',                                   unidad: 'GLOBAL' },
  { codigo: 'AM-0001',  desc:'APORTE MUNICIPAL',                                      unidad: 'GLOBAL' },
  { codigo: 'M-000040', desc:'GENERALES',                                             unidad: 'GLOBAL' },
];

async function importarModulos() {
  const db = await getDb();
  let nuevos = 0, existentes = 0;

  for (const m of modulos) {
    const ex = db.exec('SELECT id_actividad FROM actividades WHERE codigo = ?', [m.codigo]);
    if (ex.length && ex[0].values.length) { existentes++; continue; }
    db.run('INSERT INTO actividades (codigo, descripcion, unidad, costo_total) VALUES (?,?,?,0)',
      [m.codigo, m.desc, m.unidad]);
    nuevos++;
  }

  saveDb();
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  MÓDULOS FHIS IMPORTADOS                             ║`);
  console.log(`╠══════════════════════════════════════════════════════╣`);
  console.log(`║  ✓ Nuevos insertados:  ${String(nuevos).padEnd(29)}║`);
  console.log(`║  — Ya existían:        ${String(existentes).padEnd(29)}║`);
  console.log(`║  Total módulos:        ${String(modulos.length).padEnd(29)}║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);
  process.exit(0);
}

importarModulos().catch(e => { console.error(e); process.exit(1); });
