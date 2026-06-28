
'use strict';

// ─────────────────────────────────────────────
// Tablas de varillas (ASTM A615 / norma HN)
// ─────────────────────────────────────────────
const VARILLAS = [
  { diam: 9.5,  num: '#3', area: 0.71,  peso: 0.560 },
  { diam: 12.7, num: '#4', area: 1.27,  peso: 0.994 },
  { diam: 15.9, num: '#5', area: 1.99,  peso: 1.552 },
  { diam: 19.1, num: '#6', area: 2.85,  peso: 2.235 },
  { diam: 22.2, num: '#7', area: 3.87,  peso: 3.042 },
  { diam: 25.4, num: '#8', area: 5.10,  peso: 3.973 },
  { diam: 28.7, num: '#9', area: 6.45,  peso: 5.060 },
  { diam: 32.3, num: '#10',area: 8.19,  peso: 6.404 },
];

/**
 * Selecciona el grupo varilla+cantidad mínimo que cubra As_req.
 * Devuelve { diam, num, n, area_1, As_prov, peso_kg_m }
 */
function elegirVarilla(As_req) {
  for (const v of VARILLAS) {
    for (let n = 2; n <= 12; n++) {
      if (v.area * n >= As_req) {
        return { ...v, n, As_prov: +(v.area * n).toFixed(3) };
      }
    }
  }
  const v = VARILLAS[VARILLAS.length - 1];
  return { ...v, n: 12, As_prov: +(v.area * 12).toFixed(3) };
}

// ─────────────────────────────────────────────
// VIGA RECTANGULAR — Flexión simple + cortante
// ACI 318-19 §9
// ─────────────────────────────────────────────
function calcViga({ b, h, L, r = 4, WD, WL, fc, fy }) {
  const Wu = 1.2 * WD + 1.6 * WL;         // ton/m
  const Mu = Wu * L * L / 8;               // ton·m
  const Mu_kg_cm = Mu * 100000;

  const d = h - r - 1.27;                  // peralte efectivo cm
  const phi_f = 0.90;
  const Rn = Mu_kg_cm / (phi_f * b * d * d);

  const rho     = (0.85 * fc / fy) * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * fc)));
  const rho_min = Math.max(14 / fy, 0.25 * Math.sqrt(fc) / fy);
  const beta1   = fc <= 280 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * (fc - 280) / 70);
  const rho_max = 0.75 * 0.85 * beta1 * (fc / fy) * (6000 / (6000 + fy));
  const rho_d   = Math.max(rho, rho_min);
  const As      = rho_d * b * d;

  const vLong = elegirVarilla(As);

  // Estribos Ø#3 @ d/2 (zona sísmica básica)
  const d_est   = 9.5;
  const s_est   = Math.floor(d / 2);
  const n_est   = Math.ceil(L * 100 / s_est) + 1;
  const long_est = (2 * (b + h - 4 * r) / 100) + 0.30; // m por estribo
  const PESO_EST = 0.560; // #3

  // Longitudes con traslape ACI §25.5 (1.3 × ld mínimo, simplificado 60cm)
  const traslape = Math.max(0.60, 0.04 * fy / 100 * vLong.diam / 10);
  const long_barra = L + traslape;

  const kg_long = +(vLong.n * long_barra * vLong.peso).toFixed(2);
  const kg_est  = +(n_est * long_est * PESO_EST).toFixed(2);
  const kg_total= +(kg_long + kg_est).toFixed(2);

  const Vu = +(Wu * L / 2).toFixed(3);
  const phi_Vc = +(0.75 * 0.53 * Math.sqrt(fc) * b * d / 1000).toFixed(3);

  const vol_conc  = +((b / 100) * (h / 100) * L).toFixed(4);
  const area_enc  = +(2 * (h / 100) * L + (b / 100) * L).toFixed(3);

  const alertas = [];
  if (rho > rho_max) alertas.push('Cuantía supera ρ_max — aumentar peralte h.');
  if (Vu > phi_Vc * 2) alertas.push('Cortante elevado — revisar estribos o ampliar sección.');
  if (Rn > 0.85 * fc / 2) alertas.push('Sección posiblemente sobreesforzada.');

  return {
    elemento: 'viga',
    entrada: { b, h, L, r, WD, WL, fc, fy },
    cargas: { Wu: +Wu.toFixed(3), Mu: +Mu.toFixed(3), Vu },
    geometria: { d: +d.toFixed(2), rho: +rho_d.toFixed(5), rho_min: +rho_min.toFixed(5), rho_max: +rho_max.toFixed(5) },
    acero_long: { ...vLong, long_barra: +long_barra.toFixed(2), kg: kg_long },
    estribos: { diam: d_est, num: '#3', s_cm: s_est, cantidad: n_est, long_m: +long_est.toFixed(3), kg: kg_est },
    resumen_acero_kg: kg_total,
    concreto_m3: vol_conc,
    encofrado_m2: area_enc,
    alertas,
    ok: alertas.length === 0,
  };
}

// ─────────────────────────────────────────────
// COLUMNA RECTANGULAR — Compresión + cuantía
// ACI 318-19 §10
// ─────────────────────────────────────────────
function calcColumna({ a, b, H, r = 4, PD, PL, fc, fy, rho_pct = 2, d_est = 12.7 }) {
  const rho = rho_pct / 100;
  const Pu  = (1.2 * PD + 1.6 * PL) * 1000; // kg
  const Ag  = a * b;
  const phi = 0.65;

  const Pn_max = phi * 0.80 * (0.85 * fc * (Ag - Ag * rho) + fy * Ag * rho);
  const As = rho * Ag;
  const vLong = elegirVarilla(As);

  // Estribos: min(16·d_long, 48·d_est, menor_lado) — ACI §25.7.2
  const s1 = 16 * (vLong.diam / 10);
  const s2 = 48 * (d_est / 10);
  const s3 = Math.min(a, b);
  const s_est = Math.floor(Math.min(s1, s2, s3));
  const n_est = Math.ceil(H * 100 / s_est) + 1;

  const PESOS = { 9.5: 0.560, 12.7: 0.994 };
  const long_est = (2 * (a + b - 4 * r) / 100) + 0.30;

  const traslape = Math.max(0.30, 0.04 * fy / 100 * vLong.diam / 10);
  const long_barra = H + traslape;
  const kg_long = +(vLong.n * long_barra * vLong.peso).toFixed(2);
  const kg_est  = +(n_est * long_est * (PESOS[d_est] || 0.994)).toFixed(2);
  const kg_total= +(kg_long + kg_est).toFixed(2);

  const vol_conc  = +((a / 100) * (b / 100) * H).toFixed(4);
  const area_enc  = +(4 * ((a + b) / 200) * H).toFixed(3);

  const alertas = [];
  if (Pn_max < Pu) alertas.push(`φPn = ${(Pn_max/1000).toFixed(1)} t < Pu = ${(Pu/1000).toFixed(1)} t — aumentar sección o f'c.`);
  if (rho < 0.01) alertas.push('Cuantía < 1% — usar mínimo ρ = 1% (ACI §10.6.1).');
  if (rho > 0.08) alertas.push('Cuantía > 8% — no permitido por ACI §10.6.1.');

  return {
    elemento: 'columna',
    entrada: { a, b, H, r, PD, PL, fc, fy, rho_pct, d_est },
    cargas: { Pu: +(Pu / 1000).toFixed(2), Pn_max: +(Pn_max / 1000).toFixed(2) },
    geometria: { Ag, rho_real: +rho.toFixed(4), As: +As.toFixed(2) },
    acero_long: { ...vLong, long_barra: +long_barra.toFixed(2), kg: kg_long },
    estribos: { diam: d_est, s_cm: s_est, cantidad: n_est, long_m: +long_est.toFixed(3), kg: kg_est },
    resumen_acero_kg: kg_total,
    concreto_m3: vol_conc,
    encofrado_m2: area_enc,
    alertas,
    ok: alertas.length === 0,
  };
}

// ─────────────────────────────────────────────
// ZAPATA AISLADA CUADRADA — ACI 318-19 §13
// ─────────────────────────────────────────────
function calcZapata({ PD, PL, qa, Df = 1.2, ca, cb, fc, fy }) {
  const gamma_conc = 2.4; // ton/m³
  const P_serv = PD + PL;
  const q_neta = qa - gamma_conc * Df;
  const Area_req = P_serv / q_neta;
  const B = Math.ceil(Math.sqrt(Area_req) * 10) / 10; // redondear a 0.1 m
  const L = B;

  const Pu_kg = (1.2 * PD + 1.6 * PL) * 1000;
  const qu    = Pu_kg / (B * L); // kg/m²

  // Iterar peralte por punzonamiento (ACI §13.2.7)
  const phi_p = 0.75;
  let d_z = 25;
  for (let i = 0; i < 50; i++) {
    const bo = 2 * ((ca / 100 + d_z / 100) + (cb / 100 + d_z / 100)) * 100; // cm
    const Vp_perm = phi_p * 1.06 * Math.sqrt(fc) * bo * d_z; // kg
    const A_punch = B * L - (ca / 100 + d_z / 100) * (cb / 100 + d_z / 100);
    const Vp_act  = qu * A_punch; // kg
    if (Vp_perm >= Vp_act) break;
    d_z += 1;
  }
  const h_z = d_z + 8; // recubrimiento 7 + estribo ~1 cm (zapata sin estribo)

  // Flexión — voladizo crítico
  const voladizo = (B - ca / 100) / 2; // m
  const Mu_z = qu * voladizo * voladizo / 2; // kg·m por metro de ancho
  const phi_f = 0.90;
  const Rn = Mu_z * 100 / (phi_f * 100 * d_z * d_z);
  const rho_flex = (0.85 * fc / fy) * (1 - Math.sqrt(1 - 2 * Rn / (0.85 * fc)));
  const rho_min  = Math.max(0.0018, 14 / fy);
  const rho_d    = Math.max(rho_flex, rho_min);
  const As_m = rho_d * 100 * d_z; // cm²/m
  const As_total = As_m * B;

  const vLong = elegirVarilla(As_total);
  const sep = Math.floor(B * 100 / vLong.n); // cm entre barras
  const long_varilla = +(B - 0.14).toFixed(2);
  const kg_acero = +(vLong.n * 2 * long_varilla * vLong.peso).toFixed(2); // 2 dir

  const vol_conc = +(B * L * (h_z / 100)).toFixed(4);
  const area_enc = +(B * L).toFixed(3); // plantilla inferior

  // Verificar cortante como viga (ACI §13.2.6) — a 'd' de la cara
  const a_cv = voladizo - d_z / 100;
  const Vv_act  = +(qu * a_cv * B / 1000).toFixed(2); // ton
  const phi_Vc  = +(0.75 * 0.53 * Math.sqrt(fc) * (B * 100) * d_z / 1000).toFixed(2); // ton

  const alertas = [];
  if (Vv_act > phi_Vc) alertas.push(`Cortante como viga: Vu=${Vv_act}t > φVc=${phi_Vc}t — aumentar peralte.`);
  if (q_neta <= 0) alertas.push('Capacidad portante neta negativa — revisar Df o qa.');

  return {
    elemento: 'zapata',
    entrada: { PD, PL, qa, Df, ca, cb, fc, fy },
    dimensiones: { B, L, h_z, d_z },
    cargas: { P_serv, Pu: +(Pu_kg / 1000).toFixed(2), q_neta: +q_neta.toFixed(3), qu: +qu.toFixed(1), voladizo: +voladizo.toFixed(3), Mu_z: +Mu_z.toFixed(1) },
    acero: { ...vLong, sep_cm: sep, long_varilla, kg_total: kg_acero, As_req: +As_total.toFixed(2) },
    cortante: { Vv_act, phi_Vc },
    concreto_m3: vol_conc,
    encofrado_m2: area_enc,
    alertas,
    ok: alertas.length === 0,
  };
}

module.exports = { calcViga, calcColumna, calcZapata, elegirVarilla, VARILLAS };
