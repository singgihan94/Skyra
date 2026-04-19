import { useState, useEffect } from 'react';
import { api, formatRp, formatDateTime } from '../api';
import { Search, Eye, Filter, AlertCircle, Calendar, User } from 'lucide-react';

export default function TransactionsVoid() {
  const [transactions, setTransactions] = useState([]);
  const [showDetail, setShowDetail] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    let url = '/api/transactions/void?';
    if (dateFrom) url += `date_from=${dateFrom}&`;
    if (dateTo) url += `date_to=${dateTo}&`;
    setTransactions(await api.get(url));
  }

  async function viewDetail(id) {
    setShowDetail(await api.get(`/api/transactions/${id}`));
  }

  function handleFilter() { load(); }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Histori Transaksi Void</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Dari Tanggal Pembatalan</label>
            <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Sampai Tanggal Pembatalan</label>
            <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleFilter}><Filter size={14} /> Filter</button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Waktu Transaksi</th>
              <th>Waktu Void</th>
              <th>Kasir</th>
              <th>Void Oleh</th>
              <th>Total</th>
              <th>Keterangan</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.invoice_no}</td>
                <td style={{ fontSize: '0.8rem' }}>{formatDateTime(t.sold_at)}</td>
                <td style={{ fontWeight: 600, color: 'var(--danger)' }}>{formatDateTime(t.void_at)}</td>
                <td>{t.cashier_name}</td>
                <td><span className="badge badge-danger" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>{t.void_by_name}</span></td>
                <td className="text-muted font-mono" style={{ textDecoration: 'line-through' }}>{formatRp(t.total)}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.notes}>
                  {t.notes || '-'}
                </td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => viewDetail(t.id)}><Eye size={14} /> Detail</button></td>
              </tr>
            ))}
            {!transactions.length && <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>Tidak ada transaksi yang dibatalkan pada periode ini.</td></tr>}
          </tbody>
        </table>
      </div>

      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Detail Void: {showDetail.invoice_no}</h3>
              <button className="modal-close" onClick={() => setShowDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--danger-bg)', padding: 12, borderRadius: 8, marginBottom: 16, borderLeft: '4px solid var(--danger)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)', fontWeight: 600, marginBottom: 4 }}>
                  <AlertCircle size={18} /> Transaksi Telah Dibatalkan (Void)
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--danger-text)' }}>
                   Dibatalkan oleh <strong>{showDetail.void_by_name}</strong> pada {formatDateTime(showDetail.void_at)}
                </div>
                {showDetail.notes && <div style={{ marginTop: 4, fontStyle: 'italic', fontSize: '0.85rem' }}>"{showDetail.notes}"</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                <div><span className="text-muted">Kasir Original:</span> {showDetail.cashier_name}</div>
                <div><span className="text-muted">Waktu Transaksi:</span> {formatDateTime(showDetail.sold_at)}</div>
                <div><span className="text-muted">Pembayaran:</span> {showDetail.payment_method_name}</div>
                {showDetail.customer_name && <div><span className="text-muted">Pelanggan:</span> {showDetail.customer_name}</div>}
              </div>

              <table className="table">
                <thead><tr><th>Menu</th><th>Qty</th><th>Harga</th><th>Total</th></tr></thead>
                <tbody>
                  {showDetail.items?.map(i => (
                    <tr key={i.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{i.product_name}</div>
                        {i.modifiers?.map(m => <div key={m.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ {m.option_name_snapshot}</div>)}
                      </td>
                      <td className="font-mono">{i.qty}</td>
                      <td className="font-mono">{formatRp(i.unit_price)}</td>
                      <td className="text-muted font-mono" style={{ textDecoration: 'line-through' }}>{formatRp(i.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <div className="flex-between" style={{ marginBottom: 4, textDecoration: 'line-through' }}><span className="text-muted">Subtotal</span><span className="font-mono">{formatRp(showDetail.subtotal)}</span></div>
                <div className="flex-between" style={{ fontWeight: 700, paddingTop: 6, borderTop: '1px solid var(--border-color)', color: 'var(--danger)' }}>
                  <span>TOTAL (VOID)</span>
                  <span className="font-mono">{formatRp(showDetail.total)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
               <button className="btn btn-primary" onClick={() => setShowDetail(null)} style={{ width: '100%' }}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
