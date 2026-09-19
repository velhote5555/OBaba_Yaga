// ===================================================================
// OBABA_YAGA — Bonus Hunt da comunidade
// Cada pessoa faz a sua hunt no próprio browser. Não há servidor nem
// base de dados: tudo o que escreves fica guardado em localStorage,
// neste dispositivo. Para mostrar a hunt a alguém gera-se um link que
// leva a hunt inteira lá dentro, codificada.
// ===================================================================

const HUNT_KEY = 'obaba_bonus_hunt';
const HUNT_MAX = 60;            // acima disto o link de partilha fica demasiado grande

const huntVazia = () => ({ nome: '', custo: '', cur: '€', itens: [] });

let H = huntVazia();
let escolhida = null;           // slot escolhida na pesquisa, à espera de ser adicionada
let partilhada = false;         // estamos a ver a hunt de outra pessoa?

// ---------- utilitários -------------------------------------------
const $ = (id) => document.getElementById(id);
const hEsc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// aceita vírgula ou ponto: em português escreve-se 12,50
const hNum = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const hDin = (v) => (H.cur || '€') + ' ' + (Math.round(v * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hX = (v) => (Math.round(v * 100) / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x';
const hXv = (b) => { const bet = hNum(b.bet); return bet > 0 ? hNum(b.pago) / bet : 0; };

function huntToast(txt) {
  const el = $('huntToast');
  if (!el) return;
  el.textContent = txt;
  el.classList.add('show');
  clearTimeout(huntToast._t);
  huntToast._t = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------- base de dados das slots -------------------------------
// slots.js traz window.SLOTS_DB = { base, providers:[], slots:[[nome, idxProvider, idImagem]] }
let porId = new Map();
function indexarSlots() {
  const DB = window.SLOTS_DB;
  if (!DB || !DB.slots) return;
  DB.slots.forEach((s) => porId.set(s[2], { nome: s[0], prov: DB.providers[s[1]] || '' }));
}
const imagemDe = (id) => (window.SLOTS_DB ? window.SLOTS_DB.base + id + '.png?_v=4,dpr=1,width=800' : '');

// ---------- guardar e ler -----------------------------------------
function carregar() {
  try {
    const raw = localStorage.getItem(HUNT_KEY);
    if (raw) return Object.assign(huntVazia(), JSON.parse(raw));
  } catch (e) { /* browser sem armazenamento */ }
  return huntVazia();
}
function guardar() {
  if (partilhada) return;                     // a hunt de outra pessoa não se guarda por cima da nossa
  try { localStorage.setItem(HUNT_KEY, JSON.stringify(H)); } catch (e) { /* ignora */ }
}

// ---------- contas -------------------------------------------------
function contas() {
  const it = H.itens, abertos = it.filter((b) => b.aberto);
  const totalBet = it.reduce((a, b) => a + hNum(b.bet), 0);
  const betAbertos = abertos.reduce((a, b) => a + hNum(b.bet), 0);
  const pago = abertos.reduce((a, b) => a + hNum(b.pago), 0);
  const betPorAbrir = totalBet - betAbertos;
  const custo = hNum(H.custo) || totalBet;
  const xs = abertos.map(hXv);
  return {
    n: it.length, abertos: abertos.length, totalBet, pago, custo,
    be: totalBet > 0 ? custo / totalBet : 0,                       // x médio necessário para empatar
    avg: betAbertos > 0 ? pago / betAbertos : 0,
    need: betPorAbrir > 0 ? Math.max(0, (custo - pago) / betPorAbrir) : null,
    pnl: pago - custo,
    best: xs.length ? Math.max.apply(null, xs) : null,
    worst: xs.length ? Math.min.apply(null, xs) : null,
  };
}

// ---------- pesquisa de slots --------------------------------------
let timerBusca = 0;
function procurar() {
  const cx = $('huntSug');
  const q = $('huntQ').value.trim().toLowerCase();
  if (q.length < 2 || !window.SLOTS_DB) { cx.className = ''; cx.innerHTML = ''; return; }
  const prov = $('huntProv').value;
  const DB = window.SLOTS_DB;
  const res = [];
  for (let i = 0; i < DB.slots.length && res.length < 40; i++) {
    const s = DB.slots[i];
    if (prov !== '' && String(s[1]) !== prov) continue;
    if (s[0].toLowerCase().indexOf(q) === -1) continue;
    res.push(s);
  }
  // quem começa pelo que escreveste aparece primeiro
  res.sort((a, b) => {
    const ia = a[0].toLowerCase().startsWith(q) ? 0 : 1;
    const ib = b[0].toLowerCase().startsWith(q) ? 0 : 1;
    return ia - ib || a[0].localeCompare(b[0]);
  });
  if (!res.length) { cx.className = 'open'; cx.innerHTML = '<div class="hunt-sug-vazio">Nenhuma slot encontrada.</div>'; return; }
  cx.className = 'open';
  cx.innerHTML = res.slice(0, 12).map((s) => `
    <button type="button" class="hunt-sug-i" data-id="${hEsc(s[2])}">
      <img src="${hEsc(imagemDe(s[2]))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <span class="t">${hEsc(s[0])}</span>
      <span class="p">${hEsc(DB.providers[s[1]] || '')}</span>
    </button>`).join('');
}

function escolher(id) {
  const s = porId.get(id);
  if (!s) return;
  escolhida = { id, nome: s.nome, prov: s.prov };
  $('huntQ').value = s.nome;
  $('huntSug').className = '';
  $('huntEscolhida').innerHTML = `Escolhida: <b>${hEsc(s.nome)}</b> <span>· ${hEsc(s.prov)}</span>`;
  $('huntBet').focus();
  $('huntBet').select();
}

function adicionar() {
  if (partilhada) { sairDaPartilhada(true); return; }
  if (!escolhida) { huntToast('Procura e escolhe primeiro uma slot.'); $('huntQ').focus(); return; }
  if (H.itens.length >= HUNT_MAX) { huntToast('Máximo de ' + HUNT_MAX + ' bónus por hunt.'); return; }
  const bet = $('huntBet').value.trim();
  if (hNum(bet) <= 0) { huntToast('Escreve a aposta do bónus.'); $('huntBet').focus(); return; }
  H.itens.push({ id: escolhida.id, nome: escolhida.nome, prov: escolhida.prov, bet, pago: '', aberto: false, sup: false, ext: false });
  escolhida = null;
  $('huntQ').value = '';
  $('huntEscolhida').innerHTML = 'Nenhuma slot escolhida.';
  $('huntQ').focus();
  guardar(); desenhar();
  huntToast('Bónus adicionado.');
}

// ---------- desenhar -----------------------------------------------
function desenharKpis(st) {
  $('huntKpis').innerHTML = `
    <div class="stat"><small>Bónus</small><strong>${st.n}${st.n ? ' · ' + st.abertos + ' abertos' : ''}</strong></div>
    <div class="stat"><small>Total apostado</small><strong>${hDin(st.totalBet)}</strong></div>
    <div class="stat"><small>Breakeven</small><strong class="ouro">${st.be ? hX(st.be) : '—'}</strong></div>
    <div class="stat"><small>x médio</small><strong>${st.abertos ? hX(st.avg) : '—'}</strong></div>
    <div class="stat"><small>Precisa</small><strong>${st.need == null ? '—' : hX(st.need)}</strong></div>
    <div class="stat"><small>Total pago</small><strong class="ouro">${hDin(st.pago)}</strong></div>
    <div class="stat"><small>Lucro / Prejuízo</small><strong class="${st.pnl >= 0 ? 'pos' : 'neg'}">${st.pnl >= 0 ? '+' : '−'}${hDin(Math.abs(st.pnl))}</strong></div>
    <div class="stat"><small>Melhor · pior</small><strong>${st.best == null ? '—' : hX(st.best) + ' · ' + hX(st.worst)}</strong></div>`;
}

function desenharLista(st) {
  const lista = $('huntLista');
  if (!H.itens.length) {
    lista.innerHTML = `<div class="hunt-vazio">
      <i class="fas fa-crosshairs" aria-hidden="true"></i>
      <p>Ainda não tens bónus nesta hunt.</p>
      <span>Procura uma slot aí em cima, mete a aposta e carrega em Adicionar.</span>
    </div>`;
    return;
  }
  const atual = H.itens.findIndex((b) => !b.aberto);
  lista.innerHTML = H.itens.map((b, i) => {
    const x = hXv(b);
    const cls = b.aberto ? 'aberto' : (i === atual ? 'atual' : '');
    const marcas = (b.sup ? '<span class="hunt-mk s">SUPER</span>' : '') + (b.ext ? '<span class="hunt-mk e">EXTREME</span>' : '');
    return `<div class="hunt-linha ${cls}" data-i="${i}">
      <span class="hl-n">${i + 1}</span>
      <img class="hl-img" src="${hEsc(imagemDe(b.id))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="hl-nome">
        <strong>${hEsc(b.nome)}${marcas}</strong>
        <small>${hEsc(b.prov || '')}</small>
      </div>
      <label class="hl-campo"><span>Aposta</span>
        <input type="text" inputmode="decimal" autocomplete="off" data-k="bet" data-i="${i}" value="${hEsc(b.bet)}"></label>
      <label class="hl-campo"><span>Pagou</span>
        <input type="text" inputmode="decimal" autocomplete="off" data-k="pago" data-i="${i}" value="${hEsc(b.pago)}" placeholder="—"></label>
      <span class="hl-x ${b.aberto ? (x >= st.be ? 'pos' : 'neg') : ''}">${b.aberto ? hX(x) : '—'}</span>
      <span class="hl-btns">
        <button type="button" class="hb" data-a="sup" data-i="${i}" title="Marcar como super bónus" aria-pressed="${!!b.sup}">S</button>
        <button type="button" class="hb" data-a="ext" data-i="${i}" title="Marcar como extreme" aria-pressed="${!!b.ext}">E</button>
        <button type="button" class="hb" data-a="cima" data-i="${i}" title="Subir">▲</button>
        <button type="button" class="hb" data-a="baixo" data-i="${i}" title="Descer">▼</button>
        <button type="button" class="hb del" data-a="apagar" data-i="${i}" title="Apagar">✕</button>
      </span>
    </div>`;
  }).join('');
}

function desenhar() {
  const st = contas();
  desenharKpis(st);
  desenharLista(st);
  $('huntCount').textContent = st.n;
  const barra = $('huntProgresso');
  const pct = st.n ? (st.abertos / st.n) * 100 : 0;
  barra.style.width = pct.toFixed(1) + '%';
  barra.parentElement.setAttribute('aria-valuenow', String(Math.round(pct)));
  $('huntProgTxt').textContent = st.n ? st.abertos + ' / ' + st.n + ' abertos' : 'sem bónus';
}

// Só os números, sem reconstruir a lista: reconstruí-la a cada tecla
// atirava o cursor para o fim do campo e não deixava corrigir um
// algarismo no meio.
function atualizarNumeros(i) {
  const st = contas();
  desenharKpis(st);
  const linha = $('huntLista').querySelector('.hunt-linha[data-i="' + i + '"]');
  const b = H.itens[i];
  if (linha && b) {
    const cel = linha.querySelector('.hl-x');
    const x = hXv(b);
    cel.textContent = b.aberto ? hX(x) : '—';
    cel.className = 'hl-x ' + (b.aberto ? (x >= st.be ? 'pos' : 'neg') : '');
  }
}

// Ao sair do campo arruma-se o estado das linhas, mas sem reconstruir
// o HTML: se o fizesse aqui, o campo da linha seguinte — onde acabaste
// de clicar — era destruído a meio do clique.
function arrumarLinhas() {
  const st = contas();
  const atual = H.itens.findIndex((b) => !b.aberto);
  $('huntLista').querySelectorAll('.hunt-linha').forEach((linha, i) => {
    const b = H.itens[i];
    if (!b) return;
    linha.className = 'hunt-linha ' + (b.aberto ? 'aberto' : (i === atual ? 'atual' : ''));
  });
  desenharKpis(st);
  desenhar._prog();
}
desenhar._prog = () => {
  const st = contas();
  const pct = st.n ? (st.abertos / st.n) * 100 : 0;
  $('huntProgresso').style.width = pct.toFixed(1) + '%';
  $('huntProgTxt').textContent = st.n ? st.abertos + ' / ' + st.n + ' abertos' : 'sem bónus';
};

// ---------- partilha: a hunt inteira dentro do link ----------------
// Formato compacto: [nome, custo, moeda, [[idImagem, aposta, pago, flags], ...]]
// O nome e o provider da slot não vão no link — saem do slots.js pelo
// id da imagem, que é único e não muda.
function b64ParaUrl(s) { return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function urlParaB64(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return s; }

function codificar(S) {
  const itens = S.itens.map((b) => [b.id || '', String(b.bet || ''), String(b.pago || ''),
    (b.aberto ? 'a' : '') + (b.sup ? 's' : '') + (b.ext ? 'e' : '')]);
  return b64ParaUrl(unescape(encodeURIComponent(JSON.stringify([S.nome || '', String(S.custo || ''), S.cur || '€', itens]))));
}
function descodificar(txt) {
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(urlParaB64(txt)))));
    if (!Array.isArray(d) || !Array.isArray(d[3])) return null;
    const S = { nome: d[0] || '', custo: d[1] || '', cur: d[2] || '€', itens: [] };
    S.itens = d[3].slice(0, HUNT_MAX).map((a) => {
      const meta = porId.get(a[0]) || { nome: 'Slot', prov: '' };
      const f = String(a[3] || '');
      return { id: a[0], nome: meta.nome, prov: meta.prov, bet: a[1] || '', pago: a[2] || '',
               aberto: f.indexOf('a') > -1, sup: f.indexOf('s') > -1, ext: f.indexOf('e') > -1 };
    });
    return S;
  } catch (e) { return null; }
}

function linkDaHunt() {
  const base = location.origin + location.pathname;
  return base + '#h=' + codificar(H);
}

function partilhar() {
  if (!H.itens.length) { huntToast('Adiciona pelo menos um bónus antes de partilhar.'); return; }
  const url = linkDaHunt();
  if (url.length > 8000) { huntToast('Esta hunt é grande demais para um link. Tira alguns bónus.'); return; }
  const feito = () => { huntToast('Link copiado! Cola no Discord ou no chat.'); };
  if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    navigator.share({ title: 'A minha bonus hunt', url }).catch(() => copiar(url, feito));
    return;
  }
  copiar(url, feito);
}
function copiar(txt, feito) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(txt).then(feito).catch(() => copiaAntiga(txt, feito));
  } else copiaAntiga(txt, feito);
}
function copiaAntiga(txt, feito) {
  const ta = document.createElement('textarea');
  ta.value = txt;
  ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); feito(); } catch (e) { huntToast('Não consegui copiar. Copia o endereço da barra.'); }
  ta.remove();
}

function entrarNaPartilhada(S) {
  partilhada = true;
  H = S;
  document.body.classList.add('hunt-partilhada');
  $('huntAviso').hidden = false;
  desenhar();
}
function sairDaPartilhada(guardarEsta) {
  if (guardarEsta) {
    partilhada = false;
    guardar();
    huntToast('Guardada. Esta hunt passou a ser a tua.');
  } else {
    partilhada = false;
    H = carregar();
    huntToast('Voltaste à tua hunt.');
  }
  document.body.classList.remove('hunt-partilhada');
  $('huntAviso').hidden = true;
  history.replaceState({}, document.title, location.pathname);
  desenhar();
}

// ---------- arranque -----------------------------------------------
function ligarEventos() {
  // pesquisa
  $('huntQ').addEventListener('input', () => { clearTimeout(timerBusca); timerBusca = setTimeout(procurar, 140); });
  $('huntProv').addEventListener('change', procurar);
  $('huntSug').addEventListener('click', (e) => {
    const b = e.target.closest('.hunt-sug-i');
    if (b) escolher(b.dataset.id);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.hunt-busca')) $('huntSug').className = '';
  });
  $('huntQ').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const p = $('huntSug').querySelector('.hunt-sug-i'); if (p) escolher(p.dataset.id); }
    if (e.key === 'Escape') $('huntSug').className = '';
  });
  $('huntBet').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } });
  $('huntAdd').addEventListener('click', adicionar);

  // definições
  $('huntNome').addEventListener('input', (e) => { H.nome = e.target.value; guardar(); });
  $('huntCusto').addEventListener('input', (e) => { H.custo = e.target.value; guardar(); desenharKpis(contas()); });
  $('huntCur').addEventListener('change', (e) => { H.cur = e.target.value; guardar(); desenhar(); });

  // campos da lista
  $('huntLista').addEventListener('input', (e) => {
    const t = e.target; if (!t.dataset.k) return;
    const i = +t.dataset.i, b = H.itens[i]; if (!b) return;
    if (t.dataset.k === 'bet') b.bet = t.value;
    else { b.pago = t.value; b.aberto = String(t.value).trim() !== ''; }
    guardar(); atualizarNumeros(i);
  });
  $('huntLista').addEventListener('change', (e) => { if (e.target.dataset.k) arrumarLinhas(); });
  $('huntLista').addEventListener('keydown', (e) => {
    const t = e.target; if (!t.dataset.k || e.key !== 'Enter') return;
    e.preventDefault();
    const i = +t.dataset.i;
    t.blur(); arrumarLinhas();
    let alvo = H.itens.findIndex((b, j) => j > i && !b.aberto);
    if (alvo < 0) alvo = i + 1;
    const prox = $('huntLista').querySelector('input[data-k="pago"][data-i="' + alvo + '"]');
    if (prox) { prox.focus(); prox.select(); }
  });
  $('huntLista').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-a]'); if (!btn) return;
    const i = +btn.dataset.i, a = btn.dataset.a, b = H.itens[i]; if (!b) return;
    if (a === 'sup') b.sup = !b.sup;
    if (a === 'ext') b.ext = !b.ext;
    if (a === 'apagar') H.itens.splice(i, 1);
    if (a === 'cima' && i > 0) H.itens.splice(i - 1, 0, H.itens.splice(i, 1)[0]);
    if (a === 'baixo' && i < H.itens.length - 1) H.itens.splice(i + 1, 0, H.itens.splice(i, 1)[0]);
    guardar(); desenhar();
  });

  // ações
  $('huntPartilhar').addEventListener('click', partilhar);
  $('huntNova').addEventListener('click', () => {
    if (H.itens.length && !confirm('Apagar esta hunt e começar de novo?')) return;
    H = huntVazia(); partilhada = false;
    document.body.classList.remove('hunt-partilhada');
    $('huntAviso').hidden = true;
    $('huntNome').value = ''; $('huntCusto').value = '';
    guardar(); desenhar();
    huntToast('Hunt nova. Bons bónus!');
  });
  $('huntGuardarEsta').addEventListener('click', () => sairDaPartilhada(true));
  $('huntVoltar').addEventListener('click', () => sairDaPartilhada(false));
}

function encherProviders() {
  const DB = window.SLOTS_DB;
  if (!DB) return;
  $('huntProv').innerHTML = '<option value="">Todos os providers</option>' +
    DB.providers.map((p, i) => `<option value="${i}">${hEsc(p)}</option>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!$('huntLista')) return;                 // não é esta página

  if (!window.SLOTS_DB) {
    $('huntErro').hidden = false;              // slots.js não carregou
  } else {
    indexarSlots();
    encherProviders();
  }

  H = carregar();
  $('huntNome').value = H.nome || '';
  $('huntCusto').value = H.custo || '';
  $('huntCur').value = H.cur || '€';

  // alguém abriu um link de hunt partilhada?
  const m = location.hash.match(/[#&]h=([A-Za-z0-9\-_]+)/);
  if (m) {
    const S = descodificar(m[1]);
    if (S) { $('huntNome').value = S.nome || ''; $('huntCusto').value = S.custo || ''; $('huntCur').value = S.cur || '€'; entrarNaPartilhada(S); }
    else huntToast('Esse link de hunt não é válido.');
  }

  ligarEventos();
  desenhar();
});
