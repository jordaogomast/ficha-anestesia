// Ficha de exemplo (dados FICTÍCIOS) montada passando frases pelo mesmo parser usado na voz.
import { analisar } from './parser.js';
import { novaFicha, aplicarItem, adicionarFraseAnotacao, horaParaISO } from './ficha.js';

export const FRASES_EXEMPLO = [
  'peso 72 quilos altura 1,62 ASA 2',
  'alergia a dipirona',
  'procedimento colecistectomia videolaparoscópica código TUSS 31005497',
  'cirurgião doutor Carlos Eduardo Souza CRM 54321 SP',
  'anestesista doutora Ana Paula Lima CRM 123456 SP',
  'sala 3',
  'técnica anestesia geral balanceada com intubação orotraqueal',
  'início da anestesia às 8 e 05',
  'PA 135 por 85 FC 88 saturação 97 às 8:05',
  'midazolam 2 mg venoso às 8:06',
  'cefazolina 2 gramas às 8:08',
  'fentanil 250 microgramas, propofol 150 mg, rocurônio 50 mg às 8:10',
  'intubação orotraqueal às 8:12',
  'sevoflurano 2 por cento às 8:13',
  'PA 100 por 60 FC 76 saturação 99 capnografia 34 às 8:15',
  'ringer lactato 1000 ml às 8:15',
  'início da cirurgia às 8:25',
  'dexametasona 8 mg às 8:25',
  'PA 85 por 50 FC 62 saturação 99 às 8:30',
  'efedrina 10 mg às 8:31',
  'intercorrência às 8:30: hipotensão após pneumoperitônio, revertida com efedrina 10 mg EV e redução do sevoflurano',
  'PA 110 por 70 FC 70 saturação 99 temperatura 36,2 às 8:45',
  'dipirona 2 gramas às 8:50',
  'ondansetrona 4 mg às 9:00',
  'PA 120 por 75 FC 72 saturação 98 às 9:00',
  'sangramento 150 ml às 9:05',
  'PA 118 por 72 FC 74 saturação 98 capnografia 36 às 9:15',
  'fim da cirurgia às 9:20',
  'sugamadex 200 mg às 9:22',
  'diurese 250 ml às 9:25',
  'PA 128 por 80 FC 84 saturação 97 às 9:30',
  'extubação às 9:30',
  'fim da anestesia às 9:35',
  'observação via aérea sem dificuldades, Cormack-Lehane 1',
];
export const ANOTACOES_EXEMPLO = [
  'Paciente encaminhada à RPA acordada, eupneica, Aldrete 9',
  'Analgesia pós-operatória prescrita conforme protocolo',
  'Orientada família sobre o procedimento',
];

export function fichaExemplo() {
  const f = novaFicha();
  f.data = '2026-10-26';
  for (const fr of FRASES_EXEMPLO) {
    const r = analisar(fr, { agora: new Date(2026, 9, 26, 8, 0) });
    for (const it of r.itens) aplicarItem(f, { ...it, textoOriginal: fr }, 'texto');
  }
  ANOTACOES_EXEMPLO.forEach((a, i) => adicionarFraseAnotacao(f, a, horaParaISO(f, `09:${36 + i}`)));
  f.status = 'salvo'; f.salvoEm = '2026-10-26T09:40:00.000Z';
  return f;
}
