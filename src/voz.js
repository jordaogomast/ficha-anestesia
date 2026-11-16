// Reconhecimento de voz (Web Speech API), síntese de fala e feedback (bipe/vibração).
export const suportaReconhecimento = () => !!(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);
export const ehAndroid = () => /Android/i.test(globalThis.navigator ? navigator.userAgent : '');
export const ehIOS = () => /iPhone|iPad|iPod/i.test(globalThis.navigator ? navigator.userAgent : '') || (globalThis.navigator && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export class Reconhecedor {
  constructor({ lang = 'pt-BR', aoFinal, aoParcial, aoEstado, aoErro } = {}) {
    this.lang = lang; this.aoFinal = aoFinal || (() => {}); this.aoParcial = aoParcial || (() => {});
    this.aoEstado = aoEstado || (() => {}); this.aoErro = aoErro || (() => {});
    this.ativo = false; this.ouvindo = false; this.pausadoPorFala = false; this.rec = null;
    this.ultimoFinal = ''; this.ultimoFinalEm = 0; this.falhasSeguidas = 0;
    // No Android o modo contínuo repete resultados e encerra sozinho; usamos sessões curtas reiniciadas automaticamente.
    this.continuo = !ehAndroid();
  }
  _criar() {
    const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    const r = new SR();
    r.lang = this.lang; r.continuous = this.continuo; r.interimResults = true; r.maxAlternatives = 1;
    r.onstart = () => { this.ouvindo = true; this.falhasSeguidas = 0; this.aoEstado('ouvindo'); };
    r.onresult = (ev) => {
      let parcial = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i]; const txt = res[0].transcript.trim();
        if (res.isFinal) this._final(txt); else parcial += txt + ' ';
      }
      if (parcial.trim()) this.aoParcial(parcial.trim());
    };
    r.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { this.ativo = false; }
      this.falhasSeguidas++;
      this.aoErro(ev.error);
    };
    r.onend = () => {
      this.ouvindo = false;
      if (this.ativo && !this.pausadoPorFala && this.falhasSeguidas < 5) { setTimeout(() => this._iniciarSessao(), this.falhasSeguidas ? 600 : 120); }
      else this.aoEstado(this.pausadoPorFala ? 'falando' : 'parado');
    };
    return r;
  }
  _final(txt) {
    if (!txt) return;
    const agora = Date.now();
    // evita duplicatas (bug conhecido do Chrome Android)
    if (txt.toLowerCase() === this.ultimoFinal.toLowerCase() && agora - this.ultimoFinalEm < 2500) return;
    this.ultimoFinal = txt; this.ultimoFinalEm = agora;
    this.aoFinal(txt);
  }
  _iniciarSessao() {
    if (!this.ativo || this.ouvindo) return;
    try { this.rec = this._criar(); this.rec.start(); } catch (e) { this.aoErro(String(e.message || e)); }
  }
  iniciar() { if (!suportaReconhecimento()) { this.aoErro('nao-suportado'); return false; } this.ativo = true; this.falhasSeguidas = 0; this._iniciarSessao(); return true; }
  parar() { this.ativo = false; try { this.rec && this.rec.stop(); } catch { /* ignore */ } this.aoEstado('parado'); }
  pausarParaFalar() { this.pausadoPorFala = true; try { this.rec && this.rec.abort(); } catch { /* ignore */ } }
  retomarAposFala() { this.pausadoPorFala = false; if (this.ativo) this._iniciarSessao(); }
}

// ---- síntese de fala (leitura em voz alta das confirmações)
let vozPt = null;
function escolherVoz() {
  if (!globalThis.speechSynthesis) return null;
  const vs = speechSynthesis.getVoices();
  vozPt = vs.find((v) => v.lang === 'pt-BR') || vs.find((v) => /^pt/i.test(v.lang)) || null;
  return vozPt;
}
if (globalThis.speechSynthesis) speechSynthesis.onvoiceschanged = escolherVoz;

export function falar(texto, reconhecedor) {
  return new Promise((resolve) => {
    if (!globalThis.speechSynthesis || !texto) return resolve();
    if (reconhecedor) reconhecedor.pausarParaFalar();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR'; u.rate = 1.1; if (vozPt || escolherVoz()) u.voice = vozPt;
    const fim = () => { if (reconhecedor) reconhecedor.retomarAposFala(); resolve(); };
    u.onend = fim; u.onerror = fim;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
    setTimeout(() => { if (speechSynthesis.speaking) return; fim(); }, 8000);
  });
}

// ---- feedback háptico e sonoro
let actx = null;
export function bipe(tipo = 'ok') {
  try {
    actx = actx || new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const o = actx.createOscillator(); const g = actx.createGain();
    const freq = { ok: 880, captura: 660, erro: 220, salvar: 1046 }[tipo] || 660;
    o.frequency.value = freq; o.type = 'sine'; g.gain.value = 0.15;
    o.connect(g); g.connect(actx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (tipo === 'erro' ? 0.35 : 0.15));
    o.stop(actx.currentTime + 0.4);
  } catch { /* sem áudio */ }
}
export function vibrar(tipo = 'ok') {
  if (!globalThis.navigator || !navigator.vibrate) return;
  navigator.vibrate({ ok: 40, captura: [30, 40, 30], erro: [120, 60, 120], salvar: [60, 40, 60, 40, 60] }[tipo] || 40);
}

// ---- Wake Lock (manter a tela acesa)
export class TelaAcesa {
  constructor(aoMudar = () => {}) { this.lock = null; this.desejado = false; this.aoMudar = aoMudar; document.addEventListener('visibilitychange', () => { if (this.desejado && document.visibilityState === 'visible') this.ativar(); }); }
  get suportado() { return 'wakeLock' in navigator; }
  async ativar() {
    this.desejado = true;
    if (!this.suportado) { this.aoMudar(false); return false; }
    try { this.lock = await navigator.wakeLock.request('screen'); this.lock.addEventListener('release', () => this.aoMudar(false)); this.aoMudar(true); return true; } catch { this.aoMudar(false); return false; }
  }
  async desativar() { this.desejado = false; try { await (this.lock && this.lock.release()); } catch { /* ignore */ } this.lock = null; this.aoMudar(false); }
}
