import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analisar, normalizar, palavrasParaNumeros, extrairHorario, detectarComando, lerData, descreverItem } from '../src/parser.js';

const AGORA = new Date(2026, 9, 26, 10, 0, 0);
const A = (t) => analisar(t, { agora: AGORA });
const um = (t) => { const r = A(t); assert.equal(r.itens.length, 1, `esperava 1 item em "${t}", veio ${JSON.stringify(r.itens)}`); return r.itens[0]; };

describe('números por extenso', () => {
  const casos = [
    ['cento e cinquenta', '150'], ['duzentos', '200'], ['vinte e cinco', '25'], ['cem', '100'],
    ['mil e quinhentos', '1500'], ['dois mil', '2000'], ['trezentos e vinte e dois', '322'],
    ['dez e quinze', '10 e 15'], ['nove e quarenta e cinco', '9 e 45'], ['quinhentos', '500'], ['setenta e dois', '72'],
  ];
  for (const [e, s] of casos) test(`${e} -> ${s}`, () => assert.equal(palavrasParaNumeros(e), s));
  test('vírgula decimal falada', () => assert.equal(normalizar('trinta e seis vírgula cinco'), '36.5'));
  test('vírgula decimal escrita', () => assert.equal(normalizar('36,5'), '36.5'));
  test('milhar com ponto', () => assert.equal(normalizar('1.000 ml'), '1000 ml'));
});

describe('horários', () => {
  const casos = [
    ['às 10 e 15', '10:15'], ['às 10:15', '10:15'], ['10h15', '10:15'], ['às dez e quinze', '10:15'],
    ['às 10 horas', '10:00'], ['às 10 horas e 5 minutos', '10:05'], ['às 9 e meia', '09:30'], ['11h', '11:00'],
    ['agora', '10:00'], ['há 5 minutos', '09:55'], ['às 7', '07:00'],
  ];
  for (const [t, h] of casos) test(`${t} -> ${h}`, () => assert.equal(extrairHorario(normalizar(t), AGORA).hora, h));
  test('sem horário retorna null', () => assert.equal(extrairHorario(normalizar('propofol 150 mg'), AGORA), null));
  test('não confunde dose com horário', () => assert.equal(extrairHorario(normalizar('a 150 mg'), AGORA), null));
});

describe('drogas', () => {
  const casos = [
    ['propofol 150 miligramas venoso às 10 e 15', { nome: 'Propofol', dose: 150, unidade: 'mg', via: 'EV', hora: '10:15' }],
    ['Propofol 150 mg EV às 10:15', { nome: 'Propofol', dose: 150, unidade: 'mg', via: 'EV', hora: '10:15' }],
    ['propofol cento e cinquenta miligramas endovenoso', { nome: 'Propofol', dose: 150, unidade: 'mg', via: 'EV', hora: '10:00' }],
    ['fentanil 200 microgramas às 10:12', { nome: 'Fentanil', dose: 200, unidade: 'mcg', hora: '10:12' }],
    ['fentanila 100 mcg', { nome: 'Fentanil', dose: 100, unidade: 'mcg' }],
    ['fentanil 50 gamas', { nome: 'Fentanil', dose: 50, unidade: 'mcg' }],
    ['rocurônio 50 mg', { nome: 'Rocurônio', dose: 50, unidade: 'mg' }],
    ['rocuronio 50 mg', { nome: 'Rocurônio', dose: 50, unidade: 'mg' }],
    ['esmeron 40 miligramas', { nome: 'Rocurônio', dose: 40, unidade: 'mg' }],
    ['cetamina 30 mg', { nome: 'Cetamina', dose: 30, unidade: 'mg' }],
    ['ketamina 30 mg', { nome: 'Cetamina', dose: 30 }],
    ['midazolam 2 mg intravenoso', { nome: 'Midazolam', dose: 2, unidade: 'mg', via: 'EV' }],
    ['dormonid 3 mg', { nome: 'Midazolam', dose: 3 }],
    ['dexametasona 4 mg', { nome: 'Dexametasona', dose: 4, unidade: 'mg' }],
    ['decadron 8 miligramas', { nome: 'Dexametasona', dose: 8 }],
    ['ondansetrona 4 mg', { nome: 'Ondansetrona', dose: 4 }],
    ['zofran 8 mg', { nome: 'Ondansetrona', dose: 8 }],
    ['dipirona 2 gramas às dez e meia', { nome: 'Dipirona', dose: 2, unidade: 'g', hora: '10:30' }],
    ['cefazolina 2 g', { nome: 'Cefazolina', dose: 2, unidade: 'g' }],
    ['kefazol 2 gramas', { nome: 'Cefazolina', dose: 2, unidade: 'g' }],
    ['efedrina 10 mg', { nome: 'Efedrina', dose: 10, unidade: 'mg' }],
    ['fenilefrina 100 microgramas', { nome: 'Fenilefrina', dose: 100, unidade: 'mcg' }],
    ['atropina 0,5 mg', { nome: 'Atropina', dose: 0.5, unidade: 'mg' }],
    ['atropina meio miligrama', { nome: 'Atropina', dose: 0.5, unidade: 'mg' }],
    ['sugamadex 200 mg', { nome: 'Sugamadex', dose: 200, unidade: 'mg' }],
    ['neostigmina 2 mg', { nome: 'Neostigmina', dose: 2 }],
    ['succinilcolina 100 mg', { nome: 'Succinilcolina', dose: 100 }],
    ['lidocaína 60 mg', { nome: 'Lidocaína', dose: 60, unidade: 'mg' }],
    ['xilocaína 80 mg', { nome: 'Lidocaína', dose: 80 }],
    ['bupivacaína pesada 15 mg intratecal', { nome: 'Bupivacaína pesada', dose: 15, via: 'INTRATECAL' }],
    ['bupivacaína pesada 12,5 mg', { nome: 'Bupivacaína pesada', dose: 12.5, via: 'INTRATECAL' }],
    ['morfina 100 microgramas raqui', { nome: 'Morfina', dose: 100, unidade: 'mcg', via: 'INTRATECAL' }],
    ['ropivacaína 150 mg perineural', { nome: 'Ropivacaína', dose: 150, via: 'PERINEURAL' }],
    ['ropivacaína 100 mg peridural', { nome: 'Ropivacaína', dose: 100, via: 'PERIDURAL' }],
    ['sevoflurano 2 por cento', { nome: 'Sevoflurano', dose: 2, unidade: '%', via: 'INALATÓRIA' }],
    ['sevo 2%', { nome: 'Sevoflurano', dose: 2, unidade: '%' }],
    ['remifentanil 0,2 microgramas por quilo por minuto', { nome: 'Remifentanil', dose: 0.2, unidade: 'mcg/kg/min', modo: 'infusao' }],
    ['noradrenalina 0,05 mcg por kg por minuto em bomba', { nome: 'Noradrenalina', dose: 0.05, unidade: 'mcg/kg/min', modo: 'infusao' }],
    ['heparina 5000 unidades subcutânea', { nome: 'Heparina', dose: 5000, unidade: 'UI', via: 'SC' }],
    ['ocitocina 5 UI', { nome: 'Ocitocina', dose: 5, unidade: 'UI' }],
    ['ácido tranexâmico 1 grama', { nome: 'Ácido tranexâmico', dose: 1, unidade: 'g' }],
    ['tramadol 100 mg', { nome: 'Tramadol', dose: 100 }],
    ['dexmedetomidina 20 mcg', { nome: 'Dexmedetomidina', dose: 20, unidade: 'mcg' }],
    ['às 10:40 efedrina 10 mg', { nome: 'Efedrina', dose: 10, hora: '10:40' }],
    ['metoclopramida 10 mg intramuscular', { nome: 'Metoclopramida', dose: 10, via: 'IM' }],
  ];
  for (const [t, esperado] of casos) {
    test(t, () => {
      const it = um(t);
      assert.equal(it.tipo, 'droga');
      for (const [k, v] of Object.entries(esperado)) assert.equal(it.dados[k], v, `${k} em "${t}"`);
    });
  }
  test('unidade presumida gera aviso', () => {
    const it = um('propofol 100');
    assert.equal(it.dados.unidade, 'mg'); assert.ok(it.flags.unidadePresumida); assert.ok(it.avisos.some((a) => /presumida/.test(a)));
  });
  test('via padrão quando não falada', () => { const it = um('propofol 100 mg'); assert.equal(it.dados.via, 'EV'); assert.ok(it.flags.viaPresumida); });
  test('dose implausível gera alerta', () => assert.ok(um('propofol 1500 mg').avisos.some((a) => /plausibilidade/.test(a))));
  test('sem dose gera aviso', () => assert.ok(um('propofol').avisos.some((a) => /Dose/.test(a))));
  test('duas drogas na mesma frase, mesmo horário', () => {
    const r = A('rocurônio 50 mg e fentanil 250 microgramas às 9:50');
    assert.equal(r.itens.length, 2);
    assert.deepEqual(r.itens.map((i) => [i.dados.nome, i.dados.dose, i.dados.hora]), [['Rocurônio', 50, '09:50'], ['Fentanil', 250, '09:50']]);
  });
  test('três drogas de indução', () => {
    const r = A('fentanil 200 mcg, propofol 150 mg, rocurônio 50 mg às 10:05');
    assert.deepEqual(r.itens.map((i) => i.dados.nome), ['Fentanil', 'Propofol', 'Rocurônio']);
    assert.ok(r.itens.every((i) => i.dados.hora === '10:05'));
  });
});

describe('sinais vitais', () => {
  const casos = [
    ['PA 120 por 80, FC 72, saturação 98', { paSistolica: 120, paDiastolica: 80, fc: 72, spo2: 98 }],
    ['pressão 110x70 pulso 65 sat 99 às 10:30', { paSistolica: 110, paDiastolica: 70, fc: 65, spo2: 99, hora: '10:30' }],
    ['pressão arterial 130/85', { paSistolica: 130, paDiastolica: 85 }],
    ['PA cento e vinte por oitenta', { paSistolica: 120, paDiastolica: 80 }],
    ['pressão de 90 por 50 média 63', { paSistolica: 90, paDiastolica: 50, pam: 63 }],
    ['frequência cardíaca 58', { fc: 58 }],
    ['FC de 110', { fc: 110 }],
    ['saturação de 95 por cento', { spo2: 95 }],
    ['SpO2 97', { spo2: 97 }],
    ['oximetria 100', { spo2: 100 }],
    ['frequência respiratória 14', { fr: 14 }],
    ['FR 12', { fr: 12 }],
    ['temperatura 36 vírgula 5', { temperatura: 36.5 }],
    ['temperatura 35,8 graus', { temperatura: 35.8 }],
    ['capnografia 35', { etco2: 35 }],
    ['EtCO2 38', { etco2: 38 }],
    ['CO2 expirado 32', { etco2: 32 }],
    ['PAM 75', { pam: 75 }],
    ['PA 100 por 60 FC 80 SpO2 99 FR 12 temperatura 36 capno 34', { paSistolica: 100, paDiastolica: 60, fc: 80, spo2: 99, fr: 12, temperatura: 36, etco2: 34 }],
  ];
  for (const [t, esperado] of casos) {
    test(t, () => {
      const it = um(t);
      assert.equal(it.tipo, 'sinais_vitais');
      for (const [k, v] of Object.entries(esperado)) assert.equal(it.dados[k], v, `${k} em "${t}"`);
    });
  }
  test('valor fora da faixa gera aviso', () => assert.ok(um('saturação 30').avisos.length > 0));
  test('PAD > PAS gera aviso', () => assert.ok(um('PA 60 por 90').avisos.some((a) => /PAD/.test(a))));
  test('hora padrão = agora', () => assert.equal(um('FC 70').dados.hora, '10:00'));
});

describe('fluidos, diurese, perda sanguínea', () => {
  const casos = [
    ['soro fisiológico 500 ml', 'fluido', { tipo: 'Soro fisiológico 0,9%', volumeMl: 500, categoria: 'cristaloide' }],
    ['SF 0,9% 1000 mililitros', 'fluido', { tipo: 'Soro fisiológico 0,9%', volumeMl: 1000 }],
    ['ringer lactato 1 litro', 'fluido', { tipo: 'Ringer lactato', volumeMl: 1000 }],
    ['ringer 500', 'fluido', { tipo: 'Ringer lactato', volumeMl: 500 }],
    ['plasma lyte 1000 ml', 'fluido', { tipo: 'Plasma-Lyte', volumeMl: 1000 }],
    ['albumina 100 ml', 'fluido', { tipo: 'Albumina', categoria: 'coloide', volumeMl: 100 }],
    ['concentrado de hemácias 1 unidade 300 ml às 11h', 'fluido', { tipo: 'Concentrado de hemácias', categoria: 'hemoderivado', unidades: 1, volumeMl: 300, hora: '11:00' }],
    ['2 bolsas de concentrado de hemácias', 'fluido', { tipo: 'Concentrado de hemácias' }],
    ['plasma fresco 2 unidades', 'fluido', { tipo: 'Plasma fresco congelado', unidades: 2 }],
    ['plaquetas 5 unidades', 'fluido', { tipo: 'Concentrado de plaquetas', unidades: 5 }],
    ['diurese 200 ml', 'diurese', { volumeMl: 200 }],
    ['diurese de trezentos mililitros', 'diurese', { volumeMl: 300 }],
    ['débito urinário 150', 'diurese', { volumeMl: 150 }],
    ['sangramento de 300 mililitros', 'perda_sanguinea', { volumeMl: 300 }],
    ['perda sanguínea 500 ml', 'perda_sanguinea', { volumeMl: 500 }],
    ['perda de sangue estimada em 250', 'perda_sanguinea', { volumeMl: 250 }],
  ];
  for (const [t, tipo, esperado] of casos) {
    test(t, () => {
      const r = A(t); const it = r.itens.find((i) => i.tipo === tipo);
      assert.ok(it, `sem item ${tipo} em "${t}": ${JSON.stringify(r.itens)}`);
      for (const [k, v] of Object.entries(esperado)) assert.equal(it.dados[k], v, `${k} em "${t}"`);
    });
  }
});

describe('horários da anestesia e eventos', () => {
  const casos = [
    ['início da anestesia às dez e quinze', 'inicioAnestesia', '10:15'],
    ['inicio da anestesia 9:30', 'inicioAnestesia', '09:30'],
    ['início da cirurgia às 9 e 45', 'inicioCirurgia', '09:45'],
    ['incisão às 10:20', 'inicioCirurgia', '10:20'],
    ['fim da cirurgia às 11 e 50', 'fimCirurgia', '11:50'],
    ['término da cirurgia 12:05', 'fimCirurgia', '12:05'],
    ['fim da anestesia às 12 e 10', 'fimAnestesia', '12:10'],
    ['início da anestesia agora', 'inicioAnestesia', '10:00'],
  ];
  for (const [t, campo, hora] of casos) test(t, () => { const it = um(t); assert.equal(it.tipo, 'horario'); assert.equal(it.dados.campo, campo); assert.equal(it.dados.hora, hora); });
  test('sem hora usa agora com aviso', () => { const it = um('fim da cirurgia'); assert.equal(it.dados.hora, '10:00'); assert.ok(it.avisos.length); });
  test('intubação como evento', () => { const it = um('intubação orotraqueal às 10:07'); assert.equal(it.tipo, 'evento'); assert.equal(it.dados.hora, '10:07'); });
  test('extubação', () => assert.equal(um('extubado às 12:00').dados.descricao, 'Extubação'));
});

describe('paciente, plano e procedimento', () => {
  const campo = (t, c) => A(t).itens.find((i) => i.dados.campo === c);
  test('nome com acentos preservados', () => assert.equal(campo('paciente João da Silva', 'nome').dados.valor, 'João da Silva'));
  test('nome do paciente seguido de peso e ASA', () => {
    const r = A('nome do paciente Maria José Souza peso 62 quilos ASA 2');
    assert.equal(r.itens[0].dados.valor, 'Maria José Souza');
    assert.equal(r.itens[1].dados.valor, 62);
    assert.deepEqual(r.itens[2].dados.valor, { classe: 2, emergencia: false });
  });
  test('ASA 3 E', () => assert.deepEqual(campo('ASA 3 E', 'asa').dados.valor, { classe: 3, emergencia: true }));
  test('ASA dois', () => assert.equal(campo('ASA dois', 'asa').dados.valor.classe, 2));
  test('ASA II (romano)', () => assert.equal(campo('ASA II', 'asa').dados.valor.classe, 2));
  test('peso 70 kg', () => assert.equal(campo('peso 70 kg', 'pesoKg').dados.valor, 70));
  test('peso 72,5 quilos', () => assert.equal(campo('peso 72,5 quilos', 'pesoKg').dados.valor, 72.5));
  test('altura 1,75', () => assert.equal(campo('altura 1,75', 'alturaCm').dados.valor, 175));
  test('altura 1 metro e 68', () => assert.equal(campo('altura 1 metro e 68', 'alturaCm').dados.valor, 168));
  test('altura 160 centímetros', () => assert.equal(campo('altura 160 centímetros', 'alturaCm').dados.valor, 160));
  test('sexo feminino', () => assert.equal(campo('sexo feminino', 'sexo').dados.valor, 'F'));
  test('masculino direto', () => assert.equal(campo('masculino', 'sexo').dados.valor, 'M'));
  test('data de nascimento falada', () => assert.equal(campo('data de nascimento 12 de março de 1980', 'dataNascimento').dados.valor, '1980-03-12'));
  test('data de nascimento numérica', () => assert.equal(campo('nascimento 05/11/1975', 'dataNascimento').dados.valor, '1975-11-05'));
  test('lerData inválida', () => assert.equal(lerData('40/13/2000'), null));
  test('operadora + carteirinha com dígitos espaçados + guia', () => {
    const r = A('operadora Unimed Paulistana carteirinha 0 1 2 3 4 5 6 guia 987654');
    assert.deepEqual(r.itens.map((i) => [i.dados.campo, i.dados.valor]), [['operadora', 'Unimed Paulistana'], ['carteirinha', '0123456'], ['numeroGuia', '987654']]);
  });
  test('plano de saúde', () => assert.equal(campo('plano de saúde Bradesco Saúde', 'operadora').dados.valor, 'Bradesco Saúde'));
  test('número da guia', () => assert.equal(campo('número da guia 12345678', 'numeroGuia').dados.valor, '12345678'));
  test('senha de autorização', () => assert.equal(campo('senha de autorização 778899', 'senhaAutorizacao').dados.valor, '778899'));
  test('procedimento com acentos + TUSS', () => {
    const r = A('procedimento colecistectomia videolaparoscópica código TUSS 31005497');
    assert.equal(r.itens[0].dados.valor, 'Colecistectomia videolaparoscópica');
    assert.equal(r.itens[1].dados.valor, '31005497');
  });
  test('cirurgião com CRM', () => {
    const r = A('cirurgião doutor Carlos Souza CRM 54321 SP');
    assert.equal(r.itens[0].dados.valor.nome, 'Carlos Souza');
    assert.deepEqual(r.itens[1].dados.valor, { crm: '54321', uf: 'SP' }); assert.equal(r.itens[1].dados.pessoa, 'cirurgiao');
  });
  test('anestesista com CRM', () => {
    const r = A('anestesista doutora Ana Lima CRM 123456 RJ');
    assert.equal(r.itens[0].dados.valor.nome, 'Ana Lima'); assert.equal(r.itens[1].dados.pessoa, 'anestesista');
  });
  test('CRM sozinho vai para anestesista', () => assert.equal(campo('CRM 12345 SP', 'crm').dados.pessoa, 'anestesista'));
  test('hospital e sala', () => {
    const r = A('hospital Santa Clara sala 3');
    assert.equal(r.itens[0].dados.valor, 'Santa Clara'); assert.equal(r.itens[1].dados.valor, '3');
  });
  test('técnica direta', () => assert.equal(um('anestesia geral balanceada').dados.valor, 'Anestesia geral balanceada'));
  test('técnica por palavra-chave', () => assert.equal(um('técnica raquianestesia com sedação').tipo, 'tecnica'));
  test('alergias', () => assert.equal(campo('alergia a dipirona', 'alergias').dados.valor.toLowerCase().includes('dipirona'), true));
});

describe('texto livre: intercorrências e observações', () => {
  test('intercorrência absorve resto da frase (sem criar droga)', () => {
    const r = A('intercorrência: hipotensão após indução, tratada com efedrina 10 mg');
    assert.equal(r.itens.length, 1); assert.equal(r.itens[0].tipo, 'intercorrencia');
    assert.match(r.itens[0].dados.texto, /^Hipotensão após indução/);
  });
  test('observação', () => { const it = um('observação paciente com via aérea difícil prevista'); assert.equal(it.tipo, 'observacao'); assert.match(it.dados.texto, /via aérea difícil/); });
});

describe('comandos de voz', () => {
  const casos = [
    ['confirmar', 'confirmar'], ['Confirmar.', 'confirmar'], ['confirma', 'confirmar'], ['confirmar tudo', 'confirmar_tudo'],
    ['descartar', 'descartar'], ['cancelar', 'descartar'], ['descartar tudo', 'descartar_tudo'], ['desfazer', 'desfazer'],
    ['salvar', 'salvar'], ['Salvar ficha', 'salvar'], ['próximo', 'proximo'], ['finalizar registro', 'proximo'], ['avançar', 'proximo'],
    ['voltar', 'voltar'], ['apagar última frase', 'apagar_frase'], ['Apagar a última frase.', 'apagar_frase'],
    ['gerar PDF', 'gerar_pdf'], ['imprimir', 'gerar_pdf'], ['parar de ouvir', 'parar'], ['repetir', 'repetir'],
  ];
  for (const [t, c] of casos) test(`${t} -> ${c}`, () => assert.equal(detectarComando(t), c));
  test('frase comum não é comando', () => assert.equal(detectarComando('propofol 100 mg'), null));
  test('comando no fim da frase', () => {
    const r = A('dipirona 2 gramas às dez e meia confirmar');
    assert.equal(r.comando, 'confirmar'); assert.equal(r.itens[0].dados.nome, 'Dipirona'); assert.equal(r.itens[0].dados.hora, '10:30');
  });
  test('frase não reconhecida', () => { const r = A('bom dia a todos'); assert.equal(r.itens.length, 0); assert.ok(r.naoReconhecido); });
});

describe('descrição para revisão', () => {
  test('droga', () => assert.equal(descreverItem(um('propofol 150 mg às 10:15')), 'Propofol 150 mg EV às 10:15'));
  test('vitais', () => assert.equal(descreverItem(um('PA 120 por 80 FC 72 sat 98 às 10:05')), 'PA 120x80, PAM 93 (calc.), FC 72, SpO2 98%, IC 0,60 às 10:05'));
});

describe('técnica com texto livre', () => {
  test('técnica engole o resto da frase', () => {
    const r = analisar('técnica anestesia geral balanceada com intubação orotraqueal', { agora: AGORA });
    assert.equal(r.itens.length, 1); assert.equal(r.itens[0].dados.valor, 'Anestesia geral balanceada com intubação orotraqueal');
  });
});

describe('intercorrência com horário', () => {
  test('horário extraído e removido do texto', () => {
    const r = analisar('intercorrência às 8:30: hipotensão após pneumoperitônio', { agora: AGORA });
    assert.equal(r.itens[0].dados.hora, '08:30'); assert.equal(r.itens[0].dados.texto, 'Hipotensão após pneumoperitônio');
  });
  test('inalatório é contínuo', () => assert.equal(analisar('sevoflurano 2%', { agora: AGORA }).itens[0].dados.modo, 'infusao'));
});

import { calcularDerivados, formatarIC, icAlto } from '../src/parser.js';
import { novaFicha, aplicarItem } from '../src/ficha.js';
describe('PAM e índice de choque calculados', () => {
  test('FC 72 e PAS 120 -> IC 0,60', () => { const it = um('PA 120 por 80, FC 72, saturação 98'); assert.equal(it.dados.ic, 0.6); assert.equal(formatarIC(it.dados.ic), '0,60'); assert.match(descreverItem(it), /IC 0,60/); });
  test('PAM calculada (PAS+2PAD)/3', () => { const it = um('PA 120 por 80'); assert.equal(it.dados.pam, 93); assert.equal(it.dados.pamOrigem, 'calculada'); });
  test('PAM falada é mantida (medida)', () => { const it = um('PA 90 por 50 média 70 FC 60'); assert.equal(it.dados.pam, 70); assert.equal(it.dados.pamOrigem, 'medida'); assert.equal(it.dados.ic, 0.67); });
  test('sem FC não há IC', () => assert.equal(um('PA 120 por 80').dados.ic, undefined));
  test('sem PAS não há IC', () => assert.equal(um('FC 72').dados.ic, undefined));
  test('PAS 0 não gera IC', () => assert.equal(calcularDerivados({ paSistolica: 0, fc: 80 }).ic, undefined));
  test('2 casas decimais', () => { assert.equal(calcularDerivados({ paSistolica: 110, fc: 95 }).ic, 0.86); assert.equal(formatarIC(1), '1,00'); });
  test('IC ≥ 1,0 gera aviso informativo', () => { const it = um('PA 80 por 40 FC 110'); assert.equal(it.dados.ic, 1.38); assert.ok(icAlto(it.dados.ic)); assert.ok(it.avisos.some((a) => /choque/.test(a))); });
  test('IC = 1,00 é sinalizado; 0,99 não', () => { assert.ok(icAlto(calcularDerivados({ paSistolica: 100, fc: 100 }).ic)); assert.ok(!icAlto(calcularDerivados({ paSistolica: 101, fc: 100 }).ic)); });
  test('recalcula na edição', () => { const v = calcularDerivados({ paSistolica: 120, paDiastolica: 80, fc: 72 }); v.fc = 120; calcularDerivados(v); assert.equal(v.ic, 1); v.paSistolica = null; calcularDerivados(v); assert.equal(v.ic, undefined); assert.equal(v.pam, undefined); });
  test('na ficha: FC e PAS ditas separadamente no mesmo horário se combinam', () => {
    const f = novaFicha();
    aplicarItem(f, um('FC 72 às 10:05'));
    assert.equal(f.sinaisVitais[0].ic, undefined);
    aplicarItem(f, um('PA 120 por 80 às 10:05'));
    assert.equal(f.sinaisVitais.length, 1); assert.equal(f.sinaisVitais[0].ic, 0.6); assert.equal(f.sinaisVitais[0].pam, 93);
  });
  test('na ficha: horários diferentes não se misturam', () => {
    const f = novaFicha(); aplicarItem(f, um('FC 72 às 10:05')); aplicarItem(f, um('PA 120 por 80 às 10:10'));
    assert.ok(f.sinaisVitais.every((s) => s.ic === undefined));
  });
  test('PAM medida não é sobrescrita por calculada no mesmo horário', () => {
    const f = novaFicha(); aplicarItem(f, um('PAM 75 às 10:05')); aplicarItem(f, um('PA 120 por 80 FC 60 às 10:05'));
    assert.equal(f.sinaisVitais[0].pam, 75); assert.equal(f.sinaisVitais[0].ic, 0.5);
  });
});
