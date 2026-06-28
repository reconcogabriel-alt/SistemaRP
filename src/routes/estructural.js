'use strict';

const express = require('express');
const router  = express.Router();
const { calcViga, calcColumna, calcZapata } = require('../logic/aci318');

function parseNum(v, nombre) {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) throw new Error(`Parámetro inválido: ${nombre} = ${v}`);
  return n;
}

function respOk(res, data)   { res.json({ ok: true,  data }); }
function respErr(res, msg)   { res.status(400).json({ ok: false, error: msg }); }

router.post('/viga', (req, res) => {
  try {
    const { b, h, L, r = 4, WD, WL, fc, fy } = req.body;
    const params = {
      b:  parseNum(b,  'b (base cm)'),
      h:  parseNum(h,  'h (peralte cm)'),
      L:  parseNum(L,  'L (longitud m)'),
      r:  Number(r) || 4,
      WD: parseNum(WD, 'WD (carga muerta ton/m)'),
      WL: parseNum(WL, 'WL (carga viva ton/m)'),
      fc: parseNum(fc, "f'c (kg/cm²)"),
      fy: parseNum(fy, 'fy (kg/cm²)'),
    };
    respOk(res, calcViga(params));
  } catch (e) { respErr(res, e.message); }
});

router.post('/columna', (req, res) => {
  try {
    const { a, b, H, r = 4, PD, PL, fc, fy, rho_pct = 2, d_est = 12.7 } = req.body;
    const params = {
      a:       parseNum(a,  'a (lado cm)'),
      b:       parseNum(b,  'b (lado cm)'),
      H:       parseNum(H,  'H (altura m)'),
      r:       Number(r) || 4,
      PD:      parseNum(PD, 'PD (carga muerta ton)'),
      PL:      parseNum(PL, 'PL (carga viva ton)'),
      fc:      parseNum(fc, "f'c"),
      fy:      parseNum(fy, 'fy'),
      rho_pct: Number(rho_pct) || 2,
      d_est:   Number(d_est)  || 12.7,
    };
    respOk(res, calcColumna(params));
  } catch (e) { respErr(res, e.message); }
});

router.post('/zapata', (req, res) => {
  try {
    const { PD, PL, qa, Df = 1.2, ca, cb, fc, fy } = req.body;
    const params = {
      PD: parseNum(PD, 'PD (ton)'),
      PL: parseNum(PL, 'PL (ton)'),
      qa: parseNum(qa, 'qa (ton/m²)'),
      Df: Number(Df) || 1.2,
      ca: parseNum(ca, 'ca (lado col. cm)'),
      cb: parseNum(cb, 'cb (lado col. cm)'),
      fc: parseNum(fc, "f'c"),
      fy: parseNum(fy, 'fy'),
    };
    respOk(res, calcZapata(params));
  } catch (e) { respErr(res, e.message); }
});

router.get('/health', (_req, res) => {
  res.json({ ok: true, modulo: 'calculadora-estructural', version: '1.0.0' });
});

module.exports = router;
