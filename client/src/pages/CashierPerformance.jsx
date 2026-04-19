import { useState, useEffect } from 'react';
import { api, formatRp, formatDateTime } from '../api';
import { 
  Calendar, User, Clock, Wallet, TrendingUp, AlertCircle, 
  ChevronRight, ArrowRight, Eye, X, ClipboardList, Info,
  ExternalLink, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CashierPerformance() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState(null);
  const [shiftTransactions, setShiftTransactions] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const { isAdmin } = useAuth();

  useEffect(() => {
    loadShifts();
  }, []);

  async function loadShifts() {
    setLoading(true);
    try {
      const data = await api.get('/api/shifts');
      setShifts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewDetail(shift) {
    setSelectedShift(shift);
    setLoadingDetails(true);
    try {
      const transactions = await api.get(`/api/transactions?shift_id=${shift.id}`);
      setShiftTransactions(transactions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleDeleteShift(id) {
    if (!window.confirm('Hapus data performa kasir ini? Tindakan ini tidak dapat dibatalkan.')) return;
    
    try {
      await api.delete(`/api/shifts/${id}`);
      loadShifts(); // Refresh list
    } catch (err) {
      alert(err.message);
    }
  }

  const getStatusBadge = (status) => {
    if (status === 'open') return <span className="badge badge-success">Aktif</span>;
    return <span className="badge badge-secondary">Selesai</span>;
  };

  const getSelisihColor = (val) => {
    if (val === 0) return 'var(--success)';
    return 'var(--danger)';
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Performa Kasir</h1>
          <p className="page-subtitle">Pantau aktivitas shift, selisih kas, dan kinerja setiap kasir.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex-center" style={{ height: '300px' }}>
          <div className="text-gold">Memuat data shift...</div>
        </div>
      ) : (
        <div className="table-container shadow-sm">
          <table className="table">
            <thead>
              <tr>
                <th>Kasir</th>
                <th>Waktu Buka</th>
                <th>Waktu Tutup</th>
                <th>Status</th>
                <th>Total Penjualan</th>
                <th>Selisih Kas</th>
                <th>Keterangan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map(s => {
                const selisih = (s.ending_cash ?? 0) - (s.expected_ending_cash ?? 0);
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="sidebar-user-avatar" style={{ width: 24, height: 24, fontSize: '0.7rem' }}>
                          {s.cashier_name?.charAt(0)}
                        </div>
                        <span style={{ fontWeight: 600 }}>{s.cashier_name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{formatDateTime(s.start_time)}</td>
                    <td style={{ fontSize: '0.85rem' }}>{s.end_time ? formatDateTime(s.end_time) : '-'}</td>
                    <td>{getStatusBadge(s.status)}</td>
                    <td className="font-mono">{formatRp(s.total_sales || 0)}</td>
                    <td className="font-mono" style={{ color: getSelisihColor(selisih), fontWeight: 700 }}>
                      {s.status === 'closed' ? formatRp(selisih) : '-'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.notes}>
                      {s.notes || '-'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleViewDetail(s)}>
                          <Eye size={14} /> Detail
                        </button>
                        {isAdmin && (
                          <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDeleteShift(s.id)} title="Hapus">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {shifts.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted" style={{ padding: 60 }}>
                    Belum ada riwayat shift yang tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedShift && (
        <div className="modal-overlay" onClick={() => setSelectedShift(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Laporan Performa Shift #{selectedShift.id}</h3>
              <button className="modal-close" onClick={() => setSelectedShift(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="grid grid-2" style={{ gap: 16, marginBottom: 24 }}>
                {/* Section Buka Kasir */}
                <div className="card shadow-sm" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--text-gold)' }}>
                    <Clock size={18} />
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Laporan Buka Kasir</h4>
                  </div>
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <span className="text-muted">Dibuka Oleh:</span>
                    <span style={{ fontWeight: 600 }}>{selectedShift.cashier_name}</span>
                  </div>
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <span className="text-muted">Waktu Buka:</span>
                    <span>{formatDateTime(selectedShift.start_time)}</span>
                  </div>
                  <div className="flex-between">
                    <span className="text-muted">Modal Awal:</span>
                    <span className="text-gold font-mono" style={{ fontWeight: 700 }}>{formatRp(selectedShift.starting_cash)}</span>
                  </div>
                </div>

                {/* Section Tutup Kasir */}
                <div className="card shadow-sm" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--text-gold)' }}>
                    <Lock size={18} />
                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Laporan Tutup Kasir</h4>
                  </div>
                  {selectedShift.status === 'closed' ? (
                    <>
                      <div className="flex-between" style={{ marginBottom: 8 }}>
                        <span className="text-muted">Waktu Tutup:</span>
                        <span>{formatDateTime(selectedShift.end_time)}</span>
                      </div>
                      <div className="flex-between" style={{ marginBottom: 8 }}>
                        <span className="text-muted">Uang Aktual (Laci):</span>
                        <span className="font-mono">{formatRp(selectedShift.ending_cash)}</span>
                      </div>
                      <div className="flex-between" style={{ marginBottom: 8 }}>
                        <span className="text-muted">Uang Seharusnya:</span>
                        <span className="font-mono">{formatRp(selectedShift.expected_ending_cash)}</span>
                      </div>
                      <div className="flex-between" style={{ paddingTop: 8, borderTop: '1px solid var(--border-color)' }}>
                        <span style={{ fontWeight: 600 }}>Selisih:</span>
                        <span className="font-mono" style={{ 
                          fontWeight: 800, 
                          color: (selectedShift.ending_cash - selectedShift.expected_ending_cash) === 0 ? 'var(--success)' : 'var(--danger)',
                          fontSize: '1.1rem'
                        }}>
                          {formatRp(selectedShift.ending_cash - selectedShift.expected_ending_cash)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex-center" style={{ height: '80px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Shift masih aktif
                    </div>
                  )}
                </div>
              </div>

              {/* Transaction Summary */}
              <div className="card shadow-sm" style={{ padding: 16, marginBottom: 24, borderLeft: '4px solid var(--text-gold)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                  <div>
                    <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Total Transaksi</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{selectedShift.total_transactions || 0}</div>
                  </div>
                  <div style={{ width: 1, background: 'var(--border-color)' }}></div>
                  <div>
                    <div className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 4 }}>Total Pendapatan</div>
                    <div className="text-gold" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{formatRp(selectedShift.total_sales || 0)}</div>
                  </div>
                </div>
              </div>

              {/* Transactions List */}
              <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ClipboardList size={18} />
                <h4 style={{ margin: 0 }}>Daftar Transaksi Selama Shift</h4>
              </div>
              
              <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Waktu</th>
                      <th>Total</th>
                      <th>Pembayaran</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingDetails ? (
                      <tr><td colSpan={5} className="text-center" style={{ padding: 20 }}>Memuat transaksi...</td></tr>
                    ) : (
                      shiftTransactions.map(t => (
                        <tr key={t.id}>
                          <td style={{ fontWeight: 600 }}>{t.invoice_no}</td>
                          <td>{formatDateTime(t.sold_at).split(', ')[1]}</td>
                          <td className="font-mono">{formatRp(t.total)}</td>
                          <td><small className="badge badge-info">{t.payment_method_name}</small></td>
                          <td><small className="text-success" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>{t.status}</small></td>
                        </tr>
                      ))
                    )}
                    {!loadingDetails && shiftTransactions.length === 0 && (
                      <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 20 }}>Tidak ada transaksi dalam shift ini.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedShift.notes && (
                <div style={{ marginTop: 20, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontWeight: 600, color: 'var(--text-muted)' }}>
                    <Info size={14} /> Catatan Shift:
                  </div>
                  {selectedShift.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Minimal Icons for reference if needed
function Lock({ size, ...props }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} height={size} 
      viewBox="0 0 24 24" fill="none" 
      stroke="currentColor" strokeWidth="2" 
      strokeLinecap="round" strokeLinejoin="round" 
      {...props}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
