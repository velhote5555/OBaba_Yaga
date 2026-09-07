// ===================================================================
// OBABA_YAGA — Login com a Twitch (Implicit Grant Flow, sem servidor)
// ===================================================================
//
// COMO CONFIGURAR (obrigatório antes de publicar):
// 1. Vai a https://dev.twitch.tv/console/apps e cria uma aplicação.
// 2. Em "OAuth Redirect URLs", adiciona exatamente o valor de REDIRECT_URI
//    abaixo (tem de ser IDÊNTICO, incluindo a barra final "/").
// 3. Copia o "Client ID" gerado e cola-o em CLIENT_ID abaixo.
// 4. O REDIRECT_URI tem de ser https e igual ao registado na Twitch.
//    Garante que www.obabayaga.com redireciona para obabayaga.com, senão o
//    login falha para quem entrar pelo "www".
// 5. SE_CHANNEL: o nome do teu canal na StreamElements (normalmente é
//    igual ao teu username da Twitch). Se os pontos não aparecerem,
//    troca por o "Channel ID" numérico, disponível no StreamElements
//    em Overlays -> qualquer widget -> "Channel ID".
// ===================================================================

const TwitchAuth = (function () {
  const CONFIG = {
    CLIENT_ID: '34eu7t2r5xt7dev6v1x8cimr2ajhxk', // Client ID da app "OBABA_YAGA Website"
    REDIRECT_URI: 'https://obabayaga.com/',     // <-- tem de corresponder ao registado na Twitch
    SCOPE: '', // login apenas para identificação, sem permissões extra
    SE_CHANNEL: '66d3ab3e543cc77f5efabde9', // Account ID da StreamElements (canal obaba_yaga)
    EXCLUDE_FROM_RANKING: ['obaba_yaga', 'own3d'], // contas a esconder da tabela pública (streamer + bots)
  };

  const TOKEN_KEY = 'obaba_twitch_token';
  const LOGIN_KEY = 'obaba_twitch_login';
  const AVATAR_KEY = 'obaba_twitch_avatar';
  const RETURN_KEY = 'obaba_twitch_return_to';
  const STATE_KEY = 'obaba_twitch_state';

  let currentUser = null; // { login, displayName, avatar, points, pointsAlltime, rank }

  const DEFAULT_AVATAR = 'https://static-cdn.jtvnw.net/user-default-pictures-uv/de130ab0-def7-11e9-b668-784f43822e80-profile_image-70x70.png';

  // Escapa qualquer texto vindo de APIs externas antes de o inserir em innerHTML (evita XSS)
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Só aceita URLs https para avatares
  function safeUrl(url) {
    return typeof url === 'string' && /^https:\/\//i.test(url) ? escapeHtml(url) : DEFAULT_AVATAR;
  }

  function formatPoints(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '--';
    return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function randomState() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function buildAuthorizeUrl() {
    const state = randomState();
    sessionStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      response_type: 'token',
      client_id: CONFIG.CLIENT_ID,
      redirect_uri: CONFIG.REDIRECT_URI,
      scope: CONFIG.SCOPE,
      state: state,
    });
    return 'https://id.twitch.tv/oauth2/authorize?' + params.toString();
  }

  function login() {
    // guarda a página atual para regressarmos aqui depois do login
    sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search);
    window.location.href = buildAuthorizeUrl();
  }

  function logout() {
    const token = localStorage.getItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGIN_KEY);
    localStorage.removeItem(AVATAR_KEY);
    currentUser = null;

    if (token) {
      // revoga o token do lado da Twitch (não precisa de client secret)
      fetch('https://id.twitch.tv/oauth2/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: CONFIG.CLIENT_ID, token: token }),
      }).catch(() => {});
    }

    renderAuthUI();
    renderPlayerStats();
    renderLeaderboard();
    applyGates();
  }

  function parseTokenFromHash() {
    if (!window.location.hash || window.location.hash.indexOf('access_token') === -1) {
      return null;
    }
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const token = hashParams.get('access_token');
    const state = hashParams.get('state');
    const expectedState = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);

    if (!token) return null;
    if (expectedState && state !== expectedState) {
      console.warn('[TwitchAuth] state inválido, a ignorar resposta.');
      return null;
    }
    return token;
  }

  function cleanUrlHash() {
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  async function validateToken(token) {
    try {
      const res = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { Authorization: 'OAuth ' + token },
      });
      if (!res.ok) return null;
      return await res.json(); // { client_id, login, user_id, expires_in, ... }
    } catch (e) {
      return null;
    }
  }

  async function fetchUserProfile(token, login) {
    try {
      const res = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          Authorization: 'Bearer ' + token,
          'Client-Id': CONFIG.CLIENT_ID,
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const user = data.data && data.data[0];
      if (!user) return null;
      return {
        login: user.login || login,
        displayName: user.display_name || login,
        avatar: user.profile_image_url || '',
      };
    } catch (e) {
      return null;
    }
  }

  let lastPointsError = null;
  let lastLeaderboardError = null;

  // Lê os pontos e o ranking do StreamElements (API pública, sem chave)
  async function fetchStreamElementsPoints(login) {
    if (!login) return null;
    lastPointsError = null;
    const url =
      'https://api.streamelements.com/kappa/v2/points/' +
      encodeURIComponent(CONFIG.SE_CHANNEL) +
      '/' +
      encodeURIComponent(login);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastPointsError = 'HTTP ' + res.status + ' em ' + url;
        console.warn('[TwitchAuth]', lastPointsError);
        return null;
      }
      const data = await res.json();
      // a API devolve nomes de campo ligeiramente diferentes consoante a versão
      return {
        points: data.points ?? data.current ?? 0,
        pointsAlltime: data.pointsAlltime ?? data.alltime ?? null,
        rank: data.rank ?? data.leaderboardRank ?? null,
      };
    } catch (e) {
      lastPointsError = 'Erro de rede/CORS ao aceder a ' + url + ' — ' + e.message;
      console.warn('[TwitchAuth]', lastPointsError, e);
      return null;
    }
  }

  // Lê o top X do leaderboard de pontos do StreamElements
  async function fetchStreamElementsLeaderboard(limit) {
    limit = limit || 20;
    lastLeaderboardError = null;
    const url =
      'https://api.streamelements.com/kappa/v2/points/' +
      encodeURIComponent(CONFIG.SE_CHANNEL) +
      '/top?limit=' +
      limit;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastLeaderboardError = 'HTTP ' + res.status + ' em ' + url;
        console.warn('[TwitchAuth]', lastLeaderboardError);
        return null;
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.users || data.top || [];
      const excluded = CONFIG.EXCLUDE_FROM_RANKING.map((u) => u.toLowerCase());
      const filtered = list.filter((item) => {
        const uname = (item.username ?? item.user ?? '').toLowerCase();
        return uname && !excluded.includes(uname);
      });
      return filtered.map((item, idx) => ({
        rank: idx + 1, // reordenado depois de remover contas excluídas
        username: item.username ?? item.user ?? '—',
        points: item.points ?? item.current ?? 0,
      }));
    } catch (e) {
      lastLeaderboardError = 'Erro de rede/CORS ao aceder a ' + url + ' — ' + e.message;
      console.warn('[TwitchAuth]', lastLeaderboardError, e);
      return null;
    }
  }

  function renderAuthUI() {
    const slot = document.getElementById('navAuth');
    if (!slot) return;

    if (currentUser) {
      slot.innerHTML = `
        <div class="nav-user" id="navUserToggle" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false" aria-label="Conta de ${escapeHtml(currentUser.displayName)}">
          <img src="${safeUrl(currentUser.avatar)}" alt="" class="nav-user-avatar">
          <span class="nav-user-name">${escapeHtml(currentUser.displayName)}</span>
          <i class="fas fa-chevron-down nav-user-caret" aria-hidden="true"></i>
          <div class="nav-user-menu" id="navUserMenu">
            <button id="navLogoutBtn" class="nav-user-logout"><i class="fas fa-arrow-right-from-bracket" aria-hidden="true"></i> Sair</button>
          </div>
        </div>
      `;
      const toggle = document.getElementById('navUserToggle');
      const menu = document.getElementById('navUserMenu');
      const setOpen = (open) => {
        menu.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', String(open));
      };
      toggle.addEventListener('click', () => setOpen(!menu.classList.contains('open')));
      toggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!menu.classList.contains('open')); }
        if (e.key === 'Escape') setOpen(false);
      });
      document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target)) setOpen(false);
      });
      document.getElementById('navLogoutBtn').addEventListener('click', logout);
    } else {
      slot.innerHTML = `
        <button class="nav-login-btn" id="navLoginBtn">
          <i class="fab fa-twitch" aria-hidden="true"></i> <span>Entrar com Twitch</span>
        </button>
      `;
      document.getElementById('navLoginBtn').addEventListener('click', login);
    }
  }

  // Preenche o cartão "As Tuas Estatísticas" (pontos + ranking), se existir na página
  function renderPlayerStats() {
    const card = document.getElementById('playerStats');
    if (!card) return;
    const section = card.closest('.player-stats-section');

    if (!currentUser) {
      if (section) section.style.display = '';
      card.innerHTML = `
        <div class="player-stats-login">
          <div class="gate-icon"><i class="fab fa-twitch" aria-hidden="true"></i></div>
          <div>
            <p class="player-stats-login-title">Vê a tua posição no ranking</p>
            <p class="player-stats-login-text">Entra com a tua conta Twitch para veres os teus pontos e o teu lugar na comunidade.</p>
          </div>
          <button class="gate-login-btn" id="playerStatsLogin"><i class="fab fa-twitch" aria-hidden="true"></i> Entrar com Twitch</button>
        </div>
      `;
      const btn = document.getElementById('playerStatsLogin');
      if (btn) btn.addEventListener('click', login);
      return;
    }

    if (section) section.style.display = '';

    const pointsText = currentUser.points != null ? formatPoints(currentUser.points) : '--';
    const rankText = currentUser.rank != null ? '#' + escapeHtml(currentUser.rank) : '--';
    const alltimeText = currentUser.pointsAlltime != null ? formatPoints(currentUser.pointsAlltime) : '--';
    const errorNote =
      currentUser.points == null && lastPointsError
        ? `<p class="player-stats-error">Não foi possível obter os teus pontos agora. Tenta atualizar daqui a pouco.</p>`
        : '';

    card.innerHTML = `
      <div class="player-stats-avatar">
        <img src="${safeUrl(currentUser.avatar)}" alt="">
      </div>
      <div class="player-stats-info">
        <span class="player-stats-name">${escapeHtml(currentUser.displayName)}</span>
        <div class="player-stats-metrics">
          <div class="player-stats-metric">
            <span class="player-stats-value">${pointsText}</span>
            <span class="player-stats-label"><i class="fas fa-coins" aria-hidden="true"></i> Pontos</span>
          </div>
          <div class="player-stats-metric">
            <span class="player-stats-value">${rankText}</span>
            <span class="player-stats-label"><i class="fas fa-ranking-star" aria-hidden="true"></i> Ranking</span>
          </div>
          <div class="player-stats-metric">
            <span class="player-stats-value">${alltimeText}</span>
            <span class="player-stats-label"><i class="fas fa-infinity" aria-hidden="true"></i> Total (all-time)</span>
          </div>
        </div>
      </div>
      <button class="player-stats-refresh" id="playerStatsRefresh" title="Atualizar" aria-label="Atualizar os meus pontos">
        <i class="fas fa-rotate-right" aria-hidden="true"></i>
      </button>
    `;
    if (errorNote) card.insertAdjacentHTML('beforeend', errorNote);

    const refreshBtn = document.getElementById('playerStatsRefresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        const sePoints = await fetchStreamElementsPoints(currentUser.login);
        if (sePoints) Object.assign(currentUser, sePoints);
        renderPlayerStats();
        refreshBtn.classList.remove('spinning');
      });
    }
  }

  // Preenche a tabela do leaderboard, se existir na página (ranking.html)
  async function renderLeaderboard() {
    const list = document.getElementById('rankingList');
    if (!list) return;

    list.innerHTML = '<p class="ranking-loading">A carregar ranking...</p>';
    // pede alguns extra para compensar as contas excluídas (streamer + bots)
    const buffer = CONFIG.EXCLUDE_FROM_RANKING.length + 2;
    const top = await fetchStreamElementsLeaderboard(20 + buffer);
    const trimmed = top ? top.slice(0, 20) : top;

    if (!trimmed || trimmed.length === 0) {
      list.innerHTML = `
        <div class="ranking-error">
          <p>Não foi possível carregar a tabela do ranking agora.</p>
          <a class="ranking-fallback-link" href="https://streamelements.com/obaba_yaga/leaderboard" target="_blank" rel="noopener noreferrer">
            Ver ranking na StreamElements <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
          </a>
        </div>
      `;
      return;
    }

    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    list.innerHTML = trimmed
      .map((entry) => {
        const isMe = currentUser && entry.username && entry.username.toLowerCase() === currentUser.login.toLowerCase();
        return `
          <div class="ranking-row${isMe ? ' ranking-row-me' : ''}">
            <span class="ranking-position">${medals[entry.rank] || '#' + entry.rank}</span>
            <span class="ranking-username">${escapeHtml(entry.username)}${isMe ? ' <span class="ranking-you-tag">(tu)</span>' : ''}</span>
            <span class="ranking-points">${formatPoints(entry.points)} <i class="fas fa-coins" aria-hidden="true"></i></span>
          </div>
        `;
      })
      .join('');
  }

  // Liga qualquer botão de login espalhado pela página (ex.: cartão do ranking)
  function applyGates() {
    document.querySelectorAll('button.gate-login-btn').forEach((btn) => {
      btn.onclick = login;
    });
  }

  async function init() {
    // 1. Se acabámos de voltar da Twitch com um token no URL
    const tokenFromHash = parseTokenFromHash();
    if (tokenFromHash) {
      cleanUrlHash();
      const validation = await validateToken(tokenFromHash);
      if (validation) {
        localStorage.setItem(TOKEN_KEY, tokenFromHash);
        localStorage.setItem(LOGIN_KEY, validation.login || '');
        const profile = await fetchUserProfile(tokenFromHash, validation.login);
        if (profile) localStorage.setItem(AVATAR_KEY, profile.avatar || '');
      }

      const returnTo = sessionStorage.getItem(RETURN_KEY);
      sessionStorage.removeItem(RETURN_KEY);
      if (returnTo && returnTo !== window.location.pathname + window.location.search) {
        window.location.href = returnTo;
        return; // a página vai recarregar, não continuar a inicializar aqui
      }
    }

    // 2. Verifica se já existe um token guardado e válido
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      const validation = await validateToken(storedToken);
      if (validation) {
        const profile = await fetchUserProfile(storedToken, validation.login);
        currentUser = {
          login: validation.login,
          displayName: (profile && profile.displayName) || validation.login,
          avatar: (profile && profile.avatar) || localStorage.getItem(AVATAR_KEY) || '',
          points: null,
          pointsAlltime: null,
          rank: null,
        };

        const sePoints = await fetchStreamElementsPoints(currentUser.login);
        if (sePoints) Object.assign(currentUser, sePoints);
      } else {
        // token expirado ou inválido
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(LOGIN_KEY);
        localStorage.removeItem(AVATAR_KEY);
        currentUser = null;
      }
    }

    renderAuthUI();
    renderPlayerStats();
    applyGates();
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().then(() => {
      renderLeaderboard();
      const refreshBtn = document.getElementById('rankingRefresh');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
          refreshBtn.classList.add('spinning');
          await renderLeaderboard();
          refreshBtn.classList.remove('spinning');
        });
      }
    });
  });

  return { login, logout, isLoggedIn: () => !!currentUser, getUser: () => currentUser };
})();

