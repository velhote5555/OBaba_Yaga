// ===================================================================
// OBABA_YAGA — Login com a Twitch (Implicit Grant Flow, sem servidor)
// ===================================================================
//
// COMO CONFIGURAR (obrigatório antes de publicar):
// 1. Vai a https://dev.twitch.tv/console/apps e cria uma aplicação.
// 2. Em "OAuth Redirect URLs", adiciona exatamente o valor de REDIRECT_URI
//    abaixo (tem de ser IDÊNTICO, incluindo a barra final "/").
// 3. Copia o "Client ID" gerado e cola-o em CLIENT_ID abaixo.
// 4. Se o teu site ainda não estiver no domínio próprio (obabayaga.com),
//    muda REDIRECT_URI para o teu link do GitHub Pages, por exemplo:
//    'https://velhote5555.github.io/OBaba_Yaga/'
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
  };

  const TOKEN_KEY = 'obaba_twitch_token';
  const LOGIN_KEY = 'obaba_twitch_login';
  const AVATAR_KEY = 'obaba_twitch_avatar';
  const RETURN_KEY = 'obaba_twitch_return_to';
  const STATE_KEY = 'obaba_twitch_state';

  let currentUser = null; // { login, displayName, avatar, points, pointsAlltime, rank }

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

  // Lê os pontos e o ranking do StreamElements (API pública, sem chave)
  async function fetchStreamElementsPoints(login) {
    if (!login) return null;
    try {
      const res = await fetch(
        'https://api.streamelements.com/kappa/v2/points/' +
          encodeURIComponent(CONFIG.SE_CHANNEL) +
          '/' +
          encodeURIComponent(login)
      );
      if (!res.ok) return null;
      const data = await res.json();
      // a API devolve nomes de campo ligeiramente diferentes consoante a versão
      return {
        points: data.points ?? data.current ?? 0,
        pointsAlltime: data.pointsAlltime ?? data.alltime ?? null,
        rank: data.rank ?? data.leaderboardRank ?? null,
      };
    } catch (e) {
      console.warn('[TwitchAuth] Não foi possível obter pontos da StreamElements.', e);
      return null;
    }
  }

  // Lê o top X do leaderboard de pontos do StreamElements
  async function fetchStreamElementsLeaderboard(limit) {
    limit = limit || 20;
    try {
      const res = await fetch(
        'https://api.streamelements.com/kappa/v2/points/' +
          encodeURIComponent(CONFIG.SE_CHANNEL) +
          '/top?limit=' +
          limit
      );
      if (!res.ok) return null;
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.users || data.top || [];
      return list.map((item, idx) => ({
        rank: item.rank ?? idx + 1,
        username: item.username ?? item.user ?? '—',
        points: item.points ?? item.current ?? 0,
      }));
    } catch (e) {
      console.warn('[TwitchAuth] Não foi possível obter o leaderboard da StreamElements.', e);
      return null;
    }
  }

  function renderAuthUI() {
    const slot = document.getElementById('navAuth');
    if (!slot) return;

    if (currentUser) {
      slot.innerHTML = `
        <div class="nav-user" id="navUserToggle">
          <img src="${currentUser.avatar || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/de130ab0-def7-11e9-b668-784f43822e80-profile_image-70x70.png'}" alt="${currentUser.displayName}" class="nav-user-avatar">
          <span class="nav-user-name">${currentUser.displayName}</span>
          <i class="fas fa-chevron-down nav-user-caret"></i>
          <div class="nav-user-menu" id="navUserMenu">
            <button id="navLogoutBtn" class="nav-user-logout"><i class="fas fa-arrow-right-from-bracket"></i> Sair</button>
          </div>
        </div>
      `;
      const toggle = document.getElementById('navUserToggle');
      const menu = document.getElementById('navUserMenu');
      toggle.addEventListener('click', () => menu.classList.toggle('open'));
      document.addEventListener('click', (e) => {
        if (!toggle.contains(e.target)) menu.classList.remove('open');
      });
      document.getElementById('navLogoutBtn').addEventListener('click', logout);
    } else {
      slot.innerHTML = `
        <button class="nav-login-btn" id="navLoginBtn">
          <i class="fab fa-twitch"></i> Entrar com Twitch
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
      card.innerHTML = '';
      if (section) section.style.display = 'none';
      return;
    }

    if (section) section.style.display = '';

    const pointsText = currentUser.points != null ? currentUser.points.toLocaleString('pt-PT') : '--';
    const rankText = currentUser.rank != null ? '#' + currentUser.rank : '--';
    const alltimeText = currentUser.pointsAlltime != null ? currentUser.pointsAlltime.toLocaleString('pt-PT') : '--';

    card.innerHTML = `
      <div class="player-stats-avatar">
        <img src="${currentUser.avatar || 'https://static-cdn.jtvnw.net/user-default-pictures-uv/de130ab0-def7-11e9-b668-784f43822e80-profile_image-70x70.png'}" alt="${currentUser.displayName}">
      </div>
      <div class="player-stats-info">
        <span class="player-stats-name">${currentUser.displayName}</span>
        <div class="player-stats-metrics">
          <div class="player-stats-metric">
            <span class="player-stats-value">${pointsText}</span>
            <span class="player-stats-label"><i class="fas fa-coins"></i> Pontos</span>
          </div>
          <div class="player-stats-metric">
            <span class="player-stats-value">${rankText}</span>
            <span class="player-stats-label"><i class="fas fa-ranking-star"></i> Ranking</span>
          </div>
          <div class="player-stats-metric">
            <span class="player-stats-value">${alltimeText}</span>
            <span class="player-stats-label"><i class="fas fa-infinity"></i> Total (all-time)</span>
          </div>
        </div>
      </div>
      <button class="player-stats-refresh" id="playerStatsRefresh" title="Atualizar">
        <i class="fas fa-rotate-right"></i>
      </button>
    `;

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
    if (!currentUser) {
      list.innerHTML = '';
      return;
    }

    list.innerHTML = '<p class="ranking-loading">A carregar ranking...</p>';
    const top = await fetchStreamElementsLeaderboard(20);

    if (!top || top.length === 0) {
      list.innerHTML = '<p class="ranking-loading">Não foi possível carregar o ranking de momento.</p>';
      return;
    }

    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
    list.innerHTML = top
      .map((entry) => {
        const isMe = currentUser && entry.username && entry.username.toLowerCase() === currentUser.login.toLowerCase();
        return `
          <div class="ranking-row${isMe ? ' ranking-row-me' : ''}">
            <span class="ranking-position">${medals[entry.rank] || '#' + entry.rank}</span>
            <span class="ranking-username">${entry.username}${isMe ? ' <span class="ranking-you-tag">(tu)</span>' : ''}</span>
            <span class="ranking-points">${entry.points.toLocaleString('pt-PT')} <i class="fas fa-coins"></i></span>
          </div>
        `;
      })
      .join('');
  }

  function applyGates() {
    const isLoggedIn = !!currentUser;
    document.querySelectorAll('[data-gate]').forEach((el) => {
      el.classList.toggle('gate-unlocked', isLoggedIn);
    });
    // liga qualquer botão de login dentro dos overlays de bloqueio
    document.querySelectorAll('.gate-login-btn').forEach((btn) => {
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

