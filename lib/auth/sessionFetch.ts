/** Renew customer access inside its existing fixed refresh deadline. */
type Runtime = {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  setCookies: (access: string, deadline: number) => void;
  now?: () => number;
};

function claims(token: string | null): Record<string, unknown> {
  try {
    const encoded = (token || '').split('.')[1];
    return JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

function sessionError(message: string, status = 401): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

export function createSessionFetch(apiBase: string, rawFetch: typeof fetch, runtime: Runtime): typeof fetch {
  const base = new URL(apiBase);
  const basePath = base.pathname.replace(/\/$/, '');
  const now = runtime.now || Date.now;
  let pending: Promise<string> | null = null;
  let pendingToken: string | null = null;

  async function renew(): Promise<string> {
    const refresh = runtime.storage.getItem('refresh_token');
    if (!refresh) throw sessionError('Please sign in again.');
    if (pending && pendingToken === refresh) return pending;
    pendingToken = refresh;
    pending = (async () => {
      try {
        const response = await rawFetch(apiBase.replace(/\/$/, '') + '/auth/refresh', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!response.ok) {
          throw sessionError('Unable to renew sign-in.', response.status);
        }
        const result = await response.json();
        const access = result?.data?.access_token;
        const oldIdentity = claims(refresh).sub;
        const renewed = typeof access === 'string' ? claims(access) : {};
        if (!result.success || !access || renewed.type !== 'access' || !oldIdentity
            || renewed.sub !== oldIdentity || result.data.refresh_token !== refresh) {
          throw sessionError('Invalid session renewal response.', 502);
        }
        // A logout or a different login while renewal is in flight must win.
        if (runtime.storage.getItem('refresh_token') !== refresh) {
          throw sessionError('Sign-in changed while renewing.', 409);
        }
        runtime.storage.setItem('access_token', access);
        const deadline = claims(refresh).exp;
        if (typeof deadline === 'number') runtime.setCookies(access, deadline);
        return access;
      } finally {
        if (pendingToken === refresh) { pending = null; pendingToken = null; }
      }
    })();
    return pending;
  }

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request ? request.url : String(input), apiBase);
    const headers = new Headers(init?.headers || request?.headers);
    const stored = runtime.storage.getItem('access_token');
    const sent = headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
    const sameUser = stored && sent && claims(sent).type === 'access'
      && claims(stored).sub && claims(stored).sub === claims(sent).sub;
    const excluded = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];
    if (url.origin !== base.origin || !url.pathname.startsWith(basePath + '/') || !sameUser
        || excluded.some(path => url.pathname === basePath + path) || claims(stored).type !== 'access') {
      return rawFetch(input, init);
    }
    let token = stored;
    const expiry = claims(stored).exp;
    if (typeof expiry === 'number' && expiry * 1000 <= now() + 60_000) token = await renew();
    headers.set('Authorization', 'Bearer ' + token);
    const options = { ...init, headers };
    const response = await rawFetch(input, options);
    const method = (init?.method || request?.method || 'GET').toUpperCase();
    // Never replay a payment, upload, edit, approval or other mutation. Only
    // an authentication-rejected read can be renewed and retried once.
    if (response.status === 401 && ['GET', 'HEAD'].includes(method)) {
      const fresh = await renew();
      headers.set('Authorization', 'Bearer ' + fresh);
      return rawFetch(input, { ...init, headers });
    }
    return response;
  };
}

let installed = false;
export function installSessionFetch(apiBase: string): void {
  if (installed || typeof window === 'undefined') return;
  const rawFetch = window.fetch.bind(window);
  window.fetch = createSessionFetch(apiBase, rawFetch, {
    storage: window.localStorage,
    setCookies(access, deadline) {
      const expires = new Date(deadline * 1000).toUTCString();
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      for (const name of ['auth_token', 'session']) {
        document.cookie = `${name}=${access}; Path=/; Expires=${expires}; SameSite=Lax${secure}`;
      }
    },
  });
  installed = true;
}
