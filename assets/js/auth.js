// ============================================================
// 교육 플랫폼 사원 인증 공통 유틸
// ============================================================
(function () {
  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycby8zaIbNuiBMgJCasc3HMSGxYvV9v07SaH4kYaHPJF62ti_MsghiKsdY0QEmG-S7_Cp/exec';
  const TOKEN_KEY = 'edu.authToken';
  const USER_KEY = 'edu.authUser';
  const originalFetch = window.fetch.bind(window);

  function apiUrl() {
    return window.EDU_CONFIG?.API_URL || DEFAULT_API_URL;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  function isApiRequest(url) {
    return String(url || '').startsWith(apiUrl()) || /script\.google\.com\/macros\/s\/.+\/exec/.test(String(url || ''));
  }

  function shouldSkipAuth(action) {
    return action === 'login';
  }

  function normalizeAppsScriptPost(url, init) {
    const nextInit = init ? { ...init } : undefined;
    if (!nextInit || !isApiRequest(url)) return nextInit;

    const method = String(nextInit.method || 'GET').toUpperCase();
    if (method !== 'POST' || typeof nextInit.body !== 'string') return nextInit;

    // Apps Script web apps can reject JSON preflight requests. Sending a JSON
    // string as text/plain keeps the request simple while Code.gs still parses it.
    nextInit.headers = { ...(nextInit.headers || {}), 'Content-Type': 'text/plain;charset=utf-8' };
    return nextInit;
  }

  function redirectToLogin() {
    const returnTo = encodeURIComponent(location.pathname.split('/').pop() + location.search);
    location.href = `login.html?returnTo=${returnTo}`;
  }

  async function authFetch(input, init) {
    const token = getToken();
    let url = typeof input === 'string' ? input : input.url;
    let nextInit = init ? { ...init } : undefined;

    if (token && isApiRequest(url)) {
      const method = String(nextInit?.method || 'GET').toUpperCase();
      if (method === 'GET') {
        const parsed = new URL(url, location.href);
        if (!shouldSkipAuth(parsed.searchParams.get('action')) && !parsed.searchParams.has('authToken')) {
          parsed.searchParams.set('authToken', token);
          url = parsed.toString();
        }
      } else if (nextInit?.body && typeof nextInit.body === 'string') {
        try {
          const body = JSON.parse(nextInit.body);
          if (!shouldSkipAuth(body.action) && !body.authToken) {
            body.authToken = token;
            nextInit.body = JSON.stringify(body);
          }
        } catch {
          // Leave non-JSON requests untouched.
        }
      }
    }

    nextInit = normalizeAppsScriptPost(url, nextInit);
    return originalFetch(url, nextInit);
  }

  async function login(employeeNo, pin) {
    const res = await originalFetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', employeeNo, pin })
    });
    const data = await res.json();
    if (data.success) setSession(data.token, data.user);
    return data;
  }

  async function logout() {
    const token = getToken();
    if (token) {
      try {
        await authFetch(apiUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout' })
        });
      } catch {
        // Local logout should still complete if the network is unavailable.
      }
    }
    clearSession();
    location.href = 'login.html';
  }

  async function requireAuth(options = {}) {
    if (!getToken()) {
      redirectToLogin();
      return null;
    }

    const requiredRole = options.admin ? '&requiredRole=admin' : '';
    const res = await authFetch(`${apiUrl()}?action=getMe${requiredRole}`);
    const data = await res.json();
    if (!data.success) {
      clearSession();
      redirectToLogin();
      return null;
    }

    setSession(getToken(), data.user);
    if (options.admin && data.user.role !== 'admin') {
      alert('관리자 권한이 필요합니다.');
      location.href = 'index.html';
      return null;
    }
    return data.user;
  }

  window.fetch = authFetch;
  window.EDU_AUTH = {
    apiUrl,
    login,
    logout,
    requireAuth,
    getToken,
    getUser,
    setSession,
    clearSession
  };
})();
