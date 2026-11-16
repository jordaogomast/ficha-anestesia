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

# Ficha de Anestesia por Voz (protótipo PWA)

App web **mobile-first** e **instalável** (PWA) para preencher a ficha de anestesia **falando**: drogas, sinais vitais, fluidos, diurese, perdas, horários, dados do paciente/plano/procedimento e **anotações extras**, com **revisão antes de salvar**, **gráfico anestésico** e **PDF A4** para impressão ou envio ao plano de saúde. Sem backend: tudo roda no aparelho.

> ⚠️ Protótipo **não validado clinicamente**. Confira tudo antes de salvar/enviar. Não use com dados reais de pacientes sem as medidas de segurança/LGPD descritas em `docs/ESPECIFICACAO.md`.

## Rodar no computador

```bash
cd ficha-anestesia
python3 -m http.server 8080        # ou: npx serve .
# abra http://localhost:8080  (Chrome ou Edge)
```
- `http://localhost:8080/?demo=1` carrega uma ficha **fictícia** de exemplo.
- O microfone e o service worker exigem **HTTPS ou localhost**.

## Testar no celular Android (Chrome)

O celular precisa abrir o app por **HTTPS**. Opções:
1. Publicar a pasta em qualquer hospedagem estática com HTTPS (GitHub Pages, Netlify, Cloudflare Pages, Vercel) — basta enviar os arquivos, não há build.
2. Túnel temporário a partir do computador: `bash scripts/link-publico.sh` (usa `cloudflared` e imprime um endereço `https://….trycloudflare.com`). **Atenção: o link é público enquanto o túnel estiver aberto** — use apenas com dados fictícios.
3. Mesma rede Wi-Fi + Chrome do computador com depuração USB (`chrome://inspect` → Port forwarding 8080 → `localhost:8080` no celular).

No Chrome do Android: menu ⋮ → **Instalar app** / **Adicionar à tela inicial** (ou o botão ⤓ no topo do app). Depois de instalado, o app abre offline (o reconhecimento de voz ainda precisa de internet).

iPhone: Safari → Compartilhar → **Adicionar à Tela de Início**. O reconhecimento de voz no iOS é **parcial** (ver especificação §5.1).

## Como usar

1. **Dados** – fale ou digite: “peso 70 quilos, ASA 2”, “identificação administrativa: preencher à mão após imprimir”, “anestesista doutora Ana Lima CRM 12345 SP”.
2. **Registro** – toque no 🎤 (ou ative **🗣 Só voz**) e fale:
   - “propofol 150 miligramas venoso às 10 e 15”
   - “PA 120 por 80, FC 72, saturação 98”
   - “ringer lactato 500 ml”, “diurese 200”, “sangramento 300 ml”
   - “início da cirurgia agora”, “intubação às 10:07”
   - **PAM** (se não falada) e **índice de choque** (IC = FC ÷ PAS, ex.: FC 72 / PAS 120 → 0,60) são **calculados automaticamente** e recalculados ao editar; IC ≥ 1,0 recebe destaque ⚠ (informativo).
   - Cada item aparece para **revisão**: ✔ Confirmar, ✎ Editar, ✕ Descartar — ou diga **“confirmar”**, **“descartar”**, **“desfazer”**.
3. **Anotações extras** – diga “próximo”; dite livremente (cada frase é acrescentada e pode ser editada pelo toque); “apagar última frase”; “próximo” ou “salvar”.
4. **Revisão** – confira pendências; **“salvar”**; **“gerar PDF”** (baixa o PDF; no Android, botão **Compartilhar**).

Sem microfone/sem internet: botão **⌨ Digitar** aceita as mesmas frases.

Menu ☰: nova ficha, fichas salvas no aparelho, importar JSON, carregar exemplo, push-to-talk, leitura em voz alta, bipe/vibração. Exportar JSON na Revisão.

## Testes

```bash
npm install          # só para os testes/verificação (o app em si não precisa)
npm test             # testes do parser, schema e anotações (node --test)
python3 -m http.server 8080 &  node scripts/verificar.mjs   # Chrome headless: screenshots + exemplo-ficha.pdf
```

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html`, `styles.css`, `src/` | App (ES modules, sem build) |
| `src/parser.js`, `src/drogas.js` | Gramática de voz pt-BR e dicionário de drogas/fluidos |
| `src/pdf.js`, `vendor/jspdf.umd.min.js` | PDF A4 no aparelho |
| `manifest.webmanifest`, `sw.js`, `icons/` | PWA (instalação + offline) |
| `schema/ficha-anestesia.schema.json`, `types/ficha.d.ts` | Modelo de dados |
| `docs/ESPECIFICACAO.md` | Especificação completa (fluxos, gramática, mobile, TISS, LGPD, offline, roadmap) |
| `tests/` | Testes automatizados |
| `exemplo-ficha.pdf`, `screenshot*.png` | PDF e capturas geradas a partir da ficha fictícia |

## Limitações conhecidas

- Reconhecimento de voz depende da Web Speech API: **Chrome/Edge**, **requer internet** (áudio processado pelo Google); iOS parcial; Firefox sem suporte.
- Parser baseado em regras: frases fora da gramática não são entendidas (o app avisa “Não entendi”); revisão humana é obrigatória.
- Dados ficam só no `localStorage` do navegador, sem criptografia nem login; limpar o navegador apaga as fichas.
- Sem assinatura digital, sem XML TISS, sem integração com operadoras, monitores ou prontuário.
- PAM/IC calculados são aritmética simples sobre os valores registrados (o IC usa FC e PAS do mesmo horário); o destaque de IC ≥ 1,0 é informativo.
- Limites de “plausibilidade” de dose/sinais servem apenas para pegar erro de transcrição — **não são recomendação clínica**.
