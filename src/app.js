import { analisar, descreverItem, ROTULO_CAMPO, calcularDerivados, avisosDerivados, formatarIC, icAlto } from './parser.js';
import { filtrarIdentificacaoManual, AVISO_IDENTIFICACAO_MANUAL, novaFicha, aplicarItem, removerRegistro, pendencias, totais, salvarLocal, carregarAtual, carregarTodas, excluirLocal, horaParaISO, horaDeISO, adicionarFraseAnotacao, apagarUltimaFrase, duracaoMin } from './ficha.js';
import { desenharGrafico } from './grafico.js';
import { gerarPdf, nomeArquivoPdf } from './pdf.js';
import { fichaExemplo } from './exemplo.js';
import { Reconhecedor, suportaReconhecimento, falar, bipe, vibrar, TelaAcesa, ehIOS } from './voz.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const ETAPAS = ['dados', 'registro', 'anotacoes', 'revisao'];
const params = new URLSearchParams(location.search);

const estado = {
  ficha: null, etapa: 'dados', pendentes: [], desfazer: [], soVoz: false, ouvindo: false,
  ajustarGrafico: true, pdfUrl: null, pdfBlob: null,
  opcoes: JSON.parse(localStorage.getItem('fichaAnestesia.opcoes') || '{"ptt":false,"ler":true,"bipe":true}'),
};

// ----------------------------------------------------------------- utilidades de UI
let toastT;
function toast(msg, erro = false) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('erro', erro); t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
}
function feedback(tipo) { if (estado.opcoes.bipe) { bipe(tipo); vibrar(tipo); } }
const ler = (texto) => (estado.soVoz && estado.opcoes.ler ? falar(paraFala(texto), reconhecedor) : Promise.resolve());
function paraFala(t) {
  return t.replace(/(\d+)x(\d+)/g, '$1 por $2').replace(/\bmcg\/kg\/min\b/g, 'microgramas por quilo por minuto').replace(/\bmcg\b/g, 'microgramas').replace(/\bmg\b/g, 'miligramas')
    .replace(/\bmL\b/g, 'mililitros').replace(/\bEV\b/g, 'venoso').replace(/\bSpO2\b/g, 'saturação').replace(/\bFC\b/g, 'frequência').replace(/\bPA\b/g, 'pressão').replace(/(\d+)%/g, '$1 por cento').replace(/\bUI\b/g, 'unidades').replace(/\bIC (\d+),(\d+)/g, 'índice de choque $1 vírgula $2').replace(/\bPAM\b/g, 'pressão média').replace(/\(calc\.\)|⚠/g, '');
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function snapshot() { estado.desfazer.push(JSON.stringify(estado.ficha)); if (estado.desfazer.length > 50) estado.desfazer.shift(); }
function autosalvar() { estado.ficha.atualizadoEm = new Date().toISOString(); if (estado.ficha.status === 'salvo') estado.ficha.status = 'rascunho'; salvarLocal(estado.ficha); invalidarPdf(); }
function invalidarPdf() { if (estado.pdfUrl) URL.revokeObjectURL(estado.pdfUrl); estado.pdfUrl = null; estado.pdfBlob = null; $('#pdfAcoes').hidden = true; }

// ----------------------------------------------------------------- etapas
function irPara(etapa, anunciar = true) {
  estado.etapa = etapa;
  $$('.etapa').forEach((s) => s.classList.toggle('ativa', s.id === 'etapa-' + etapa));
  $$('.etapas button').forEach((b) => { b.classList.toggle('ativa', b.dataset.etapa === etapa); b.classList.toggle('feita', ETAPAS.indexOf(b.dataset.etapa) < ETAPAS.indexOf(etapa)); });
  render();
  window.scrollTo({ top: 0 });
  if (anunciar) {
    const fala = { dados: 'Dados do paciente e do plano.', registro: 'Registro intraoperatório. Fale drogas, sinais vitais e fluidos.', anotacoes: 'Anotações extras. Dite suas anotações. Diga próximo para revisar.', revisao: `Revisão final. ${pendencias(estado.ficha).length ? pendencias(estado.ficha).length + ' campos pendentes.' : 'Sem pendências.'} Diga salvar para salvar a ficha.` }[etapa];
    toast(fala.split('.')[0]); ler(fala);
  }
}
const proxima = () => irPara(ETAPAS[Math.min(ETAPAS.length - 1, ETAPAS.indexOf(estado.etapa) + 1)]);
const anterior = () => irPara(ETAPAS[Math.max(0, ETAPAS.indexOf(estado.etapa) - 1)]);

// ----------------------------------------------------------------- formulário de dados
const CAMPOS = [
  ['Dados clínicos (preservados)', [['paciente.pesoKg', 'Peso (kg)', 'number'], ['paciente.alturaCm', 'Altura (cm)', 'number'], ['paciente.asa.classe', 'ASA', 'select:|1|2|3|4|5|6'], ['paciente.asa.emergencia', 'Emergência (E)', 'select:false:Não|true:Sim'], ['paciente.alergias', 'Alergias', 'text', 'largo']]],
  ['Procedimento e equipe', [['data', 'Data do procedimento', 'date'], ['procedimento.descricao', 'Procedimento', 'text', 'largo'], ['procedimento.codigoTuss', 'Código TUSS', 'text'], ['procedimento.carater', 'Caráter', 'select:eletivo:Eletivo|urgência:Urgência'], ['procedimento.sala', 'Sala', 'text'], ['procedimento.cirurgiao.nome', 'Cirurgião', 'text', 'largo'], ['procedimento.cirurgiao.crm', 'CRM cirurgião', 'text'], ['procedimento.cirurgiao.uf', 'UF', 'text'], ['procedimento.anestesista.nome', 'Anestesista', 'text', 'largo'], ['procedimento.anestesista.crm', 'CRM anestesista', 'text'], ['procedimento.anestesista.uf', 'UF', 'text']]],
  ['Técnica e horários', [['tecnicaAnestesica.descricao', 'Técnica anestésica', 'text', 'largo'], ['horarios.inicioAnestesia', 'Início anestesia', 'time'], ['horarios.inicioCirurgia', 'Início cirurgia', 'time'], ['horarios.fimCirurgia', 'Fim cirurgia', 'time'], ['horarios.fimAnestesia', 'Fim anestesia', 'time']]],
];
const getP = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setP = (o, p, v) => { const ks = p.split('.'); const u = ks.pop(); const alvo = ks.reduce((a, k) => a[k], o); alvo[u] = v; };

function montarForm() {
  const f = $('#formDados'); f.innerHTML = '<p class="ok-box">Hospital e identificação administrativa/paciente: preencher à mão após imprimir. O PDF terá espaço em branco para identificação.</p>';
  for (const [grupo, campos] of CAMPOS) {
    const fs = document.createElement('fieldset'); fs.innerHTML = `<legend>${grupo}</legend>`;
    for (const [path, rot, tipo, cls] of campos) {
      const l = document.createElement('label'); l.className = 'campo' + (cls ? ' ' + cls : ''); l.textContent = rot;
      let el;
      if (tipo.startsWith('select:')) { el = document.createElement('select'); el.innerHTML = tipo.slice(7).split('|').map((o) => { const [v, t] = o.split(':'); return `<option value="${v}">${t ?? v}</option>`; }).join(''); }
      else { el = document.createElement('input'); el.type = tipo; if (tipo === 'number') { el.inputMode = 'decimal'; el.step = 'any'; } }
      el.dataset.path = path; el.dataset.tipo = tipo;
      el.addEventListener('change', () => {
        snapshot(); let v = el.value;
        if (tipo === 'number' || path.endsWith('asa.classe')) v = v === '' ? null : Number(v);
        else if (path.endsWith('emergencia')) v = v === 'true';
        else if (tipo === 'time') v = v ? horaParaISO(estado.ficha, v) : null;
        else if (tipo === 'date') v = v || null;
        setP(estado.ficha, path, v); autosalvar(); render();
      });
      l.appendChild(el); fs.appendChild(l);
    }
    f.appendChild(fs);
  }
}
function preencherForm() {
  for (const el of $$('#formDados [data-path]')) {
    if (document.activeElement === el) continue;
    let v = getP(estado.ficha, el.dataset.path);
    if (el.dataset.tipo === 'time') v = horaDeISO(v);
    el.value = v == null ? '' : String(v);
  }
}

// ----------------------------------------------------------------- render
function render() {
  const f = estado.ficha;
  const st = $('#statusFicha'); st.textContent = f.status === 'salvo' ? 'Salva' : 'Rascunho'; st.classList.toggle('salvo', f.status === 'salvo');
  preencherForm();
  if (estado.etapa === 'registro') renderRegistro();
  if (estado.etapa === 'anotacoes') renderAnotacoes();
  if (estado.etapa === 'revisao') renderRevisao();
  renderPendentes();
}

function renderGrafico() {
  const wrap = $('#graficoWrap'); const cv = $('#grafico');
  const paisagem = innerWidth > innerHeight;
  const altura = Math.max(280, Math.min(520, paisagem && innerHeight < 560 ? innerHeight - 70 : 400));
  const larguraTela = wrap.clientWidth - 2;
  desenharGrafico(cv, estado.ficha, { tema: document.documentElement.dataset.tema, altura, largura: estado.ajustarGrafico ? larguraTela : undefined, larguraMin: larguraTela, pxPorMin: 7 });
  if (!estado.ajustarGrafico) wrap.scrollLeft = wrap.scrollWidth;
}

function entradasLinhaTempo() {
  const f = estado.ficha; const L = [];
  const fmt = (n) => (n == null ? '?' : String(n).replace('.', ','));
  f.drogas.forEach((d) => L.push({ col: 'drogas', id: d.id, h: d.horario, tag: 'droga', txt: `${d.nome} ${fmt(d.dose)} ${d.unidade || ''} ${d.via || ''}${d.modo === 'infusao' ? ' (infusão)' : ''}` }));
  f.sinaisVitais.forEach((s) => L.push({ col: 'sinaisVitais', id: s.id, h: s.horario, tag: icAlto(s.ic) ? 'vitais · IC ≥ 1,0' : 'vitais', alerta: icAlto(s.ic), txt: descreverItem({ tipo: 'sinais_vitais', dados: { ...s, hora: '' } }).replace(/ às $/, '') }));
  f.fluidos.forEach((x) => L.push({ col: 'fluidos', id: x.id, h: x.horario, tag: x.categoria, txt: `${x.tipo}${x.unidades != null ? ' ' + x.unidades + ' U' : ''}${x.volumeMl != null ? ' ' + x.volumeMl + ' mL' : ''}` }));
  f.diurese.forEach((x) => L.push({ col: 'diurese', id: x.id, h: x.horario, tag: 'diurese', txt: `Diurese ${x.volumeMl} mL` }));
  f.perdaSanguinea.forEach((x) => L.push({ col: 'perdaSanguinea', id: x.id, h: x.horario, tag: 'perda', txt: `Perda sanguínea ${x.volumeMl} mL` }));
  f.eventos.forEach((x) => L.push({ col: 'eventos', id: x.id, h: x.horario, tag: 'evento', txt: x.descricao }));
  f.intercorrencias.forEach((x) => L.push({ col: 'intercorrencias', id: x.id, h: x.horario, tag: 'intercorrência', txt: x.descricao }));
  return L.sort((a, b) => (b.h || '').localeCompare(a.h || ''));
}
function renderRegistro() {
  renderGrafico();
  const t = totais(estado.ficha); const f = estado.ficha;
  $('#contadores').innerHTML = [`💉 ${f.drogas.length} drogas`, `❤ ${f.sinaisVitais.length} sinais vitais`, `💧 Cristaloide ${t.cristaloides} mL`, t.coloides ? `Coloide ${t.coloides} mL` : '', t.hemoderivados ? `🩸 Hemoderivados ${t.hemoderivados} mL` : '', `Diurese ${t.diurese} mL`, `Perda ${t.perdaSanguinea} mL`].filter(Boolean).map((s) => `<span>${s}</span>`).join('');
  const L = entradasLinhaTempo();
  $('#linhaTempo').innerHTML = L.length ? L.map((e) => `<li><span class="hora">${horaDeISO(e.h)}</span><span class="txt">${esc(e.txt)} <span class="tag${e.alerta ? ' alerta' : ''}">${e.tag}</span></span><button class="btn-x" data-remover="${e.col}:${e.id}" aria-label="Remover">✕</button></li>`).join('') : '<li><span class="txt">Nada registrado ainda.</span></li>';
}
function renderAnotacoes() {
  const ta = $('#anotacoes'); if (document.activeElement !== ta) ta.value = estado.ficha.anotacoesExtras.texto;
  const fr = estado.ficha.anotacoesExtras.frases;
  $('#frases').innerHTML = fr.map((x, i) => `<li><span class="hora">${horaDeISO(x.horario)}</span><span class="txt">${esc(x.texto)}</span><button class="btn-x" data-frase="${i}" aria-label="Remover frase">✕</button></li>`).join('');
}
function renderRevisao() {
  const f = estado.ficha; const p = f.paciente; const pr = f.procedimento; const h = f.horarios;
  const pend = pendencias(f);
  $('#pendenciasFicha').innerHTML = pend.length ? `<div class="pend"><b>Pendências (${pend.length}):</b> ${pend.map(esc).join(' · ')}<br><small>Você pode salvar mesmo assim; o PDF mostrará os campos pendentes.</small></div>` : '<div class="ok-box">✔ Todos os campos obrigatórios preenchidos.</div>';
  const dl = (pares) => `<dl>${pares.map(([a, b]) => `<dt>${a}</dt><dd>${esc(b == null || b === '' ? '—' : b)}</dd>`).join('')}</dl>`;
  const pes = (o) => (o.nome ? `${o.nome}${o.crm ? ' — CRM ' + o.crm + (o.uf ? '/' + o.uf : '') : ''}` : '');
  const t = totais(f);
  $('#resumo').innerHTML = `
    <div class="bloco"><h4>Dados do paciente: preencher à mão após imprimir</h4><p>Identificação em branco no PDF.</p>${dl([ ['Peso/Altura', `${p.pesoKg ?? '—'} kg / ${p.alturaCm ?? '—'} cm`], ['ASA', p.asa.classe ? p.asa.classe + (p.asa.emergencia ? 'E' : '') : ''], ['Alergias', p.alergias]])}</div>
    <div class="bloco">Hospital, documentos e plano: preencher à mão após imprimir.</div>
    <div class="bloco"><h4>Procedimento</h4>${dl([['Procedimento', pr.descricao], ['TUSS', pr.codigoTuss], ['Cirurgião', pes(pr.cirurgiao)], ['Anestesista', pes(pr.anestesista)], ['Sala', pr.sala], ['Técnica', f.tecnicaAnestesica.descricao]])}</div>
    <div class="bloco"><h4>Horários</h4>${dl([['Anestesia', `${horaDeISO(h.inicioAnestesia) || '—'} → ${horaDeISO(h.fimAnestesia) || '—'} (${duracaoMin(h.inicioAnestesia, h.fimAnestesia) ?? '—'} min)`], ['Cirurgia', `${horaDeISO(h.inicioCirurgia) || '—'} → ${horaDeISO(h.fimCirurgia) || '—'} (${duracaoMin(h.inicioCirurgia, h.fimCirurgia) ?? '—'} min)`]])}</div>
    <div class="bloco"><h4>Registros</h4>${dl([['Drogas', f.drogas.length], ['Sinais vitais', f.sinaisVitais.length], ['Fluidos', `${t.cristaloides + t.coloides + t.hemoderivados} mL`], ['Diurese', `${t.diurese} mL`], ['Perda sanguínea', `${t.perdaSanguinea} mL`], ['Intercorrências', f.intercorrencias.map((i) => i.descricao).join(' | ')], ['Observações', f.observacoes]])}</div>
    <div class="bloco"><h4>Anotações extras</h4><p>${esc(f.anotacoesExtras.texto || '—')}</p></div>`;
}

const ICONE = { droga: '💉', sinais_vitais: '❤', fluido: '💧', diurese: '🚻', perda_sanguinea: '🩸', horario: '⏱', evento: '📍', intercorrencia: '⚠', observacao: '📝', anotacao: '📝', paciente: '👤', procedimento: '🏥', tecnica: '🩺' };
function renderPendentes() {
  const sec = $('#pendentes'); sec.hidden = !estado.pendentes.length;
  $('#listaPendentes').innerHTML = estado.pendentes.map((p) => `
    <li class="pendente" data-id="${p.id}">
      <div class="desc">${ICONE[p.item.tipo] || '•'} ${esc(descreverItem(p.item))}</div>
      <div class="orig">“${esc(p.item.textoOriginal || '')}” · ${p.origem}</div>
      ${p.item.avisos && p.item.avisos.length ? `<div class="avisos">⚠ ${p.item.avisos.map(esc).join(' · ')}</div>` : ''}
      <div class="acoes"><button class="btn primario" data-acao="confirmar">✔ Confirmar</button><button class="btn" data-acao="editar">✎ Editar</button><button class="btn perigo" data-acao="descartar">✕</button></div>
    </li>`).join('');
}

// ----------------------------------------------------------------- pendentes: confirmar / editar / descartar
let seq = 0;
function adicionarPendentes(itens, origem, textoOriginal) {
  for (const it of itens) estado.pendentes.push({ id: ++seq, origem, item: { ...it, textoOriginal } });
  renderPendentes(); feedback('captura');
  const resumo = itens.map(descreverItem).join('; ');
  toast('Para revisar: ' + resumo);
  ler(resumo + '. Confirmar?');
}
function confirmar(ids) {
  const alvo = ids ? estado.pendentes.filter((p) => ids.includes(p.id)) : [...estado.pendentes];
  if (!alvo.length) return 0;
  snapshot();
  for (const p of alvo) aplicarItem(estado.ficha, p.item, p.origem);
  estado.pendentes = estado.pendentes.filter((p) => !alvo.includes(p));
  autosalvar(); render(); feedback('ok');
  toast(`✔ ${alvo.length} item(ns) registrado(s)`); ler(alvo.length > 1 ? `${alvo.length} itens registrados` : 'Registrado');
  return alvo.length;
}
function descartar(id) {
  const i = id != null ? estado.pendentes.findIndex((p) => p.id === id) : estado.pendentes.length - 1;
  if (i < 0) return;
  estado.pendentes.splice(i, 1); renderPendentes(); feedback('erro'); toast('Descartado'); ler('Descartado');
}
function desfazer() {
  const s = estado.desfazer.pop();
  if (!s) { toast('Nada para desfazer', true); ler('Nada para desfazer'); return; }
  estado.ficha = JSON.parse(s); salvarLocal(estado.ficha); invalidarPdf(); render(); feedback('erro'); toast('↶ Desfeito'); ler('Desfeito');
}

// editor de item pendente (campos gerados a partir de dados)
const ROT_EDIT = { nome: 'Droga', dose: 'Dose', unidade: 'Unidade', via: 'Via', modo: 'Modo (bolus/infusao)', hora: 'Horário', paSistolica: 'PA sistólica', paDiastolica: 'PA diastólica', pam: 'PAM', fc: 'FC', spo2: 'SpO2', fr: 'FR', temperatura: 'Temperatura', etco2: 'EtCO2', tipo: 'Tipo', volumeMl: 'Volume (mL)', unidades: 'Unidades', texto: 'Texto', descricao: 'Descrição', valor: 'Valor' };
const NUMERICOS = new Set(['dose', 'paSistolica', 'paDiastolica', 'pam', 'fc', 'spo2', 'fr', 'temperatura', 'etco2', 'volumeMl', 'unidades']);
function editarPendente(id) {
  const p = estado.pendentes.find((x) => x.id === id); if (!p) return;
  const d = p.item.dados; const c = $('#camposEditar'); c.innerHTML = '';
  const chaves = p.item.tipo === 'sinais_vitais' ? ['hora', 'paSistolica', 'paDiastolica', 'pam', 'fc', 'spo2', 'fr', 'temperatura', 'etco2'] : Object.keys(d).filter((k) => !['campo', 'categoria', 'acumulado', 'pessoa'].includes(k));
  $('#tituloEditar').textContent = 'Editar: ' + (p.item.tipo === 'paciente' || p.item.tipo === 'procedimento' ? (ROTULO_CAMPO[d.campo] || d.campo) : p.item.tipo.replace('_', ' '));
  for (const k of chaves) {
    let v = d[k];
    if (k === 'valor' && v && typeof v === 'object') v = v.nome ?? v.crm ?? v.classe;
    const l = document.createElement('label'); l.className = 'campo'; l.textContent = ROT_EDIT[k] || k;
    const inp = document.createElement('input'); inp.dataset.k = k; inp.value = v == null ? '' : v;
    if (k === 'hora') inp.type = 'time'; else if (NUMERICOS.has(k)) { inp.type = 'text'; inp.inputMode = 'decimal'; }
    l.appendChild(inp); c.appendChild(l);
  }
  let calc = null;
  if (p.item.tipo === 'sinais_vitais') {
    calc = document.createElement('div'); calc.className = 'calc'; calc.setAttribute('aria-live', 'polite'); c.appendChild(calc);
    const lerV = () => { const v = { pamOrigem: d.pamOrigem }; for (const inp of c.querySelectorAll('input')) { const k = inp.dataset.k; if (NUMERICOS.has(k) && inp.value.trim() !== '') v[k] = Number(inp.value.replace(',', '.')); } return v; };
    const pamOrig = d.pam;
    const atualizar = (ev) => {
      const v = lerV();
      const pamInp = c.querySelector('input[data-k=pam]');
      if (ev && ev.target === pamInp) d.pamOrigem = pamInp.value.trim() === '' ? 'calculada' : 'medida';
      v.pamOrigem = d.pamOrigem;
      calcularDerivados(v);
      if (d.pamOrigem !== 'medida' && pamInp && document.activeElement !== pamInp) pamInp.value = v.pam ?? '';
      calc.innerHTML = `Calculado automaticamente: <b>IC ${v.ic != null ? formatarIC(v.ic) : '— (faltam FC e PAS)'}</b>${icAlto(v.ic) ? ' <span class="alerta">⚠ IC ≥ 1,0 (informativo)</span>' : ''} · PAM ${v.pam ?? '—'}${d.pamOrigem === 'medida' ? ' (medida)' : ' (calc.)'}`;
    };
    c.addEventListener('input', atualizar); atualizar();
    void pamOrig;
  }
  const dlg = $('#dlgEditar');
  dlg.onclose = () => {
    if (dlg.returnValue !== 'ok') return;
    for (const inp of c.querySelectorAll('input')) {
      const k = inp.dataset.k; let v = inp.value.trim();
      if (NUMERICOS.has(k)) v = v === '' ? null : Number(v.replace(',', '.'));
      if (k === 'valor' && d.valor && typeof d.valor === 'object') { if ('nome' in d.valor) d.valor.nome = v; else if ('crm' in d.valor) d.valor.crm = v; else if ('classe' in d.valor) d.valor.classe = Number(v); }
      else d[k] = v === '' ? null : v;
    }
    p.item.avisos = (p.item.avisos || []).filter((a) => !/presumida|choque/.test(a));
    if (p.item.tipo === 'sinais_vitais') { calcularDerivados(d); p.item.avisos.push(...avisosDerivados(d)); }
    confirmar([p.id]);
  };
  dlg.showModal();
}

// ----------------------------------------------------------------- comandos e processamento de frases
async function salvarFicha() {
  if (estado.pendentes.length) { toast(`${estado.pendentes.length} item(ns) pendente(s): confirme ou descarte`, true); ler(`Há ${estado.pendentes.length} itens pendentes. Diga confirmar ou descartar.`); return false; }
  salvarLocal(estado.ficha, localStorage, 'salvo'); render(); feedback('salvar');
  const pend = pendencias(estado.ficha);
  toast('💾 Ficha salva neste aparelho'); await ler(`Ficha salva. ${pend.length ? pend.length + ' campos pendentes.' : ''} Diga gerar PDF para criar o documento.`);
  return true;
}
function executarComando(cmd) {
  const et = estado.etapa;
  switch (cmd) {
    case 'confirmar': case 'confirmar_tudo':
      if (estado.pendentes.length) confirmar();
      else if (et === 'revisao') salvarFicha();
      else { toast('Nada pendente'); ler('Nada pendente'); }
      break;
    case 'descartar': descartar(); break;
    case 'descartar_tudo': estado.pendentes = []; renderPendentes(); toast('Pendentes descartados'); ler('Pendentes descartados'); break;
    case 'desfazer': if (et === 'anotacoes') apagarFrase(); else desfazer(); break;
    case 'apagar_frase': apagarFrase(); break;
    case 'salvar':
      if (estado.pendentes.length) { salvarFicha(); break; }
      if (et === 'dados' || et === 'registro') irPara('anotacoes');
      else if (et === 'anotacoes') irPara('revisao');
      else salvarFicha();
      break;
    case 'proximo': if (estado.pendentes.length) { ler('Confirme ou descarte os pendentes antes'); toast('Há itens pendentes', true); } else proxima(); break;
    case 'voltar': anterior(); break;
    case 'gerar_pdf': gerarEMostrarPdf(true); break;
    case 'parar': pararMic(); toast('Microfone pausado'); break;
    case 'repetir': ler(estado.pendentes.length ? estado.pendentes.map((p) => descreverItem(p.item)).join('. ') : 'Nada pendente'); break;
    default: break;
  }
}
function apagarFrase() {
  snapshot(); const fr = apagarUltimaFrase(estado.ficha);
  if (!fr) { estado.desfazer.pop(); toast('Nenhuma frase para apagar', true); ler('Nenhuma frase'); return; }
  autosalvar(); render(); feedback('erro'); toast('Frase apagada: ' + fr.texto); ler('Última frase apagada');
}

export function processarFrase(texto, origem = 'voz') {
  texto = String(texto || '').trim(); if (!texto) return;
  $('#transcricao').textContent = '“' + texto + '”'; $('#transcricao').classList.remove('parcial');
  const r = analisar(texto);
  if (estado.etapa !== 'anotacoes') { const filtrado = filtrarIdentificacaoManual(r.itens); r.itens = filtrado.itens; if (filtrado.aviso) { toast(filtrado.aviso); ler(filtrado.aviso); r.identificacaoManual = true; $('#transcricao').textContent = 'Identificação administrativa: preencher à mão após imprimir'; r.itens.forEach(it => { it.textoOriginal = it.texto; }); } }
  if (estado.etapa === 'anotacoes') {
    if (r.comando && !r.itens.length) return executarComando(r.comando);
    // ditado livre: acrescenta a frase inteira (sem o comando final)
    let frase = texto.replace(/\s*[,.]?\s*(próximo|proximo|salvar|confirmar)\s*\.?$/i, '').trim();
    if (frase) {
      snapshot();
      const d = new Date(); adicionarFraseAnotacao(estado.ficha, frase, horaParaISO(estado.ficha, `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`));
      autosalvar(); render(); feedback('captura'); toast('＋ ' + frase);
    }
    if (r.comando) executarComando(r.comando);
    return;
  }
  if (r.itens.length) adicionarPendentes(r.itens, origem, r.identificacaoManual ? r.itens.map(it => it.texto).join('; ') : texto);
  if (r.comando) executarComando(r.comando);
  if (!r.itens.length && !r.comando && !r.identificacaoManual) { feedback('erro'); toast('Não entendi: “' + texto + '”', true); ler('Não entendi. Repita.'); }
}

// ----------------------------------------------------------------- microfone
const reconhecedor = new Reconhecedor({
  aoFinal: (t) => processarFrase(t, 'voz'),
  aoParcial: (t) => { const el = $('#transcricao'); el.textContent = t + '…'; el.classList.add('parcial'); },
  aoEstado: (s) => { if (s === 'ouvindo') { $('#btnMic').setAttribute('aria-pressed', 'true'); $('#micRotulo').textContent = 'Ouvindo'; } else if (s === 'parado' && !reconhecedor.ativo) { $('#btnMic').setAttribute('aria-pressed', 'false'); $('#micRotulo').textContent = 'Falar'; } },
  aoErro: (e) => {
    const msg = { 'not-allowed': 'Permissão do microfone negada. Libere nas configurações do navegador.', 'service-not-allowed': 'Serviço de voz indisponível neste navegador.', network: 'Sem internet: o reconhecimento de voz do Chrome precisa de conexão. Use o teclado.', 'nao-suportado': 'Este navegador não tem reconhecimento de voz. Use Chrome no Android ou o teclado.', 'audio-capture': 'Microfone não encontrado.' }[e] || 'Erro de voz: ' + e;
    toast(msg, true); feedback('erro');
    if (!reconhecedor.ativo) { $('#btnMic').setAttribute('aria-pressed', 'false'); $('#micRotulo').textContent = 'Falar'; }
  },
});
const tela = new TelaAcesa((on) => $('#btnTela').classList.toggle('on', on));
function iniciarMic() { if (reconhecedor.iniciar()) { estado.ouvindo = true; tela.ativar(); feedback('ok'); $('#btnMic').setAttribute('aria-pressed', 'true'); $('#micRotulo').textContent = 'Ouvindo'; } }
function pararMic() { reconhecedor.parar(); estado.ouvindo = false; $('#btnMic').setAttribute('aria-pressed', 'false'); $('#micRotulo').textContent = 'Falar'; if (estado.soVoz) alternarSoVoz(false); }
function alternarSoVoz(forcar) {
  estado.soVoz = forcar ?? !estado.soVoz;
  document.body.classList.toggle('so-voz', estado.soVoz); $('#btnSoVoz').setAttribute('aria-pressed', String(estado.soVoz));
  if (estado.soVoz) { iniciarMic(); tela.ativar(); toast('Modo só voz ativado'); ler('Modo só voz. Pode falar.'); }
  else toast('Modo só voz desativado');
}

// ----------------------------------------------------------------- PDF
async function gerarEMostrarPdf(porVoz = false) {
  if (estado.ficha.status !== 'salvo') { const ok = await salvarFicha(); if (!ok) return; }
  try {
    const doc = gerarPdf(estado.ficha);
    invalidarPdf();
    estado.pdfBlob = doc.output('blob'); estado.pdfUrl = URL.createObjectURL(estado.pdfBlob);
    const a = $('#lnkPdf'); a.href = estado.pdfUrl; a.download = nomeArquivoPdf(estado.ficha);
    $('#pdfAcoes').hidden = false; $('#btnCompartilhar').hidden = !(navigator.canShare && navigator.canShare({ files: [new File([estado.pdfBlob], 'f.pdf', { type: 'application/pdf' })] }));
    if (estado.etapa !== 'revisao') irPara('revisao', false);
    a.click();
    feedback('salvar'); toast('📄 PDF gerado'); if (porVoz) ler('PDF gerado.');
  } catch (e) { console.error(e); toast('Falha ao gerar PDF: ' + e.message, true); }
}
async function compartilharPdf() {
  if (!estado.pdfBlob) return;
  const file = new File([estado.pdfBlob], nomeArquivoPdf(estado.ficha), { type: 'application/pdf' });
  try { await navigator.share({ files: [file], title: 'Ficha de anestesia', text: 'Ficha de anestesia — identificação a preencher após imprimir' }); } catch (e) { if (e.name !== 'AbortError') toast('Não foi possível compartilhar', true); }
}

function baixar(nome, conteudo, tipo) { const b = new Blob([conteudo], { type: tipo }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(u), 5000); }

// ----------------------------------------------------------------- eventos
function ligar() {
  $$('.etapas button').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.etapa, false)));
  $$('[data-ir]').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.ir, false)));
  $('#btnAjuste').addEventListener('click', () => { estado.ajustarGrafico = !estado.ajustarGrafico; $('#btnAjuste').textContent = estado.ajustarGrafico ? 'Rolagem (detalhe)' : 'Ajustar à tela'; renderGrafico(); });
  $('#btnAjuste').textContent = estado.ajustarGrafico ? 'Rolagem (detalhe)' : 'Ajustar à tela';
  new ResizeObserver(() => { if (!(innerWidth > innerHeight && innerHeight < 560)) document.documentElement.style.setProperty('--dock', $('.dock').offsetHeight + 'px'); }).observe($('.dock'));
  $('#linhaTempo').addEventListener('click', (e) => { const b = e.target.closest('[data-remover]'); if (!b) return; const [col, id] = b.dataset.remover.split(':'); snapshot(); removerRegistro(estado.ficha, col, id); autosalvar(); render(); toast('Removido — diga "desfazer" para voltar'); });
  $('#frases').addEventListener('click', (e) => { const b = e.target.closest('[data-frase]'); if (!b) return; snapshot(); const i = Number(b.dataset.frase); const an = estado.ficha.anotacoesExtras; const fr = an.frases.splice(i, 1)[0]; an.texto = an.texto.replace(fr.texto, '').replace(/\.\s*\./g, '.').replace(/^\s*\.\s*/, '').trim(); autosalvar(); render(); });
  $('#anotacoes').addEventListener('input', (e) => { estado.ficha.anotacoesExtras.texto = e.target.value; autosalvar(); });
  $('#anotacoes').addEventListener('change', () => { snapshot(); });
  $('#btnApagarFrase').addEventListener('click', apagarFrase);
  $('#listaPendentes').addEventListener('click', (e) => { const b = e.target.closest('[data-acao]'); if (!b) return; const id = Number(b.closest('.pendente').dataset.id); ({ confirmar: () => confirmar([id]), editar: () => editarPendente(id), descartar: () => descartar(id) })[b.dataset.acao](); });
  $('#btnConfirmarTudo').addEventListener('click', () => confirmar());
  $('#btnDescartarTudo').addEventListener('click', () => executarComando('descartar_tudo'));
  $('#btnSalvar').addEventListener('click', salvarFicha);
  $('#btnPdf').addEventListener('click', () => gerarEMostrarPdf(false));
  $('#btnCompartilhar').addEventListener('click', compartilharPdf);
  $('#btnJson').addEventListener('click', () => baixar(`ficha-anestesia-${estado.ficha.id.slice(0, 8)}.json`, JSON.stringify(estado.ficha, null, 2), 'application/json'));
  $('#btnTema').addEventListener('click', () => { const t = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro'; document.documentElement.dataset.tema = t; localStorage.setItem('fichaAnestesia.tema', t); document.querySelector('meta[name=theme-color]').content = t === 'escuro' ? '#0b0f14' : '#f5f7fa'; render(); });
  $('#btnTela').addEventListener('click', () => (tela.lock ? tela.desativar() : tela.ativar().then((ok) => toast(ok ? 'Tela ficará acesa' : 'Wake Lock não suportado aqui', !ok))));
  $('#btnTeclado').addEventListener('click', () => { const f = $('#formTexto'); f.hidden = !f.hidden; if (!f.hidden) $('#entradaTexto').focus(); });
  $('#formTexto').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#entradaTexto'); processarFrase(i.value, 'texto'); i.value = ''; });
  $('#btnSoVoz').addEventListener('click', () => alternarSoVoz());
  const mic = $('#btnMic');
  mic.addEventListener('pointerdown', (e) => { if (!estado.opcoes.ptt) return; e.preventDefault(); iniciarMic(); });
  mic.addEventListener('pointerup', () => { if (estado.opcoes.ptt) setTimeout(pararMic, 400); });
  mic.addEventListener('pointercancel', () => { if (estado.opcoes.ptt) pararMic(); });
  mic.addEventListener('click', () => { if (estado.opcoes.ptt) return; reconhecedor.ativo ? pararMic() : iniciarMic(); });
  // menu
  const menu = $('#dlgMenu');
  $('#btnMenu').addEventListener('click', () => { $('#optPtt').checked = estado.opcoes.ptt; $('#optLer').checked = estado.opcoes.ler; $('#optBipe').checked = estado.opcoes.bipe; menu.showModal(); });
  for (const [id, k] of [['#optPtt', 'ptt'], ['#optLer', 'ler'], ['#optBipe', 'bipe']]) $(id).addEventListener('change', (e) => { estado.opcoes[k] = e.target.checked; localStorage.setItem('fichaAnestesia.opcoes', JSON.stringify(estado.opcoes)); });
  menu.addEventListener('close', () => {
    const v = menu.returnValue;
    if (v === 'nova') { if (confirm('Começar uma nova ficha? A atual continua salva no aparelho.')) { estado.ficha = novaFicha(); estado.pendentes = []; estado.desfazer = []; salvarLocal(estado.ficha); invalidarPdf(); irPara('dados', false); } }
    if (v === 'exemplo') { estado.ficha = fichaExemplo(); estado.ficha.status = 'rascunho'; salvarLocal(estado.ficha); invalidarPdf(); irPara('registro', false); toast('Exemplo fictício carregado'); }
    if (v === 'importar') $('#arquivoJson').click();
    if (v === 'abrir') abrirFichas();
  });
  $('#arquivoJson').addEventListener('change', async (e) => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); if (!j.paciente || !j.drogas) throw new Error('formato'); estado.ficha = j; salvarLocal(j); invalidarPdf(); irPara('revisao', false); toast('Ficha importada'); } catch { toast('Arquivo inválido', true); } e.target.value = ''; });
  $('#listaFichas').addEventListener('click', (e) => { const b = e.target.closest('button[data-id]'); if (!b) return; e.preventDefault(); const todas = carregarTodas(); if (b.dataset.op === 'abrir') { estado.ficha = todas[b.dataset.id]; salvarLocal(estado.ficha); invalidarPdf(); $('#dlgFichas').close(); irPara('revisao', false); } else if (confirm('Excluir esta ficha do aparelho?')) { excluirLocal(b.dataset.id); abrirFichas(); } });
  addEventListener('resize', () => { if (estado.etapa === 'registro') renderGrafico(); });
  // instalar PWA
  let promptInstalar = null;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptInstalar = e; $('#btnInstalar').hidden = false; });
  $('#btnInstalar').addEventListener('click', async () => { if (!promptInstalar) return; promptInstalar.prompt(); await promptInstalar.userChoice; promptInstalar = null; $('#btnInstalar').hidden = true; });
}
function abrirFichas() {
  const todas = Object.values(carregarTodas()).sort((a, b) => (b.atualizadoEm || '').localeCompare(a.atualizadoEm || ''));
  $('#listaFichas').innerHTML = todas.length ? todas.map((f) => `<li><span class="txt"><b>Identificação a preencher à mão</b><br><small>${f.data ? f.data.split('-').reverse().join('/') : ''} · ${esc(f.procedimento.descricao || '')} · ${f.status}</small></span><button class="btn pequeno" data-op="abrir" data-id="${f.id}">Abrir</button><button class="btn-x" data-op="excluir" data-id="${f.id}" aria-label="Excluir">✕</button></li>`).join('') : '<li>Nenhuma ficha salva.</li>';
  $('#dlgFichas').showModal();
}

// ----------------------------------------------------------------- inicialização
function init() {
  const tema = localStorage.getItem('fichaAnestesia.tema') || (matchMedia('(prefers-color-scheme: light)').matches ? 'claro' : 'escuro');
  document.documentElement.dataset.tema = tema;
  montarForm(); ligar();
  if (params.has('demo')) { estado.ficha = fichaExemplo(); if (params.get('demo') !== 'salvo') estado.ficha.status = 'rascunho'; }
  else estado.ficha = carregarAtual() || novaFicha();
  salvarLocal(estado.ficha);
  const avisos = [];
  if (!suportaReconhecimento()) avisos.push('Este navegador não oferece reconhecimento de voz (Web Speech API). Use o Chrome no Android, ou o botão ⌨ Digitar.');
  else if (ehIOS()) avisos.push('iPhone/iPad: o reconhecimento de voz do Safari é parcial (pode parar sozinho e exige toque para reiniciar). Recomendado: Android + Chrome.');
  if (!isSecureContext) avisos.push('Abra por HTTPS (ou localhost) para microfone, instalação e modo offline funcionarem.');
  if (avisos.length) { $('#avisoVoz').hidden = false; $('#avisoVoz').innerHTML = avisos.map(esc).join('<br>'); }
  irPara(params.get('etapa') || 'dados', false);
  if (params.has('pendentes')) processarFrase(params.get('pendentes'), 'texto');
  if ('serviceWorker' in navigator && isSecureContext && !params.has('semsw')) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// API para testes automatizados / depuração
window.fichaApp = {
  get ficha() { return estado.ficha; }, estado, processarFrase, executarComando, irPara,
  pdfBase64: () => gerarPdf(estado.ficha).output('datauristring').split(',')[1],
  carregarExemplo: () => { estado.ficha = fichaExemplo(); render(); },
};
init();
