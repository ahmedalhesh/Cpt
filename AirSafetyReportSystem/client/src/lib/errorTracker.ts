export function initErrorTracker() {
  if (typeof window === 'undefined') return;

  const send = (payload: any) => {
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  window.addEventListener('error', (event) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      send({
        level: 'error',
        message: event?.message || 'window.error',
        stack: event?.error?.stack || '',
        path: location.pathname,
        method: 'CLIENT',
        status: 0,
        userId: user?.id || null,
        userEmail: user?.email || null,
      });
    } catch {}
  });

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      const reason: any = event?.reason || {};
      send({
        level: 'error',
        message: String(reason?.message || 'unhandledrejection'),
        stack: String(reason?.stack || ''),
        path: location.pathname,
        method: 'CLIENT',
        status: 0,
        userId: user?.id || null,
        userEmail: user?.email || null,
      });
    } catch {}
  });
}

