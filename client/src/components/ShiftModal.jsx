import { useState } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { api, formatRp } from '../api';
import { useShift } from '../context/ShiftContext';

export default function ShiftModal({ mode, onClose, onComplete }) {
  const { currentShift, checkCurrentShift } = useShift();
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  const isClose = mode === 'close';

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const val = parseInt(amount);
      if (isNaN(val) || val < 0) {
        throw new Error('Masukkan nominal yang valid.');
      }

      if (isClose) {
        const res = await api.post('/api/shifts/end', { ending_cash: val, notes });
        setSummary(res.summary);
        await checkCurrentShift();
        if (onComplete) onComplete();
      } else {
        await api.post('/api/shifts/start', { starting_cash: val });
        await checkCurrentShift();
        if (onComplete) onComplete();
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Quick cash buttons for input
  const quickCash = [0, 50000, 100000, 200000, 500000];

  return (
    <div className="modal-overlay" onClick={summary ? undefined : onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {summary ? <><CheckCircle size={20} style={{ color: 'var(--success)', verticalAlign: 'middle', marginRight: 8 }}/>Shift Ditutup</> : 
            isClose ? 'Tutup Kasir' : 'Buka Kasir'}
          </h3>
          {!summary && <button className="modal-close" onClick={onClose}><X size={20} /></button>}
        </div>
        
        {summary ? (
          <div className="modal-body text-center">
            <p className="text-muted" style={{ marginBottom: 16 }}>Sesi kasir telah berakhir. Berikut adalah ringkasan kas:</p>
            <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-muted">Total Diharapkan di Laci:</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Total Aktual yang Dihitung:</span>
              </div>
            </div>
            
            <div style={{ padding: 16, borderRadius: 8, background: summary.selisih === 0 ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>Selisih Kas</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: summary.selisih === 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatRp(summary.selisih)}
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: 24, padding: 0 }}>
              <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>Tutup</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="login-error"><AlertCircle size={16} style={{ display: 'inline', marginRight: 4 }} />{error}</div>}
              
              {isClose && currentShift && (
                <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="text-muted">Shift Dibuka:</span>
                    <span>{new Date(currentShift.start_time).toLocaleString('id-ID')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="text-muted">Modal Awal:</span>
                    <span>{formatRp(currentShift.starting_cash)}</span>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">{isClose ? 'Total Uang Kas di Laci Saat Ini' : 'Uang Modal Awal Laci'}</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="0" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  autoFocus 
                  style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'right', padding: '16px' }} 
                  required
                />
              </div>
              
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
                {quickCash.map(v => (
                  <button key={v} type="button" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={() => setAmount(String(v))}>{formatRp(v)}</button>
                ))}
              </div>

              {isClose && (
                <div className="form-group">
                  <label className="form-label">Catatan Penutupan (opsional)</label>
                  <input className="form-input" placeholder="Alasan selisih kas..." value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              )}

              {!isClose && (
                <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                  Modal awal ini akan menjadi dasar perhitungan selisih kas saat Anda tutup kasir nanti.
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Batal</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Menyimpan...' : (isClose ? 'Tutup Kasir' : 'Buka Kasir')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
