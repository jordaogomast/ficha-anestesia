import { calcularDerivados } from './parser.js';
// Modelo da ficha de anestesia: criação, aplicação de itens confirmados, validação e persistência.
export const CAMPOS_IDENTIFICACAO_MANUAL = ['nome','dataNascimento','sexo','sexoDireto','prontuario','idade','cpf','documento','atendimento','leito','operadora','registroAns','carteirinha','validadeCarteirinha','numeroGuia','senhaAutorizacao','etiqueta','codigoBarras'];
export const AVISO_IDENTIFICACAO_MANUAL = 'Hospital e dados de identificação, documentos e plano: preencher à mão após imprimir. Esses campos não são registrados por voz ou teclado.';
export const identificacaoManual = it => (it.tipo === 'paciente' && !['pesoKg','alturaCm','asa','alergias'].includes(it.dados.campo)) || (it.tipo === 'procedimento' && it.dados.campo === 'hospital');
export function filtrarIdentificacaoManual(itens) {
 const bloqueados = itens.filter(identificacaoManual);
 return { itens: itens.filter(it => !identificacaoManual(it)), aviso: bloqueados.length ? AVISO_IDENTIFICACAO_MANUAL : null };
}

export const VERSAO_SCHEMA = '1.1.0';
const pad = (n) => String(n).padStart(2, '0');
export const hojeISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const agoraISO = () => new Date().toISOString();
export const novoId = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

export function novaFicha() {
  return {
    schemaVersion: VERSAO_SCHEMA,
    id: novoId(),
    status: 'rascunho',
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    salvoEm: null,
    data: hojeISO(),
    paciente: {
      nome: '', dataNascimento: null, sexo: null, pesoKg: null, alturaCm: null,
      asa: { classe: null, emergencia: false }, alergias: '',
      plano: { operadora: '', registroAns: '', carteirinha: '', validadeCarteirinha: null, numeroGuia: '', senhaAutorizacao: '' },
    },
    procedimento: {
      descricao: '', codigoTuss: '', carater: 'eletivo', hospital: '', sala: '',
      cirurgiao: { nome: '', crm: '', uf: '' },
      anestesista: { nome: '', crm: '', uf: '' },
    },
    tecnicaAnestesica: { descricao: '' },
    horarios: { inicioAnestesia: null, inicioCirurgia: null, fimCirurgia: null, fimAnestesia: null },
    drogas: [], sinaisVitais: [], fluidos: [], diurese: [], perdaSanguinea: [], eventos: [], intercorrencias: [],
    observacoes: '',
    anotacoesExtras: { texto: '', frases: [] },
    auditoria: [],
  };
}

// 'HH:MM' -> 'YYYY-MM-DDTHH:MM' (horário local, sem fuso). Se a hora for muito anterior ao início da anestesia, assume dia seguinte.
export function horaParaISO(ficha, hora) {
  if (!hora) return null;
  let data = ficha.data || hojeISO();
  const ini = ficha.horarios && ficha.horarios.inicioAnestesia;
  if (ini && ini.slice(0, 10) === data) {
    const [h, m] = hora.split(':').map(Number); const [hi, mi] = ini.slice(11, 16).split(':').map(Number);
    if (h * 60 + m < hi * 60 + mi - 6 * 60) { const d = new Date(data + 'T12:00'); d.setDate(d.getDate() + 1); data = hojeISO(d); }
  }
  return `${data}T${hora}`;
}
export const horaDeISO = (iso) => (iso ? iso.slice(11, 16) : '');

export function minutos(iso) { return iso ? new Date(iso + (iso.length === 16 ? ':00' : '')).getTime() / 60000 : null; }

// Aplica um item confirmado (vindo do parser ou do editor) à ficha. Retorna descrição do que mudou.
export function aplicarItem(f, item, origem = 'voz') {
  const d = item.dados;
  if (identificacaoManual(item)) return null;
  const id = novoId();
  const base = { id, origem, textoOriginal: item.textoOriginal || item.texto || '' };
  const t = horaParaISO(f, d.hora);
  switch (item.tipo) {
    case 'droga':
      f.drogas.push({ ...base, nome: d.nome, dose: d.dose, unidade: d.unidade, via: d.via, modo: d.modo || 'bolus', horario: t });
      break;
    case 'sinais_vitais': {
      const campos = ['paSistolica', 'paDiastolica', 'pam', 'fc', 'spo2', 'fr', 'temperatura', 'etco2'];
      let amostra = f.sinaisVitais.find((v) => v.horario === t);
      if (!amostra) { amostra = { ...base, horario: t }; f.sinaisVitais.push(amostra); }
      for (const c of campos) if (d[c] != null && !(c === 'pam' && d.pamOrigem !== 'medida')) amostra[c] = d[c];
      if (d.pam != null && d.pamOrigem === 'medida') amostra.pamOrigem = 'medida';
      calcularDerivados(amostra); // PAM (se não medida) e índice de choque com FC e PAS do mesmo horário
      f.sinaisVitais.sort((a, b) => a.horario.localeCompare(b.horario));
      break;
    }
    case 'fluido':
      f.fluidos.push({ ...base, tipo: d.tipo, categoria: d.categoria, volumeMl: d.volumeMl, unidades: d.unidades ?? null, horario: t });
      break;
    case 'diurese': f.diurese.push({ ...base, volumeMl: d.volumeMl, horario: t }); break;
    case 'perda_sanguinea': f.perdaSanguinea.push({ ...base, volumeMl: d.volumeMl, horario: t }); break;
    case 'horario': f.horarios[d.campo] = horaParaISO(f, d.hora); break;
    case 'evento': f.eventos.push({ ...base, descricao: d.descricao, horario: t }); break;
    case 'intercorrencia': f.intercorrencias.push({ ...base, descricao: d.texto, horario: t }); break;
    case 'observacao': f.observacoes = (f.observacoes ? f.observacoes + '\n' : '') + d.texto; break;
    case 'anotacao': adicionarFraseAnotacao(f, d.texto, t); break;
    case 'paciente': {
      const p = f.paciente; const v = d.valor;
      if (['operadora', 'carteirinha', 'numeroGuia', 'senhaAutorizacao'].includes(d.campo)) p.plano[d.campo] = v;
      else if (d.campo === 'asa') p.asa = v; else p[d.campo] = v;
      break;
    }
    case 'procedimento': {
      const p = f.procedimento; const v = d.valor;
      if (d.campo === 'cirurgiao' || d.campo === 'anestesista') p[d.campo].nome = v.nome;
      else if (d.campo === 'crm') { const pessoa = d.pessoa || 'anestesista'; p[pessoa].crm = v.crm; if (v.uf) p[pessoa].uf = v.uf; }
      else p[d.campo] = v;
      break;
    }
    case 'tecnica': f.tecnicaAnestesica.descricao = d.valor; break;
    default: throw new Error('Tipo desconhecido: ' + item.tipo);
  }
  f.atualizadoEm = agoraISO();
  f.auditoria.push({ em: agoraISO(), acao: 'adicionar', tipo: item.tipo, origem, texto: base.textoOriginal });
  return id;
}

export function adicionarFraseAnotacao(f, texto, horario) {
  const tx = String(texto || '').trim(); if (!tx) return;
  const frase = tx.charAt(0).toUpperCase() + tx.slice(1);
  f.anotacoesExtras.frases.push({ texto: frase, horario: horario || null });
  const sep = f.anotacoesExtras.texto && !/[.!?]\s*$/.test(f.anotacoesExtras.texto) ? '. ' : (f.anotacoesExtras.texto ? ' ' : '');
  f.anotacoesExtras.texto = (f.anotacoesExtras.texto + sep + frase).trim();
}
export function apagarUltimaFrase(f) {
  const fr = f.anotacoesExtras.frases.pop(); if (!fr) return null;
  const t = f.anotacoesExtras.texto; const i = t.lastIndexOf(fr.texto);
  f.anotacoesExtras.texto = (i >= 0 ? t.slice(0, i) : t).replace(/[.\s]+$/, (m) => (m.includes('.') ? '.' : '')).trim();
  if (f.anotacoesExtras.texto === '.') f.anotacoesExtras.texto = '';
  return fr;
}

export function removerRegistro(f, colecao, id) {
  const i = f[colecao].findIndex((x) => x.id === id); if (i < 0) return false;
  f[colecao].splice(i, 1); f.atualizadoEm = agoraISO();
  f.auditoria.push({ em: agoraISO(), acao: 'remover', tipo: colecao, id });
  return true;
}

// Pendências para faturamento (TISS) e completude clínica
export function pendencias(f) {
  const p = [];
  const req = (cond, msg) => { if (!cond) p.push(msg); };
  req(f.procedimento.descricao, 'Procedimento');
  req(f.procedimento.anestesista.nome, 'Nome do anestesista');
  req(f.procedimento.anestesista.crm, 'CRM do anestesista');
  req(f.tecnicaAnestesica.descricao, 'Técnica anestésica');
  req(f.paciente.asa && f.paciente.asa.classe, 'Classificação ASA');
  req(f.horarios.inicioAnestesia, 'Início da anestesia');
  req(f.horarios.fimAnestesia, 'Fim da anestesia');
  req(f.horarios.inicioCirurgia, 'Início da cirurgia');
  req(f.horarios.fimCirurgia, 'Fim da cirurgia');
  req(f.sinaisVitais.length, 'Ao menos um registro de sinais vitais');
  const h = f.horarios;
  if (h.inicioAnestesia && h.fimAnestesia && h.fimAnestesia < h.inicioAnestesia) p.push('Fim da anestesia antes do início');
  if (h.inicioCirurgia && h.fimCirurgia && h.fimCirurgia < h.inicioCirurgia) p.push('Fim da cirurgia antes do início');
  return p;
}

export function totais(f) {
  const soma = (arr, filtro = () => true) => arr.filter(filtro).reduce((s, x) => s + (Number(x.volumeMl) || 0), 0);
  return {
    cristaloides: soma(f.fluidos, (x) => x.categoria === 'cristaloide'),
    coloides: soma(f.fluidos, (x) => x.categoria === 'coloide'),
    hemoderivados: soma(f.fluidos, (x) => x.categoria === 'hemoderivado'),
    diurese: soma(f.diurese),
    perdaSanguinea: soma(f.perdaSanguinea),
  };
}

export function duracaoMin(ini, fim) { if (!ini || !fim) return null; return Math.round(minutos(fim) - minutos(ini)); }
export function idade(f) {
  const n = f.paciente.dataNascimento; if (!n) return null;
  const ref = new Date((f.data || hojeISO()) + 'T12:00'); const d = new Date(n + 'T12:00');
  let a = ref.getFullYear() - d.getFullYear(); if (ref.getMonth() < d.getMonth() || (ref.getMonth() === d.getMonth() && ref.getDate() < d.getDate())) a--;
  return a;
}

// ---------- persistência local (localStorage)
const CHAVE = 'fichaAnestesia.v1';
export function carregarTodas(storage = globalThis.localStorage) {
  try { return JSON.parse(storage.getItem(CHAVE) || '{}'); } catch { return {}; }
}
export function salvarLocal(f, storage = globalThis.localStorage, status) {
  const todas = carregarTodas(storage);
  if (status) f.status = status;
  if (status === 'salvo') { f.salvoEm = agoraISO(); f.auditoria.push({ em: f.salvoEm, acao: 'salvar' }); }
  todas[f.id] = f;
  storage.setItem(CHAVE, JSON.stringify(todas));
  storage.setItem(CHAVE + '.atual', f.id);
}
export function carregarAtual(storage = globalThis.localStorage) {
  const id = storage.getItem(CHAVE + '.atual'); const todas = carregarTodas(storage);
  return id && todas[id] ? todas[id] : null;
}
export function excluirLocal(id, storage = globalThis.localStorage) {
  const todas = carregarTodas(storage); delete todas[id]; storage.setItem(CHAVE, JSON.stringify(todas));
}
