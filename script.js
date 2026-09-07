// ===================================================================
// OBABA_YAGA — script principal (navegação, verificação de idade,
// popup promocional, estado da stream, contadores)
// ===================================================================

const TWITCH_CHANNEL = 'obaba_yaga';
const STREAM_CHECK_INTERVAL = 60 * 1000;      // 60 s (a DecAPI bloqueia pedidos abusivos)
const FOLLOWER_CHECK_INTERVAL = 5 * 60 * 1000; // 5 min
const PROMO_DELAY = 5000;                      // popup só 5 s depois de entrar
const RESPONSIBLE_GAMBLING_URL = 'https://www.jogoresponsavel.pt/';

// -------------------------------------------------------------------
// Verificação de idade
// -------------------------------------------------------------------
(function initAgeGate() {
  const ageGate = document.getElementById('ageGate');
  const ageConfirm = document.getElementById('ageConfirm');
  const ageDeny = document.getElementById('ageDeny');
  const STORAGE_KEY = 'obaba_age_verified';

  // Páginas sem verificação de idade (ex.: contacto) nunca bloqueiam o scroll
  if (!ageGate || !ageConfirm || !ageDeny) {
    document.body.style.overflow = '';
    schedulePromoPopup();
    return;
  }

  let verified = false;
  try { verified = localStorage.getItem(STORAGE_KEY) === 'true'; } catch (e) { /* storage indisponível */ }

  if (verified) {
    ageGate.classList.add('hidden');
    document.body.style.overflow = '';
    schedulePromoPopup();
    return;
  }

  document.body.style.overflow = 'hidden';
  ageConfirm.focus();

  // Mantém o foco dentro do modal (acessibilidade)
  ageGate.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusables = [ageConfirm, ageDeny];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  ageConfirm.addEventListener('click', () => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (e) { /* ignora */ }
    ageGate.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => {
      ageGate.classList.add('hidden');
      document.body.style.overflow = '';
      schedulePromoPopup();
    }, 300);
  });

  ageDeny.addEventListener('click', () => {
    window.location.href = RESPONSIBLE_GAMBLING_URL;
  });
})();

// -------------------------------------------------------------------
// Popup promocional (uma vez por sessão, com atraso)
// -------------------------------------------------------------------
function schedulePromoPopup() {
  const promoPopup = document.getElementById('promoPopup');
  if (!promoPopup) return;

  const SESSION_KEY = 'obaba_promo_shown';
  try { if (sessionStorage.getItem(SESSION_KEY) === 'true') return; } catch (e) { /* ignora */ }

  setTimeout(() => {
    try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch (e) { /* ignora */ }
    promoPopup.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const promoClose = document.getElementById('promoClose');
    if (promoClose) promoClose.focus();

    function closePromo() {
      promoPopup.classList.add('hidden');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') closePromo(); }

    if (promoClose) promoClose.addEventListener('click', closePromo);
    promoPopup.addEventListener('click', (e) => { if (e.target === promoPopup) closePromo(); });
    document.addEventListener('keydown', onKey);
  }, PROMO_DELAY);
}

// -------------------------------------------------------------------
// Layout: sidebar (mobile), chat da comunidade, pesquisa
// -------------------------------------------------------------------
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const backdrop = document.getElementById('backdrop');
const chatPanel = document.getElementById('chat');
const chatToggle = document.getElementById('chatToggle');
const chatCollapse = document.getElementById('chatCollapse');
const app = document.getElementById('app');
const navLinks = document.querySelectorAll('.sidebar-link');

function closeOverlays() {
  if (sidebar) sidebar.classList.remove('open');
  if (chatPanel) chatPanel.classList.remove('open');
  if (backdrop) backdrop.classList.remove('show');
  if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
}

if (menuToggle && sidebar) {
  menuToggle.addEventListener('click', () => {
    const open = !sidebar.classList.contains('open');
    closeOverlays();
    if (open) { sidebar.classList.add('open'); backdrop.classList.add('show'); }
    menuToggle.setAttribute('aria-expanded', String(open));
  });
}

if (chatToggle && chatPanel) {
  chatToggle.addEventListener('click', () => {
    const open = !chatPanel.classList.contains('open');
    closeOverlays();
    if (open) { chatPanel.classList.add('open'); backdrop.classList.add('show'); }
  });
}

if (backdrop) backdrop.addEventListener('click', closeOverlays);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlays(); });
navLinks.forEach((l) => l.addEventListener('click', closeOverlays));

// Chat da Twitch: o "parent" tem de ser o domínio atual
const chatFrame = document.getElementById('chatFrame');
if (chatFrame) {
  const hosts = new Set(['obabayaga.com', 'www.obabayaga.com', window.location.hostname]);
  const parents = [...hosts].filter(Boolean).map((h) => 'parent=' + encodeURIComponent(h)).join('&');
  chatFrame.src = `https://www.twitch.tv/embed/${chatFrame.dataset.channel}/chat?${parents}&darkpopout`;
}

// Recolher / expandir o painel do chat em desktop (lembra a escolha)
if (chatCollapse && app) {
  const KEY = 'obaba_chat_collapsed';
  const apply = (collapsed) => {
    app.classList.toggle('chat-collapsed', collapsed);
    chatCollapse.setAttribute('aria-label', collapsed ? 'Expandir chat' : 'Recolher chat');
    chatCollapse.querySelector('i').className = collapsed ? 'fas fa-chevron-left' : 'fas fa-chevron-right';
  };
  let collapsed = false;
  try { collapsed = localStorage.getItem(KEY) === '1'; } catch (e) { /* ignora */ }
  apply(collapsed);
  chatCollapse.addEventListener('click', () => {
    if (chatPanel.classList.contains('open')) { closeOverlays(); return; }
    collapsed = !app.classList.contains('chat-collapsed');
    apply(collapsed);
    try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch (e) { /* ignora */ }
  });
}

// Scroll suave para âncoras da própria página
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// -------------------------------------------------------------------
// Ofertas: filtros, pesquisa e "mais info"
// -------------------------------------------------------------------
const offerCards = document.querySelectorAll('.offer-card');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('siteSearch');
const searchForm = document.querySelector('.search');
let activeFilter = 'all';
let query = '';

function applyOfferFilters() {
  let shown = 0;
  offerCards.forEach((card) => {
    const cats = card.dataset.cats || '';
    const hay = (card.dataset.name + ' ' + card.innerText).toLowerCase();
    const okFilter = activeFilter === 'all' || cats.split(' ').includes(activeFilter);
    const okQuery = !query || hay.includes(query);
    card.classList.toggle('is-hidden', !(okFilter && okQuery));
    if (okFilter && okQuery) shown++;
  });
  const empty = document.getElementById('noResults');
  if (empty) empty.hidden = shown > 0;
}

filterBtns.forEach((btn) => btn.addEventListener('click', () => {
  filterBtns.forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  applyOfferFilters();
}));

if (searchInput) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('q')) { query = params.get('q').toLowerCase(); searchInput.value = params.get('q'); }
  searchInput.addEventListener('input', () => { query = searchInput.value.trim().toLowerCase(); applyOfferFilters(); });
  if (searchForm && offerCards.length) searchForm.addEventListener('submit', (e) => e.preventDefault());
  if (query) applyOfferFilters();
}

document.querySelectorAll('.more-btn').forEach((btn) => btn.addEventListener('click', () => {
  const card = btn.closest('.offer-card');
  const open = card.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
  btn.innerHTML = open
    ? 'Menos info <i class="fas fa-chevron-up" aria-hidden="true"></i>'
    : 'Mais info <i class="fas fa-chevron-down" aria-hidden="true"></i>';
}));

// Abrir automaticamente o cartão referido na âncora (casinos.html#offer-x)
if (window.location.hash.startsWith('#offer-')) {
  const target = document.querySelector(window.location.hash);
  if (target) { target.classList.add('open'); setTimeout(() => target.scrollIntoView({ block: 'center' }), 100); }
}

// -------------------------------------------------------------------
// Horário das lives — EDITA AQUI (hora local de Portugal)
// -------------------------------------------------------------------
const SCHEDULE = [
  { day: 'Segunda', time: 'Folga', what: '' },
  { day: 'Terça', time: 'A partir das 21h30', what: '' },
  { day: 'Quarta', time: 'A partir das 21h30', what: '' },
  { day: 'Quinta', time: 'A partir das 21h30', what: '' },
  { day: 'Sexta', time: 'A partir das 22h00', what: '' },
  { day: 'Sábado', time: 'A partir das 22h00', what: '' },
  { day: 'Domingo', time: 'Folga', what: '' },
];

const scheduleGrid = document.getElementById('scheduleGrid');
if (scheduleGrid) {
  const todayIdx = (new Date().getDay() + 6) % 7; // 0 = segunda
  scheduleGrid.innerHTML = SCHEDULE.map((d, i) => {
    const off = /folga/i.test(d.time);
    return `<div class="day-card${i === todayIdx ? ' today' : ''}${off ? ' off' : ''}">
      <span class="day">${d.day}${i === todayIdx ? ' · hoje' : ''}</span>
      <span class="time">${d.time}</span>
      <span class="what">${d.what || 'Sem live'}</span>
    </div>`;
  }).join('');
}

// -------------------------------------------------------------------
// Animações de entrada
// -------------------------------------------------------------------
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduceMotion) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
        entry.target.style.opacity = '1';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.stat-card, .offer-card').forEach((el) => {
    el.style.opacity = '0';
    observer.observe(el);
  });
}

// -------------------------------------------------------------------
// Contadores (ticker)
// -------------------------------------------------------------------
function formatNumber(num) {
  // 1300 -> "1.300" (coerente com os valores escritos no HTML)
  return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function animateCounter(element, target, duration = 2000) {
  if (reduceMotion) { element.textContent = '+' + formatNumber(target); return; }
  const start = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = '+' + formatNumber(target * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const statsSection = document.querySelector('.hero-ticker');
if (statsSection) {
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.querySelectorAll('.ticker-value[data-target]').forEach((stat) => {
        animateCounter(stat, parseInt(stat.getAttribute('data-target'), 10));
      });
      statsObserver.unobserve(entry.target);
    });
  }, { threshold: 0.5 });
  statsObserver.observe(statsSection);
}

// Followers em tempo real (DecAPI, sem chave)
function fetchFollowerCount() {
  const el = document.getElementById('followerCount');
  if (!el) return;
  fetch(`https://decapi.me/twitch/followcount/${TWITCH_CHANNEL}`)
    .then((r) => r.text())
    .then((text) => {
      const count = parseInt(text.trim(), 10);
      if (!isNaN(count)) animateCounter(el, count, 2000);
      else el.textContent = '+1.000';
    })
    .catch(() => { el.textContent = '+1.000'; });
}

// -------------------------------------------------------------------
// Estado da stream (só na página com player)
// -------------------------------------------------------------------
let currentStreamState = null;

function loadTwitchIframe() {
  const container = document.getElementById('twitch-embed-container');
  if (!container) return;
  const parents = ['obabayaga.com', 'www.obabayaga.com', 'localhost']
    .map((p) => 'parent=' + p).join('&');
  container.innerHTML = `
    <iframe
      src="https://player.twitch.tv/?channel=${TWITCH_CHANNEL}&${parents}&muted=true"
      title="Stream ao vivo do ${TWITCH_CHANNEL} na Twitch"
      height="100%"
      width="100%"
      allowfullscreen="true"
      allow="autoplay; fullscreen">
    </iframe>`;
}

function setLiveUI(isLive) {
  const offlineCard = document.getElementById('offlineCard');
  const liveBadge = document.getElementById('liveBadge');
  const liveText = document.getElementById('liveText');
  if (offlineCard) offlineCard.classList.toggle('visible', !isLive);
  if (liveBadge) liveBadge.classList.toggle('live-active', isLive);
  if (liveText) liveText.textContent = isLive ? 'AO VIVO' : 'OFFLINE';
  const pill = document.getElementById('navLivePill');
  if (pill) pill.hidden = !isLive;
  const chatLive = document.getElementById('chatLive');
  if (chatLive) { chatLive.textContent = isLive ? '● LIVE' : '● OFFLINE'; chatLive.style.color = isLive ? '' : 'var(--muted)'; }
}

function checkTwitchStreamStatus() {
  fetch(`https://decapi.me/twitch/uptime/${TWITCH_CHANNEL}`)
    .then((r) => r.text())
    .then((status) => {
      const text = status.trim().toLowerCase();
      const isOffline = text === '' || text === '-1' || text.includes('offline') || text.includes('error');
      const newState = isOffline ? 'offline' : 'online';
      if (currentStreamState === newState) return;
      currentStreamState = newState;
      if (isOffline) {
        const container = document.getElementById('twitch-embed-container');
        if (container) container.innerHTML = '';
        setLiveUI(false);
      } else {
        if (document.getElementById('twitch-embed-container')) loadTwitchIframe();
        setLiveUI(true);
      }
    })
    .catch(() => {
      if (currentStreamState !== 'offline') { currentStreamState = 'offline'; setLiveUI(false); }
    });
}

// -------------------------------------------------------------------
// Arranque
// -------------------------------------------------------------------
function initializeApp() {
  // Ano do copyright
  document.querySelectorAll('#year').forEach((el) => { el.textContent = new Date().getFullYear(); });

  if (document.getElementById('followerCount')) {
    fetchFollowerCount();
    setInterval(fetchFollowerCount, FOLLOWER_CHECK_INTERVAL);
  }

  if (document.getElementById('twitch-embed-container') || document.getElementById('navLivePill')) {
    setLiveUI(false);
    checkTwitchStreamStatus();
    setInterval(checkTwitchStreamStatus, STREAM_CHECK_INTERVAL);
    // Volta a verificar quando o utilizador regressa ao separador
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkTwitchStreamStatus();
    });
  }

}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
