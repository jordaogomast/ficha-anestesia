// Verificação automatizada no Chrome headless: carrega o app com dados de exemplo, tira screenshots e gera o PDF de exemplo.
// Uso: node scripts/verificar.mjs [url-base]   (requer servidor local, ex.: python3 -m http.server 8080)
import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:8080/';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const erros = [];
async function abrir(viewport, query) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await page.setViewport(viewport);
  if (viewport.isMobile) await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.goto(BASE + 'index.html?' + query, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.fichaApp && window.fichaApp.ficha);
  return page;
}
// desktop
let p = await abrir({ width: 1280, height: 900 }, 'demo=1&etapa=registro&semsw=1');
await p.evaluate(() => window.fichaApp.processarFrase('PA 125 por 78, FC 80, saturação 98 às 9:34', 'texto'));
await new Promise((r) => setTimeout(r, 400));
await p.screenshot({ path: 'screenshot.png' });
// mobile (Android, 390x844)
p = await abrir({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'demo=1&etapa=registro&semsw=1');
await p.evaluate(() => window.fichaApp.processarFrase('propofol 30 mg venoso às 9:33', 'texto'));
await new Promise((r) => setTimeout(r, 400));
await p.screenshot({ path: 'screenshot-mobile.png' });
// índice de choque: cartão de revisão + recálculo no editor
await p.evaluate(() => { window.fichaApp.estado.pendentes = []; window.fichaApp.processarFrase('PA 80 por 40, FC 110, saturação 95 às 9:34', 'texto'); });
await new Promise((r) => setTimeout(r, 300));
const ic = await p.evaluate(() => ({ cartao: document.querySelector('#listaPendentes .pendente').innerText.replace(/\s+/g, ' ') }));
await p.screenshot({ path: 'screenshot-mobile-ic.png' });
await p.evaluate(() => document.querySelector('#listaPendentes [data-acao=editar]').click());
ic.editorInicial = await p.evaluate(() => document.querySelector('.calc').innerText);
ic.editorAposEditar = await p.evaluate(() => { const i = document.querySelector('#camposEditar input[data-k=fc]'); i.value = '72'; i.dispatchEvent(new Event('input', { bubbles: true })); const s = document.querySelector('#camposEditar input[data-k=paSistolica]'); s.value = '120'; s.dispatchEvent(new Event('input', { bubbles: true })); return document.querySelector('.calc').innerText; });
ic.registrado = await p.evaluate(async () => { document.querySelector('#btnOkEditar').click(); await new Promise((r) => setTimeout(r, 200)); const v = window.fichaApp.ficha.sinaisVitais.find((x) => x.horario.endsWith('09:34')); return v && { ic: v.ic, pam: v.pam, pamOrigem: v.pamOrigem }; });
console.log('IC:', JSON.stringify(ic));
// mobile paisagem
p = await abrir({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'demo=1&etapa=registro&semsw=1');
await p.screenshot({ path: 'screenshot-mobile-paisagem.png' });
// mobile anotações e revisão
p = await abrir({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'demo=1&etapa=anotacoes&semsw=1');
await p.screenshot({ path: 'screenshot-mobile-anotacoes.png' });
// fluxo de comandos de voz (simulado via texto): confirmar, anotação, apagar última frase, próximo, salvar
const fluxo = await p.evaluate(async () => {
  const A = window.fichaApp; const log = [];
  A.irPara('registro', false);
  A.processarFrase('fentanil 50 microgramas às 9:34'); log.push('pendentes=' + A.estado.pendentes.length);
  A.processarFrase('confirmar'); log.push('pendentes=' + A.estado.pendentes.length + ' drogas=' + A.ficha.drogas.length);
  A.processarFrase('efedrina 5 mg'); A.processarFrase('descartar'); log.push('apos descartar pend=' + A.estado.pendentes.length + ' drogas=' + A.ficha.drogas.length);
  A.processarFrase('desfazer'); log.push('apos desfazer drogas=' + A.ficha.drogas.length);
  A.processarFrase('próximo'); log.push('etapa=' + A.estado.etapa);
  const n0 = A.ficha.anotacoesExtras.frases.length;
  A.processarFrase('Teste de frase ditada'); A.processarFrase('Outra frase errada'); A.processarFrase('apagar última frase');
  log.push('frases +' + (A.ficha.anotacoesExtras.frases.length - n0) + ' ultima=' + A.ficha.anotacoesExtras.frases.at(-1).texto);
  A.processarFrase('salvar'); log.push('etapa=' + A.estado.etapa);
  A.processarFrase('salvar'); await new Promise((r) => setTimeout(r, 300)); log.push('status=' + A.ficha.status);
  return log;
});
console.log('Fluxo:', fluxo.join(' | '));
await p.screenshot({ path: 'screenshot-mobile-revisao.png' });
// PDF de exemplo a partir da ficha de exemplo
p = await abrir({ width: 390, height: 844 }, 'demo=salvo&etapa=revisao&semsw=1');
const b64 = await p.evaluate(() => window.fichaApp.pdfBase64());
writeFileSync('exemplo-ficha.pdf', Buffer.from(b64, 'base64'));
// manifest/SW
const pwa = await p.evaluate(async () => ({ manifest: !!document.querySelector('link[rel=manifest]'), sw: 'serviceWorker' in navigator, secure: isSecureContext, beforeinstallprompt: !document.querySelector('#btnInstalar').hidden }));
// service worker real (sem ?semsw)
const p2 = await browser.newPage(); await p2.goto(BASE + 'index.html', { waitUntil: 'networkidle0' });
pwa.swRegistrado = await p2.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
await p2.setOfflineMode(true); await p2.reload({ waitUntil: 'domcontentloaded' });
pwa.abreOffline = await p2.evaluate(() => !!document.querySelector('#btnMic'));
await p2.setOfflineMode(false);
console.log('PWA:', JSON.stringify(pwa));
console.log('Erros JS:', erros.length ? erros.join('\n') : 'nenhum');
await browser.close();
