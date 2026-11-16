// Geração do PDF (A4) da ficha de anestesia no próprio navegador, com jsPDF (vendor/jspdf.umd.min.js).
import { desenharGrafico } from './grafico.js';
import { formatarIC, icAlto } from './parser.js';
import { horaDeISO, totais, duracaoMin, idade, pendencias } from './ficha.js';

const fmt = (n) => (n == null || n === '' ? '—' : String(n).replace('.', ','));
const dataBR = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const val = (v) => (v == null || v === '' ? '—' : String(v));

export function gerarPdf(f, { jsPDF, criarCanvas } = {}) {
  jsPDF = jsPDF || (globalThis.jspdf && globalThis.jspdf.jsPDF);
  if (!jsPDF) throw new Error('jsPDF não carregado');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const W = 210; const H = 297; const M = 12; const CW = W - 2 * M;
  let y = M;
  const novaPagina = () => { doc.addPage(); y = M; };
  const garantir = (h) => { if (y + h > H - 16) novaPagina(); };
  const p = f.paciente; const pr = f.procedimento; const h = f.horarios;

  // ---------- cabeçalho
  doc.setFillColor(20, 40, 60); doc.rect(0, 0, W, 18, 'F');
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.text('FICHA DE ANESTESIA', M, 11.5);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
  doc.text(`Data: ${dataBR(f.data)}   •   Status: ${f.status === 'salvo' ? 'Salva' : 'Rascunho'}   •   ID: ${f.id.slice(0, 8)}`, W - M, 11.5, { align: 'right' });
  doc.setTextColor(0); y = 23;

  const secao = (titulo) => {
    garantir(10);
    doc.setFillColor(232, 238, 244); doc.rect(M, y, CW, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(20, 40, 60);
    doc.text(titulo.toUpperCase(), M + 2, y + 4.2); doc.setTextColor(0); y += 8;
  };
  // grade de campos rótulo/valor em colunas
  const campos = (lista, colunas = 3) => {
    const cw = CW / colunas; doc.setFontSize(8.5);
    const grupos = []; let atual = []; let soma = 0;
    for (const c of lista) { const sp = c[2] || 1; if (soma + sp > colunas) { grupos.push(atual); atual = []; soma = 0; } atual.push(c); soma += sp; }
    if (atual.length) grupos.push(atual);
    for (const linha of grupos) {
      let alt = 0; const blocos = linha.map(([r, v, span]) => {
        const larg = cw * (span || 1) - 3;
        doc.setFont('helvetica', 'normal'); const linhas = doc.splitTextToSize(val(v), larg);
        alt = Math.max(alt, 3.6 + linhas.length * 3.8); return { r, linhas, span: span || 1 };
      });
      garantir(alt + 1);
      let x = M;
      for (const b of blocos) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(90); doc.text(b.r.toUpperCase(), x + 1, y + 2.4);
        doc.setFontSize(9); doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.text(b.linhas, x + 1, y + 6);
        x += cw * b.span;
      }
      y += alt + 1.5;
    }
  };

  secao('Hospital e identificação: preencher à mão após imprimir');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const linha = (rotulo, yy, x = M, largura = CW) => {
    doc.text(rotulo, x + 1, yy); doc.setDrawColor(120); doc.line(x + 1, yy + 9, x + largura - 2, yy + 9);
  };
  garantir(115);
  linha('Hospital / estabelecimento:', y + 2);
  linha('Nome completo:', y + 18);
  linha('Nascimento: ____ / ____ / ________    Idade: ______', y + 34, M, CW * 0.65);
  linha('Sexo:', y + 34, M + CW * 0.65, CW * 0.35);
  linha('CPF / RG / outros documentos:', y + 50);
  linha('Prontuário:                         Atendimento:                         Leito:', y + 66);
  linha('Operadora / registro ANS:                              Carteirinha / validade:', y + 82);
  linha('Guia:                                     Senha / autorização:', y + 98);
  y += 112;
  garantir(25); doc.setDrawColor(120); doc.rect(M, y, CW, 22);
  doc.text('Espaço para etiqueta / código de barras (aplicar após imprimir)', M + 2, y + 5); y += 26;
  secao('Dados clínicos');
  campos([
    ['Peso / Altura', `${fmt(p.pesoKg)} kg / ${fmt(p.alturaCm)} cm`], ['ASA', p.asa && p.asa.classe ? `${p.asa.classe}${p.asa.emergencia ? 'E' : ''}` : null], ['Alergias', p.alergias],
  ]);
  secao('Procedimento e equipe');
  const pessoa = (o) => (o && o.nome ? `${o.nome}${o.crm ? ` — CRM ${o.crm}${o.uf ? '/' + o.uf : ''}` : ''}` : null);
  campos([
    ['Procedimento', pr.descricao, 2], ['Código TUSS', pr.codigoTuss],
    ['Cirurgião', pessoa(pr.cirurgiao), 2], ['Caráter', pr.carater],
    ['Anestesista', pessoa(pr.anestesista), 2], ['Sala', pr.sala],
    ['Técnica anestésica', f.tecnicaAnestesica.descricao, 3],
  ]);
  secao('Horários');
  const dA = duracaoMin(h.inicioAnestesia, h.fimAnestesia); const dC = duracaoMin(h.inicioCirurgia, h.fimCirurgia);
  campos([
    ['Início da anestesia', horaDeISO(h.inicioAnestesia)], ['Fim da anestesia', horaDeISO(h.fimAnestesia)], ['Duração da anestesia', dA != null ? `${dA} min` : null],
    ['Início da cirurgia', horaDeISO(h.inicioCirurgia)], ['Fim da cirurgia', horaDeISO(h.fimCirurgia)], ['Duração da cirurgia', dC != null ? `${dC} min` : null],
  ]);

  // ---------- gráfico
  secao('Gráfico da anestesia');
  const canvas = criarCanvas ? criarCanvas() : document.createElement('canvas');
  const larg = 1100; const alt = 470;
  desenharGrafico(canvas, f, { tema: 'claro', largura: larg, altura: alt, escala: 2, maxLinhasDrogas: 10 });
  const imgH = (CW * alt) / larg;
  garantir(imgH + 2);
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', M, y, CW, imgH, undefined, 'FAST');
  doc.setDrawColor(180); doc.rect(M, y, CW, imgH); y += imgH + 3;

  // ---------- tabelas
  const tabela = (cab, linhas, larguras) => {
    const ws = larguras.map((w) => (w / larguras.reduce((a, b) => a + b, 0)) * CW);
    const desenharCab = () => {
      doc.setFillColor(245, 247, 250); doc.rect(M, y, CW, 5.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); let x = M;
      cab.forEach((c, i) => { doc.text(c, x + 1.5, y + 3.8); x += ws[i]; }); y += 5.5;
    };
    garantir(12); desenharCab();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    if (!linhas.length) { doc.setTextColor(120); doc.text('Nenhum registro.', M + 1.5, y + 4); doc.setTextColor(0); y += 6; return; }
    for (const l of linhas) {
      const cel = l.map((c, i) => doc.splitTextToSize(val(c), ws[i] - 3));
      const alt = Math.max(...cel.map((c) => c.length)) * 3.8 + 1.6;
      if (y + alt > H - 16) { novaPagina(); desenharCab(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); }
      let x = M; cel.forEach((c, i) => { doc.text(c, x + 1.5, y + 3.6); x += ws[i]; });
      doc.setDrawColor(225); doc.line(M, y + alt, M + CW, y + alt); y += alt;
    }
    y += 3;
  };
  const ord = (a) => [...a].sort((x, z) => (x.horario || '').localeCompare(z.horario || ''));

  secao('Drogas administradas');
  tabela(['Horário', 'Droga', 'Dose', 'Unidade', 'Via', 'Modo'], ord(f.drogas).map((d) => [horaDeISO(d.horario), d.nome, fmt(d.dose), d.unidade, d.via, d.modo === 'infusao' ? (d.via === 'INALATÓRIA' ? 'Contínuo' : 'Infusão') : 'Bolus']), [14, 40, 14, 18, 22, 14]);

  secao('Sinais vitais');
  tabela(['Horário', 'PA (mmHg)', 'PAM', 'FC (bpm)', 'IC', 'SpO2 (%)', 'FR (irpm)', 'Temp (°C)', 'EtCO2'], ord(f.sinaisVitais).map((s) => [horaDeISO(s.horario), s.paSistolica != null ? `${s.paSistolica}${s.paDiastolica != null ? ' x ' + s.paDiastolica : ''}` : '—', s.pam != null ? `${fmt(s.pam)}${s.pamOrigem === 'calculada' ? '*' : ''}` : '—', fmt(s.fc), s.ic != null ? `${formatarIC(s.ic)}${icAlto(s.ic) ? ' (!)' : ''}` : '—', fmt(s.spo2), fmt(s.fr), fmt(s.temperatura), fmt(s.etco2)]), [13, 19, 11, 12, 12, 12, 12, 12, 11]);
  garantir(6); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(90);
  doc.text('* PAM calculada = (PAS + 2×PAD)/3.  IC = índice de choque = FC ÷ PAS (calculado; (!) = IC >= 1,0, informativo, não é orientação clínica).', M, y); doc.setTextColor(0); y += 5;

  secao('Fluidos, hemoderivados, diurese e perdas');
  const linhasFl = [
    ...f.fluidos.map((x) => [horaDeISO(x.horario), 'Infundido', x.tipo + (x.categoria ? ` (${x.categoria})` : ''), x.unidades != null ? `${fmt(x.unidades)} U` : '—', fmt(x.volumeMl)]),
    ...f.diurese.map((x) => [horaDeISO(x.horario), 'Diurese', 'Diurese', '—', fmt(x.volumeMl)]),
    ...f.perdaSanguinea.map((x) => [horaDeISO(x.horario), 'Perda', 'Perda sanguínea', '—', fmt(x.volumeMl)]),
  ].sort((a, b) => a[0].localeCompare(b[0]));
  tabela(['Horário', 'Tipo', 'Descrição', 'Unidades', 'Volume (mL)'], linhasFl, [14, 18, 50, 16, 18]);
  const t = totais(f);
  garantir(8); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.text(`Totais — Cristaloides: ${t.cristaloides} mL   Coloides: ${t.coloides} mL   Hemoderivados: ${t.hemoderivados} mL   Diurese: ${t.diurese} mL   Perda sanguínea: ${t.perdaSanguinea} mL`, M, y + 2); y += 7;

  if (f.eventos.length) { secao('Eventos'); tabela(['Horário', 'Evento'], ord(f.eventos).map((e) => [horaDeISO(e.horario), e.descricao]), [14, 100]); }

  const blocoTexto = (titulo, texto) => {
    secao(titulo); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const linhas = doc.splitTextToSize(texto && texto.trim() ? texto : 'Nada consta.', CW - 2);
    for (const l of linhas) { garantir(5); doc.text(l, M + 1, y + 3); y += 4.2; }
    y += 3;
  };
  blocoTexto('Intercorrências', f.intercorrencias.map((i) => `${horaDeISO(i.horario)} — ${i.descricao}`).join('\n'));
  blocoTexto('Observações', f.observacoes);
  blocoTexto('Anotações extras', f.anotacoesExtras && f.anotacoesExtras.texto);

  // ---------- assinatura
  garantir(32); y += 14;
  doc.setDrawColor(0); doc.line(M + 20, y, M + 100, y); doc.line(M + 115, y, W - M - 10, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(`${val(pr.anestesista.nome)}${pr.anestesista.crm ? ` — CRM ${pr.anestesista.crm}${pr.anestesista.uf ? '/' + pr.anestesista.uf : ''}` : ''}`, M + 60, y + 4, { align: 'center' });
  doc.text('Assinatura e carimbo do anestesista', M + 60, y + 8, { align: 'center' });
  doc.text('Local e data', (M + 115 + W - M - 10) / 2, y + 4, { align: 'center' });
  y += 12;
  const pend = pendencias(f);
  if (pend.length) { garantir(10); doc.setFontSize(7.5); doc.setTextColor(170, 0, 0); doc.text(doc.splitTextToSize('Campos pendentes: ' + pend.join('; '), CW), M, y); doc.setTextColor(0); }

  // ---------- rodapé
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(110); doc.setFont('helvetica', 'normal');
    doc.text(`Identificação manuscrita • Gerado em ${new Date().toLocaleString('pt-BR')} • Protótipo — conferir antes de enviar`, M, H - 7);
    doc.text(`Página ${i} de ${n}`, W - M, H - 7, { align: 'right' });
    doc.setTextColor(0);
  }
  return doc;
}

export function nomeArquivoPdf(f) {
  const base = ('identificacao-manuscrita').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return `ficha-anestesia-${base}-${f.data || ''}.pdf`;
}
