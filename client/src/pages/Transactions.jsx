import { useState, useEffect } from 'react';
import { api, formatRp, formatDateTime } from '../api';
import { Search, Eye, X, Filter, Printer, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBluetooth } from '../context/BluetoothContext';
import { imageToEscPos } from '../utils/printImage';

export default function Transactions() {
  const { isAdmin } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [showDetail, setShowDetail] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { btStatus, sendToPrinter } = useBluetooth();


  useEffect(() => { 
    load(); 
    if (isAdmin) {
      api.get('/api/users').then(setUsers).catch(console.error);
    }
  }, []);

  async function load() {
    let url = '/api/transactions?limit=100';
    if (dateFrom) url += `&date_from=${dateFrom}`;
    if (dateTo) url += `&date_to=${dateTo}`;
    if (cashierId) url += `&cashier_id=${cashierId}`;
    setTransactions(await api.get(url));
  }

  async function viewDetail(id) {
    setShowDetail(await api.get(`/api/transactions/${id}`));
  }

  function handleFilter() { load(); }

  async function handleDelete(id) {
    if (!window.confirm('PERINGATAN: Hapus transaksi ini secara permanen? Stok akan dikembalikan otomatis.')) return;
    
    setLoading(true);
    try {
      const res = await api.post(`/api/transactions/${id}/void`);
      alert(res.message);
      setShowDetail(null);
      load();
    } catch (err) {
      console.error('HandleDelete Error:', err);
      alert('Gagal memproses pembatalan: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePrint(receipt) {
    if (btStatus !== 'connected') {
      return alert('Printer tidak terhubung! Silakan hubungkan di layar POS atau Pengaturan terlebih dahulu.');
    }
    
    try {
      const storeSettings = await api.get('/api/settings');
      const encoder = new TextEncoder();
      const ESC = 0x1B;
      const GS = 0x1D;

      const fRp = (num) => num.toLocaleString('id-ID'); // tanp Rp untuk hemat ruang

      let cmds = [
        new Uint8Array([ESC, 0x40]),          // Init
        new Uint8Array([ESC, 0x61, 0x01]),    // Center
      ];

      // Logo and Header Toko
      let printedStoreName = false;
      if (storeSettings.store_logo_url) {
        try {
          const logoUrl = storeSettings.store_logo_url.startsWith('http')
            ? storeSettings.store_logo_url
            : `${window.location.protocol}//${window.location.hostname}:3001${storeSettings.store_logo_url}`;
          const logoCmds = await imageToEscPos(logoUrl, 200, { text: storeSettings.store_name });
          cmds = cmds.concat(logoCmds);
          cmds.push(encoder.encode('\n'));
          printedStoreName = true;
        } catch (logoErr) {
          console.warn('Logo print failed:', logoErr);
        }
      }

      if (!printedStoreName) {
        cmds = cmds.concat([
          new Uint8Array([ESC, 0x61, 0x01]),    // Center 
          new Uint8Array([ESC, 0x45, 0x01]),    // Bold
          new Uint8Array([GS, 0x21, 0x11]),     // 2x width+height
          encoder.encode(`${storeSettings.store_name}\n`),
          new Uint8Array([GS, 0x21, 0x00]),     // Normal size
          new Uint8Array([ESC, 0x45, 0x00]),    // Bold off
        ]);
      }

      if (storeSettings.store_address) {
        cmds.push(encoder.encode(`${storeSettings.store_address}\n`));
      }

      // Data Transaksi
      cmds = cmds.concat([
        encoder.encode(`\n${receipt.invoice_no} (Copy)\n`),
        encoder.encode(`${new Date(receipt.sold_at).toLocaleString('id-ID')}\n`),
        encoder.encode(`Kasir: ${receipt.cashier_name || 'Kasir'}\n`),
        encoder.encode('--------------------------------\n'),
        new Uint8Array([ESC, 0x61, 0x00]), // Left align
      ]);

      // Items
      for (const item of receipt.items) {
        const name = item.product_name || `Menu #${item.product_id}`;
        const qty = `${item.qty}x`;
        const price = fRp(item.line_total);
        
        let line1 = `${qty.padEnd(4)}${name}`;
        if (line1.length > 22) line1 = line1.substring(0, 22);
        
        const padding = 32 - line1.length - price.length;
        const spaces = padding > 0 ? ' '.repeat(padding) : ' ';
        
        cmds.push(encoder.encode(`${line1}${spaces}${price}\n`));
        
        if (item.modifiers && item.modifiers.length > 0) {
           for(const m of item.modifiers) {
             cmds.push(encoder.encode(`  + ${m.option_name_snapshot}\n`));
           }
        }
      }
      cmds.push(encoder.encode('--------------------------------\n'));
      
      // Totals
      const subTxt = `Subtotal`;
      const subVal = fRp(receipt.subtotal);
      cmds.push(encoder.encode(`${subTxt.padEnd(32 - subVal.length)}${subVal}\n`));
      
      if (receipt.discount_amount > 0) {
        const dTxt = `Diskon`;
        const dVal = `-${fRp(receipt.discount_amount)}`;
        cmds.push(encoder.encode(`${dTxt.padEnd(32 - dVal.length)}${dVal}\n`));
      }
      
      cmds.push(new Uint8Array([ESC, 0x45, 0x01])); // bold
      const tTxt = `TOTAL`;
      const tVal = fRp(receipt.total);
      cmds.push(encoder.encode(`${tTxt.padEnd(32 - tVal.length)}${tVal}\n`));
      cmds.push(new Uint8Array([ESC, 0x45, 0x00]));

      cmds.push(encoder.encode('--------------------------------\n'));

      const pMethod = receipt.payment_method_name || 'Cash';
      const pTxt = `Bayar (${pMethod.substring(0,10)})`;
      const pVal = fRp(receipt.cash_received || receipt.total); 
      cmds.push(encoder.encode(`${pTxt.padEnd(32 - pVal.length)}${pVal}\n`));

      if (receipt.change_amount > 0) {
         const cTxt = `Kembalian`;
         const cVal = fRp(receipt.change_amount);
         cmds.push(encoder.encode(`${cTxt.padEnd(32 - cVal.length)}${cVal}\n`));
      }

      // Footer
      cmds = cmds.concat([
        new Uint8Array([ESC, 0x61, 0x01]),    // Center
        encoder.encode('\n--------------------------------\n'),
        encoder.encode(`${storeSettings.receipt_footer}\n`)
      ]);

      if (storeSettings.store_instagram) {
        cmds.push(encoder.encode(`Follow IG: ${storeSettings.store_instagram}\n`));
      }

      cmds.push(encoder.encode('\n\n\n\n'));
      cmds.push(new Uint8Array([GS, 0x56, 0x00])); // Cut

      await sendToPrinter(cmds);
      alert('Struk cetak ulang (copy) berhasil dikirim ke printer.');
    } catch (err) {
      console.error('Bluetooth print failed:', err);
      alert('Gagal mencetak struk: ' + err.message);
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Histori Transaksi</h1>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Dari Tanggal</label>
            <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Sampai Tanggal</label>
            <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          {isAdmin && (
            <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
              <label className="form-label">Filter Kasir</label>
              <select className="form-input" value={cashierId} onChange={e => setCashierId(e.target.value)}>
                <option value="">Semua Kasir</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
          )}
          <button className="btn btn-primary btn-sm" onClick={handleFilter}><Filter size={14} /> Filter</button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead><tr><th>Invoice</th><th>Waktu</th><th>Kasir</th><th>Pembayaran</th><th>Total</th><th>Laba</th><th>Keterangan</th><th>Aksi</th></tr></thead>
          <tbody>
            {transactions.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.invoice_no}</td>
                <td>{formatDateTime(t.sold_at)}</td>
                <td>{t.cashier_name}</td>
                <td><span className="badge badge-info">{t.payment_method_name}</span></td>
                <td className="text-gold font-mono">{formatRp(t.total)}</td>
                <td className="text-success font-mono">{formatRp(t.profit_total)}</td>
                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.notes}>
                  {t.notes || '-'}
                </td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => viewDetail(t.id)}><Eye size={14} /> Detail</button></td>
              </tr>
            ))}
            {!transactions.length && <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>Belum ada transaksi.</td></tr>}
          </tbody>
        </table>
      </div>

      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Detail: {showDetail.invoice_no}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {isAdmin && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(showDetail.id)} disabled={loading} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                    <Trash2 size={14} /> Hapus
                  </button>
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(showDetail)} style={{ color: 'var(--text-primary)' }}>
                  <Printer size={14} /> Cetak Struk
                </button>
                <button className="modal-close" onClick={() => setShowDetail(null)}><X size={20} /></button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16, fontSize: '0.85rem' }}>
                <div><span className="text-muted">Kasir:</span> {showDetail.cashier_name}</div>
                <div><span className="text-muted">Waktu:</span> {formatDateTime(showDetail.sold_at)}</div>
                <div><span className="text-muted">Pembayaran:</span> {showDetail.payment_method_name}</div>
                {showDetail.customer_name && <div><span className="text-muted">Pelanggan:</span> {showDetail.customer_name}</div>}
                {showDetail.notes && <div style={{ gridColumn: '1 / -1', marginTop: 8, padding: 8, background: 'var(--bg-secondary)', borderRadius: 4, fontStyle: 'italic' }}>
                  <span className="text-muted">Catatan:</span> {showDetail.notes}
                </div>}
              </div>
              <table className="table">
                <thead><tr><th>Menu</th><th>Qty</th><th>Harga</th><th>HPP</th><th>Total</th></tr></thead>
                <tbody>
                  {showDetail.items?.map(i => (
                    <tr key={i.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{i.product_name}</div>
                        {i.modifiers?.map(m => <div key={m.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ {m.option_name_snapshot} {m.price_adjustment > 0 ? `(+${formatRp(m.price_adjustment)})` : ''}</div>)}
                      </td>
                      <td className="font-mono">{i.qty}</td>
                      <td className="font-mono">{formatRp(i.unit_price)}</td>
                      <td className="font-mono text-muted">{formatRp(i.unit_hpp_snapshot)}</td>
                      <td className="text-gold font-mono">{formatRp(i.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <div className="flex-between" style={{ marginBottom: 4 }}><span className="text-muted">Subtotal</span><span className="font-mono">{formatRp(showDetail.subtotal)}</span></div>
                {showDetail.discount_amount > 0 && <div className="flex-between" style={{ marginBottom: 4 }}><span className="text-muted">Diskon</span><span className="text-danger font-mono">-{formatRp(showDetail.discount_amount)}</span></div>}
                <div className="flex-between" style={{ fontWeight: 700, paddingTop: 6, borderTop: '1px solid var(--border-color)' }}><span>Total</span><span className="text-gold font-mono">{formatRp(showDetail.total)}</span></div>
                <div className="flex-between" style={{ marginTop: 4 }}><span className="text-muted">HPP Total</span><span className="font-mono">{formatRp(showDetail.hpp_total)}</span></div>
                <div className="flex-between" style={{ marginTop: 4 }}><span className="text-muted">Laba Kotor</span><span className="text-success font-mono">{formatRp(showDetail.profit_total)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
