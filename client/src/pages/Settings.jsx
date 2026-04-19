import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { useBluetooth } from '../context/BluetoothContext';
import { useTheme } from '../context/ThemeContext';
import { Save, Upload, Store, Bluetooth, Printer, CheckCircle, AlertCircle, Wifi, Trash2, RefreshCcw, ShieldAlert, Key, Sun, Moon, Palette, Image } from 'lucide-react';

export default function Settings() {
  const { btStatus, btDeviceName, connectBluetooth, disconnectBluetooth, sendToPrinter } = useBluetooth();
  const { updateTheme } = useTheme();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [bgFile, setBgFile] = useState(null);
  const [bgPreview, setBgPreview] = useState(null);
  const fileRef = useRef(null);
  const bgRef = useRef(null);

  // Bluetooth Context used instead of local state

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await api.get('/api/settings');
      setSettings(data);
      if (data.store_logo_url) setLogoPreview(data.store_logo_url);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    setSaving(true);
    try {
      let currentPayload = { ...settings };

      // Upload logo first if changed
      if (logoFile) {
        const formData = new FormData();
        formData.append('logo', logoFile);
        const logoResult = await api.post('/api/settings/logo', formData);
        currentPayload.store_logo_url = logoResult.logo_url;
        setLogoFile(null);
      }

      // Upload background if changed
      if (bgFile) {
        const formData = new FormData();
        formData.append('background', bgFile);
        const bgResult = await api.post('/api/settings/background', formData);
        currentPayload.bg_image_url = bgResult.bg_image_url;
        setBgFile(null);
      }

      // Save settings
      const updated = await api.put('/api/settings', currentPayload);
      setSettings(updated);

      // Apply theme live
      updateTheme({
        mode: updated.theme_mode || 'dark',
        brandColor: updated.brand_color || '#d4a843',
        bgImageUrl: updated.bg_image_url || ''
      });

      showToast('Pengaturan berhasil disimpan!');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearTransactions() {
    const pwd = window.prompt('Peringatan: Ini akan menghapus seluruh riwayat pesanan dan mutasi stok.\n\nMasukkan Password Sistem untuk melanjutkan:');
    if (!pwd) return;

    if (window.confirm('Apakah Anda benar-benar yakin ingin menghapus SEMUA transaksi? Tindakan ini tidak dapat dibatalkan.')) {
      try {
        setSaving(true);
        const res = await api.post('/api/system/clear-transactions', { password: pwd });
        showToast(res.message);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setSaving(false);
      }
    }
  }

  async function handleResetDatabase() {
    const pwd = window.prompt('PERINGATAN KERAS: Ini akan menghapus SELURUH data (Produk, Bahan Baku, dll).\n\nMasukkan Password Sistem untuk melanjutkan:');
    if (!pwd) return;

    if (window.confirm('TINDAKAN SANGAT BERBAHAYA!\nSemua data menu dan inventaris akan musnah. Anda harus menginput ulang dari nol.\n\nLanjutkan reset total?')) {
      try {
        setSaving(true);
        const res = await api.post('/api/system/reset-all', { password: pwd });
        showToast(res.message);
        setTimeout(() => window.location.reload(), 2000);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setSaving(false);
      }
    }
  }

  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  // ─── Bluetooth Printer Functions ─────────────────────
  async function handleConnectBluetooth() {
    try {
      await connectBluetooth();
      showToast(`Terhubung ke printer!`);
    } catch (err) {
      if (err.name !== 'NotFoundError' && !err.message.includes('User cancelled')) {
        showToast(`Gagal: ${err.message}`, 'error');
      }
    }
  }

  async function handleDisconnectBluetooth() {
    await disconnectBluetooth();
    showToast('Printer diputuskan.');
  }

  async function testPrint() {
    try {
      const encoder = new TextEncoder();
      const storeName = settings?.store_name || 'Skyra Coffee';

      const ESC = 0x1B;
      const GS = 0x1D;

      const cmds = [
        new Uint8Array([ESC, 0x40]),
        new Uint8Array([ESC, 0x61, 0x01]),
        new Uint8Array([ESC, 0x45, 0x01]),
        new Uint8Array([GS, 0x21, 0x11]),
        encoder.encode(`${storeName}\n`),
        new Uint8Array([GS, 0x21, 0x00]),
        new Uint8Array([ESC, 0x45, 0x00]),
        encoder.encode('================================\n'),
        encoder.encode('   Test Print Berhasil!   \n'),
        encoder.encode(`   ${new Date().toLocaleString('id-ID')}\n`),
        encoder.encode('================================\n'),
        encoder.encode('Printer Bluetooth 58mm\n'),
        encoder.encode('terhubung dengan baik.\n'),
        encoder.encode('================================\n\n\n\n'),
        new Uint8Array([GS, 0x56, 0x00]),
      ];

      await sendToPrinter(cmds);
      showToast('Test print dikirim ke printer!');
    } catch (err) {
      showToast(`Gagal print: ${err.message}`, 'error');
    }
  }

  if (loading) {
    return <div className="flex-center" style={{ height: 300 }}><div className="text-gold">Memuat pengaturan...</div></div>;
  }

  return (
    <div className="page-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        </div>
      )}

      <div className="page-header">
        <h2>Pengaturan</h2>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* ─── Store Info Card ─────────────────── */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Store size={18} /> Informasi Toko</h3>
          </div>
          <div className="card-body">
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div
                style={{
                  width: 100, height: 100, borderRadius: 16,
                  background: logoPreview ? 'none' : 'linear-gradient(135deg, var(--accent-gold), var(--accent-coffee))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px', overflow: 'hidden', border: '2px solid var(--border-color)',
                  cursor: 'pointer'
                }}
                onClick={() => fileRef.current?.click()}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 40 }}>☕</span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleLogoChange}
              />
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> Ganti Logo
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Nama Toko</label>
              <input
                className="form-input"
                value={settings?.store_name || ''}
                onChange={e => setSettings(prev => ({ ...prev, store_name: e.target.value }))}
                placeholder="Nama toko Anda"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Alamat</label>
              <input
                className="form-input"
                value={settings?.store_address || ''}
                onChange={e => setSettings(prev => ({ ...prev, store_address: e.target.value }))}
                placeholder="Jl. Contoh No. 123"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">No. Telepon</label>
                <input
                  className="form-input"
                  value={settings?.store_phone || ''}
                  onChange={e => setSettings(prev => ({ ...prev, store_phone: e.target.value }))}
                  placeholder="08123456789"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Instagram</label>
                <input
                  className="form-input"
                  value={settings?.store_instagram || ''}
                  onChange={e => setSettings(prev => ({ ...prev, store_instagram: e.target.value }))}
                  placeholder="@skyra.coffee"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Footer Struk</label>
              <input
                className="form-input"
                value={settings?.receipt_footer || ''}
                onChange={e => setSettings(prev => ({ ...prev, receipt_footer: e.target.value }))}
                placeholder="Terima Kasih!"
              />
            </div>

            <div className="form-group" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
              <label className="form-label">🔑 QRIS Static String (Content)</label>
              <textarea
                className="form-input"
                rows={3}
                value={settings?.qris_base_string || ''}
                onChange={e => setSettings(prev => ({ ...prev, qris_base_string: e.target.value }))}
                placeholder="000201010211..."
                style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
              />
              <p className="text-muted" style={{ fontSize: '0.7rem', marginTop: 4 }}>
                Tempelkan (paste) teks dari QRIS statis Anda di sini untuk mengaktifkan fitur nominal otomatis.
              </p>
            </div>

            <div className="form-group" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
              <label className="form-label"><Key size={14} /> Password Sistem (Aksi Bahaya)</label>
              <input
                className="form-input"
                type="password"
                value={settings?.system_password || ''}
                onChange={e => setSettings(prev => ({ ...prev, system_password: e.target.value }))}
                placeholder="Password untuk reset data"
              />
              <p className="text-muted" style={{ fontSize: '0.7rem', marginTop: 4 }}>
                Digunakan untuk mengonfirmasi penghapusan transaksi atau reset database.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Printer Card ──────────────────── */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title"><Printer size={18} /> Printer Bluetooth 58mm</h3>
          </div>
          <div className="card-body">
            {/* Status */}
            <div style={{
              padding: 20, borderRadius: 12,
              background: btStatus === 'connected'
                ? 'var(--success-bg)'
                : btStatus === 'connecting'
                  ? 'var(--warning-bg)'
                  : 'var(--bg-secondary)',
              textAlign: 'center', marginBottom: 20,
              border: `1px solid ${btStatus === 'connected' ? 'rgba(74,222,128,0.2)' : 'var(--border-color)'}`
            }}>
              <div style={{ marginBottom: 8 }}>
                {btStatus === 'connected' ? (
                  <Wifi size={32} style={{ color: 'var(--success)' }} />
                ) : btStatus === 'connecting' ? (
                  <Bluetooth size={32} style={{ color: 'var(--warning)', animation: 'pulse 1s infinite' }} />
                ) : (
                  <Bluetooth size={32} style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {btStatus === 'connected'
                  ? `Terhubung: ${btDeviceName}`
                  : btStatus === 'connecting'
                    ? 'Menghubungkan...'
                    : 'Tidak Terhubung'}
              </div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                {btStatus === 'connected'
                  ? 'Printer siap mencetak struk'
                  : 'Klik tombol di bawah untuk menghubungkan printer'}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {btStatus === 'connected' ? (
                <>
                  <button className="btn btn-primary" onClick={testPrint}>
                    <Printer size={16} /> Test Print
                  </button>
                  <button className="btn btn-secondary" onClick={handleDisconnectBluetooth}>
                    <Bluetooth size={16} /> Putuskan Printer
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={handleConnectBluetooth} disabled={btStatus === 'connecting'}>
                  <Bluetooth size={16} /> {btStatus === 'connecting' ? 'Menghubungkan...' : 'Hubungkan Printer Bluetooth'}
                </button>
              )}
            </div>

            {/* Help Info */}
            <div style={{
              marginTop: 20, padding: 16, borderRadius: 8,
              background: 'var(--bg-secondary)', fontSize: '0.8rem',
              color: 'var(--text-muted)', lineHeight: 1.6
            }}>
              <p style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>📋 Panduan Koneksi:</p>
              <ol style={{ paddingLeft: 20 }}>
                <li>Nyalakan printer Bluetooth 58mm Anda</li>
                <li>Pastikan printer sudah di-<i>pairing</i> dengan perangkat ini via Bluetooth sistem</li>
                <li>Klik "Hubungkan Printer Bluetooth"</li>
                <li>Pilih printer Anda dari daftar perangkat</li>
                <li>Klik "Test Print" untuk menguji cetak</li>
              </ol>
              <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ⚠️ Web Bluetooth memerlukan Chrome/Edge dan koneksi HTTPS atau localhost.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tampilan & Branding Card ──────────── */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3 className="card-title"><Palette size={18} /> Tampilan & Branding</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Theme Mode */}
            <div>
              <label className="form-label">Mode Tema</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${settings?.theme_mode !== 'light' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setSettings(prev => ({ ...prev, theme_mode: 'dark' }))}
                >
                  <Moon size={16} /> Dark
                </button>
                <button
                  className={`btn ${settings?.theme_mode === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setSettings(prev => ({ ...prev, theme_mode: 'light' }))}
                >
                  <Sun size={16} /> Light
                </button>
              </div>
            </div>

            {/* Brand Color */}
            <div>
              <label className="form-label">Warna Brand</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={settings?.brand_color || '#d4a843'}
                  onChange={e => setSettings(prev => ({ ...prev, brand_color: e.target.value }))}
                  style={{
                    width: 48, height: 48, border: '2px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: 2,
                    background: 'var(--bg-input)'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <input
                    className="form-input"
                    value={settings?.brand_color || '#d4a843'}
                    onChange={e => setSettings(prev => ({ ...prev, brand_color: e.target.value }))}
                    placeholder="#d4a843"
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSettings(prev => ({ ...prev, brand_color: '#d4a843' }))}
                  title="Reset ke default"
                >
                  Reset
                </button>
              </div>
              {/* Color presets */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {['#d4a843', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#f39c12'].map(color => (
                  <button
                    key={color}
                    onClick={() => setSettings(prev => ({ ...prev, brand_color: color }))}
                    style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: color, border: settings?.brand_color === color ? '3px solid var(--text-primary)' : '2px solid var(--border-color)',
                      cursor: 'pointer', transition: 'all 150ms ease',
                      transform: settings?.brand_color === color ? 'scale(1.15)' : 'scale(1)'
                    }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Background Upload */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
            <label className="form-label"><Image size={14} /> Background Kustom</label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 160, height: 100, borderRadius: 'var(--radius-md)',
                  border: '2px dashed var(--border-color)', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', background: 'var(--bg-secondary)',
                  flexShrink: 0
                }}
                onClick={() => bgRef.current?.click()}
              >
                {(bgPreview || settings?.bg_image_url) ? (
                  <img
                    src={bgPreview || `${settings.bg_image_url}`}
                    alt="Background"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    <Image size={24} style={{ opacity: 0.3, marginBottom: 4 }} />
                    <div>Klik untuk upload</div>
                  </div>
                )}
              </div>
              <input
                ref={bgRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files[0];
                  if (file) {
                    setBgFile(file);
                    setBgPreview(URL.createObjectURL(file));
                  }
                }}
              />
              <div style={{ flex: 1 }}>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 12 }}>
                  Upload gambar background untuk area konten. Gambar akan ditampilkan sebagai watermark halus di belakang konten.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => bgRef.current?.click()}>
                    <Upload size={14} /> Ganti Background
                  </button>
                  {(settings?.bg_image_url || bgPreview) && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        try {
                          await api.delete('/api/settings/background');
                          setSettings(prev => ({ ...prev, bg_image_url: '' }));
                          setBgFile(null);
                          setBgPreview(null);
                          updateTheme({ bgImageUrl: '' });
                          showToast('Background dihapus.');
                        } catch (err) {
                          showToast(err.message, 'error');
                        }
                      }}
                    >
                      <Trash2 size={14} /> Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Danger Zone ──────────────────── */}
      <div className="card" style={{ marginTop: 24, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
        <div className="card-header" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
          <h3 className="card-title" style={{ color: 'var(--danger)' }}><ShieldAlert size={18} /> Area Berbahaya</h3>
        </div>
        <div className="card-body">
          <p className="text-muted" style={{ marginBottom: 20 }}>
            Tindakan di bawah ini bersifat permanen dan tidak dapat dibatalkan. Pastikan Anda telah melakukan backup data jika diperlukan.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Hapus Semua Transaksi</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Menghapus seluruh riwayat pesanan (Sales), mutasi stok, dan riwayat performa kasir (Shift). Master data (Produk & Bahan Baku) tidak dihapus.
              </p>
              <button className="btn btn-danger btn-sm" onClick={handleClearTransactions} disabled={saving}>
                <Trash2 size={14} /> {saving ? 'Memproses...' : 'Hapus Semua Transaksi'}
              </button>
            </div>

            <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <h4 style={{ marginBottom: 8, fontSize: '0.9rem', fontWeight: 600 }}>Reset Database ke Nol</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Menghapus SEMUA data produk, kategori, stok, riwayat shift, dan transaksi. Hanya menyisakan akun login dan pengaturan toko.
              </p>
              <button className="btn btn-danger btn-sm" onClick={handleResetDatabase} disabled={saving}>
                <RefreshCcw size={14} /> {saving ? 'Memproses...' : 'Reset Seluruh Database'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
