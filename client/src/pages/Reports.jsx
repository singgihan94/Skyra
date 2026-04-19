import { useState, useEffect } from 'react';
import { api, formatRp, formatDate, downloadBlob } from '../api';
import { Download, Filter } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const tabs = ['Omzet', 'Penjualan', 'Laba', 'Stok'];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('Omzet');
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, [activeTab, dateFrom, dateTo]);

  async function loadData() {
    setLoading(true);
    try {
      let result;
      if (activeTab === 'Omzet') {
        result = await api.get(`/api/reports/revenue?period=daily&date_from=${dateFrom}&date_to=${dateTo}`);
      } else if (activeTab === 'Penjualan') {
        result = await api.get(`/api/reports/sales-by-product?date_from=${dateFrom}&date_to=${dateTo}`);
      } else if (activeTab === 'Laba') {
        result = await api.get(`/api/reports/revenue?period=daily&date_from=${dateFrom}&date_to=${dateTo}`);
      } else if (activeTab === 'Stok') {
        result = await api.get('/api/reports/stock');
      }
      setData(result || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function exportExcel() {
    try {
      let blob;
      if (activeTab === 'Omzet' || activeTab === 'Laba') {
        blob = await api.get(`/api/export/excel/revenue?period=daily&date_from=${dateFrom}&date_to=${dateTo}`);
      } else if (activeTab === 'Penjualan') {
        blob = await api.get('/api/export/excel/sales');
      } else {
        blob = await api.get('/api/export/excel/stock');
      }
      downloadBlob(blob, `laporan_${activeTab.toLowerCase()}.xlsx`);
    } catch (err) { alert('Export gagal: ' + err.message); }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Laporan</h1>
        <button className="btn btn-secondary" onClick={exportExcel}><Download size={16} /> Export Excel</button>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {activeTab !== 'Stok' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Dari</label><input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
            <div className="form-group" style={{ margin: 0 }}><label className="form-label">Sampai</label><input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
            <button className="btn btn-primary btn-sm" onClick={loadData}><Filter size={14} /> Filter</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-muted text-center" style={{ padding: 40 }}>Memuat...</p> : (
        <>
          {activeTab === 'Omzet' && <RevenueReport data={data} />}
          {activeTab === 'Penjualan' && <SalesReport data={data} />}
          {activeTab === 'Laba' && <ProfitReport data={data} />}
          {activeTab === 'Stok' && <StockReport data={data} />}
        </>
      )}
    </div>
  );
}

function RevenueReport({ data }) {
  const total = data.reduce((s, d) => s + (d.revenue || 0), 0);
  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi-card"><div className="kpi-label">TOTAL OMZET</div><div className="kpi-value gold">{formatRp(total)}</div></div>
        <div className="kpi-card"><div className="kpi-label">TOTAL TRANSAKSI</div><div className="kpi-value">{data.reduce((s, d) => s + (d.transactions || 0), 0)}</div></div>
      </div>
      {data.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ height: 300 }}>
            <Bar data={{ labels: data.map(d => d.date?.slice(5) || d.month), datasets: [{ label: 'Omzet', data: data.map(d => d.revenue), backgroundColor: 'rgba(212,168,67,0.6)', borderRadius: 6 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6d6259' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6d6259' } } } }} />
          </div>
        </div>
      )}
      <div className="table-container"><table className="table"><thead><tr><th>Tanggal</th><th>Transaksi</th><th>Omzet</th><th>HPP</th><th>Laba</th></tr></thead><tbody>
        {data.map((d, i) => <tr key={i}><td>{d.date || d.month}</td><td className="font-mono">{d.transactions}</td><td className="text-gold font-mono">{formatRp(d.revenue)}</td><td className="font-mono">{formatRp(d.hpp)}</td><td className="text-success font-mono">{formatRp(d.profit)}</td></tr>)}
      </tbody></table></div>
    </>
  );
}

function SalesReport({ data }) {
  return (
    <>
      {data.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ height: 300 }}>
            <Bar data={{ labels: data.slice(0, 10).map(d => d.product_name), datasets: [{ label: 'Qty', data: data.slice(0, 10).map(d => d.qty_sold), backgroundColor: 'rgba(212,168,67,0.6)', borderRadius: 6 }] }} options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6d6259' } }, y: { grid: { display: false }, ticks: { color: '#a89b8c' } } } }} />
          </div>
        </div>
      )}
      <div className="table-container"><table className="table"><thead><tr><th>Menu</th><th>Kategori</th><th>Qty Terjual</th><th>Omzet</th><th>HPP</th><th>Laba</th></tr></thead><tbody>
        {data.map((d, i) => <tr key={i}><td style={{ fontWeight: 600 }}>{d.product_name}</td><td><span className="badge badge-gold">{d.category_name}</span></td><td className="font-mono">{d.qty_sold}</td><td className="text-gold font-mono">{formatRp(d.total_revenue)}</td><td className="font-mono">{formatRp(d.total_hpp)}</td><td className="text-success font-mono">{formatRp(d.total_profit)}</td></tr>)}
      </tbody></table></div>
    </>
  );
}

function ProfitReport({ data }) {
  const totalProfit = data.reduce((s, d) => s + (d.profit || 0), 0);
  const totalRevenue = data.reduce((s, d) => s + (d.revenue || 0), 0);
  const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

  return (
    <>
      <div className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi-card"><div className="kpi-label">TOTAL LABA KOTOR</div><div className="kpi-value green">{formatRp(totalProfit)}</div></div>
        <div className="kpi-card"><div className="kpi-label">MARGIN</div><div className="kpi-value">{margin}%</div></div>
      </div>
      <div className="table-container"><table className="table"><thead><tr><th>Tanggal</th><th>Omzet</th><th>HPP</th><th>Laba</th><th>Margin</th></tr></thead><tbody>
        {data.map((d, i) => {
          const m = d.revenue > 0 ? ((d.profit / d.revenue) * 100).toFixed(1) : 0;
          return <tr key={i}><td>{d.date || d.month}</td><td className="font-mono">{formatRp(d.revenue)}</td><td className="font-mono">{formatRp(d.hpp)}</td><td className="text-success font-mono">{formatRp(d.profit)}</td><td className="font-mono">{m}%</td></tr>;
        })}
      </tbody></table></div>
    </>
  );
}

function StockReport({ data }) {
  return (
    <div className="table-container"><table className="table"><thead><tr><th>Bahan</th><th>Satuan</th><th>Stok Saat Ini</th><th>Stok Minimum</th><th>Harga Terakhir</th><th>Harga Rata²</th><th>Status</th></tr></thead><tbody>
      {data.map((i, idx) => (
        <tr key={idx}>
          <td style={{ fontWeight: 600 }}>{i.name}</td>
          <td>{i.unit_name} ({i.unit_code})</td>
          <td className={`font-mono ${i.is_low ? 'text-danger' : ''}`} style={{ fontWeight: i.is_low ? 700 : 400 }}>{i.current_stock}</td>
          <td className="font-mono text-muted">{i.min_stock}</td>
          <td className="font-mono">{formatRp(i.last_cost)}</td>
          <td className="font-mono">{formatRp(i.avg_cost)}</td>
          <td><span className={`badge ${i.is_low ? 'badge-danger' : 'badge-success'}`}>{i.is_low ? 'RENDAH' : 'OK'}</span></td>
        </tr>
      ))}
    </tbody></table></div>
  );
}
