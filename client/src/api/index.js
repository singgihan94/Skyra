const BASE = '';

async function request(url, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  };

  if (options.body instanceof FormData) {
    // Let browser set the Content-Type with correct boundary
    delete config.headers['Content-Type'];
    config.body = options.body;
  } else if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${BASE}${url}`, config);

  if (res.status === 401) {
    // Token expired — redirect to login
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Sesi habis. Silakan login ulang.');
  }

  const contentType = res.headers.get('content-type') || '';
  
  // Handle blob responses (Excel export)
  if (contentType.includes('spreadsheet') || contentType.includes('pdf') || contentType.includes('octet-stream')) {
    if (!res.ok) throw new Error('Export gagal.');
    return res.blob();
  }

  // Handle JSON and potential HTML error pages
  let data;
  if (contentType.includes('application/json')) {
    try {
      data = await res.json();
    } catch (e) {
      throw new Error('Gagal membaca data dari server (JSON corrupt).');
    }
  } else {
    // If not JSON, it might be an HTML error page from proxy (502/504) or crash
    const text = await res.text();
    console.error('SERVER NON-JSON RESPONSE:', text);
    throw new Error(`Server tidak memberikan respon JSON. (Status: ${res.status}). Silakan cek koneksi backend.`);
  }

  if (!res.ok) throw new Error(data?.error || 'Terjadi kesalahan.');
  return data;
}

export const api = {
  get: (url) => request(url),
  post: (url, body) => request(url, { method: 'POST', body }),
  put: (url, body) => request(url, { method: 'PUT', body }),
  delete: (url) => request(url, { method: 'DELETE' }),
};

// Helper to format Rupiah
export function formatRp(amount) {
  return 'Rp ' + (amount || 0).toLocaleString('id-ID');
}

// Helper to format date
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Download blob as file
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
