// Tipos TypeScript da ficha de anestesia (espelham schema/ficha-anestesia.schema.json v1.1.0)
export type Horario = string | null; // 'AAAA-MM-DDTHH:MM' (local, sem fuso)
export type Origem = 'voz' | 'texto' | 'manual';
export type Via = 'EV' | 'IM' | 'SC' | 'VO' | 'SL' | 'INALATÓRIA' | 'INTRATECAL' | 'PERIDURAL' | 'PERINEURAL' | 'INFILTRAÇÃO' | 'INTRANASAL' | 'TÓPICA';
export type Unidade = 'mg' | 'mcg' | 'g' | 'mL' | 'UI' | 'mEq' | '%' | 'L/min' | 'mcg/kg/min' | 'mcg/kg/h' | 'mg/kg/h' | 'mcg/min' | 'mg/h' | 'mL/h';

export interface RegistroBase { id: string; origem?: Origem; textoOriginal?: string; horario: Horario; }
export interface Profissional { nome: string; crm: string; uf?: string; }

export interface PlanoSaude {
  operadora: string; registroAns?: string; carteirinha: string; validadeCarteirinha?: string | null;
  numeroGuia: string; senhaAutorizacao?: string;
}
export interface Paciente {
  nome: string; dataNascimento: string | null; sexo: 'M' | 'F' | 'O' | null;
  pesoKg: number | null; alturaCm: number | null;
  asa: { classe: 1 | 2 | 3 | 4 | 5 | 6 | null; emergencia: boolean };
  alergias?: string; plano: PlanoSaude;
}
export interface Procedimento {
  descricao: string; codigoTuss?: string; carater?: 'eletivo' | 'urgência';
  hospital?: string; sala?: string; cirurgiao: Profissional; anestesista: Profissional;
}
export interface Droga extends RegistroBase { nome: string; dose: number | null; unidade: Unidade; via: Via; modo?: 'bolus' | 'infusao'; }
export interface SinaisVitais extends RegistroBase {
  paSistolica?: number; paDiastolica?: number;
  /** PAM medida, ou calculada = round((PAS + 2×PAD)/3) */ pam?: number; pamOrigem?: 'medida' | 'calculada';
  /** Índice de choque, CALCULADO = FC ÷ PAS (2 casas); ausente se faltar FC/PAS ou PAS = 0 */ readonly ic?: number;
  fc?: number; spo2?: number; fr?: number; temperatura?: number; etco2?: number;
}
export interface Fluido extends RegistroBase { tipo: string; categoria: 'cristaloide' | 'coloide' | 'hemoderivado'; volumeMl: number | null; unidades?: number | null; }
export interface Volume extends RegistroBase { volumeMl: number | null; }
export interface Evento extends RegistroBase { descricao: string; }

export interface FichaAnestesia {
  schemaVersion: '1.1.0'; id: string; status: 'rascunho' | 'salvo';
  criadoEm: string; atualizadoEm: string; salvoEm: string | null; data: string;
  paciente: Paciente; procedimento: Procedimento; tecnicaAnestesica: { descricao: string };
  horarios: { inicioAnestesia: Horario; inicioCirurgia: Horario; fimCirurgia: Horario; fimAnestesia: Horario };
  drogas: Droga[]; sinaisVitais: SinaisVitais[]; fluidos: Fluido[]; diurese: Volume[]; perdaSanguinea: Volume[];
  eventos: Evento[]; intercorrencias: Evento[]; observacoes: string;
  anotacoesExtras: { texto: string; frases: { texto: string; horario: Horario }[] };
  auditoria: { em: string; acao: string; tipo?: string; origem?: string; texto?: string; id?: string }[];
}

// Saída do parser (itens pendentes de revisão)
export type TipoItem = 'droga' | 'sinais_vitais' | 'fluido' | 'diurese' | 'perda_sanguinea' | 'horario' | 'evento' | 'intercorrencia' | 'observacao' | 'anotacao' | 'paciente' | 'procedimento' | 'tecnica';
export type Comando = 'confirmar' | 'confirmar_tudo' | 'descartar' | 'descartar_tudo' | 'desfazer' | 'apagar_frase' | 'salvar' | 'proximo' | 'voltar' | 'gerar_pdf' | 'parar' | 'repetir';
export interface ItemAnalisado { tipo: TipoItem; dados: Record<string, unknown> & { hora?: string }; flags?: Record<string, boolean>; avisos: string[]; texto: string; }
export interface ResultadoAnalise { comando: Comando | null; itens: ItemAnalisado[]; naoReconhecido: string | null; normalizado: string; }
