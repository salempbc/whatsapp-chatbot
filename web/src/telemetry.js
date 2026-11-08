export const sendClientError = (err, info = '') => {
  try {
    const msg = err?.message || String(err || '');
    if (msg.includes('WebAppMethodUnsupported')) return;
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        stack: err?.stack || '',
        info,
        userAgent: navigator.userAgent,
        url: window.location.pathname || '/'
      })
    }).catch(() => {});
  } catch (_) {}
};

