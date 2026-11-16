## Atualização vigente: hospital e identificação exclusivamente manuscritos

**Hospital, documentos e identificação administrativa/paciente: preencher à mão após imprimir.**
O PDF reserva linhas amplas, sempre em branco, para hospital; nome; nascimento/idade/sexo;
CPF/RG/outros documentos; prontuário/atendimento/leito; operadora/registro ANS;
carteirinha/validade; guia; senha/autorização, além de uma caixa para etiqueta/código de barras.
Não há coleta digital desses campos pela interface ou por voz/texto: o app explica a regra.
Nenhum é exigido para salvar ou gerar PDF; não aparecem na revisão, leitura ou rodapé.
Peso, altura, ASA, alergias, procedimento, sala e equipe permanecem digitais.
Registros legados não são apagados; JSON legado pode conter identificadores. Texto livre
não é anonimizado automaticamente: revise anotações e JSON antes de compartilhar.
As descrições históricas de gramática/TISS abaixo não autorizam mais coleta administrativa;
a gramática interna apenas reconhece comandos antigos para recusar com explicação.

> **Atualização — identificação manuscrita:** Dados do paciente: preencher à mão após imprimir.
> Nome, nascimento/idade, sexo e prontuário ficam em uma seção ampla e **em branco** no PDF.
> Não há entrada desses campos pelo computador; tentativas por voz/texto são recusadas com explicação.
> Dados legados continuam armazenados por compatibilidade, mas não aparecem no PDF, rodapé ou nome do arquivo.
> Nome e demais identificadores não são exigidos para salvar, exportar ou gerar PDF.
> Peso, altura, ASA e alergias continuam como **dados clínicos**; equipe e procedimento são preservados; plano passa a manuscrito.
> JSON de fichas antigas pode conter identificação legada: revise antes de compartilhar.
> Texto livre de anotações/intercorrências não é anonimizado automaticamente; não dite identificadores nesses campos.

# Ficha de Anestesia por Voz — Especificação (v1.1, protótipo)

> Documento de produto e técnico do protótipo. **Não é um dispositivo médico validado.** Toda informação capturada deve ser conferida pelo anestesista antes de salvar e de enviar ao plano de saúde.

## 1. Objetivo

Permitir que o anestesiologista preencha a **ficha de anestesia** (registro anestésico intraoperatório) **pelo celular, falando**, sem tirar as luvas nem parar a atenção do paciente, e ao final gere um **PDF A4** pronto para impressão e para envio à operadora (plano de saúde), com os dados que a guia TISS exige.

Metas:
- Registrar por voz drogas (dose, unidade, via, horário), sinais vitais, fluidos/hemoderivados, diurese, perda sanguínea, horários, eventos, intercorrências, observações e dados do paciente/plano/procedimento.
- Nada entra na ficha sem **revisão**: cada frase reconhecida vira um item pendente que é confirmado, editado ou descartado (por toque ou por voz).
- Modo **só voz** (mãos livres): comandos falados para confirmar, descartar, desfazer, avançar etapa, salvar e gerar o PDF.
- Funcionar em **celular Android (Chrome)** como **PWA instalável**, com a interface carregando offline.
- Gerar **gráfico anestésico** (PA, FC, SpO2 e EtCO2 no tempo, com marcadores de drogas, fluidos e eventos).

Fora do escopo do protótipo: servidor, login, envio eletrônico (XML TISS) à operadora, assinatura digital ICP-Brasil, integração com monitores multiparamétricos.

## 2. Usuários

| Perfil | Uso |
|---|---|
| Anestesiologista (principal) | Registra durante a anestesia, revisa, salva, gera PDF, assina. |
| Residente / médico em formação | Registra sob supervisão; o PDF sai com o nome/CRM do anestesista responsável. |
| Faturamento do hospital/grupo | Recebe o PDF/JSON com os dados da guia (operadora, carteirinha, nº guia, TUSS, horários). |

## 3. Fluxos

### 3.1 Etapas
1. **Dados** — paciente, plano de saúde (operadora, carteirinha, guia, senha), procedimento (descrição, TUSS), equipe (cirurgião, anestesista + CRM), hospital/sala, técnica, horários. Pode ser preenchido por voz ou toque.
2. **Registro** — durante a anestesia: drogas, sinais vitais, fluidos, diurese, perdas, eventos, intercorrências. Gráfico atualizado em tempo real e linha do tempo (com botão ✕ para remover um registro).
3. **Anotações extras** — **última etapa antes de salvar**: ditado livre; cada frase transcrita é acrescentada ao texto, que continua editável pelo toque. Comandos: “apagar última frase”, “próximo”/“salvar”.
4. **Revisão** — resumo completo + lista de pendências de faturamento; “Salvar ficha”; depois “Gerar PDF” (download e compartilhamento).

Fluxo de voz completo: *terminar o registro* → “próximo” → **Anotações extras** (ditado) → “próximo” ou “salvar” → **Revisão** → “salvar” → “gerar PDF”.

### 3.2 Fluxo manual (toque)
- Botão grande de microfone no rodapé (alcance do polegar). Toque = liga/desliga; opção “segurar para falar” (push-to-talk) no menu.
- Botão ⌨ “Digitar” abre um campo que aceita **as mesmas frases** da voz (útil sem microfone/sem internet e para testes).
- Cada item reconhecido aparece numa “folha” de revisão com **✔ Confirmar / ✎ Editar / ✕ Descartar** (botões ≥ 64 px).
- Campos da etapa Dados também podem ser digitados diretamente.

### 3.3 Fluxo só voz (mãos livres)
- Ativar “🗣 Só voz”: microfone fica ligado continuamente (reinicia sozinho), a tela fica acesa (Wake Lock) e o app **lê em voz alta** o que entendeu (“Propofol 150 miligramas venoso às 10:15. Confirmar?”). Durante a leitura o microfone é pausado para não ouvir a si mesmo.
- O usuário responde “confirmar”, “descartar”, “desfazer”, etc.
- Bipe + vibração a cada captura (sucesso/erro/salvo têm padrões diferentes).

### 3.4 Revisão antes de salvar
- **Nível 1 — item**: nada entra na ficha sem confirmação. Avisos aparecem no item: unidade presumida, dose acima do limite de plausibilidade, valor vital fora da faixa, PAD ≥ PAS, data inválida, etc.
- **Nível 2 — ficha**: na Revisão, a ficha mostra o resumo e as **pendências de faturamento** (nome, operadora, carteirinha, guia, procedimento, anestesista/CRM, técnica, ASA, quatro horários, ≥ 1 sinal vital). É possível salvar com pendências (o PDF as lista em vermelho), mas o usuário é avisado.
- “Salvar” com itens pendentes é bloqueado até confirmar/descartar.
- Toda alteração entra num histórico de **desfazer** (até 50 passos) e numa **trilha de auditoria** (`auditoria[]`, com origem voz/texto e a frase original).

## 4. Gramática de voz (pt-BR)

O parser (`src/parser.js`) normaliza a frase (minúsculas, sem acentos, números por extenso → dígitos — “cento e cinquenta” → 150, sem confundir “dez e quinze” com 25; “trinta e seis vírgula cinco” → 36,5; “1.000” → 1000; “120/80”, “120x80” → “120 por 80”), localiza **palavras-chave** e divide a frase em segmentos; uma frase pode conter vários itens.

### 4.1 Drogas
`<droga> <dose> [unidade] [via] [modo] [horário]`
- ~75 drogas comuns com sinônimos/nomes comerciais (`src/drogas.js`): propofol, fentanil/fentanila, sufentanil, remifentanil, midazolam/dormonid, cetamina/ketamina, etomidato, dexmedetomidina/precedex, rocurônio/esmeron, cisatracúrio, succinilcolina, sugamadex/bridion, neostigmina, atropina, efedrina, fenilefrina, adrenalina, noradrenalina, dexametasona/decadron, ondansetrona/zofran, dipirona, cetoprofeno, cefazolina/kefazol, ácido tranexâmico, lidocaína/xilocaína, bupivacaína (isobárica e pesada), ropivacaína, sevoflurano/sevo, isoflurano, desflurano, ocitocina, heparina, etc.
- Unidades: mg, mcg (“microgramas”, “gamas”), g, mL, UI (“unidades”), mEq, %, L/min, mcg/kg/min, mcg/kg/h, mg/kg/h, mcg/min, mg/h, mL/h.
- Vias: EV (venoso, endovenoso, intravenoso, IV), IM, SC, VO, SL, inalatória, intratecal (raqui, subaracnóidea), peridural, perineural (bloqueio), infiltração, intranasal, tópica. Sem via falada → via padrão da droga (marcada como presumida).
- Sem unidade → unidade padrão da droga, com **aviso** “unidade presumida”.
- “infusão”, “bomba”, “BIC”, ou unidade por tempo → modo infusão.

Exemplos:
- “propofol 150 miligramas venoso às 10 e 15” → Propofol 150 mg EV 10:15
- “fentanil 250 microgramas, propofol 150 mg, rocurônio 50 mg às 8:10” → 3 itens, todos às 08:10
- “remifentanil 0,2 microgramas por quilo por minuto” → infusão 0,2 mcg/kg/min
- “bupivacaína pesada 15 mg intratecal”, “sevoflurano 2 por cento”, “heparina 5000 unidades subcutânea”

### 4.2 Sinais vitais (agrupados numa amostra)
- PA: “PA 120 por 80”, “pressão 110x70”, “pressão arterial 130/85”, “pressão de 90 por 50 média 63”
- FC: “FC 72”, “frequência cardíaca 58”, “pulso 65”
- SpO2: “saturação 98”, “sat 99”, “SpO2 97”, “oximetria 100”
- FR: “FR 12”, “frequência respiratória 14”
- Temperatura: “temperatura 36 vírgula 5”, “temperatura 35,8 graus”
- EtCO2 (opcional): “capnografia 35”, “EtCO2 38”, “CO2 expirado 32”
- Ex.: “PA 120 por 80, FC 72, saturação 98” → 1 amostra (PA 120x80, PAM 93 calc., FC 72, SpO2 98%, **IC 0,60**).

### 4.2.1 Valores calculados automaticamente (sem precisar falar)
| Valor | Fórmula | Regras |
|---|---|---|
| **PAM** (pressão arterial média) | round((PAS + 2×PAD) / 3), em mmHg | Calculada quando há PAS e PAD e a PAM **não** foi falada/medida. PAM falada (“PAM 75”, “média 63”) é mantida e marcada `pamOrigem: "medida"`; a calculada é marcada `"calculada"` e aparece como “(calc.)” na tela e com * no PDF. |
| **IC** (índice de choque) | FC ÷ PAS, **2 casas decimais**, vírgula pt-BR (FC 72, PAS 120 → **0,60**) | Usa FC e PAS **do mesmo registro/horário** (se FC e PA forem ditas em frases separadas no mesmo minuto, a amostra é unida e o IC calculado). Sem FC, sem PAS ou PAS = 0 → **sem IC**. Recalculado a cada edição (no cartão de revisão o editor mostra IC/PAM ao vivo). IC ≥ 1,0 recebe destaque visual ⚠ e aviso **informativo** (não é orientação clínica). |

Onde aparecem: cartão de revisão, linha do tempo, editor, tabela de sinais vitais do PDF (colunas PAM e IC, com legenda), exportação JSON (`pam`, `pamOrigem`, `ic`).

### 4.3 Fluidos, hemoderivados, diurese, perdas
- “soro fisiológico 500 ml”, “SF 0,9% 1000 mililitros”, “ringer lactato 1 litro”, “plasma lyte 1000”, “albumina 100 ml”
- “concentrado de hemácias 1 unidade 300 ml às 11h”, “plasma fresco 2 unidades”, “plaquetas 5 unidades”, “crioprecipitado”
- “diurese 200 ml”, “débito urinário 150”
- “sangramento de 300 mililitros”, “perda sanguínea 500 ml”, “perda de sangue estimada em 250”

### 4.4 Horários e eventos
- “início da anestesia às 8 e 05”, “início da cirurgia agora”, “incisão às 10:20”, “fim da cirurgia às 11 e 50”, “término da anestesia 12:10”
- Eventos: entrada em sala, indução, intubação (IOT), máscara laríngea, punção raquidiana, posicionamento, extubação, saída para RPA.
- Formatos de horário: “às 10 e 15”, “10:15”, “10h15”, “às dez e quinze”, “às 10 horas e 5 minutos”, “às 9 e meia”, “agora”, “há 5 minutos”. **Sem horário falado → horário atual**. Se a frase tem um único horário, ele vale para todos os itens dela.

### 4.5 Paciente, plano e procedimento
- “paciente João da Silva”, “sexo feminino”, “data de nascimento 12 de março de 1980” / “nascimento 05/11/1975”, “peso 70 quilos”, “altura 1,75” / “1 metro e 68”, “ASA 2”, “ASA 3 E”, “ASA II”, “alergia a dipirona”
- “operadora Unimed”, “plano de saúde Bradesco Saúde”, “carteirinha 0 1 2 3 4 5 6” (dígitos falados um a um são juntados), “guia 987654”, “senha de autorização 778899”
- “procedimento colecistectomia videolaparoscópica”, “código TUSS 31005497”, “cirurgião doutor Carlos Souza CRM 54321 SP”, “anestesista doutora Ana Lima CRM 123456 SP” (o CRM vai para o último profissional citado), “hospital Santa Clara”, “sala 3”
- Técnica: “técnica anestesia geral balanceada com intubação orotraqueal”, ou direto: “raquianestesia”, “sedação”, “anestesia geral venosa total”.

### 4.6 Texto livre
- “intercorrência [às 8:30]: hipotensão após pneumoperitônio, revertida com efedrina” → todo o resto da frase vira texto (drogas citadas ali **não** viram registros de droga).
- “observação via aérea sem dificuldades”.
- Na etapa **Anotações extras**, toda frase que não for comando é acrescentada ao texto.

### 4.7 Comandos
| Fala | Ação |
|---|---|
| confirmar / confirma / registrar / confirmar tudo | Confirma todos os itens pendentes (na Revisão, sem pendentes: salva) |
| descartar / cancelar / errado | Descarta o último pendente |
| descartar tudo | Descarta todos os pendentes |
| desfazer | Desfaz a última alteração confirmada (em Anotações: apaga a última frase) |
| apagar última frase | Remove a última frase das anotações extras |
| próximo / avançar / finalizar registro | Próxima etapa |
| voltar | Etapa anterior |
| salvar | Registro → Anotações extras → Revisão → salva a ficha |
| gerar PDF / imprimir | Salva (se preciso) e gera o PDF |
| repetir / ler pendentes | Lê em voz alta os pendentes |
| parar / pausar | Desliga o microfone |

Um comando dito no fim de uma frase também funciona: “dipirona 2 gramas às dez e meia, confirmar”.

## 5. Interface móvel (Android-first)

- **PWA instalável**: `manifest.webmanifest` (nome, ícones 192/512 + maskable, `display: standalone`, `orientation: any`), service worker (`sw.js`) com cache do app shell (abre offline), botão “⤓ Instalar” quando o Chrome oferece `beforeinstallprompt`; no iOS, “Adicionar à Tela de Início” pelo Safari.
- **Alvos de toque grandes**: mínimo 48 px; botões principais 60–80 px; microfone 112 px (128 px no modo só voz); ações de revisão 64 px. Nada depende de gestos finos (sem swipe, sem duplo toque) → **uso com luvas**.
- **Uma mão**: microfone, digitar e só voz no rodapé fixo (zona do polegar); folha de revisão logo acima do rodapé; navegação por etapas grande no topo.
- **Alto contraste**, **tema escuro** padrão (sala escura / menos ofuscamento) e tema claro; foco visível.
- **Tela acesa** (Screen Wake Lock API) enquanto o microfone/modo só voz está ativo; botão ☀ para ligar manualmente; reativado ao voltar ao app.
- **Retorno háptico e sonoro**: `navigator.vibrate` e bipes WebAudio diferentes para captura, confirmação, erro e salvar; leitura em voz alta (speechSynthesis) no modo só voz.
- **Mínimo de digitação**: tudo pode ser falado; datas/horas usam seletores nativos; o campo de texto é alternativo.
- **Paisagem**: o gráfico usa a altura disponível; o rodapé fica compacto em uma linha. Botão “Ajustar à tela / Rolagem (detalhe)” no gráfico (7 px/min com rolagem horizontal).
- Áreas seguras (notch) respeitadas com `env(safe-area-inset-*)`.

### 5.1 Reconhecimento de voz por plataforma
| Plataforma | Situação |
|---|---|
| Android + Chrome | Suportado (`webkitSpeechRecognition`, pt-BR). No Android, o modo contínuo repete resultados e encerra sozinho; o app usa sessões curtas reiniciadas automaticamente e descarta duplicatas. **Requer internet** (o reconhecimento é feito nos servidores do Google). Requer HTTPS. |
| Desktop Chrome / Edge | Suportado (modo contínuo). Requer internet. |
| iOS / iPadOS Safari (≥ 14.5) | **Parcial**: `webkitSpeechRecognition` existe, mas pode parar após silêncio, exige gesto do usuário para (re)começar e o comportamento muda entre versões; como PWA instalado pode não ter acesso ao microfone. Chrome no iOS usa o mesmo motor do Safari. Recomendado: Android ou o caminho nativo (seção 9). |
| Firefox | Sem Web Speech API de reconhecimento → usar o campo ⌨. |

## 6. Modelo de dados

- JSON Schema: `schema/ficha-anestesia.schema.json` (draft 2020-12, v1.1.0).
- Tipos TypeScript: `types/ficha.d.ts`.
- Blocos: `paciente` (nome, nascimento, sexo, peso, altura, ASA {classe, emergência}, alergias, `plano` {operadora, registro ANS, carteirinha, validade, nº guia, senha}), `procedimento` (descrição, TUSS, caráter, hospital, sala, cirurgião e anestesista {nome, CRM, UF}), `tecnicaAnestesica`, `horarios` (início/fim anestesia e cirurgia), `drogas[]`, `sinaisVitais[]` (série temporal; inclui `pam`/`pamOrigem` e `ic` calculados), `fluidos[]` (cristaloide/coloide/hemoderivado, volume, unidades), `diurese[]`, `perdaSanguinea[]`, `eventos[]`, `intercorrencias[]`, `observacoes`, **`anotacoesExtras` {texto, frases[]}**, `auditoria[]`.
- Horários: `AAAA-MM-DDTHH:MM` local, sem fuso (se a hora for > 6 h antes do início da anestesia, assume-se o dia seguinte — cirurgias que passam da meia-noite).
- Cada registro guarda `origem` (voz/texto/manual) e `textoOriginal` (a frase transcrita), para auditoria.

## 7. Plano de saúde (TISS) — campos

O PDF e o JSON trazem os dados usualmente exigidos para faturamento de honorários anestésicos na guia (padrão TISS da ANS; procedimentos em TUSS): operadora e registro ANS, nº da carteira do beneficiário, nº da guia, senha de autorização, data, procedimento e código TUSS, caráter (eletivo/urgência), hospital, profissional executante (anestesista) com CRM/UF, horários de início e fim (base para cálculo do porte/tempo), técnica anestésica e ASA. **O protótipo não gera XML TISS** nem valida códigos TUSS/portes contra a tabela vigente — isso está no roadmap e depende da versão TISS de cada operadora.

## 8. PDF

- Gerado no aparelho com **jsPDF** (embutido em `vendor/`), A4 retrato, 1–3 páginas.
- Conteúdo: cabeçalho (data, status, ID); paciente e plano (operadora, carteirinha, guia, senha); procedimento e equipe (cirurgião e anestesista com CRM); horários e durações; técnica; **gráfico anestésico** (imagem do canvas em tema claro: PA ∨∧, FC ●, EtCO2 “E”, SpO2 em faixa própria, drogas/fluidos/eventos); tabela de drogas (horário, droga, dose, unidade, via, modo); tabela de sinais vitais (com PAM — * se calculada — e IC calculado, (!) se ≥ 1,0); fluidos/diurese/perdas com totais; eventos; intercorrências; observações; **anotações extras** (seção própria, antes da assinatura); linha de **assinatura e carimbo do anestesista** + local/data; lista de campos pendentes (se houver); rodapé com paciente, guia, data de geração e paginação.
- “Gerar PDF” salva a ficha primeiro (se ainda for rascunho), baixa o arquivo e habilita **Compartilhar** (Web Share API com arquivo — WhatsApp, e-mail, Drive — no Android).

## 9. LGPD e privacidade

- Dados de saúde são **dados pessoais sensíveis** (LGPD, art. 5º II e art. 11). Base legal típica: tutela da saúde / cumprimento de obrigação legal (prontuário) — a definir com o DPO do serviço.
- No protótipo: tudo fica **somente no aparelho** (localStorage), sem servidor. **Não há criptografia em repouso nem bloqueio por senha** — não usar com dados reais em aparelho compartilhado.
- O **áudio** vai para o serviço de reconhecimento do navegador (no Chrome, servidores do Google). Para uso real, avaliar: termo/contrato com o provedor, reconhecimento **on-device** (roadmap) ou servidor próprio; informar o paciente/serviço; não ditar dados desnecessários.
- Produção deverá ter: autenticação, criptografia (em repouso e em trânsito), controle de acesso por perfil, trilha de auditoria imutável, política de retenção (prontuário: mínimo 20 anos — Lei 13.787/2018), backup, exclusão segura, registro de consentimento quando aplicável, e conformidade com as resoluções do CFM sobre prontuário eletrônico (certificação/assinatura ICP-Brasil, NGS2 SBIS/CFM).

## 10. Offline

- O app shell (HTML/CSS/JS/jsPDF/ícones) é cacheado pelo service worker: abre e funciona sem rede — registro por **texto**, gráfico, salvar e PDF funcionam offline.
- O **reconhecimento de voz do Chrome precisa de internet**; sem rede o app avisa e o usuário usa ⌨. Alternativas no roadmap: reconhecimento on-device (Android `SpeechRecognizer` com `EXTRA_PREFER_OFFLINE` / pacote pt-BR offline; iOS `SFSpeechRecognizer` com `requiresOnDeviceRecognition`; ou Whisper/Vosk local).
- Fichas ficam no aparelho; sincronização com servidor (fila offline + resolução de conflitos) é roadmap.

## 11. Arquitetura do protótipo

```
index.html            app (PWA) — sem build, sem backend
styles.css            mobile-first, temas escuro/claro, alvos grandes
manifest.webmanifest  instalação PWA
sw.js                 cache offline do app shell
src/parser.js         gramática pt-BR → itens/comandos (puro, testado no Node)
src/drogas.js         dicionário de drogas e fluidos
src/ficha.js          modelo, aplicação de itens, pendências, persistência local
src/grafico.js        gráfico anestésico (canvas) — tela e PDF
src/pdf.js            PDF A4 (jsPDF)
src/voz.js            Web Speech (reconhecimento + síntese), Wake Lock, bipe/vibração
src/app.js            interface, etapas, revisão, comandos
src/exemplo.js        ficha fictícia de demonstração
vendor/jspdf.umd.min.js
tests/                testes (node --test)
```

## 12. Roadmap

1. **Validação clínica e de usabilidade** com anestesiologistas (sala real, ruído, máscaras, luvas); medir taxa de erro de transcrição por campo.
2. **App nativo (Capacitor)**: empacotar o mesmo código web com Capacitor para Android/iOS e usar plugin de **reconhecimento nativo** (ex.: `@capacitor-community/speech-recognition`) → melhor funcionamento no iOS, opção **offline/on-device**, microfone em segundo plano controlado, Wake Lock nativo (`@capacitor-community/keep-awake`), haptics nativos (`@capacitor/haptics`), armazenamento criptografado (SQLite cifrado/Keychain/Keystore), compartilhamento nativo (`@capacitor/share`), publicação na Play Store / App Store (ou MDM do hospital).
3. **Backend** (API + banco) com autenticação (SSO do hospital/2FA), multiusuário, sincronização offline-first, auditoria imutável, backup.
4. **Assinatura digital** ICP-Brasil (certificado A1/A3 ou nuvem — ex.: assinadores em nuvem), carimbo de tempo, PDF/A.
5. **TISS/TUSS**: geração do XML TISS (guia de honorários / SP-SADT conforme operadora), tabela TUSS e portes anestésicos (CBHPM), validação de campos obrigatórios por operadora, envio via webservice da operadora/portal.
6. **Integração com monitores** (HL7/IEEE 11073, ou gateways do fabricante) para sinais vitais automáticos a cada 5 min; voz fica para drogas e eventos.
7. **Prontuário/HIS**: integração HL7 FHIR (Patient, Procedure, MedicationAdministration, Observation), busca do paciente pela agenda cirúrgica.
8. Parser: modelo de linguagem on-device para frases livres; aprendizado de sinônimos por usuário; checagem de dose por kg; alertas de alergia × droga; cálculos automáticos (balanço hídrico, doses por peso).
9. Acessibilidade e idiomas; relatórios (consumo de drogas, tempos de sala).
