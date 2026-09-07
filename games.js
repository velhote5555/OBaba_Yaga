// ===================================================================
// OBABA_YAGA — Jogos Grátis (fichas virtuais, sem dinheiro real)
// ===================================================================

const BALANCE_KEY = 'obaba_credits';
const START_BALANCE = 1000;

function getBalance() {
  const stored = localStorage.getItem(BALANCE_KEY);
  return stored === null ? START_BALANCE : parseInt(stored, 10);
}

function setBalance(value) {
  const clamped = Math.max(0, Math.round(value));
  localStorage.setItem(BALANCE_KEY, clamped.toString());
  renderBalance();
  if (clamped <= 0) {
    setTimeout(() => {
      if (getBalance() <= 0) {
        setBalance(START_BALANCE);
        flashMessage('As tuas fichas acabaram — aqui tens mais ' + formatCoins(START_BALANCE) + ' para continuares a jogar!');
      }
    }, 600);
  }
}

function adjustBalance(delta) {
  setBalance(getBalance() + delta);
}

function formatCoins(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function renderBalance() {
  const el = document.getElementById('balanceDisplay');
  if (el) el.textContent = formatCoins(getBalance());
}

function flashMessage(text) {
  const active = document.querySelector('.game-panel.active .bj-message, .game-panel.active .dice-message, .game-panel.active .mines-message');
  if (active) active.textContent = text;
}

// Clamp a bet input to the current balance and minimum
function readBet(inputId) {
  const input = document.getElementById(inputId);
  let value = parseInt(input.value, 10);
  if (isNaN(value) || value < 10) value = 10;
  const balance = getBalance();
  if (value > balance) value = balance;
  input.value = value;
  return value;
}

document.addEventListener('DOMContentLoaded', () => {
  renderBalance();
  initTabs();
  initBetSteppers();
  initBalanceReset();
  initBlackjack();
  initDice();
  initMines();
});

// ===================================================================
// TABS
// ===================================================================
function initTabs() {
  const tabs = document.querySelectorAll('.game-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.querySelectorAll('.game-panel').forEach(p => p.classList.remove('active'));
      const target = document.getElementById('panel-' + tab.dataset.game);
      if (target) target.classList.add('active');
    });
  });
}

function initBetSteppers() {
  document.querySelectorAll('.bet-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetInput = document.getElementById(btn.dataset.target);
      const step = parseInt(btn.dataset.step, 10);
      let value = parseInt(targetInput.value, 10) || 10;
      value = Math.max(10, value + step);
      targetInput.value = value;
      if (targetInput.id === 'diceBet') updateDiceStats();
    });
  });
}

function initBalanceReset() {
  const btn = document.getElementById('balanceReset');
  if (!btn) return;
  btn.addEventListener('click', () => {
    setBalance(START_BALANCE);
  });
}

// ===================================================================
// BLACKJACK
// ===================================================================
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

let bjDeck = [];
let bjPlayerHand = [];
let bjDealerHand = [];
let bjBetAmount = 0;
let bjInProgress = false;

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  // shuffle (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(card) {
  if (card.rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

function handScore(hand) {
  let score = hand.reduce((sum, c) => sum + cardValue(c), 0);
  let aces = hand.filter(c => c.rank === 'A').length;
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }
  return score;
}

function renderCard(card, hidden = false) {
  const div = document.createElement('div');
  div.className = 'bj-card' + (hidden ? ' bj-card-hidden' : '');

  if (hidden) {
    div.innerHTML = `<div class="bj-card-back-pattern"></div>`;
    return div;
  }

  const isRed = card.suit === '♥' || card.suit === '♦';
  const colorClass = isRed ? 'bj-red' : 'bj-black';

  div.classList.add(colorClass);
  div.innerHTML = `
    <span class="bj-corner bj-corner-top">${card.rank}<br>${card.suit}</span>
    <span class="bj-pip">${card.suit}</span>
    <span class="bj-corner bj-corner-bottom">${card.rank}<br>${card.suit}</span>
  `;
  return div;
}

function renderBjHands(revealDealer) {
  const dealerCardsEl = document.getElementById('dealerCards');
  const playerCardsEl = document.getElementById('playerCards');
  dealerCardsEl.innerHTML = '';
  playerCardsEl.innerHTML = '';

  bjDealerHand.forEach((card, idx) => {
    const hide = !revealDealer && idx === 1;
    dealerCardsEl.appendChild(renderCard(card, hide));
  });
  bjPlayerHand.forEach(card => {
    playerCardsEl.appendChild(renderCard(card));
  });

  document.getElementById('playerScore').textContent = handScore(bjPlayerHand);
  document.getElementById('dealerScore').textContent = revealDealer
    ? handScore(bjDealerHand)
    : (bjDealerHand.length ? cardValue(bjDealerHand[0]) : 0);
}

function setBjMessage(text, type = '') {
  const el = document.getElementById('bjMessage');
  el.textContent = text;
  el.classList.remove('win-text', 'lose-text', 'push-text');
  if (type) el.classList.add(type);
}

function bjSetInGame(inGame) {
  bjInProgress = inGame;
  document.getElementById('bjPreActions').classList.toggle('hidden', inGame);
  document.getElementById('bjInGameActions').classList.toggle('hidden', !inGame);
  document.getElementById('bjBet').disabled = inGame;
}

function initBlackjack() {
  document.getElementById('bjDealBtn').addEventListener('click', startBlackjackRound);
  document.getElementById('bjHitBtn').addEventListener('click', blackjackHit);
  document.getElementById('bjStandBtn').addEventListener('click', blackjackStand);
}

function startBlackjackRound() {
  if (bjInProgress) return;
  const bet = readBet('bjBet');
  if (bet <= 0 || bet > getBalance()) {
    setBjMessage('Saldo insuficiente para essa aposta.');
    return;
  }
  bjBetAmount = bet;
  adjustBalance(-bet);

  bjDeck = buildDeck();
  bjPlayerHand = [bjDeck.pop(), bjDeck.pop()];
  bjDealerHand = [bjDeck.pop(), bjDeck.pop()];

  bjSetInGame(true);
  renderBjHands(false);

  const playerScore = handScore(bjPlayerHand);
  const dealerScore = handScore(bjDealerHand);

  if (playerScore === 21 || dealerScore === 21) {
    finishBlackjackRound();
    return;
  }

  setBjMessage('Pede carta ou fica-te pela tua mão atual.');
}

function blackjackHit() {
  if (!bjInProgress) return;
  bjPlayerHand.push(bjDeck.pop());
  const score = handScore(bjPlayerHand);
  renderBjHands(false);

  if (score > 21) {
    finishBlackjackRound();
  } else {
    setBjMessage('Pede mais carta ou fica-te.');
  }
}

function blackjackStand() {
  if (!bjInProgress) return;
  finishBlackjackRound();
}

function finishBlackjackRound() {
  let playerScore = handScore(bjPlayerHand);
  let dealerScore = handScore(bjDealerHand);

  if (playerScore <= 21) {
    while (dealerScore < 17) {
      bjDealerHand.push(bjDeck.pop());
      dealerScore = handScore(bjDealerHand);
    }
  }

  renderBjHands(true);
  bjSetInGame(false);

  const playerBJ = playerScore === 21 && bjPlayerHand.length === 2;
  const dealerBJ = dealerScore === 21 && bjDealerHand.length === 2;

  let resultText = '';
  let payout = 0;

  let msgType = '';
  if (playerScore > 21) {
    resultText = `Rebentaste com ${playerScore}. Perdeste ${formatCoins(bjBetAmount)} fichas.`;
    payout = 0;
    msgType = 'lose-text';
  } else if (dealerBJ && !playerBJ) {
    resultText = `O dealer tem Blackjack. Perdeste ${formatCoins(bjBetAmount)} fichas.`;
    payout = 0;
    msgType = 'lose-text';
  } else if (playerBJ && !dealerBJ) {
    payout = bjBetAmount + Math.floor(bjBetAmount * 1.5);
    resultText = `Blackjack! Ganhaste ${formatCoins(payout - bjBetAmount)} fichas.`;
    msgType = 'win-text';
  } else if (dealerScore > 21) {
    payout = bjBetAmount * 2;
    resultText = `O dealer rebentou com ${dealerScore}. Ganhaste ${formatCoins(bjBetAmount)} fichas!`;
    msgType = 'win-text';
  } else if (playerScore > dealerScore) {
    payout = bjBetAmount * 2;
    resultText = `Ganhaste com ${playerScore} contra ${dealerScore}! +${formatCoins(bjBetAmount)} fichas.`;
    msgType = 'win-text';
  } else if (playerScore < dealerScore) {
    resultText = `Perdeste com ${playerScore} contra ${dealerScore}. -${formatCoins(bjBetAmount)} fichas.`;
    payout = 0;
    msgType = 'lose-text';
  } else {
    payout = bjBetAmount;
    resultText = `Empate (push) em ${playerScore}. Aposta devolvida.`;
    msgType = 'push-text';
  }

  if (payout > 0) adjustBalance(payout);
  setBjMessage(resultText, msgType);
}

// ===================================================================
// DICE
// ===================================================================
const DICE_HOUSE_EDGE = 0.02;

function diceWinChance(target) {
  return Math.max(1, Math.min(97, target - 1));
}

function diceMultiplier(target) {
  const chance = diceWinChance(target);
  return (100 / chance) * (1 - DICE_HOUSE_EDGE);
}

function updateDiceStats() {
  const targetInput = document.getElementById('diceTarget');
  let target = parseInt(targetInput.value, 10);
  if (isNaN(target)) target = 50;
  target = Math.max(2, Math.min(98, target));
  targetInput.value = target;

  const chance = diceWinChance(target);
  const mult = diceMultiplier(target);

  document.getElementById('diceChance').textContent = chance.toFixed(2) + '%';
  document.getElementById('diceMultiplier').textContent = mult.toFixed(4) + 'x';
  document.getElementById('diceTrackFill').style.width = target + '%';
  document.getElementById('diceTrackMarker').style.left = target + '%';
}

function initDice() {
  const targetInput = document.getElementById('diceTarget');
  targetInput.addEventListener('input', updateDiceStats);
  document.getElementById('diceRollBtn').addEventListener('click', rollDice);
  updateDiceStats();
}

function rollDice() {
  const bet = readBet('diceBet');
  if (bet <= 0 || bet > getBalance()) {
    document.getElementById('diceMessage').textContent = 'Saldo insuficiente para essa aposta.';
    return;
  }
  const target = parseInt(document.getElementById('diceTarget').value, 10);
  const mult = diceMultiplier(target);

  adjustBalance(-bet);

  const roll = Math.random() * 100;
  const rollDisplay = roll.toFixed(2);
  document.getElementById('diceResultValue').textContent = rollDisplay;
  document.getElementById('diceTrackMarker').style.left = Math.min(100, roll) + '%';

  const won = roll < target;
  const msgEl = document.getElementById('diceMessage');

  if (won) {
    const payout = Math.floor(bet * mult);
    adjustBalance(payout);
    msgEl.textContent = `Saiu ${rollDisplay} — ganhaste! +${formatCoins(payout - bet)} fichas.`;
    msgEl.classList.remove('lose-text');
    msgEl.classList.add('win-text');
  } else {
    msgEl.textContent = `Saiu ${rollDisplay} — não foi desta. -${formatCoins(bet)} fichas.`;
    msgEl.classList.remove('win-text');
    msgEl.classList.add('lose-text');
  }
}

// ===================================================================
// MINES
// ===================================================================
const MINES_GRID_SIZE = 25; // 5x5
let minesBoard = [];
let minesRevealed = [];
let minesCount = 5;
let minesBetAmount = 0;
let minesInProgress = false;
let minesSafeOpened = 0;

function minesMultiplierFor(minesN, opened) {
  // Fair-odds multiplier with a small house edge, standard "mines" formula
  const total = MINES_GRID_SIZE;
  let mult = 1;
  for (let i = 0; i < opened; i++) {
    const safeLeft = total - minesN - i;
    const cellsLeft = total - i;
    mult *= cellsLeft / safeLeft;
  }
  return mult * 0.97; // house edge
}

function buildMinesBoard(minesN) {
  const board = new Array(MINES_GRID_SIZE).fill(false);
  let placed = 0;
  while (placed < minesN) {
    const idx = Math.floor(Math.random() * MINES_GRID_SIZE);
    if (!board[idx]) {
      board[idx] = true;
      placed++;
    }
  }
  return board;
}

function renderMinesGrid(revealAll) {
  const grid = document.getElementById('minesGrid');
  grid.innerHTML = '';
  for (let i = 0; i < MINES_GRID_SIZE; i++) {
    const cell = document.createElement('button');
    cell.className = 'mines-cell';
    cell.dataset.index = i;

    if (minesRevealed[i]) {
      cell.classList.add(minesBoard[i] ? 'mines-cell-bomb' : 'mines-cell-safe');
      cell.innerHTML = minesBoard[i] ? '<i class="fas fa-bomb"></i>' : '<i class="fas fa-gem"></i>';
    } else if (revealAll) {
      cell.classList.add(minesBoard[i] ? 'mines-cell-bomb-dim' : '');
      cell.innerHTML = minesBoard[i] ? '<i class="fas fa-bomb"></i>' : '';
      cell.disabled = true;
    } else {
      cell.innerHTML = '';
    }

    if (!minesInProgress || minesRevealed[i]) {
      cell.disabled = true;
    } else {
      cell.addEventListener('click', () => revealMinesCell(i));
    }

    grid.appendChild(cell);
  }
}

function setMinesMessage(text) {
  document.getElementById('minesMessage').textContent = text;
}

function minesSetInGame(inGame) {
  minesInProgress = inGame;
  document.getElementById('minesPreActions').classList.toggle('hidden', inGame);
  document.getElementById('minesInGameActions').classList.toggle('hidden', !inGame);
  document.getElementById('minesBet').disabled = inGame;
  document.getElementById('minesCount').disabled = inGame;
}

function initMines() {
  document.getElementById('minesStartBtn').addEventListener('click', startMinesGame);
  document.getElementById('minesCashoutBtn').addEventListener('click', cashoutMines);
  renderMinesGrid(false);
}

function startMinesGame() {
  if (minesInProgress) return;
  const bet = readBet('minesBet');
  if (bet <= 0 || bet > getBalance()) {
    setMinesMessage('Saldo insuficiente para essa aposta.');
    return;
  }
  minesBetAmount = bet;
  minesCount = parseInt(document.getElementById('minesCount').value, 10);
  adjustBalance(-bet);

  minesBoard = buildMinesBoard(minesCount);
  minesRevealed = new Array(MINES_GRID_SIZE).fill(false);
  minesSafeOpened = 0;

  minesSetInGame(true);
  document.getElementById('minesMultiplier').textContent = '1.00x';
  document.getElementById('minesCashoutValue').textContent = '(' + formatCoins(minesBetAmount) + ')';
  setMinesMessage('Escolhe casas para revelar gemas. Podes recolher a qualquer momento.');
  renderMinesGrid(false);
}

function revealMinesCell(index) {
  if (!minesInProgress || minesRevealed[index]) return;
  minesRevealed[index] = true;

  if (minesBoard[index]) {
    renderMinesGrid(true);
    minesSetInGame(false);
    setMinesMessage(`Bum! Encontraste uma mina. Perdeste ${formatCoins(minesBetAmount)} fichas.`);
    return;
  }

  minesSafeOpened++;
  const mult = minesMultiplierFor(minesCount, minesSafeOpened);
  const potential = Math.floor(minesBetAmount * mult);

  document.getElementById('minesMultiplier').textContent = mult.toFixed(2) + 'x';
  document.getElementById('minesCashoutValue').textContent = '(' + formatCoins(potential) + ')';

  const maxSafe = MINES_GRID_SIZE - minesCount;
  if (minesSafeOpened >= maxSafe) {
    adjustBalance(potential);
    renderMinesGrid(true);
    minesSetInGame(false);
    setMinesMessage(`Encontraste todas as gemas! Ganhaste ${formatCoins(potential - minesBetAmount)} fichas.`);
    return;
  }

  renderMinesGrid(false);
  setMinesMessage(`Gema encontrada! Multiplicador: ${mult.toFixed(2)}x — continua ou recolhe.`);
}

function cashoutMines() {
  if (!minesInProgress) return;
  const mult = minesMultiplierFor(minesCount, minesSafeOpened);
  const payout = Math.floor(minesBetAmount * mult);
  adjustBalance(payout);
  renderMinesGrid(true);
  minesSetInGame(false);
  setMinesMessage(`Recolheste ${formatCoins(payout)} fichas (${mult.toFixed(2)}x).`);
}
