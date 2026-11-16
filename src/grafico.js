// Gráfico da anestesia em <canvas>: PA (∨ sistólica / ∧ diastólica), FC (●), SpO2 (faixa inferior),
// marcadores de drogas, fluidos e eventos no eixo do tempo. Usado na tela (tema escuro/claro) e no PDF.
import { minutos } from './ficha.js';

const TEMAS = {
  escuro: { fundo: '#0b0f14', grade: '#1f2a36', gradeForte: '#33475c', texto: '#e6edf3', sub: '#9fb0c0', pas: '#ff6b6b', pad: '#ff6b6b', fc: '#4dabf7', spo2: '#51cf66', etco2: '#ffd43b', droga: '#f783ac', fluido: '#74c0fc', evento: '#ffa94d', faixa: 'rgba(255,255,255,0.04)' },
  claro: { fundo: '#ffffff', grade: '#e3e8ee', gradeForte: '#b8c2cc', texto: '#111111', sub: '#444b55', pas: '#c92a2a', pad: '#c92a2a', fc: '#1864ab', spo2: '#2b8a3e', etco2: '#a07c00', droga: '#a61e4d', fluido: '#1971c2', evento: '#d9480f', faixa: 'rgba(0,0,0,0.035)' },
};

export function intervaloTempo(f) {
  const ts = [];
  for (const c of ['drogas', 'sinaisVitais', 'fluidos', 'diurese', 'perdaSanguinea', 'eventos']) for (const x of f[c]) if (x.horario) ts.push(minutos(x.horario));
  for (const v of Object.values(f.horarios)) if (v) ts.push(minutos(v));
  if (!ts.length) { const n = Math.floor(Date.now() / 60000); return [n - 15, n + 45]; }
  let ini = Math.floor(Math.min(...ts) / 15) * 15; let fim = Math.ceil((Math.max(...ts) + 1) / 15) * 15;
  if (fim - ini < 60) fim = ini + 60;
  return [ini, fim];
}

const hhmm = (m) => { const d = new Date(m * 60000); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const fmt = (n) => String(n).replace('.', ',');

/**
 * Desenha o gráfico. opcoes: { tema, largura, altura, escala, pxPorMin }
 * Se largura não for informada, usa pxPorMin (mín. 4 px/min) para permitir rolagem horizontal no celular.
 */
export function desenharGrafico(canvas, f, opcoes = {}) {
  const tema = TEMAS[opcoes.tema || 'escuro'];
  const [t0, t1] = intervaloTempo(f);
  const span = t1 - t0;
  const margemE = 46; const margemD = 14;
  const largura = opcoes.largura || Math.max(opcoes.larguraMin || 320, margemE + margemD + span * (opcoes.pxPorMin || 6));
  const altura = opcoes.altura || 420;
  const escala = opcoes.escala || (globalThis.devicePixelRatio || 1);
  canvas.width = Math.round(largura * escala); canvas.height = Math.round(altura * escala);
  if (canvas.style) { canvas.style.width = largura + 'px'; canvas.style.height = altura + 'px'; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.fillStyle = tema.fundo; ctx.fillRect(0, 0, largura, altura);
  const fonte = (px, peso = '') => `${peso} ${px}px system-ui, -apple-system, Roboto, Arial, sans-serif`.trim();

  // ---- faixas verticais
  const drogas = [...f.drogas].sort((a, b) => a.horario.localeCompare(b.horario));
  const marcas = [
    ...drogas.map((d) => ({ t: minutos(d.horario), txt: `${d.nome} ${d.dose != null ? fmt(d.dose) : '?'}${d.unidade || ''}`, cor: tema.droga })),
    ...f.fluidos.map((x) => ({ t: minutos(x.horario), txt: `${x.tipo.split(' ')[0]} ${x.volumeMl != null ? x.volumeMl + 'mL' : (x.unidades || '') + 'U'}`, cor: tema.fluido })),
  ].sort((a, b) => a.t - b.t);
  const x = (t) => margemE + ((t - t0) / span) * (largura - margemE - margemD);
  // empilha rótulos para não sobrepor
  ctx.font = fonte(11);
  const linhasFim = []; for (const m of marcas) {
    const w = ctx.measureText(m.txt).width + 8; const xi = x(m.t);
    let l = linhasFim.findIndex((fim) => fim < xi); if (l < 0) { l = linhasFim.length; linhasFim.push(0); }
    linhasFim[l] = xi + w; m.linha = l;
  }
  const nLinhas = Math.min(Math.max(linhasFim.length, 1), opcoes.maxLinhasDrogas || 8);
  const hLinha = 15; const topoDrogas = 18; const hDrogas = nLinhas * hLinha + 6;
  const topoEventos = topoDrogas + hDrogas; const hEventos = 18;
  const topoPlot = topoEventos + hEventos + 6; const hSpo2 = 60; const baseEixo = 20;
  const basePlot = altura - baseEixo - hSpo2 - 12; const topoSpo2 = basePlot + 10; const baseSpo2 = topoSpo2 + hSpo2;
  const yV = (v) => basePlot - (v / 220) * (basePlot - topoPlot);
  const yS = (v) => baseSpo2 - ((Math.max(80, Math.min(100, v)) - 80) / 20) * hSpo2;

  // título faixas
  ctx.fillStyle = tema.sub; ctx.font = fonte(10, 'bold'); ctx.textBaseline = 'middle';
  ctx.fillText('DROGAS / FLUIDOS', 4, 9);

  // grade de tempo
  for (let t = t0; t <= t1; t += 5) {
    const forte = t % 15 === 0;
    ctx.strokeStyle = forte ? tema.gradeForte : tema.grade; ctx.lineWidth = forte ? 1 : 0.6;
    ctx.beginPath(); ctx.moveTo(x(t), topoDrogas); ctx.lineTo(x(t), baseSpo2); ctx.stroke();
    if (forte) { ctx.fillStyle = tema.texto; ctx.font = fonte(11); ctx.textAlign = 'center'; ctx.fillText(hhmm(t), x(t), altura - baseEixo / 2); }
  }
  ctx.textAlign = 'left';
  // faixa de drogas
  ctx.fillStyle = tema.faixa; ctx.fillRect(margemE, topoDrogas, largura - margemE - margemD, hDrogas);
  for (const m of marcas) {
    if (m.linha >= nLinhas) continue;
    const xi = x(m.t); const yi = topoDrogas + 4 + m.linha * hLinha + hLinha / 2;
    ctx.fillStyle = m.cor; ctx.beginPath(); ctx.moveTo(xi, yi - 5); ctx.lineTo(xi + 4, yi); ctx.lineTo(xi, yi + 5); ctx.lineTo(xi - 4, yi); ctx.closePath(); ctx.fill();
    ctx.font = fonte(11); ctx.fillStyle = tema.texto; ctx.fillText(m.txt, xi + 6, yi);
    ctx.strokeStyle = m.cor; ctx.globalAlpha = 0.35; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(xi, yi + 5); ctx.lineTo(xi, basePlot); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  if (linhasFim.length > nLinhas) { ctx.fillStyle = tema.sub; ctx.font = fonte(10); ctx.fillText(`+${marcas.filter((m) => m.linha >= nLinhas).length} na tabela`, 4, topoDrogas + hDrogas - 6); }

  // eventos e horários-chave
  ctx.fillStyle = tema.sub; ctx.font = fonte(10, 'bold'); ctx.fillText('EVENTOS', 4, topoEventos + hEventos / 2);
  const chaves = [['inicioAnestesia', 'Iní.Anest'], ['inicioCirurgia', 'Iní.Cir'], ['fimCirurgia', 'Fim Cir'], ['fimAnestesia', 'Fim Anest']];
  const evs = [...f.eventos.map((e) => ({ t: minutos(e.horario), txt: abrevEvento(e.descricao) })), ...chaves.filter(([k]) => f.horarios[k]).map(([k, s]) => ({ t: minutos(f.horarios[k]), txt: s, forte: true }))].sort((a, b) => a.t - b.t);
  let ultimoX = -99;
  for (const e of evs) {
    const xi = x(e.t);
    ctx.fillStyle = tema.evento; ctx.font = fonte(10, 'bold');
    const w = ctx.measureText(e.txt).width;
    const xt = Math.max(xi - w / 2, ultimoX + 2);
    ctx.fillText(e.txt, xt, topoEventos + hEventos / 2); ultimoX = xt + w;
    if (e.forte) { ctx.strokeStyle = tema.evento; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xi, topoEventos + hEventos); ctx.lineTo(xi, baseSpo2); ctx.stroke(); }
  }

  // eixo y (0-220)
  for (let v = 0; v <= 220; v += 20) {
    const y = yV(v); ctx.strokeStyle = v % 40 === 0 ? tema.gradeForte : tema.grade; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(margemE, y); ctx.lineTo(largura - margemD, y); ctx.stroke();
    if (v % 40 === 0) { ctx.fillStyle = tema.sub; ctx.font = fonte(10); ctx.textAlign = 'right'; ctx.fillText(String(v), margemE - 4, y); ctx.textAlign = 'left'; }
  }
  // SpO2 faixa
  ctx.fillStyle = tema.faixa; ctx.fillRect(margemE, topoSpo2, largura - margemE - margemD, hSpo2);
  ctx.fillStyle = tema.spo2; ctx.font = fonte(10, 'bold'); ctx.fillText('SpO2', 4, topoSpo2 + 8);
  ctx.fillStyle = tema.sub; ctx.font = fonte(10); ctx.textAlign = 'right';
  for (const v of [100, 90, 80]) { ctx.fillText(String(v), margemE - 4, yS(v)); ctx.strokeStyle = tema.grade; ctx.beginPath(); ctx.moveTo(margemE, yS(v)); ctx.lineTo(largura - margemD, yS(v)); ctx.stroke(); }
  ctx.textAlign = 'left';

  const sv = [...f.sinaisVitais].sort((a, b) => a.horario.localeCompare(b.horario));
  // FC linha + pontos
  const linha = (campo, cor, yfn) => {
    const pts = sv.filter((s) => s[campo] != null).map((s) => [x(minutos(s.horario)), yfn(s[campo])]);
    if (!pts.length) return pts;
    ctx.strokeStyle = cor; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6; ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.stroke(); ctx.globalAlpha = 1;
    return pts;
  };
  for (const [a, b] of linha('fc', tema.fc, yV)) { ctx.fillStyle = tema.fc; ctx.beginPath(); ctx.arc(a, b, 4, 0, Math.PI * 2); ctx.fill(); }
  if (opcoes.etco2 !== false) for (const s of sv.filter((s) => s.etco2 != null)) { const a = x(minutos(s.horario)); const b = yV(s.etco2); ctx.fillStyle = tema.etco2; ctx.font = fonte(11, 'bold'); ctx.textAlign = 'center'; ctx.fillText('E', a, b); ctx.textAlign = 'left'; }
  // PA: ∨ sistólica, ∧ diastólica, ligadas por linha vertical
  for (const s of sv) {
    const a = x(minutos(s.horario));
    ctx.strokeStyle = tema.pas; ctx.lineWidth = 2;
    if (s.paSistolica != null && s.paDiastolica != null) { ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.moveTo(a, yV(s.paSistolica)); ctx.lineTo(a, yV(s.paDiastolica)); ctx.stroke(); ctx.globalAlpha = 1; }
    if (s.paSistolica != null) { const b = yV(s.paSistolica); ctx.beginPath(); ctx.moveTo(a - 5, b - 7); ctx.lineTo(a, b); ctx.lineTo(a + 5, b - 7); ctx.stroke(); }
    if (s.paDiastolica != null) { const b = yV(s.paDiastolica); ctx.beginPath(); ctx.moveTo(a - 5, b + 7); ctx.lineTo(a, b); ctx.lineTo(a + 5, b + 7); ctx.stroke(); }
  }
  // SpO2
  for (const [a, b] of linha('spo2', tema.spo2, yS)) { ctx.fillStyle = tema.spo2; ctx.fillRect(a - 3, b - 3, 6, 6); }
  for (const s of sv.filter((s) => s.spo2 != null)) { ctx.fillStyle = tema.texto; ctx.font = fonte(9); ctx.textAlign = 'center'; ctx.fillText(String(s.spo2), x(minutos(s.horario)), yS(s.spo2) - 9 < topoSpo2 ? yS(s.spo2) + 10 : yS(s.spo2) - 9); ctx.textAlign = 'left'; }

  // legenda
  ctx.font = fonte(10); let lx = margemE + 4; const ly = topoPlot + 8;
  const leg = [[tema.pas, '∨∧ PA'], [tema.fc, '● FC'], [tema.etco2, 'E EtCO2'], [tema.droga, '◆ droga'], [tema.fluido, '◆ fluido']];
  for (const [c, t] of leg) { ctx.fillStyle = c; ctx.fillText(t, lx, ly); lx += ctx.measureText(t).width + 12; }
  if (!sv.length && !marcas.length) { ctx.fillStyle = tema.sub; ctx.font = fonte(14); ctx.textAlign = 'center'; ctx.fillText('Sem registros ainda — fale ou digite: "PA 120 por 80, FC 72, saturação 98"', largura / 2, (topoPlot + basePlot) / 2); ctx.textAlign = 'left'; }
  return { largura, altura, t0, t1 };
}

function abrevEvento(d) {
  const m = { 'Intubação orotraqueal': 'IOT', 'Extubação': 'Extub.', 'Entrada em sala': 'Sala', 'Indução': 'Ind.', 'Máscara laríngea': 'ML', 'Punção raquidiana': 'Raqui', 'Posicionamento': 'Pos.', 'Saída de sala (RPA)': 'RPA' };
  return m[d] || d.slice(0, 8);
}
