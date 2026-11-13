/* JCV · imágenes desde el celular.
   Copia en JavaScript de lo que dibuja el PC: estado de cuenta (jcv_img.py, formato A1), remisión amarilla
   (jcv_pdf.pdf_remision) y despacho (jcv_pdf.pdf_despacho). Los textos y cifras ya vienen calculados desde el PC,
   aquí solo se dibujan. */
"use strict";
const FUENTE = 'Helvetica, Arial, "Liberation Sans", sans-serif';
const _imgs = {};
function cargarImagen(src){
  if (!_imgs[src]) _imgs[src] = new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  return _imgs[src];
}

class Lienzo {
  /* coordenadas en puntos, y hacia abajo; S = píxeles por punto */
  constructor(anchoPt, altoPt, S){
    const MAX = 16e6;                                          // límite de área de canvas en iPhone
    if (anchoPt * altoPt * S * S > MAX) S = Math.sqrt(MAX / (anchoPt * altoPt)) * 0.98;
    this.S = S;
    this.c = document.createElement("canvas");
    this.c.width = Math.round(anchoPt * S); this.c.height = Math.round(altoPt * S);
    this.x = this.c.getContext("2d");
    this.x.fillStyle = "#FFFFFF"; this.x.fillRect(0, 0, this.c.width, this.c.height);
    this.x.textBaseline = "alphabetic";
  }
  p(v){ return v * this.S; }
  fuente(neg, pt){ return `${neg ? "bold " : ""}${Math.max(8, Math.round(pt * this.S))}px ${FUENTE}`; }
  rect(x0, y0, x1, y1, o = {}){
    const x = this.x, X = this.p(x0), Y = this.p(y0), W = this.p(x1 - x0), H = this.p(y1 - y0);
    x.beginPath();
    if (o.radio){
      const r = Math.min(this.p(o.radio), W / 2, H / 2);
      x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r);
      x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
    } else x.rect(X, Y, W, H);
    if (o.fill){ x.fillStyle = o.fill; x.fill(); }
    if (o.stroke){ x.strokeStyle = o.stroke; x.lineWidth = Math.max(1, this.p(o.ancho ?? 1)); x.stroke(); }
  }
  linea(x0, y0, x1, y1, color = "#000", ancho = 1){
    const x = this.x; x.beginPath(); x.moveTo(this.p(x0), this.p(y0)); x.lineTo(this.p(x1), this.p(y1));
    x.strokeStyle = color; x.lineWidth = Math.max(1, this.p(ancho)); x.stroke();
  }
  ancho(t, neg, pt){ this.x.font = this.fuente(neg, pt); return this.x.measureText(String(t)).width / this.S; }
  ajustar(t, neg, pt, maxw, minimo = 7){
    t = String(t);
    while (pt > minimo && this.ancho(t, neg, pt) > maxw) pt -= 0.25;
    while (this.ancho(t, neg, pt) > maxw && t.length > 4) t = t.slice(0, -2).replace(/[ ·]+$/, "") + "…";
    return [t, pt];
  }
  texto(x, y, t, pt = 9, neg = false, color = "#111111", alin = "l", maxw = null, minimo = 7){
    t = String(t ?? "");
    if (maxw) [t, pt] = this.ajustar(t, neg, pt, maxw, minimo);
    const w = this.ancho(t, neg, pt);
    if (alin === "r") x -= w; else if (alin === "c") x -= w / 2;
    this.x.font = this.fuente(neg, pt); this.x.fillStyle = color;
    this.x.fillText(t, this.p(x), this.p(y));
  }
  pildora(x, y, t, pt = 6.8, fondo = "#B3261E", color = "#FFFFFF"){
    const w = this.ancho(t, true, pt) + 8;
    this.rect(x, y - pt - 1.5, x + w, y + 3, {fill: fondo, radio: 3});
    this.texto(x + 4, y, t, pt, true, color);
    return w;
  }
  imagen(img, x, y, w, h){ if (img) this.x.drawImage(img, this.p(x), this.p(y), this.p(w), this.p(h)); }
  envolver(t, neg, pt, maxw){
    const lineas = [];
    for (const parrafo of String(t).split(/\n/)){
      let l = "";
      for (const p of parrafo.split(/\s+/).filter(Boolean)){
        const prueba = (l + " " + p).trim();
        if (this.ancho(prueba, neg, pt) > maxw && l){ lineas.push(l); l = p; } else l = prueba;
      }
      lineas.push(l);
    }
    return lineas;
  }
}

const COL = {NEG: "#111111", DOR: "#C9A24D", DOR_CL: "#F4ECD6", GR: "#6E6A62", GR_CL: "#F6F4EF", BOR: "#DCD6C8",
  VER: "#2E7D32", ROJ: "#B3261E", ROJ_CL: "#FBE7E5", NAR: "#C77700", SECC: "#ECE8DF", CREMA: "#FFF8E1",
  BLANCO: "#FFFFFF", GRIS_TXT: "#BDB7A8"};
const copJ = n => (n < 0 ? "-$ " : "$ ") + Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function ahoraTxt(){
  const d = new Date(), z = n => String(n).padStart(2, "0");
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

/* ================= ESTADO DE CUENTA (A1) ================= */
async function dibujarEstado(e, observacion, diasVenc){
  const ANCHO = 612, M = 36, S = 2.75;
  const obs = (observacion || "").trim();
  const filas = e.filas;
  const altoFila = Math.max(15, Math.min(20, 20 * 40 / Math.max(1, filas.length)));
  let linObs = [];
  if (obs){ const t = new Lienzo(10, 10, 1); linObs = t.envolver(obs, false, 9, ANCHO - 2 * M - 20).slice(0, 6); }
  const yTabla = 268, altoTabla = 2 + altoFila * (filas.length + 1);
  const alto = yTabla + altoTabla + 30 + 70 + (obs ? 26 + 12 * linObs.length : 0) + 56;
  const L = new Lienzo(ANCHO, alto, S);

  // encabezado negro con el logo
  L.rect(0, 0, ANCHO, 118, {fill: COL.NEG});
  L.imagen(await cargarImagen("logo_estado.png"), M - 4, 7, 104, 104);
  L.texto(ANCHO - M, 60, "ESTADO DE CUENTA", 24, true, COL.BLANCO, "r");
  L.texto(ANCHO - M, 77, e.sub || `Semana ${e.s} · del ${e.d} al ${e.h}`, 10.5, false, COL.DOR, "r");
  L.texto(ANCHO - M, 93, "Feria de ganados Medellín Of. 2DD · Cel 320 733 61 10", 8.5, false, COL.GRIS_TXT, "r");
  L.rect(0, 118, ANCHO, 121, {fill: COL.DOR});

  // cliente + saldo
  let y = 150;
  L.texto(M, y, "CLIENTE", 8, true, COL.GR);
  L.texto(M, y + 20, e.n, 17, true, COL.NEG, "l", ANCHO - 2 * M - 230, 10);
  let yy = y + 36;
  if (e.nit){ L.texto(M, yy, `CC/NIT ${e.nit}`, 9.5, false, COL.GR); yy += 13; }
  if (e.dir){ L.texto(M, yy, e.dir, 9.5, false, COL.GR, "l", ANCHO - 2 * M - 230); yy += 13; }
  L.texto(M, yy, `Fecha de corte: ${e.corte}`, 9.5, false, COL.GR);
  const bx = ANCHO - M - 210, bw = 210;
  L.rect(bx, y - 10, bx + bw, y + 74, {fill: COL.DOR_CL, stroke: COL.DOR, ancho: 1.5, radio: 6});
  L.texto(bx + 14, y + 8, e.saldo >= 0 ? "SALDO A PAGAR" : "SALDO A FAVOR DEL CLIENTE", 8.5, true, COL.GR);
  L.texto(bx + 14, y + 37, copJ(Math.abs(e.saldo)), 25, true, COL.NEG, "l", bw - 28, 14);
  if (e.ven > 0.5){
    L.pildora(bx + 14, y + 58, `VENCIDO ${copJ(e.ven)}`, 8.5);
    L.texto(bx + 14, y + 70, `Deudas con más de ${diasVenc} días sin pagar`, 7.5, false, COL.GR);
  } else L.texto(bx + 14, y + 60, "Sin deudas vencidas", 8.5, true, COL.VER);

  // tabla
  const cols = e.cols || [["FECHA", 58, "l"], ["SEMANA", 46, "c"], ["DOCUMENTO", 66, "l"], ["DESCRIPCIÓN", 178, "l"],
    ["CARGOS", 66, "r"], ["ABONOS", 62, "r"], ["SALDO", 64, "r"]];
  y = yTabla;
  L.rect(M, y - 14, ANCHO - M, y + 6, {fill: COL.NEG});
  let x = M;
  for (const [t, w, a] of cols){ L.texto(a === "r" ? x + w - 6 : a === "c" ? x + w / 2 : x + 6, y, t, 8, true, COL.BLANCO, a); x += w; }
  y += 2 + altoFila;
  let par = 0;
  for (const f of filas){
    if (f.sec){
      L.rect(M, y - altoFila + 6, ANCHO - M, y + 6, {fill: COL.SECC});
      L.texto(M + 6, y, f.sec, 7.8, true, COL.GR);
      if (f.secd) L.texto(ANCHO - M - 6, y, f.secd, 8, true, COL.GR, "r");
      y += altoFila; par = 0; continue;
    }
    if (f.ven) L.rect(M, y - altoFila + 6, ANCHO - M, y + 6, {fill: COL.ROJ_CL});
    else if (par % 2 === 0) L.rect(M, y - altoFila + 6, ANCHO - M, y + 6, {fill: COL.GR_CL});
    par++;
    const vals = [f.f, f.sem, f.doc, f.desc, f.c, f.a, f.s];
    x = M;
    cols.forEach(([t, w, a], j) => {
      const v = vals[j] || "";
      const color = (j === 5 && v) || (j === 2 && v === "Abono") ? COL.VER : COL.NEG;
      if (j === 1){ if (v) L.texto(x + w / 2, y, v, 8.3, true, f.ven ? COL.ROJ : COL.NEG, "c", w - 6, 6.8); }
      else if (j === 3 && f.ven){
        const et = `VENCIDA · ${f.dias} días`, pw = L.ancho(et, true, 6.8) + 8;
        L.texto(x + 6, y, v, 8.5, false, COL.NEG, "l", w - pw - 16, 7.6);
        L.pildora(x + w - pw - 4, y, et);
      } else L.texto(a === "r" ? x + w - 6 : x + 6, y, v, 8.5, j === 6, color, a, w - 10, 7.2);
      x += w;
    });
    y += altoFila;
  }
  y -= 8;
  L.linea(M, y, ANCHO - M, y, COL.DOR, 1.2);
  L.texto(M + 6, y + 16, e.tot || (e.saldo >= 0 ? "SALDO A PAGAR" : "SALDO A FAVOR"), 10, true);
  L.texto(ANCHO - M - 6, y + 16, copJ(Math.abs(e.saldo)), 10, true, COL.NEG, "r");
  y += 46;

  // antigüedad
  L.texto(M, y, "ANTIGÜEDAD DEL SALDO", 9, true);
  L.texto(M + 128, y, `(vencida: más de ${diasVenc} días sin pagar · los abonos pagan primero lo más antiguo)`, 7.5, false, COL.GR);
  y += 8;
  const gap = 10, aw = (ANCHO - 2 * M - 3 * gap) / 4;
  e.antig.forEach(([k, v], i) => {
    const xx = M + i * (aw + gap), col = i === 0 ? COL.VER : i === 1 ? COL.NAR : COL.ROJ;
    L.rect(xx, y, xx + aw, y + 38, {fill: COL.BLANCO, stroke: COL.BOR, ancho: 0.8, radio: 4});
    L.rect(xx, y, xx + 3, y + 38, {fill: col});
    L.texto(xx + 10, y + 12, k, 7.2, true, COL.GR, "l", aw - 14);
    L.texto(xx + 10, y + 29, copJ(v), 11, true, v > 0.5 ? COL.NEG : COL.GR);
  });
  y += 52;

  if (obs){
    const h = 20 + 12 * linObs.length;
    L.rect(M, y, ANCHO - M, y + h, {fill: COL.CREMA, stroke: COL.DOR, ancho: 1, radio: 4});
    L.texto(M + 10, y + 13, "OBSERVACIÓN / ACUERDO", 8.5, true);
    linObs.forEach((ln, i) => L.texto(M + 10, y + 26 + 12 * i, ln, 9));
  }

  y = alto - 26;
  L.linea(M, y - 12, ANCHO - M, y - 12, COL.BOR, 0.6);
  L.texto(M, y, "JCV · Comercialización de cerdo y ganado · Cel 320 733 61 10", 7.5, false, COL.GR);
  L.texto(ANCHO - M, y, `Generado ${ahoraTxt()}`, 7.5, false, COL.GR, "r");
  return L.c;
}

/* ================= REMISIÓN AMARILLA ================= */
async function dibujarRemision(r){
  // misma plantilla del PDF: "px" medidos de la hoja (x 60..840, y 0..575) escalados a carta horizontal
  const AP = 792, HP = 612, X0 = 60, X1 = 840, Y1 = 575;
  const s = Math.min((AP - 36) / (X1 - X0), (HP - 30) / Y1);
  const ox = (AP - (X1 - X0) * s) / 2 - X0 * s, top = 15;
  const L = new Lienzo(AP, HP, 2.75);
  const X = v => ox + v * s, Yp = v => top + v * s;
  const AMA = "#FFFF66", GRIS = "#DBDBDB", ROJO = "#C00000", OSC = "#262626";
  const rect = (x0, y0, x1, y1, fill, borde = true, g = 0.8) =>
    L.rect(X(x0), Yp(y0), X(x1), Yp(y1), {fill, stroke: borde ? "#000" : null, ancho: g * s});
  const linea = (x0, y0, x1, y1, g = 0.8) => L.linea(X(x0), Yp(y0), X(x1), Yp(y1), "#000", g * s);
  const texto = (x, y, t, tam = 9, neg = false, color = "#000", alin = "c") => L.texto(X(x), Yp(y), t, tam * s, neg, color, alin);
  const ajust = (x0, x1, y, t, tam, neg = false, alin = "c") => {
    t = String(t ?? "");
    while (tam > 5 && L.ancho(t, neg, tam * s) > (x1 - x0 - 6) * s) tam -= 0.5;
    texto(alin === "c" ? (x0 + x1) / 2 : x0 + 4, y, t, tam, neg, "#000", alin);
  };

  rect(X0, 0, X1, Y1, AMA, false);
  const logo = await cargarImagen("logo_remision.png");
  if (logo) L.imagen(logo, X(90), Yp(106) - 108 * s, 108 * s, 108 * s); else texto(145, 70, "JCV", 40, true);
  [[17, "Venta de cerdos en canal y astilla", 10], [37, "Producción / Venta", 10], [54, "Cel: 320 733 61 10", 10],
   [73, "Feria de ganados Medellín Of. 2DD", 10], [92, "¡CERDOS DE LA MEJOR CALIDAD!", 10.5]]
    .forEach(([y, t, tam]) => texto(330, y, t, tam, true));
  texto(711, 19, "REMISIÓN", 11, true);
  rect(594, 25, 675, 62, GRIS); rect(675, 25, 827, 62, GRIS);
  texto(634, 49, "N°.", 13, true, ROJO);
  ajust(675, 827, 51, r.num, 19, true);
  rect(594, 81, 827, 99, GRIS);
  texto(711, 95, r.fl, 11.5, true, ROJO);

  rect(70, 118, 827, 559, AMA);
  texto(146, 150, "Nombre:", 9.5, true, "#000", "r"); rect(149, 136, 332, 155); ajust(149, 332, 150, r.cli, 9.5, true, "l");
  texto(392, 150, "CC o NIT:", 9.5, true, "#000", "r"); rect(395, 136, 675, 155); ajust(395, 675, 150, r.nit, 9.5, false, "l");
  texto(146, 187, "DIR. Y TEL:", 9.5, true, "#000", "r"); rect(149, 173, 332, 191); ajust(149, 332, 187, r.dir, 9, false, "l");

  rect(70, 210, 827, 229, OSC);
  [[70, 240, "DESCRIPCIÓN"], [240, 331, "NÚMERO"], [331, 394, "CANT"], [394, 497, "PESO (Kg)"],
   [497, 594, "CANT TOTAL"], [594, 675, "Vr UNITARIO"], [675, 827, "VALOR TOTAL"]]
    .forEach(([a, b, t]) => texto((a + b) / 2, 223, t, 9, true, "#FFFFFF"));

  const n = Math.max(14, r.lin.length), yi = 229, yf = 486, h = (yf - yi) / n;
  const tam = Math.min(9.5, Math.max(5.5, h * 0.55));
  for (let i = 0; i <= n; i++) linea(70, yi + i * h, 497, yi + i * h, 0.6);
  for (const xx of [240, 331, 394, 497]) linea(xx, yi, xx, yf, 0.6);
  r.lin.forEach(([desc, num, cant, peso], i) => {
    const yb = yi + (i + 1) * h - h * 0.28;
    ajust(70, 240, yb, desc, tam, false, "l");
    texto(285.5, yb, num, tam); texto(362.5, yb, cant, tam); texto(445.5, yb, peso, tam);
  });

  for (const [a, b] of [[497, 594], [594, 675], [675, 827]]) rect(a, 229, b, 246);
  texto(545.5, 242, r.cant, 10, true);
  ajust(594, 675, 242, r.vru, 10, true);
  texto(680, 242, "COP", 9.5, false, "#000", "l");
  texto(822, 242, r.valor, 9.5, true, "#000", "r");
  let yo = 246;
  if (r.sac){                                   // ganado: renglón del costo de sacrificio
    for (const [a, b] of [[497, 594], [594, 675], [675, 827]]) rect(a, 246, b, 263);
    texto(545.5, 259, r.sac[0], 9, true); ajust(594, 675, 259, r.sac[1], 9, true);
    texto(680, 259, "COP", 9.5, false, "#000", "l"); texto(822, 259, r.sac[2], 9.5, true, "#000", "r");
    yo = 263;
  }
  rect(497, yo, 827, yo + 19, OSC);
  texto(662, yo + 13, "OBSERVACIONES", 9, true, "#FFFFFF");
  let yy = yo + 34;
  for (const tr of L.envolver(r.obs || "", false, 9 * s, (827 - 503 - 6) * s)){
    if (yy > 440 || !tr) break;
    texto(503, yy, tr, 9, false, "#000", "l"); yy += 13;
  }
  linea(497, 229, 497, 486, 0.8);
  rect(497, 449, 594, 467, OSC);
  texto(545.5, 462, "PESO TOTAL (Kg)", 8.5, true, "#FFFFFF");
  rect(497, 467, 594, 486, AMA);
  texto(545.5, 481, r.peso, 10, true);

  linea(70, 486, 827, 486, 0.8);
  linea(149, 522, 497, 522, 0.6);
  linea(286, 504, 286, 541, 0.6);
  if (r.enc) texto(218, 516, r.enc, 9.5, true);
  texto(218, 537, "Despachado por. CC o NIT", 8.5);
  texto(392, 537, "Recibido por. CC o NIT", 8.5);
  rect(594, 486, 675, 559, GRIS);
  texto(634.5, 527, "TOTAL", 10.5, true);
  rect(675, 486, 827, 559, AMA);
  texto(681, 527, "COP", 10.5, false, "#000", "l");
  texto(821, 527, r.total || r.valor, 12, true, "#000", "r");
  return L.c;
}

/* ================= DESPACHO (formato Cúcuta, en una sola imagen) ================= */
async function dibujarDespacho(d){
  const Xc = [8.8, 91.8, 155.2, 335.2, 454.8], XS = 276.8, PASO = 13.44, TOP = 11.5;
  const COLORES = ["#DDEBF7", "#FCE4D6", "#E2F0D9", "#E4DFEC", "#EDEDED", "#D9E1F2", "#FBE5F0", "#E7F3F3"];
  const GRIS = "#D9D9D9", CREMA = "#FFF2CC";
  const nCerdos = d.lotes.reduce((a, l) => a + l.cer.length, 0);
  const nFilas = nCerdos + 1 + d.lotes.length + 3;
  const yHdr = 159.25, alto = yHdr + nFilas * PASO + 14, ancho = 464;
  const L = new Lienzo(ancho, alto, 2.75);
  const caja = (x0, y0, x1, y1, fondo) => L.rect(x0, y0, x1, y1, {fill: fondo || null, stroke: "#000", ancho: 0.6});
  const texto = (x0, x1, y0, y1, t, neg = false, tam = 10) => {
    t = String(t); while (tam > 6 && L.ancho(t, neg, tam) > (x1 - x0) - 3) tam -= 0.5;
    L.texto((x0 + x1) / 2, (y0 + y1) / 2 + tam * 0.35, t, tam, neg, "#000", "c");
  };
  const yMid = 92.25, yBot = 132.5;
  caja(Xc[0], TOP, Xc[2], yBot, "#000000");
  const lado = (yBot - TOP) - 2;
  L.imagen(await cargarImagen("logo_estado.png"), (Xc[0] + Xc[2]) / 2 - lado / 2, TOP + 1, lado, lado);
  caja(Xc[2], TOP, XS, yMid); caja(XS, TOP, Xc[4], yMid); caja(Xc[2], yMid, XS, yBot); caja(XS, yMid, Xc[4], yBot);
  texto(Xc[2], XS, TOP, yMid, "PROCEDENCIA"); texto(XS, Xc[4], TOP, yMid, d.proc, true, 18);
  texto(Xc[2], XS, yMid, yBot, "FECHA"); texto(XS, Xc[4], yMid, yBot, d.fecha, true, 13.5);
  ["MARCA", "NÚMERO", "PESO CANAL CALIENTE", "PESO CANAL FRÍA"].forEach((t, i) => { caja(Xc[i], yBot, Xc[i + 1], yHdr, GRIS); texto(Xc[i], Xc[i + 1], yBot, yHdr, t, true); });
  let y = yHdr;
  d.lotes.forEach((l, i) => {
    const col = COLORES[i % COLORES.length], y0 = y;
    for (const [num, cal, fr] of l.cer){
      [[1, num], [2, cal], [3, fr]].forEach(([k, t]) => { caja(Xc[k], y, Xc[k + 1], y + PASO, col); texto(Xc[k], Xc[k + 1], y, y + PASO, t); });
      y += PASO;
    }
    caja(Xc[0], y0, Xc[1], y, col);
    const yc = y0 + (y - y0) / 2;
    texto(Xc[0], Xc[1], yc - PASO / 2, yc + PASO / 2, l.m, true, 18);
  });
  caja(Xc[0], y, Xc[4], y + PASO, GRIS); texto(Xc[0], Xc[4], y, y + PASO, "SUBTOTAL", true); y += PASO;
  d.lotes.forEach((l, i) => {
    const col = COLORES[i % COLORES.length];
    caja(Xc[0], y, Xc[2], y + PASO, col); texto(Xc[0], Xc[2], y, y + PASO, l.m, true);
    caja(Xc[2], y, Xc[3], y + PASO, col); texto(Xc[2], Xc[3], y, y + PASO, l.cal, true);
    caja(Xc[3], y, Xc[4], y + PASO, col); texto(Xc[3], Xc[4], y, y + PASO, l.fr, true);
    y += PASO;
  });
  caja(Xc[0], y, Xc[2], y + PASO, GRIS); texto(Xc[0], Xc[2], y, y + PASO, "TOTAL GENERAL", true);
  caja(Xc[2], y, Xc[3], y + PASO, GRIS); texto(Xc[2], Xc[3], y, y + PASO, d.cal, true);
  caja(Xc[3], y, Xc[4], y + PASO, GRIS); texto(Xc[3], Xc[4], y, y + PASO, d.fr, true); y += PASO;
  caja(Xc[0], y, Xc[3], y + PASO); texto(Xc[0], Xc[3], y, y + PASO, "MERMA POR ANIMAL (kg)", true);
  caja(Xc[3], y, Xc[4], y + PASO, CREMA); texto(Xc[3], Xc[4], y, y + PASO, d.merma, true); y += PASO;
  caja(Xc[0], y, Xc[3], y + PASO); texto(Xc[0], Xc[3], y, y + PASO, "CANTIDAD TOTAL DE CERDOS", true);
  caja(Xc[3], y, Xc[4], y + PASO); texto(Xc[3], Xc[4], y, y + PASO, String(d.cant), true);
  return L.c;
}

/* ================= HOJA DEL LOTE (igual a la hoja del Excel / PDF del PC) ================= */
async function dibujarLote(L, umbrales){
  const AP = 612, HP = 792, M = 22, S = 2.75;
  const w = [62, 66, 94, 80, 66, 132, 68], X = [M];
  for (const a of w) X.push(X[X.length - 1] + a);
  const alto = L.cerdos.length <= 40 ? 10.2 : Math.max(6.5, Math.min(9.0, (HP - 2 * M - 80) / (L.cerdos.length + 3)));
  const tam = alto >= 9 ? 8.2 : 7;
  const Lz = new Lienzo(AP, HP, S);
  const VERDE = "#00FF00", NAR = "#FFC000", ROJO = "#FF0000", SALMON = "#F4B084", GRIS = "#D9D9D9", ALERTA = "#FF0000";
  const [umbPos, umbNeg] = umbrales || [5, -2];
  const celda = (i, y, txt, o = {}) => {
    const x0 = X[i], x1 = X[(o.hasta ?? i) + 1];
    if (o.fondo) Lz.rect(x0, y, x1, y + alto, {fill: o.fondo});
    if (o.borde !== false) Lz.rect(x0, y, x1, y + alto, {stroke: "#000", ancho: 0.5});
    if (txt !== "" && txt != null){
      const f = o.cursiva ? "italic bold " : (o.neg ? "bold " : "");
      let t = String(txt), pt = tam;
      do { Lz.x.font = `${f}${Math.round(pt * Lz.S)}px ${FUENTE}`; pt -= 0.25; }
      while (Lz.x.measureText(t).width / Lz.S > (x1 - x0) - 3 && pt > 6);
      Lz.x.fillStyle = o.color || "#000";
      while (Lz.x.measureText(t).width / Lz.S > (x1 - x0) - 3 && t.length > 3) t = t.slice(0, -2) + "…";
      const ancho = Lz.x.measureText(t).width / Lz.S;
      const xx = o.izq ? x0 + 3 : (x0 + x1) / 2 - ancho / 2;
      Lz.x.fillText(t, Lz.p(xx), Lz.p(y + alto - (alto - pt * 0.72) / 2));
    }
  };
  const k1 = v => v == null ? "" : (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
  let y = M;
  ["Numero", "Marca", "PESO CANAL FRIA", "PESO ENTREGA", "DIFERENCIA", "CLIENTE", "ENCARGADO"]
    .forEach((t, i) => celda(i, y, t, {fondo: GRIS, cursiva: true}));
  y += alto + 1;
  let tf = 0, te = 0;
  for (const c of L.cerdos){
    tf += c.fr; if (c.en != null) te += c.en;
    const dif = c.fr - (c.en || 0);
    const raro = c.en != null && (dif > umbPos || dif < umbNeg);
    const cli = (c.cli || "") + (c.tv === "ASTILLA" ? " (astilla)" : "");
    celda(0, y, c.n, {fondo: VERDE}); celda(1, y, L.m, {fondo: VERDE});
    [k1(c.fr), c.en != null ? k1(c.en) : "", k1(dif), cli, c.enc || ""].forEach((t, j) =>
      celda(j + 2, y, t, {fondo: raro ? ALERTA : null}));
    y += alto;
  }
  // TOTALES y PROMEDIO MERMA MATADERO
    celda(1, y, "TOTALES", {fondo: NAR, neg: true}); celda(2, y, k1(tf), {fondo: NAR, neg: true});
  celda(3, y, k1(te), {fondo: NAR, neg: true}); celda(4, y, k1(tf - te), {fondo: NAR, neg: true});
  y += alto;
  celda(1, y, "PROMEDIO MERMA MATADERO", {fondo: ROJO, neg: true, color: "#FFFFFF", hasta: 3});
  celda(4, y, k1(L.merma), {fondo: VERDE, neg: true});
  y += alto * 3.2;
  // SE SACRIFICA / SE ENTREGA / NOTA
  const fechas = [...new Set(L.cerdos.map(c => c.fe).filter(Boolean))].sort();
  const ff = s => s ? `${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}` : "";
  const entrega = !fechas.length ? "" : fechas.length === 1 ? ff(fechas[0]) : `${ff(fechas[0])} al ${ff(fechas[fechas.length - 1])}`;
  const pend = L.cerdos.filter(c => c.en == null).length;
  const nota = L.nota || (pend ? `${pend} cerdo${pend !== 1 ? "s" : ""} pendiente${pend !== 1 ? "s" : ""}` : "");
  celda(0, y, "SE SACRIFICA", {fondo: VERDE, cursiva: true}); celda(1, y, ff(L.f), {hasta: 4, izq: true}); y += alto + 1;
  celda(0, y, "SE ENTREGA", {fondo: VERDE, cursiva: true}); celda(1, y, entrega, {hasta: 4, izq: true}); y += alto + 1;
  celda(0, y, "NOTA", {fondo: SALMON, cursiva: true}); celda(1, y, nota, {hasta: 4, izq: true});
  return Lz.c;
}

/* Canvas -> PDF de una página (imagen JPEG a página completa, tamaño carta) */
async function canvasAPdf(canvas, anchoPt = 612, altoPt = 792){
  const blob = await new Promise(ok => canvas.toBlob(ok, "image/jpeg", 0.93));
  const jpg = new Uint8Array(await blob.arrayBuffer());
  const enc = new TextEncoder(), partes = [], offs = [];
  let largo = 0;
  const add = d => { const b = typeof d === "string" ? enc.encode(d) : d; partes.push(b); largo += b.length; };
  const obj = (n, cuerpo, stream) => {
    offs[n] = largo;
    add(`${n} 0 obj\n${cuerpo}\n`);
    if (stream){ add("stream\n"); add(stream); add("\nendstream\n"); }
    add("endobj\n");
  };
  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const cont = `q ${anchoPt} 0 0 ${altoPt} 0 0 cm /Im0 Do Q`;
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${anchoPt} ${altoPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>`, jpg);
  obj(5, `<< /Length ${cont.length} >>`, enc.encode(cont));
  const xref = largo;
  let x = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i <= 5; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
  add(x + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes, {type: "application/pdf"});
}
