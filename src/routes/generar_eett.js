const express    = require('express');
const router     = express.Router();
const https      = require('https');
const { getDb, saveDb } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// Ejemplos de estilo tomados de la propia base de datos
async function getEjemplos() {
  const db = await getDb();
  const r = db.exec(`SELECT codigo, nombre, unidad, descripcion, consideraciones, criterios_pago
    FROM especificaciones_fhis WHERE codigo IN ('F011001','F031001','F034001') LIMIT 3`);
  if (!r.length) return '';
  return r[0].values.map(v =>
    `CÓDIGO: ${v[0]} | NOMBRE: ${v[1]} | UNIDAD: ${v[2]}\n` +
    `DESCRIPCIÓN: ${v[3]}\nCONSIDERACIONES: ${v[4]}\nCRITERIOS: ${v[5]}`
  ).join('\n---\n');
}

function llamarClaude(prompt, apiKey) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const p = JSON.parse(data);
          if (p.error) return reject(new Error(p.error.message));
          resolve(p.content?.[0]?.text || '');
        } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parsear(texto, lote) {
  const fichas = [];
  const partes = texto.split(/===([^=\n]+)===/g);
  for (let i = 1; i < partes.length - 1; i += 2) {
    const codigo = partes[i].trim();
    const bloque = partes[i + 1] || '';
    const get = tag => {
      const m = bloque.match(new RegExp('\\[' + tag + '\\]([\\s\\S]*?)(?=\\[|$)'));
      return m ? m[1].trim() : '';
    };
    const nombre = get('NOMBRE');
    const act = lote.find(a => a.codigo === codigo);
    if (act && nombre) fichas.push({
      codigo,
      nombre,
      unidad: act.unidad,
      descripcion:      get('DESCRIPCION'),
      consideraciones:  get('CONSIDERACIONES'),
      criterios_pago:   get('CRITERIOS')
    });
  }
  return fichas;
}

// ── GET: actividades pendientes de generar (paginado) ────
router.get('/pendientes', requireAuth, async (req, res) => {
  try {
    const db     = await getDb();
    const offset = parseInt(req.query.offset) || 0;
    const limit  = Math.min(parseInt(req.query.limit) || 50, 100);

    const total_r = db.exec(`SELECT COUNT(*) FROM actividades a
      LEFT JOIN especificaciones_fhis e ON e.codigo = a.codigo
      WHERE e.id_especificacion IS NULL`);
    const total = total_r[0].values[0][0];

    const r = db.exec(`SELECT a.codigo, a.descripcion, a.unidad
      FROM actividades a
      LEFT JOIN especificaciones_fhis e ON e.codigo = a.codigo
      WHERE e.id_especificacion IS NULL
      ORDER BY a.codigo LIMIT ${limit} OFFSET ${offset}`);

    const rows = r.length ? r[0].values.map(v => ({
      codigo: v[0], descripcion: v[1], unidad: v[2]
    })) : [];

    res.json({ total, rows, offset, limit });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── POST: generar un lote ─────────────────────────────────
router.post('/generar-lote', requireAuth, async (req, res) => {
  try {
    const { actividades, apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'Se requiere la API key de Anthropic' });
    if (!actividades || !actividades.length)
      return res.status(400).json({ error: 'Sin actividades en el lote' });

    const ejemplos = await getEjemplos();
    const lista = actividades.map(a =>
      `- CÓDIGO: ${a.codigo} | DESC: ${a.descripcion} | UNIDAD: ${a.unidad}`
    ).join('\n');

    const prompt = `Eres un ingeniero civil experto en especificaciones técnicas de construcción en Honduras.
Redacta especificaciones técnicas con el mismo estilo del catálogo oficial FHIS. Usa español técnico, tercera persona, tiempo futuro ("consistirá", "se medirá").

EJEMPLOS DE ESTILO A SEGUIR:
${ejemplos}

Para CADA actividad usa EXACTAMENTE este formato (con los delimitadores):
===CODIGO===
[NOMBRE]nombre técnico completo de la actividad
[DESCRIPCION]2-3 oraciones: en qué consiste, materiales, proceso constructivo
[CONSIDERACIONES]rendimientos, mano de obra, materiales por unidad, desperdicios típicos
[CRITERIOS]cómo se mide (unidad indicada) y cómo se paga

ACTIVIDADES A ESPECIFICAR:
${lista}`;

    const texto  = await llamarClaude(prompt, apiKey);
    const fichas = parsear(texto, actividades);

    // Insertar en BD
    const db = await getDb();
    let insertadas = 0;
    for (const f of fichas) {
      try {
        db.run(
          `INSERT OR IGNORE INTO especificaciones_fhis
           (codigo, nombre, unidad, descripcion, consideraciones, criterios_pago)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [f.codigo, f.nombre, f.unidad, f.descripcion, f.consideraciones, f.criterios_pago]
        );
        insertadas++;
      } catch(e) { /* duplicado, ignorar */ }
    }
    if (insertadas > 0) saveDb();

    res.json({ ok: true, generadas: fichas.length, insertadas, fichas });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
