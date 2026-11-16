// Parser de comandos de voz/texto em pt-BR para a ficha de anestesia.
// Puro JavaScript (ES module), sem dependências: roda no navegador e no Node (testes).
import { DROGAS, FLUIDOS } from './drogas.js';

// ---------------------------------------------------------------- normalização
export function semAcento(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const UNID = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9 };
const TEENS = { dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
const DEZENAS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, cincoenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const CENTENAS = { cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900 };
const ehPalavraNumero = (t) => t in UNID || t in TEENS || t in DEZENAS || t in CENTENAS || t === 'cem' || t === 'mil';

// Lê um "bloco" < 1000 a partir de tokens[i]. Respeita a gramática do português:
// centena [e dezena [e unidade]] ; dezena [e unidade] ; "dez e quinze" NÃO vira 25.
function lerBloco(tk, i) {
  let v = 0; let j = i; let leu = false;
  const lerDezena = () => {
    const t = tk[j];
    if (t in DEZENAS) {
      v += DEZENAS[t]; j++; leu = true;
      if (tk[j] === 'e' && tk[j + 1] in UNID && tk[j + 1] !== 'zero') { v += UNID[tk[j + 1]]; j += 2; }
      return true;
    }
    if (t in TEENS) { v += TEENS[t]; j++; leu = true; return true; }
    if (t in UNID) { v += UNID[t]; j++; leu = true; return true; }
    return false;
  };
  const t = tk[j];
  if (t === 'cem') { return { v: 100, j: j + 1 }; }
  if (t in CENTENAS) {
    v = CENTENAS[t]; j++; leu = true;
    if (tk[j] === 'e' && tk[j + 1] && (tk[j + 1] in DEZENAS || tk[j + 1] in TEENS || tk[j + 1] in UNID)) { j++; lerDezena(); }
    return { v, j };
  }
  if (lerDezena()) return { v, j };
  return leu ? { v, j } : null;
}

function lerNumero(tk, i) {
  let b = lerBloco(tk, i);
  let v; let j;
  if (b) { v = b.v; j = b.j; } else if (tk[i] === 'mil') { v = 1; j = i; } else return null;
  if (tk[j] === 'mil') {
    v = v * 1000; j++;
    if (tk[j] === 'e' && tk[j + 1] && ehPalavraNumero(tk[j + 1]) && tk[j + 1] !== 'mil') { const b2 = lerBloco(tk, j + 1); if (b2) { v += b2.v; j = b2.j; } }
    else if (tk[j] in CENTENAS) { const b2 = lerBloco(tk, j); if (b2) { v += b2.v; j = b2.j; } }
  }
  return { v, j };
}

export function palavrasParaNumeros(texto) {
  const tk = texto.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < tk.length;) {
    if (ehPalavraNumero(tk[i])) {
      const r = lerNumero(tk, i);
      if (r && r.j > i) { out.push(String(r.v)); i = r.j; continue; }
    }
    out.push(tk[i]); i++;
  }
  return out.join(' ');
}

export function normalizar(texto) {
  let s = semAcento(String(texto || '').toLowerCase());
  s = s.replace(/µg|μg/g, ' mcg ');
  s = s.replace(/[“”"'!?;]/g, ' ');
  s = s.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2');          // 1.000 -> 1000
  s = s.replace(/(\d),(\d)/g, '$1.$2');                     // 36,5 -> 36.5
  s = s.replace(/(\d)\s*x\s*(\d)/g, '$1 por $2');           // 120x80
  s = s.replace(/(?<![\d/])(\d{2,3})\s*\/\s*(\d{2,3})(?![\d/])/g, '$1 por $2'); // 120/80 (não mexe em datas dd/mm/aaaa)
  s = s.replace(/[,]/g, ' , ').replace(/\.(?!\d)/g, ' . ');
  s = s.replace(/-/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/\bpor\s+cento\b/g, '%');
  s = palavrasParaNumeros(s);
  s = s.replace(/(\d+) (?:virgula|ponto) (\d+)/g, '$1.$2');
  s = s.replace(/\b(\d+) e meio\b/g, (m, a) => String(Number(a) + 0.5));
  s = s.replace(/\bmeio (miligrama|grama|micrograma|mililitro|litro)/g, '0.5 $1');
  s = s.replace(/(\d)\s*por\s*cento\b/g, '$1%');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// ---------------------------------------------------------------- horário
const pad = (n) => String(n).padStart(2, '0');
export function horaDe(date) { return `${pad(date.getHours())}:${pad(date.getMinutes())}`; }
function horaValida(h, m) { return h >= 0 && h <= 23 && m >= 0 && m <= 59; }

// Extrai um horário do trecho; retorna { hora: 'HH:MM', resto } ou null.
export function extrairHorario(trecho, agora = new Date()) {
  const padroes = [
    // "as 10 e meia"
    { re: /\b(?:as|a|ha|desde as|a partir das)?\s*(\d{1,2}) e meia\b/, f: (m) => [m[1], 30] },
    // "as 10:15", "10h15", "10 h 15", "as 10 horas e 15 minutos", "as 10 e 15"
    { re: /\b(\d{1,2})\s*:\s*(\d{2})\b/, f: (m) => [m[1], m[2]] },
    { re: /\b(\d{1,2})\s*h\s*(\d{2})\b/, f: (m) => [m[1], m[2]] },
    { re: /\b(?:as|a)\s+(\d{1,2})\s+horas?(?:\s+e\s+(\d{1,2})(?:\s+minutos?)?)?\b/, f: (m) => [m[1], m[2] || 0] },
    { re: /\b(?:as|a)\s+(\d{1,2})\s+e\s+(\d{1,2})(?:\s+minutos?)?\b/, f: (m) => [m[1], m[2]] },
    { re: /\b(\d{1,2})\s*h\b/, f: (m) => [m[1], 0] },
    { re: /\b(?:as|a)\s+(\d{1,2})\b(?!\s*(?:mg|mcg|ml|g|%|ui|kg|unidades?|miligramas?|microgramas?|gramas?|mililitros?|litros?))/, f: (m) => [m[1], 0] },
  ];
  // relativo: "ha 5 minutos"
  const rel = trecho.match(/\bha\s+(\d{1,3})\s+minutos?\b/);
  if (rel) {
    const d = new Date(agora.getTime() - Number(rel[1]) * 60000);
    return { hora: horaDe(d), resto: trecho.replace(rel[0], ' '), relativo: true };
  }
  for (const p of padroes) {
    const m = trecho.match(p.re);
    if (m) {
      const [h, mi] = p.f(m).map(Number);
      if (horaValida(h, mi)) return { hora: `${pad(h)}:${pad(mi)}`, resto: trecho.replace(m[0], ' ') };
    }
  }
  if (/\bagora\b/.test(trecho)) return { hora: horaDe(agora), resto: trecho.replace(/\bagora\b/, ' '), agora: true };
  return null;
}

// ---------------------------------------------------------------- vocabulário
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
const VIAS = [
  ['EV', ['endovenosa', 'endovenoso', 'intravenosa', 'intravenoso', 'venosa', 'venoso', 'na veia', 'ev', 'iv', 'e v', 'i v']],
  ['IM', ['intramuscular', 'im', 'muscular']],
  ['SC', ['subcutanea', 'subcutaneo', 'sc', 'sub cutaneo']],
  ['VO', ['via oral', 'oral', 'vo']],
  ['SL', ['sublingual']],
  ['INALATÓRIA', ['inalatoria', 'inalatorio', 'inalado', 'inalada', 'inalacao']],
  ['INTRATECAL', ['intratecal', 'subaracnoidea', 'subaracnoideo', 'raquidiana', 'raqui', 'espinhal']],
  ['PERIDURAL', ['peridural', 'epidural']],
  ['PERINEURAL', ['perineural', 'no bloqueio', 'bloqueio', 'no plexo']],
  ['INFILTRAÇÃO', ['infiltracao', 'infiltrado', 'local', 'subcutaneo local']],
  ['INTRANASAL', ['intranasal', 'nasal']],
  ['TÓPICA', ['topica', 'topico', 'spray']],
];

// unidades (ordem importa: as mais longas primeiro)
const UNIDADES = [
  ['mcg/kg/min', ['microgramas? por quilo por minuto', 'mcg por kg por minuto', 'mcg por quilo por minuto', 'mcg/kg/min', 'gamas? por quilo por minuto', 'micrograma por kg por minuto', 'microgramas por kg por minuto']],
  ['mcg/kg/h', ['microgramas? por quilo por hora', 'mcg por kg por hora', 'mcg por quilo por hora', 'mcg/kg/h', 'microgramas? por kg por hora']],
  ['mg/kg/h', ['miligramas? por quilo por hora', 'mg por kg por hora', 'mg por quilo por hora', 'mg/kg/h', 'miligramas? por kg por hora']],
  ['mcg/min', ['microgramas? por minuto', 'mcg por minuto', 'mcg/min']],
  ['mg/h', ['miligramas? por hora', 'mg por hora', 'mg/h']],
  ['mL/h', ['mililitros? por hora', 'ml por hora', 'ml/h']],
  ['L/min', ['litros? por minuto', 'l/min', 'l por minuto']],
  ['mcg', ['microgramas?', 'micro gramas?', 'mcg', 'ug', 'gamas?', 'micras?']],
  ['mg', ['miligramas?', 'mili gramas?', 'mg', 'mgs', 'milis?']],
  ['g', ['gramas?', 'g', 'gr']],
  ['mL', ['mililitros?', 'ml', 'mls']],
  ['UI', ['unidades internacionais', 'unidades?', 'ui', 'u']],
  ['mEq', ['miliequivalentes?', 'meq']],
  ['%', ['%']],
];
const RE_UNIDADES = UNIDADES.map(([u, ls]) => [u, new RegExp(`^\\s*(?:${ls.map((x) => x.replace(/ /g, '\\s+').replace(/\//g, '\\/')).join('|')})(?![a-z0-9])`)]);

function viaDe(trecho) {
  for (const [via, ls] of VIAS) {
    for (const l of ls) {
      const re = new RegExp(`(?<![a-z0-9])(?:via\\s+)?${esc(l)}(?![a-z0-9])`);
      if (re.test(trecho)) return via;
    }
  }
  return null;
}

// ---------------------------------------------------------------- palavras-chave de segmentação
// Cada entrada: [tipo, campo, frases]
const CHAVES = [];
const add = (tipo, campo, frases, extra = {}) => CHAVES.push({ tipo, campo, frases, ...extra });

for (const d of DROGAS) add('droga', d.nome, d.sinonimos, { droga: d });
for (const f of FLUIDOS) add('fluido', f.tipo, f.sinonimos, { fluido: f });
add('vital', 'pa', ['pressao arterial', 'pressao', 'pa', 'p a', 'pas']);
add('vital', 'pam', ['pressao arterial media', 'pressao media', 'pam']);
add('vital', 'fc', ['frequencia cardiaca', 'freq cardiaca', 'fc', 'f c', 'pulso', 'batimentos', 'frequencia']);
add('vital', 'spo2', ['saturacao de oxigenio', 'saturacao', 'saturando', 'sat', 'spo2', 'sp o2', 'oximetria', 'spo 2', 'sp o 2']);
add('vital', 'fr', ['frequencia respiratoria', 'freq respiratoria', 'fr', 'f r', 'respiracao']);
add('vital', 'temperatura', ['temperatura', 'temp', 'tax']);
add('vital', 'etco2', ['etco2', 'et co2', 'etco 2', 'et co 2', 'capnografia', 'capnometria', 'capno', 'co2 expirado', 'co2', 'co 2']);
add('diurese', 'diurese', ['diurese', 'debito urinario', 'urina']);
add('perda', 'perdaSanguinea', ['perda sanguinea estimada', 'perda sanguinea', 'perda de sangue', 'sangramento', 'sangrou', 'perda estimada']);
add('horario', 'inicioAnestesia', ['inicio da anestesia', 'inicio de anestesia', 'inicio anestesia', 'comeco da anestesia', 'inicio anestesico']);
add('horario', 'fimAnestesia', ['fim da anestesia', 'fim de anestesia', 'final da anestesia', 'termino da anestesia', 'fim anestesia']);
add('horario', 'inicioCirurgia', ['inicio da cirurgia', 'inicio de cirurgia', 'inicio cirurgia', 'inicio do procedimento', 'incisao', 'inicio cirurgico']);
add('horario', 'fimCirurgia', ['fim da cirurgia', 'fim de cirurgia', 'final da cirurgia', 'termino da cirurgia', 'fim do procedimento', 'termino do procedimento', 'fim cirurgia']);
add('evento', 'Entrada em sala', ['entrada em sala', 'entrada na sala', 'paciente em sala', 'chegada em sala', 'chegou na sala']);
add('evento', 'Indução', ['inducao anestesica', 'inducao']);
add('evento', 'Intubação orotraqueal', ['intubacao orotraqueal', 'intubacao', 'intubado', 'intubada', 'iot']);
add('evento', 'Máscara laríngea', ['mascara laringea', 'ml insercao']);
add('evento', 'Punção raquidiana', ['puncao raquidiana', 'puncao lombar', 'raqui realizada']);
add('evento', 'Posicionamento', ['posicionamento', 'posicionado', 'posicionada']);
add('evento', 'Extubação', ['extubacao', 'extubado', 'extubada']);
add('evento', 'Saída de sala (RPA)', ['saida de sala', 'saida da sala', 'encaminhado a rpa', 'encaminhada a rpa', 'para rpa', 'recuperacao pos anestesica']);
add('paciente', 'nome', ['nome do paciente', 'nome da paciente', 'paciente', 'nome']);
add('paciente', 'dataNascimento', ['data de nascimento', 'nascimento', 'nascido em', 'nascida em', 'nasceu em']);
add('paciente', 'sexo', ['sexo']);
add('paciente', 'sexoDireto', ['sexo masculino', 'sexo feminino', 'masculino', 'feminino']);
add('paciente', 'pesoKg', ['peso']);
add('paciente', 'alturaCm', ['altura', 'estatura']);
add('paciente', 'asa', ['asa']);
// Campos reconhecidos somente para orientar o preenchimento manuscrito no app.
for (const [campo, frases] of Object.entries({cpf:['cpf'], documento:['documento','rg','passaporte'], prontuario:['prontuario'], atendimento:['numero do atendimento','atendimento'], leito:['leito'], registroAns:['registro ans'], validadeCarteirinha:['validade da carteirinha'], etiqueta:['etiqueta'], codigoBarras:['codigo de barras']})) add('paciente',campo,frases);
add('paciente', 'carteirinha', ['numero da carteirinha', 'carteirinha', 'carteira do plano', 'numero da carteira', 'matricula do plano', 'matricula']);
add('paciente', 'operadora', ['operadora', 'plano de saude', 'convenio']);
add('paciente', 'numeroGuia', ['numero da guia', 'guia']);
add('paciente', 'senhaAutorizacao', ['senha de autorizacao', 'senha']);
add('paciente', 'alergias', ['alergias', 'alergia', 'alergico a', 'alergica a']);
add('procedimento', 'descricao', ['procedimento', 'cirurgia proposta', 'cirurgia realizada']);
add('procedimento', 'codigoTuss', ['codigo tuss', 'tuss', 'codigo do procedimento']);
add('procedimento', 'cirurgiao', ['cirurgiao', 'cirurgia o', 'cirurgia que']);
add('procedimento', 'anestesista', ['anestesiologista', 'anestesista']);
add('procedimento', 'crm', ['crm']);
add('procedimento', 'hospital', ['hospital', 'clinica']);
add('procedimento', 'sala', ['sala']);
add('procedimento', 'carater', ['carater']);
add('tecnica', 'descricao', ['tecnica anestesica', 'tecnica']);
add('tecnica', 'direta', ['anestesia geral balanceada', 'anestesia geral venosa total', 'anestesia geral inalatoria', 'anestesia geral', 'raquianestesia', 'anestesia raquidiana', 'anestesia peridural', 'peridural continua', 'anestesia combinada', 'sedacao', 'bloqueio de plexo braquial', 'bloqueio periferico', 'anestesia local']);
add('intercorrencia', 'descricao', ['intercorrencia', 'intercorrencias', 'evento adverso', 'complicacao']);
add('observacao', 'texto', ['observacao', 'observacoes', 'obs']);
add('anotacao', 'texto', ['anotacao extra', 'anotacoes extras', 'anotacao']);

const ABSORVENTES = new Set(['intercorrencia', 'observacao', 'anotacao']);
const TEXTO_LIVRE = new Set(['paciente:nome', 'paciente:operadora', 'paciente:alergias', 'procedimento:descricao', 'procedimento:cirurgiao', 'procedimento:anestesista', 'procedimento:hospital', 'tecnica:descricao']);

const CHAVES_RE = [];
for (const c of CHAVES) for (const f of c.frases) CHAVES_RE.push({ ...c, frase: f, re: new RegExp(`(?<![a-z0-9])${esc(f)}(?![a-z0-9])`, 'g') });

function acharChaves(s) {
  const achados = [];
  for (const c of CHAVES_RE) {
    c.re.lastIndex = 0; let m;
    while ((m = c.re.exec(s))) achados.push({ ...c, ini: m.index, fim: m.index + m[0].length });
  }
  achados.sort((a, b) => a.ini - b.ini || (b.fim - b.ini) - (a.fim - a.ini));
  const res = []; let ultimoFim = -1;
  for (const a of achados) { if (a.ini >= ultimoFim) { res.push(a); ultimoFim = a.fim; } }
  return res;
}

// ---------------------------------------------------------------- comandos
export const COMANDOS = [
  ['confirmar_tudo', /^(?:ok\s+)?(?:confirmar|confirma|confirmo)\s+(?:tudo|todos|todas)$/],
  ['confirmar', /^(?:ok\s+)?(?:confirmar|confirma|confirmo|confirmado|pode confirmar|ok confirmar|registrar|registra)(?:\s+(?:ultimo|ultima|isso))?$/],
  ['descartar_tudo', /^(?:descartar|descarta|cancelar|cancela|apagar|apaga)\s+(?:tudo|todos|todas|pendentes)$/],
  ['descartar', /^(?:descartar|descarta|cancelar|cancela|rejeitar|errado|descartar ultimo|descarta ultimo)(?:\s+(?:ultimo|ultima|isso))?$/],
  ['apagar_frase', /^(?:apagar|apaga|apague|remover|remove)\s+(?:a\s+)?ultima\s+frase$/],
  ['desfazer', /^(?:desfazer|desfaz|desfaca|desfazer ultimo|voltar atras)$/],
  ['salvar', /^(?:salvar|salva|salve|salvar ficha|salvar a ficha|gravar|grava)(?:\s+(?:ficha|a ficha|tudo))?$/],
  ['proximo', /^(?:proximo|proxima|proxima etapa|proximo passo|avancar|avanca|seguir|finalizar registro|terminar registro|encerrar registro|finalizar|terminei)$/],
  ['voltar', /^(?:voltar|volta|etapa anterior|anterior)$/],
  ['gerar_pdf', /^(?:gerar|gera|gere|criar|cria)\s+(?:o\s+)?pdf$|^imprimir(?: ficha)?$/],
  ['parar', /^(?:parar|pare|para|pausar|pausa)(?:\s+(?:de ouvir|escuta|microfone|gravacao))?$/],
  ['repetir', /^(?:repetir|repete|ler pendentes|o que falta|ler pendente)$/],
];
const RE_CMD_FINAL = /(?:^|\s)(confirmar|confirma|descartar|descarta|salvar|proximo|desfazer)$/;

export function detectarComando(texto) {
  const s = normalizar(texto).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [cmd, re] of COMANDOS) if (re.test(s)) return cmd;
  return null;
}

// ---------------------------------------------------------------- parsing de segmentos
const num = (s) => (s == null ? null : Number(String(s).replace(',', '.')));
const NUM = '(\\d+(?:\\.\\d+)?)';
const limpar = (s) => s.replace(/\s+([.,])/g, '$1').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').replace(/\s+/g, ' ').trim();
const tituloNome = (s) => limpar(s).split(' ').map((w) => (['da', 'de', 'do', 'dos', 'das', 'e'].includes(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');

function lerDoseUnidade(resto) {
  const m = resto.match(new RegExp(`(?<![a-z0-9:])${NUM}(?![:\\d])`));
  if (!m) return null;
  const dose = num(m[1]);
  const depois = resto.slice(m.index + m[0].length);
  for (const [u, re] of RE_UNIDADES) {
    const mu = depois.match(re);
    if (mu) return { dose, unidade: u, fim: m.index + m[0].length + mu[0].length, ini: m.index };
  }
  return { dose, unidade: null, ini: m.index, fim: m.index + m[0].length };
}

function parseDroga(seg, chave, ctx) {
  const d = chave.droga;
  const avisos = [];
  let resto = seg.slice(chave.fim - chave.ini);
  const h = extrairHorario(resto, ctx.agora); if (h) resto = h.resto;
  const du = lerDoseUnidade(resto);
  let via = viaDe(resto);
  let viaPresumida = false; let unidadePresumida = false;
  let dose = du ? du.dose : null; let unidade = du ? du.unidade : null;
  if (dose == null) avisos.push('Dose não identificada');
  if (dose != null && !unidade) { unidade = d.unidadePadrao; unidadePresumida = true; avisos.push(`Unidade presumida (${unidade})`); }
  if (!via) { via = d.viaPadrao; viaPresumida = true; }
  const infusao = /\b(infusao|bomba|continua|continuo|em bic|bic)\b/.test(resto) || /\/(min|h)$/.test(unidade || '') || via === 'INALATÓRIA';
  if (d.doseAlerta && dose != null && unidade === d.unidadePadrao && dose > d.doseAlerta) avisos.push(`Dose acima do limite de plausibilidade (${d.doseAlerta} ${d.unidadePadrao}) — confira`);
  return {
    tipo: 'droga',
    dados: { nome: d.nome, dose, unidade, via, modo: infusao ? 'infusao' : 'bolus', hora: h ? h.hora : null },
    flags: { viaPresumida, unidadePresumida, horaPresumida: !h },
    avisos,
  };
}

function lerVolumeMl(resto) {
  const m = resto.match(new RegExp(`${NUM}\\s*(ml|mililitros?|mls|litros?|l|cc)?(?![a-z0-9])`));
  if (!m) return null;
  let v = num(m[1]);
  if (m[2] && /^l/.test(m[2])) v = v * 1000;
  return { v, explicito: !!m[2], ini: m.index, fim: m.index + m[0].length };
}

function parseFluido(seg, chave, ctx) {
  const f = chave.fluido; const avisos = [];
  let resto = seg.slice(chave.fim - chave.ini);
  const h = extrairHorario(resto, ctx.agora); if (h) resto = h.resto;
  let unidades = null;
  const mu = resto.match(new RegExp(`${NUM}\\s*(?:unidades?|bolsas?|u)(?![a-z])`));
  if (mu) { unidades = num(mu[1]); resto = resto.replace(mu[0], ' '); }
  const vol = lerVolumeMl(resto);
  const volumeMl = vol ? vol.v : null;
  if (volumeMl == null && unidades == null) avisos.push('Volume não identificado');
  if (vol && !vol.explicito && vol.v < 20) avisos.push('Volume muito baixo — confira a unidade');
  return { tipo: 'fluido', dados: { tipo: f.tipo, categoria: f.categoria, volumeMl, unidades, hora: h ? h.hora : null }, flags: { horaPresumida: !h }, avisos };
}

function parseVolumeSimples(tipo, seg, chave, ctx) {
  let resto = seg.slice(chave.fim - chave.ini);
  const h = extrairHorario(resto, ctx.agora); if (h) resto = h.resto;
  const vol = lerVolumeMl(resto);
  const avisos = vol ? [] : ['Volume não identificado'];
  const acumulado = /\b(total|acumulad[oa])\b/.test(resto);
  return { tipo, dados: { volumeMl: vol ? vol.v : null, acumulado, hora: h ? h.hora : null }, flags: { horaPresumida: !h }, avisos };
}

function parseVitalCampo(campo, resto) {
  if (campo === 'pa') {
    const m = resto.match(new RegExp(`${NUM}\\s*(?:por|sobre|com|e|x|/)\\s*${NUM}`));
    if (m) {
      const r = { paSistolica: num(m[1]), paDiastolica: num(m[2]) };
      const mm = resto.match(new RegExp(`(?:media|pam)\\s*(?:de)?\\s*${NUM}`)); if (mm) r.pam = num(mm[1]);
      const mmP = resto.match(new RegExp(`\\(\\s*${NUM}\\s*\\)`)); if (!r.pam && mmP) r.pam = num(mmP[1]);
      return r;
    }
    const m1 = resto.match(new RegExp(`${NUM}`));
    return m1 ? { paSistolica: num(m1[1]) } : {};
  }
  const m = resto.match(new RegExp(`${NUM}`));
  if (!m) return {};
  const v = num(m[1]);
  const mapa = { pam: 'pam', fc: 'fc', spo2: 'spo2', fr: 'fr', temperatura: 'temperatura', etco2: 'etco2' };
  return { [mapa[campo]]: v };
}

// ---------------------------------------------------------------- valores derivados (calculados automaticamente)
// PAM = (PAS + 2×PAD) / 3, arredondada ao inteiro — só se a PAM não foi medida/falada.
// Índice de choque (IC) = FC ÷ PAS, 2 casas — só com FC e PAS do mesmo registro e PAS > 0.
export const LIMIAR_IC = 1.0;
export function calcularDerivados(v) {
  if (!v) return v;
  const pas = v.paSistolica; const pad = v.paDiastolica; const fc = v.fc;
  if (v.pamOrigem !== 'medida') {
    if (pas != null && pad != null && Number.isFinite(pas) && Number.isFinite(pad)) { v.pam = Math.round((pas + 2 * pad) / 3); v.pamOrigem = 'calculada'; }
    else { delete v.pam; delete v.pamOrigem; }
  }
  if (fc != null && pas != null && Number.isFinite(fc) && Number.isFinite(pas) && pas > 0) v.ic = Math.round((fc / pas) * 100) / 100;
  else delete v.ic;
  return v;
}
export const formatarIC = (ic) => (ic == null ? null : ic.toFixed(2).replace('.', ','));
export const icAlto = (ic) => ic != null && ic >= LIMIAR_IC;
const AVISO_IC = 'Índice de choque ≥ 1,0 (informativo, não é orientação clínica)';
export function avisosDerivados(v) { return icAlto(v.ic) ? [AVISO_IC] : []; }

const FAIXAS = { paSistolica: [40, 300], paDiastolica: [15, 200], pam: [20, 250], fc: [20, 250], spo2: [50, 100], fr: [0, 60], temperatura: [30, 43], etco2: [5, 100] };
export const ROTULO_VITAL = { ic: 'IC', paSistolica: 'PAS', paDiastolica: 'PAD', pam: 'PAM', fc: 'FC', spo2: 'SpO2', fr: 'FR', temperatura: 'Temp', etco2: 'EtCO2' };

function validarVitais(v) {
  const avisos = [];
  for (const [k, [a, b]] of Object.entries(FAIXAS)) if (v[k] != null && (v[k] < a || v[k] > b)) avisos.push(`${ROTULO_VITAL[k]} = ${v[k]} fora da faixa plausível (${a}–${b})`);
  if (v.paSistolica != null && v.paDiastolica != null && v.paDiastolica >= v.paSistolica) avisos.push('PAD maior ou igual à PAS — confira');
  return avisos;
}

const MESES = { janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
export function lerData(s) {
  let m = s.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2,4})/);
  let d; let mes; let a;
  if (m) { [d, mes, a] = [m[1], m[2], m[3]].map(Number); }
  else {
    m = s.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
    if (m && MESES[m[2]]) { d = Number(m[1]); mes = MESES[m[2]]; a = Number(m[3]); }
    else {
      m = s.match(/\b(\d{1,2})\s+(\d{1,2})\s+(\d{4})\b/);
      if (m) [d, mes, a] = [m[1], m[2], m[3]].map(Number); else return null;
    }
  }
  if (a < 100) a += a > 30 ? 1900 : 2000;
  if (mes < 1 || mes > 12 || d < 1 || d > 31) return null;
  return `${a}-${pad(mes)}-${pad(d)}`;
}

function parseCampoTexto(tipo, campo, seg, chave) {
  let resto = seg.slice(chave.fim - chave.ini).replace(/^\s*(?:e|eh|é|:|de|do|da|e o|a|o)\s+/, ' ');
  const avisos = [];
  let valor = null;
  switch (`${tipo}:${campo}`) {
    case 'paciente:nome': valor = tituloNome(resto); break;
    case 'paciente:operadora': valor = tituloNome(resto); break;
    case 'paciente:alergias': valor = limpar(resto); break;
    case 'paciente:dataNascimento': valor = lerData(resto); if (!valor) avisos.push('Data não reconhecida (use dia/mês/ano)'); break;
    case 'paciente:sexo': valor = /femin/.test(resto) ? 'F' : /mascul/.test(resto) ? 'M' : null; break;
    case 'paciente:sexoDireto': return { tipo: 'paciente', dados: { campo: 'sexo', valor: /femin/.test(chave.frase) ? 'F' : 'M' }, avisos: [] };
    case 'paciente:pesoKg': { const m = resto.match(new RegExp(NUM)); valor = m ? num(m[1]) : null; if (/\bgramas?\b/.test(resto) && !/quilo|kg/.test(resto) && valor > 500) valor = valor / 1000; break; }
    case 'paciente:alturaCm': {
      const m2 = resto.match(/(\d)\s*(?:metros?|m)?\s*e\s*(\d{1,2})/);
      if (m2) valor = Number(m2[1]) * 100 + Number(m2[2]);
      else { const m = resto.match(new RegExp(NUM)); valor = m ? num(m[1]) : null; if (valor != null && valor < 3) valor = Math.round(valor * 100); }
      break;
    }
    case 'paciente:asa': {
      const m = resto.match(/^\s*(?:classe\s+)?(vi|iv|v|i{1,3}|[1-6])\s*(e\b|emergencia|urgencia)?/);
      if (m) {
        const romanos = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 };
        const classe = romanos[m[1]] || Number(m[1]);
        valor = { classe, emergencia: !!m[2] };
      } else avisos.push('Classe ASA não reconhecida');
      break;
    }
    case 'paciente:carteirinha': case 'paciente:numeroGuia': case 'paciente:senhaAutorizacao': case 'procedimento:codigoTuss': {
      valor = resto.replace(/\b(numero|e|eh|:)\b/g, ' ').replace(/[^0-9a-z]/g, '').toUpperCase() || null;
      if (!valor) avisos.push('Número não identificado');
      break;
    }
    case 'procedimento:descricao': valor = limpar(resto); valor = valor.charAt(0).toUpperCase() + valor.slice(1); break;
    case 'procedimento:cirurgiao': case 'procedimento:anestesista': {
      let r = resto.replace(/\b(doutor|doutora|dr|dra)\b\.?/g, ' ');
      valor = { nome: tituloNome(r) };
      break;
    }
    case 'procedimento:crm': {
      const m = resto.match(/(\d[\d\s]*)\s*(?:([a-z]{2})\b)?/);
      valor = m ? { crm: m[1].replace(/\s/g, ''), uf: m[2] ? m[2].toUpperCase() : null } : null;
      if (!valor) avisos.push('CRM não identificado');
      break;
    }
    case 'procedimento:hospital': valor = tituloNome(resto); break;
    case 'procedimento:sala': valor = limpar(resto).toUpperCase(); break;
    case 'procedimento:carater': valor = /urg|emerg/.test(resto) ? 'urgência' : 'eletivo'; break;
    case 'tecnica:descricao': valor = limpar(resto); valor = valor.charAt(0).toUpperCase() + valor.slice(1); break;
    case 'tecnica:direta': { const t = limpar(seg); valor = t.charAt(0).toUpperCase() + t.slice(1); return { tipo: 'tecnica', dados: { campo: 'descricao', valor }, avisos: [] }; }
    default: valor = limpar(resto);
  }
  if (valor == null || valor === '') avisos.push('Valor não identificado');
  return { tipo, dados: { campo, valor }, avisos };
}

// ---------------------------------------------------------------- API principal
/**
 * Analisa uma frase (transcrição de voz ou texto digitado).
 * @returns {{ comando: string|null, itens: Array, naoReconhecido: string|null, normalizado: string }}
 */
export function analisar(texto, opcoes = {}) {
  const agora = opcoes.agora || new Date();
  const ctx = { agora };
  const original = String(texto || '').trim();
  const cmd = detectarComando(original);
  if (cmd) return { comando: cmd, itens: [], naoReconhecido: null, normalizado: normalizar(original) };

  let s = normalizar(original);
  let comandoFinal = null;
  const mf = s.replace(/[.,]\s*$/, '').trim().match(RE_CMD_FINAL);
  if (mf) { comandoFinal = detectarComando(mf[1]); s = s.replace(/[.,]?\s*$/, '').trim().slice(0, -mf[1].length).trim(); }

  const chaves = acharChaves(s);
  const itens = [];
  let horaGlobal = null;
  const prefixo = chaves.length ? s.slice(0, chaves[0].ini) : s;
  const hg = extrairHorario(prefixo, agora); if (hg) horaGlobal = hg.hora;

  let vitalAtual = null; let ultimaPessoa = null;
  for (let k = 0; k < chaves.length; k++) {
    const c = chaves[k];
    if (ABSORVENTES.has(c.tipo)) {
      // consome o restante da frase como texto livre (preserva o texto original com acentos quando possível)
      const resto = limpar(s.slice(c.fim));
      const hora = extrairHorario(resto, agora);
      let textoLivre = limparTextoLivre(original, c.frase) || resto;
      if (hora) textoLivre = textoLivre.replace(/(?:^|\s|,)\s*(?:às|as|a)\s+\d{1,2}\s*(?::|h)\s*\d{2}\b\s*[,:]?/i, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
      itens.push({ tipo: c.tipo, dados: { texto: textoLivre, hora: hora ? hora.hora : null }, flags: { horaPresumida: !hora }, avisos: textoLivre ? [] : ['Texto vazio'], texto: s.slice(c.ini) });
      vitalAtual = null;
      break;
    }
    // alguns campos de texto livre engolem palavras-chave que viriam depois
    let prox = k + 1;
    if (c.tipo === 'paciente' && c.campo === 'alergias') prox = chaves.length;
    if (c.tipo === 'tecnica' && c.campo === 'descricao') prox = chaves.length;
    const fimSeg = prox < chaves.length ? chaves[prox].ini : s.length;
    const seg = s.slice(c.ini, fimSeg);
    let item = null;
    if (c.tipo === 'vital') {
      let resto = seg.slice(c.fim - c.ini);
      const h = extrairHorario(resto, agora); if (h) resto = h.resto;
      const v = parseVitalCampo(c.campo, resto);
      if (!vitalAtual) { vitalAtual = { tipo: 'sinais_vitais', dados: { hora: null }, flags: { horaPresumida: true }, avisos: [], texto: '' }; itens.push(vitalAtual); }
      Object.assign(vitalAtual.dados, v);
      if (v.pam != null) vitalAtual.dados.pamOrigem = 'medida';
      if (h) { vitalAtual.dados.hora = h.hora; vitalAtual.flags.horaPresumida = false; }
      vitalAtual.texto = (vitalAtual.texto + ' ' + seg).trim();
      if (!Object.keys(v).length) vitalAtual.avisos.push(`Valor de ${c.frase.toUpperCase()} não identificado`);
      continue;
    }
    vitalAtual = null;
    if (c.tipo === 'droga') item = parseDroga(seg, c, ctx);
    else if (c.tipo === 'fluido') item = parseFluido(seg, c, ctx);
    else if (c.tipo === 'diurese') item = parseVolumeSimples('diurese', seg, c, ctx);
    else if (c.tipo === 'perda') item = parseVolumeSimples('perda_sanguinea', seg, c, ctx);
    else if (c.tipo === 'horario') {
      const h = extrairHorario(seg.slice(c.fim - c.ini), agora);
      item = { tipo: 'horario', dados: { campo: c.campo, hora: h ? h.hora : horaDe(agora) }, flags: { horaPresumida: !h }, avisos: h ? [] : ['Horário não falado — usado o horário atual'] };
    } else if (c.tipo === 'evento') {
      const h = extrairHorario(seg.slice(c.fim - c.ini), agora);
      item = { tipo: 'evento', dados: { descricao: c.campo, hora: h ? h.hora : null }, flags: { horaPresumida: !h }, avisos: [] };
    } else if (c.tipo === 'procedimento' && c.campo === 'crm') {
      item = parseCampoTexto(c.tipo, c.campo, seg, c);
      item.dados.pessoa = ultimaPessoa || 'anestesista';
    } else {
      item = parseCampoTexto(c.tipo, c.campo, seg, c);
      if (c.tipo === 'procedimento' && (c.campo === 'cirurgiao' || c.campo === 'anestesista')) ultimaPessoa = c.campo;
    }
    if (item) { item.texto = seg.trim(); itens.push(item); }
    k = prox - 1;
  }

  // se a frase tem um único horário explícito, ele vale para os itens sem horário
  const explicitas = [...new Set(itens.filter((it) => it.dados.hora && it.flags && !it.flags.horaPresumida).map((it) => it.dados.hora))];
  if (!horaGlobal && explicitas.length === 1) horaGlobal = explicitas[0];
  for (const it of itens) {
    if (it.tipo === 'sinais_vitais') { calcularDerivados(it.dados); it.avisos.push(...validarVitais(it.dados), ...avisosDerivados(it.dados)); }
    if ('hora' in it.dados && !it.dados.hora) {
      it.dados.hora = horaGlobal || horaDe(agora);
      if (horaGlobal) it.flags.horaPresumida = false;
    }
  }
  const mapa = mapaAcentos(original);
  for (const it of itens) {
    if (['paciente', 'procedimento', 'tecnica'].includes(it.tipo) && it.dados.valor) {
      if (typeof it.dados.valor === 'string' && !['dataNascimento', 'sexo', 'carteirinha', 'numeroGuia', 'senhaAutorizacao', 'codigoTuss', 'sala'].includes(it.dados.campo)) it.dados.valor = restaurarAcentos(it.dados.valor, mapa);
      else if (it.dados.valor && it.dados.valor.nome) it.dados.valor.nome = restaurarAcentos(it.dados.valor.nome, mapa);
    }
  }
  const naoReconhecido = itens.length ? null : (s || null);
  return { comando: comandoFinal, itens, naoReconhecido, normalizado: s };
}

function mapaAcentos(original) {
  const m = new Map();
  for (const w of original.split(/[\s,.;:!?()]+/)) { if (w) { const k = semAcento(w.toLowerCase()); if (k !== w.toLowerCase()) m.set(k, w.toLowerCase()); } }
  return m;
}
function restaurarAcentos(valor, mapa) {
  return valor.split(' ').map((w) => {
    const k = semAcento(w.toLowerCase());
    if (!mapa.has(k)) return w;
    const orig = mapa.get(k);
    return w[0] === w[0].toUpperCase() ? orig.charAt(0).toUpperCase() + orig.slice(1) : orig;
  }).join(' ');
}

// Tenta recuperar o texto livre original (com acentos) após a palavra-chave
function limparTextoLivre(original, fraseChave) {
  const o = original; const on = semAcento(o.toLowerCase());
  const re = new RegExp(`(?<![a-z0-9])${esc(fraseChave)}(?![a-z0-9])\\s*[:,-]?\\s*`);
  const m = on.match(re);
  if (!m) return null;
  let t = o.slice(m.index + m[0].length).trim();
  t = t.replace(/\s*[,.]?\s*(confirmar|confirma|salvar)\s*\.?$/i, '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : null;
}

// Descrição curta em pt-BR de um item (para revisão e leitura em voz alta)
export function descreverItem(it) {
  const d = it.dados;
  const fmt = (n) => (n == null ? '?' : String(n).replace('.', ','));
  switch (it.tipo) {
    case 'droga': return `${d.nome} ${fmt(d.dose)} ${d.unidade || ''} ${d.via || ''}${d.modo === 'infusao' ? ' (infusão)' : ''} às ${d.hora}`.replace(/\s+/g, ' ');
    case 'sinais_vitais': {
      const p = [];
      if (d.paSistolica != null) p.push(`PA ${fmt(d.paSistolica)}${d.paDiastolica != null ? 'x' + fmt(d.paDiastolica) : ''}`);
      if (d.pam != null) p.push(`PAM ${fmt(d.pam)}${d.pamOrigem === 'calculada' ? ' (calc.)' : ''}`);
      if (d.fc != null) p.push(`FC ${fmt(d.fc)}`);
      if (d.spo2 != null) p.push(`SpO2 ${fmt(d.spo2)}%`);
      if (d.fr != null) p.push(`FR ${fmt(d.fr)}`);
      if (d.temperatura != null) p.push(`Temp ${fmt(d.temperatura)}°C`);
      if (d.etco2 != null) p.push(`EtCO2 ${fmt(d.etco2)}`);
      if (d.ic != null) p.push(`IC ${formatarIC(d.ic)}${icAlto(d.ic) ? ' ⚠' : ''}`);
      return `${p.join(', ')} às ${d.hora}`;
    }
    case 'fluido': return `${d.tipo}${d.unidades != null ? ' ' + fmt(d.unidades) + ' U' : ''}${d.volumeMl != null ? ' ' + fmt(d.volumeMl) + ' mL' : ''} às ${d.hora}`;
    case 'diurese': return `Diurese ${fmt(d.volumeMl)} mL às ${d.hora}`;
    case 'perda_sanguinea': return `Perda sanguínea ${fmt(d.volumeMl)} mL às ${d.hora}`;
    case 'horario': return `${ROTULO_HORARIO[d.campo]}: ${d.hora}`;
    case 'evento': return `${d.descricao} às ${d.hora}`;
    case 'intercorrencia': return `Intercorrência: ${d.texto}`;
    case 'observacao': return `Observação: ${d.texto}`;
    case 'anotacao': return `Anotação: ${d.texto}`;
    case 'paciente': case 'procedimento': case 'tecnica': {
      let v = d.valor;
      if (d.campo === 'asa' && v) v = `${v.classe}${v.emergencia ? 'E' : ''}`;
      else if (d.campo === 'crm' && v) v = `${v.crm}${v.uf ? '-' + v.uf : ''} (${d.pessoa})`;
      else if (v && typeof v === 'object') v = v.nome;
      return `${ROTULO_CAMPO[d.campo] || d.campo}: ${v ?? '?'}`;
    }
    default: return JSON.stringify(d);
  }
}
export const ROTULO_HORARIO = { inicioAnestesia: 'Início da anestesia', fimAnestesia: 'Fim da anestesia', inicioCirurgia: 'Início da cirurgia', fimCirurgia: 'Fim da cirurgia' };
export const ROTULO_CAMPO = { nome: 'Paciente', dataNascimento: 'Data de nascimento', sexo: 'Sexo', pesoKg: 'Peso (kg)', alturaCm: 'Altura (cm)', asa: 'ASA', carteirinha: 'Carteirinha', operadora: 'Operadora', numeroGuia: 'Nº da guia', senhaAutorizacao: 'Senha de autorização', alergias: 'Alergias', descricao: 'Descrição', codigoTuss: 'Código TUSS', cirurgiao: 'Cirurgião', anestesista: 'Anestesista', crm: 'CRM', hospital: 'Hospital', sala: 'Sala', carater: 'Caráter' };
