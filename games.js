// ===================================================================
// OBABA_YAGA — Minijogos (fichas virtuais, sem dinheiro real)
// Saldo e histórico partilhados entre jogos, guardados no browser.
// ===================================================================

const BALANCE_KEY = 'obaba_credits';
const HISTORY_KEY = 'obaba_game_history';
const START_BALANCE = 1000;
const MIN_BET = 10;
const HISTORY_MAX = 50;

// ---------- utilitários ----------
function fmt(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getBalance() {
  try { const s = localStorage.getItem(BALANCE_KEY); return s === null ? START_BALANCE : parseInt(s, 10); } catch (e) { return START_BALANCE; }
}

function setBalance(v) {
  const val = Math.max(0, Math.round(v));
  try { localStorage.setItem(BALANCE_KEY, String(val)); } catch (e) { /* ignora */ }
  renderBalance();
  if (val <= 0) {
    setTimeout(() => {
      if (getBalance() <= 0) { setBalance(START_BALANCE); toast('As tuas fichas acabaram — aqui tens mais ' + fmt(START_BALANCE) + ' para continuares.'); }
    }, 700);
  }
}

function adjustBalance(d) { setBalance(getBalance() + d); }

function renderBalance() {
  document.querySelectorAll('[data-balance]').forEach((el) => { el.textContent = fmt(getBalance()); });
}

function toast(text) {
  const el = document.getElementById('gameToast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3500);
}

// histórico: { game, bet, result (+/-), label, t }
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { return []; }
}

function pushHistory(game, bet, result, label) {
  const list = getHistory();
  list.unshift({ game, bet, result: Math.round(result), label: label || '', t: Date.now() });
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX))); } catch (e) { /* ignora */ }
  renderHistory();
}

function timeAgo(t) {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'agora';
  const m = Math.round(s / 60); if (m < 60) return m + ' min';
  const h = Math.round(m / 60); if (h < 24) return h + ' h';
  return Math.round(h / 24) + ' d';
}

const GAME_NAMES = { blackjack: 'Blackjack', dice: 'Dados', mines: 'Minas', crash: 'Crash' };

function renderHistory() {
  const body = document.getElementById('historyBody');
  if (!body) return;
  const filter = body.dataset.game || '';
  const list = getHistory().filter((h) => !filter || h.game === filter);
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="4" class="history-empty">Ainda não há jogadas. Faz a tua primeira aposta!</td></tr>';
    return;
  }
  const you = (window.TwitchAuth && TwitchAuth.getUser() && TwitchAuth.getUser().displayName) || 'Tu';
  body.innerHTML = list.slice(0, 20).map((h) => {
    const cls = h.result > 0 ? 'win' : (h.result < 0 ? 'lose' : 'push');
    const res = h.result > 0 ? '+' + fmt(h.result) : (h.result < 0 ? '−' + fmt(-h.result) : 'Push');
    return `<tr>
      <td><span class="history-player">${esc(you)}</span><small>${timeAgo(h.t)}${filter ? '' : ' · ' + GAME_NAMES[h.game]}</small></td>
      <td>${fmt(h.bet)}</td>
      <td class="history-label">${esc(h.label)}</td>
      <td class="history-result ${cls}">${res}</td>
    </tr>`;
  }).join('');
}

function renderStats() {
  const el = document.getElementById('gameStats');
  if (!el) return;
  const body = document.getElementById('historyBody');
  const filter = (body && body.dataset.game) || '';
  const list = getHistory().filter((h) => !filter || h.game === filter);
  const wins = list.filter((h) => h.result > 0).length;
  const best = list.reduce((m, h) => Math.max(m, h.result), 0);
  const total = list.reduce((s, h) => s + h.result, 0);
  el.innerHTML = `
    <div class="stat"><small>Jogadas</small><strong>${fmt(list.length)}</strong></div>
    <div class="stat"><small>Vitórias</small><strong>${list.length ? Math.round((wins / list.length) * 100) : 0}%</strong></div>
    <div class="stat"><small>Melhor ganho</small><strong class="${best > 0 ? 'win' : ''}">+${fmt(best)}</strong></div>
    <div class="stat"><small>Saldo líquido</small><strong class="${total >= 0 ? 'win' : 'lose'}">${total >= 0 ? '+' : '−'}${fmt(Math.abs(total))}</strong></div>`;
}

function readBet(id) {
  const input = document.getElementById(id);
  let v = parseInt(input.value, 10);
  if (isNaN(v) || v < MIN_BET) v = MIN_BET;
  v = Math.min(v, getBalance());
  input.value = v;
  return v;
}

function initBetControls() {
  document.querySelectorAll('.bet-step').forEach((btn) => btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const cur = parseInt(input.value, 10) || MIN_BET;
    const op = btn.dataset.op;
    let v = cur;
    if (op === 'half') v = Math.floor(cur / 2);
    else if (op === 'double') v = cur * 2;
    else if (op === 'max') v = getBalance();
    else v = cur + parseInt(btn.dataset.step, 10);
    input.value = Math.max(MIN_BET, Math.min(v, getBalance()));
    input.dispatchEvent(new Event('input'));
  }));
  const reset = document.getElementById('balanceReset');
  if (reset) reset.addEventListener('click', () => { setBalance(START_BALANCE); toast('Saldo reposto para ' + fmt(START_BALANCE) + ' fichas.'); });
}

document.addEventListener('DOMContentLoaded', () => {
  renderBalance();
  renderHistory();
  renderStats();
  initBetControls();
  const game = document.body.dataset.game;
  if (game === 'blackjack') initBlackjack();
  if (game === 'dice') initDice();
  if (game === 'mines') initMines();
  if (game === 'crash') initCrash();
  setInterval(renderHistory, 30000);
});

// ===================================================================
// BLACKJACK
// ===================================================================
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let bjDeck = [], bjPlayer = [], bjDealer = [], bjBet = 0, bjActive = false;

function buildDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ s, r });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
const cardValue = (c) => c.r === 'A' ? 11 : (['J', 'Q', 'K'].includes(c.r) ? 10 : parseInt(c.r, 10));
function handScore(h) {
  let s = h.reduce((a, c) => a + cardValue(c), 0), aces = h.filter((c) => c.r === 'A').length;
  while (s > 21 && aces > 0) { s -= 10; aces--; }
  return s;
}
function renderCard(c, hidden) {
  const d = document.createElement('div');
  d.className = 'bj-card' + (hidden ? ' bj-card-hidden' : '') + ((c.s === '♥' || c.s === '♦') ? ' bj-red' : ' bj-black');
  d.innerHTML = hidden ? '<div class="bj-card-back-pattern"></div>' : `<span class="bj-corner bj-corner-top">${c.r}<br>${c.s}</span><span class="bj-pip">${c.s}</span><span class="bj-corner bj-corner-bottom">${c.r}<br>${c.s}</span>`;
  return d;
}
function renderBj(reveal) {
  const de = document.getElementById('dealerCards'), pe = document.getElementById('playerCards');
  de.innerHTML = ''; pe.innerHTML = '';
  bjDealer.forEach((c, i) => de.appendChild(renderCard(c, !reveal && i === 1)));
  bjPlayer.forEach((c) => pe.appendChild(renderCard(c)));
  document.getElementById('playerScore').textContent = bjPlayer.length ? handScore(bjPlayer) : '—';
  document.getElementById('dealerScore').textContent = bjDealer.length ? (reveal ? handScore(bjDealer) : cardValue(bjDealer[0])) : '—';
}
function bjMsg(t, type) { const el = document.getElementById('bjMessage'); el.textContent = t; el.className = 'game-message ' + (type || ''); }
function bjState(active) {
  bjActive = active;
  document.getElementById('bjPreActions').classList.toggle('hidden', active);
  document.getElementById('bjInGameActions').classList.toggle('hidden', !active);
  document.getElementById('bjBet').disabled = active;
  document.getElementById('bjDoubleBtn').disabled = !(active && bjPlayer.length === 2 && getBalance() >= bjBet);
}
function initBlackjack() {
  document.getElementById('bjDealBtn').addEventListener('click', bjDeal);
  document.getElementById('bjHitBtn').addEventListener('click', bjHit);
  document.getElementById('bjStandBtn').addEventListener('click', () => bjActive && bjFinish());
  document.getElementById('bjDoubleBtn').addEventListener('click', bjDouble);
  document.addEventListener('keydown', (e) => {
    if (!bjActive) return;
    if (e.key === 'h' || e.key === 'H') bjHit();
    if (e.key === 's' || e.key === 'S') bjFinish();
  });
}
function bjDeal() {
  if (bjActive) return;
  const bet = readBet('bjBet');
  if (bet <= 0) { bjMsg('Saldo insuficiente.', 'lose'); return; }
  bjBet = bet; adjustBalance(-bet);
  bjDeck = buildDeck(); bjPlayer = [bjDeck.pop(), bjDeck.pop()]; bjDealer = [bjDeck.pop(), bjDeck.pop()];
  bjState(true); renderBj(false);
  if (handScore(bjPlayer) === 21 || handScore(bjDealer) === 21) { bjFinish(); return; }
  bjMsg('Pede carta (H), fica (S) ou dobra.');
}
function bjHit() {
  if (!bjActive) return;
  bjPlayer.push(bjDeck.pop()); renderBj(false);
  document.getElementById('bjDoubleBtn').disabled = true;
  if (handScore(bjPlayer) > 21) bjFinish(); else bjMsg('Pede mais carta ou fica.');
}
function bjDouble() {
  if (!bjActive || bjPlayer.length !== 2 || getBalance() < bjBet) return;
  adjustBalance(-bjBet); bjBet *= 2;
  bjPlayer.push(bjDeck.pop()); renderBj(false);
  bjFinish();
}
function bjFinish() {
  let ps = handScore(bjPlayer), ds = handScore(bjDealer);
  if (ps <= 21) while (ds < 17) { bjDealer.push(bjDeck.pop()); ds = handScore(bjDealer); }
  renderBj(true); bjState(false);
  const pBJ = ps === 21 && bjPlayer.length === 2, dBJ = ds === 21 && bjDealer.length === 2;
  let payout = 0, text = '', type = 'lose', label = '';
  if (ps > 21) { text = `Rebentaste com ${ps}. −${fmt(bjBet)} fichas.`; label = 'Bust'; }
  else if (dBJ && !pBJ) { text = `O dealer tem Blackjack. −${fmt(bjBet)} fichas.`; label = 'Dealer BJ'; }
  else if (pBJ && !dBJ) { payout = bjBet + Math.floor(bjBet * 1.5); text = `Blackjack! +${fmt(payout - bjBet)} fichas.`; type = 'win'; label = 'Blackjack'; }
  else if (ds > 21) { payout = bjBet * 2; text = `O dealer rebentou com ${ds}. +${fmt(bjBet)} fichas!`; type = 'win'; label = `Dealer bust`; }
  else if (ps > ds) { payout = bjBet * 2; text = `Ganhaste ${ps} contra ${ds}! +${fmt(bjBet)} fichas.`; type = 'win'; label = `${ps} vs ${ds}`; }
  else if (ps < ds) { text = `Perdeste ${ps} contra ${ds}. −${fmt(bjBet)} fichas.`; label = `${ps} vs ${ds}`; }
  else { payout = bjBet; text = `Empate em ${ps}. Aposta devolvida.`; type = 'push'; label = 'Push'; }
  if (payout > 0) adjustBalance(payout);
  bjMsg(text, type);
  pushHistory('blackjack', bjBet, payout - bjBet, label);
  renderStats();
}

// ===================================================================
// DADOS
// ===================================================================
const DICE_EDGE = 0.02;
const diceChance = (t) => Math.max(1, Math.min(97, t - 1));
const diceMult = (t) => (100 / diceChance(t)) * (1 - DICE_EDGE);
function updateDice() {
  const inp = document.getElementById('diceTarget');
  let t = parseInt(inp.value, 10); if (isNaN(t)) t = 50; t = Math.max(2, Math.min(98, t)); inp.value = t;
  const slider = document.getElementById('diceSlider'); if (slider && parseInt(slider.value, 10) !== t) slider.value = t;
  document.getElementById('diceChance').textContent = diceChance(t).toFixed(2) + '%';
  document.getElementById('diceMultiplier').textContent = diceMult(t).toFixed(4) + 'x';
  const bet = parseInt(document.getElementById('diceBet').value, 10) || MIN_BET;
  document.getElementById('dicePayout').textContent = fmt(Math.floor(bet * diceMult(t)));
  document.getElementById('diceTrackFill').style.width = t + '%';
  document.getElementById('diceTrackTarget').style.left = t + '%';
}
function initDice() {
  const inp = document.getElementById('diceTarget'), slider = document.getElementById('diceSlider');
  inp.addEventListener('input', updateDice);
  if (slider) slider.addEventListener('input', () => { inp.value = slider.value; updateDice(); });
  document.getElementById('diceBet').addEventListener('input', updateDice);
  document.getElementById('diceRollBtn').addEventListener('click', rollDice);
  updateDice();
}
function rollDice() {
  const bet = readBet('diceBet');
  if (bet <= 0) { setMsg('diceMessage', 'Saldo insuficiente.', 'lose'); return; }
  const t = parseInt(document.getElementById('diceTarget').value, 10), m = diceMult(t);
  adjustBalance(-bet);
  const roll = Math.random() * 100, rs = roll.toFixed(2);
  const val = document.getElementById('diceResultValue'); val.textContent = rs;
  const marker = document.getElementById('diceTrackMarker'); marker.style.left = Math.min(100, roll) + '%'; marker.classList.add('show');
  const won = roll < t;
  let delta = -bet;
  if (won) { const payout = Math.floor(bet * m); adjustBalance(payout); delta = payout - bet; }
  val.className = 'dice-result-value ' + (won ? 'win' : 'lose');
  setMsg('diceMessage', won ? `Saiu ${rs} — ganhaste! +${fmt(delta)} fichas.` : `Saiu ${rs} — não foi desta. −${fmt(bet)} fichas.`, won ? 'win' : 'lose');
  pushHistory('dice', bet, delta, `${rs} < ${t}`);
  renderStats();
}
function setMsg(id, t, type) { const el = document.getElementById(id); el.textContent = t; el.className = 'game-message ' + (type || ''); }

// ===================================================================
// MINAS
// ===================================================================
const GRID = 25;
let mBoard = [], mRevealed = [], mCount = 5, mBet = 0, mActive = false, mOpened = 0;
function minesMult(n, opened) { let m = 1; for (let i = 0; i < opened; i++) m *= (GRID - i) / (GRID - n - i); return m * 0.97; }
function buildMines(n) { const b = new Array(GRID).fill(false); let p = 0; while (p < n) { const i = Math.floor(Math.random() * GRID); if (!b[i]) { b[i] = true; p++; } } return b; }
function renderMines(revealAll) {
  const g = document.getElementById('minesGrid'); g.innerHTML = '';
  for (let i = 0; i < GRID; i++) {
    const c = document.createElement('button'); c.className = 'mines-cell'; c.type = 'button'; c.setAttribute('aria-label', 'Casa ' + (i + 1));
    if (mRevealed[i]) { c.classList.add(mBoard[i] ? 'mines-cell-bomb' : 'mines-cell-safe'); c.innerHTML = mBoard[i] ? '<i class="fas fa-bomb" aria-hidden="true"></i>' : '<i class="fas fa-gem" aria-hidden="true"></i>'; }
    else if (revealAll) { if (mBoard[i]) { c.classList.add('mines-cell-bomb-dim'); c.innerHTML = '<i class="fas fa-bomb" aria-hidden="true"></i>'; } c.disabled = true; }
    if (!mActive || mRevealed[i]) c.disabled = true; else c.addEventListener('click', () => revealMine(i));
    g.appendChild(c);
  }
}
function minesState(a) {
  mActive = a;
  document.getElementById('minesPreActions').classList.toggle('hidden', a);
  document.getElementById('minesInGameActions').classList.toggle('hidden', !a);
  document.getElementById('minesBet').disabled = a; document.getElementById('minesCount').disabled = a;
}
function updateMinesInfo() {
  const n = parseInt(document.getElementById('minesCount').value, 10);
  document.getElementById('minesNext').textContent = minesMult(n, mOpened + 1).toFixed(2) + 'x';
}
function initMines() {
  document.getElementById('minesStartBtn').addEventListener('click', startMines);
  document.getElementById('minesCashoutBtn').addEventListener('click', cashoutMines);
  document.getElementById('minesCount').addEventListener('change', updateMinesInfo);
  renderMines(false); updateMinesInfo();
}
function startMines() {
  if (mActive) return;
  const bet = readBet('minesBet'); if (bet <= 0) { setMsg('minesMessage', 'Saldo insuficiente.', 'lose'); return; }
  mBet = bet; mCount = parseInt(document.getElementById('minesCount').value, 10); adjustBalance(-bet);
  mBoard = buildMines(mCount); mRevealed = new Array(GRID).fill(false); mOpened = 0;
  minesState(true);
  document.getElementById('minesMultiplier').textContent = '1.00x';
  document.getElementById('minesCashoutValue').textContent = fmt(mBet);
  setMsg('minesMessage', 'Escolhe casas para revelar gemas. Recolhe quando quiseres.');
  renderMines(false); updateMinesInfo();
}
function revealMine(i) {
  if (!mActive || mRevealed[i]) return;
  mRevealed[i] = true;
  if (mBoard[i]) {
    renderMines(true); minesState(false);
    setMsg('minesMessage', `Bum! Encontraste uma mina. −${fmt(mBet)} fichas.`, 'lose');
    pushHistory('mines', mBet, -mBet, `${mOpened} gemas · ${mCount} minas`); renderStats();
    return;
  }
  mOpened++;
  const mult = minesMult(mCount, mOpened), pot = Math.floor(mBet * mult);
  document.getElementById('minesMultiplier').textContent = mult.toFixed(2) + 'x';
  document.getElementById('minesCashoutValue').textContent = fmt(pot);
  if (mOpened >= GRID - mCount) { adjustBalance(pot); renderMines(true); minesState(false); setMsg('minesMessage', `Todas as gemas! +${fmt(pot - mBet)} fichas.`, 'win'); pushHistory('mines', mBet, pot - mBet, `${mOpened} gemas · ${mult.toFixed(2)}x`); renderStats(); return; }
  renderMines(false); updateMinesInfo();
  setMsg('minesMessage', `Gema! ${mult.toFixed(2)}x — continua ou recolhe.`);
}
function cashoutMines() {
  if (!mActive) return;
  const mult = minesMult(mCount, mOpened), pay = Math.floor(mBet * mult);
  adjustBalance(pay); renderMines(true); minesState(false);
  setMsg('minesMessage', `Recolheste ${fmt(pay)} fichas (${mult.toFixed(2)}x).`, pay > mBet ? 'win' : 'push');
  pushHistory('mines', mBet, pay - mBet, `${mOpened} gemas · ${mult.toFixed(2)}x`); renderStats();
}

// ===================================================================
// CRASH
// ===================================================================
const CRASH_EDGE = 0.03;
let cActive = false, cBet = 0, cPoint = 1, cStart = 0, cRaf = 0, cAuto = 0, cCashed = false;
const crashHistory = [];
function crashPoint() {
  const u = Math.random();
  if (u < CRASH_EDGE) return 1.0;                       // rebenta logo
  return Math.max(1.0, Math.floor((100 * (1 - CRASH_EDGE)) / (1 - u)) / 100);
}
function crashMultAt(ms) { return Math.pow(Math.E, 0.00006 * ms * 1.15) ; } // cresce ~1x → 2x em ~10 s
function initCrash() {
  document.getElementById('crashStartBtn').addEventListener('click', startCrash);
  document.getElementById('crashCashBtn').addEventListener('click', cashCrash);
  drawCrashCanvas(1, false);
  renderCrashHistory();
}
function crashState(a) {
  cActive = a;
  document.getElementById('crashPreActions').classList.toggle('hidden', a);
  document.getElementById('crashInGameActions').classList.toggle('hidden', !a);
  document.getElementById('crashBet').disabled = a; document.getElementById('crashAuto').disabled = a;
}
function startCrash() {
  if (cActive) return;
  const bet = readBet('crashBet'); if (bet <= 0) { setMsg('crashMessage', 'Saldo insuficiente.', 'lose'); return; }
  cBet = bet; adjustBalance(-bet);
  cAuto = parseFloat(document.getElementById('crashAuto').value) || 0;
  cPoint = crashPoint(); cStart = performance.now(); cCashed = false;
  crashState(true); setMsg('crashMessage', 'A subir... recolhe antes de rebentar!');
  document.getElementById('crashMult').className = 'crash-mult';
  cancelAnimationFrame(cRaf); cRaf = requestAnimationFrame(crashTick);
}
function crashTick(now) {
  const m = crashMultAt(now - cStart);
  if (m >= cPoint) { crashEnd(); return; }
  document.getElementById('crashMult').textContent = m.toFixed(2) + 'x';
  document.getElementById('crashCashValue').textContent = fmt(Math.floor(cBet * m));
  drawCrashCanvas(m, false);
  if (cAuto >= 1.01 && m >= cAuto && !cCashed) { cashCrash(cAuto); return; }
  cRaf = requestAnimationFrame(crashTick);
}
function cashCrash(atMult) {
  if (!cActive || cCashed) return;
  const m = atMult || crashMultAt(performance.now() - cStart);
  cCashed = true; cancelAnimationFrame(cRaf);
  const pay = Math.floor(cBet * m); adjustBalance(pay);
  crashState(false);
  document.getElementById('crashMult').textContent = m.toFixed(2) + 'x';
  document.getElementById('crashMult').className = 'crash-mult win';
  drawCrashCanvas(m, false);
  setMsg('crashMessage', `Recolheste a ${m.toFixed(2)}x. +${fmt(pay - cBet)} fichas!`, 'win');
  crashHistory.unshift(cPoint); renderCrashHistory();
  pushHistory('crash', cBet, pay - cBet, `saiu a ${m.toFixed(2)}x`); renderStats();
}
function crashEnd() {
  cancelAnimationFrame(cRaf); crashState(false);
  document.getElementById('crashMult').textContent = cPoint.toFixed(2) + 'x';
  document.getElementById('crashMult').className = 'crash-mult lose';
  drawCrashCanvas(cPoint, true);
  setMsg('crashMessage', `Rebentou a ${cPoint.toFixed(2)}x. −${fmt(cBet)} fichas.`, 'lose');
  crashHistory.unshift(cPoint); renderCrashHistory();
  pushHistory('crash', cBet, -cBet, `rebentou a ${cPoint.toFixed(2)}x`); renderStats();
}
function renderCrashHistory() {
  const el = document.getElementById('crashHistory'); if (!el) return;
  el.innerHTML = crashHistory.slice(0, 12).map((p) => `<span class="crash-chip ${p >= 2 ? 'good' : (p < 1.2 ? 'bad' : '')}">${p.toFixed(2)}x</span>`).join('');
}
function drawCrashCanvas(mult, crashed) {
  const cv = document.getElementById('crashCanvas'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width = cv.clientWidth * (window.devicePixelRatio || 1), H = cv.height = cv.clientHeight * (window.devicePixelRatio || 1);
  ctx.clearRect(0, 0, W, H);
  const maxM = Math.max(2, mult * 1.15);
  // grelha
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.08)'; ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, H * i / 5); ctx.lineTo(W, H * i / 5); ctx.stroke(); }
  // curva
  ctx.beginPath(); ctx.moveTo(0, H);
  const n = 60;
  for (let i = 1; i <= n; i++) {
    const p = i / n, m = 1 + (mult - 1) * Math.pow(p, 1.8);
    ctx.lineTo(W * p * 0.92, H - ((m - 1) / (maxM - 1)) * H * 0.9);
  }
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, crashed ? '#ff4444' : '#00c8ff'); grad.addColorStop(1, crashed ? '#e8305e' : '#29a9ea');
  ctx.strokeStyle = grad; ctx.lineWidth = 4 * (window.devicePixelRatio || 1); ctx.lineJoin = 'round'; ctx.stroke();
  ctx.lineTo(W * 0.92, H); ctx.closePath();
  ctx.fillStyle = crashed ? 'rgba(255, 68, 68, 0.12)' : 'rgba(0, 200, 255, 0.12)'; ctx.fill();
}
