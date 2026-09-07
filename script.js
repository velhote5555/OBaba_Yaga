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
// Navegação
// -------------------------------------------------------------------
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const navLinks = document.querySelectorAll('.nav-link');
const navbar = document.querySelector('.navbar');

function setMenu(open) {
  navMenu.classList.toggle('active', open);
  const icon = navToggle.querySelector('i');
  icon.classList.toggle('fa-bars', !open);
  icon.classList.toggle('fa-times', open);
  navToggle.setAttribute('aria-expanded', String(open));
  navToggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
}

if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => setMenu(!navMenu.classList.contains('active')));
  navLinks.forEach((link) => link.addEventListener('click', () => {
    if (navMenu.classList.contains('active')) setMenu(false);
  }));
}

// Scroll suave para âncoras da própria página
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.pageYOffset - navbar.offsetHeight;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// Botões que abrem links externos (afiliados, Twitch)
document.querySelectorAll('[data-link]').forEach((el) => {
  el.addEventListener('click', function () {
    window.open(this.getAttribute('data-link'), '_blank', 'noopener,noreferrer');
  });
});

// Sombra da navbar + link ativo + parallax, num único listener (throttled)
const heroBg = document.querySelector('.hero-bg');
const sections = document.querySelectorAll('section[id]');
let ticking = false;

function onScroll() {
  const y = window.pageYOffset;
  navbar.style.boxShadow = y <= 0 ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.3)';
  if (heroBg) heroBg.style.transform = `translateX(-50%) translateY(${y * 0.5}px)`;
  updateActiveNavLink(y);
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
}, { passive: true });

function updateActiveNavLink(y) {
  if (!sections.length) return;
  const navbarHeight = navbar.offsetHeight;
  sections.forEach((section) => {
    const top = section.offsetTop - navbarHeight - 100;
    const bottom = top + section.offsetHeight;
    if (y >= top && y < bottom) {
      navLinks.forEach((l) => l.classList.remove('active'));
      const current = document.querySelector(`.nav-link[href="#${section.id}"]`);
      if (current) current.classList.add('active');
    }
  });
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
        loadTwitchIframe();
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

  if (document.getElementById('twitch-embed-container')) {
    setLiveUI(false);
    checkTwitchStreamStatus();
    setInterval(checkTwitchStreamStatus, STREAM_CHECK_INTERVAL);
    // Volta a verificar quando o utilizador regressa ao separador
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkTwitchStreamStatus();
    });
  }

  updateActiveNavLink(window.pageYOffset);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
