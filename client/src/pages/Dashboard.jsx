import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, formatRp } from '../api';
import { DollarSign, TrendingUp, ShoppingBag, AlertTriangle, Coffee } from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#221e18',
      titleColor: '#f5f0e8',
      bodyColor: '#a89b8c',
      borderColor: 'rgba(212,168,67,0.2)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
    }
  },
  scales: {
    x: { grid: { color: 'rgba(245,240,232,0.04)' }, ticks: { color: '#6d6259', font: { size: 11 } } },
    y: { grid: { color: 'rgba(245,240,232,0.04)' }, ticks: { color: '#6d6259', font: { size: 11 } } }
  }
};

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/dashboard').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex-center" style={{ padding: 60 }}><span className="text-muted">Memuat dashboard...</span></div>;
  if (!data) return <div className="text-muted text-center">Gagal memuat data.</div>;

  if (!isAdmin) return <CashierDashboard data={data} />;

  return (
    <div className="animate-in">
      {/* KPI Cards */}
      <div className="kpi-grid">
        <KPICard label="Omzet Hari Ini" value={formatRp(data.today_revenue)} icon={DollarSign} gold />
        <KPICard label="Omzet Bulan Ini" value={formatRp(data.month_revenue)} icon={TrendingUp} />
        <KPICard label="Laba Hari Ini" value={formatRp(data.today_profit)} icon={TrendingUp} green />
        <KPICard label="Laba Bulan Ini" value={formatRp(data.month_profit)} icon={TrendingUp} green />
        <KPICard label="Transaksi Hari Ini" value={data.today_transactions} icon={ShoppingBag} />
        <KPICard label="Omzet Tahun Ini" value={formatRp(data.year_revenue)} icon={DollarSign} />
      </div>

      {/* Charts Row */}
      <div className="grid-2 mb-6">
        <div className="card">
          <div className="card-header"><span className="card-title">Omzet 7 Hari Terakhir</span></div>
          <div style={{ height: 250 }}>
            {data.last_7_days?.length ? (
              <Bar data={{
                labels: data.last_7_days.map(d => d.date?.slice(5)),
                datasets: [{
                  label: 'Omzet',
                  data: data.last_7_days.map(d => d.revenue),
                  backgroundColor: 'rgba(212, 168, 67, 0.6)',
                  borderColor: '#d4a843',
                  borderWidth: 1,
                  borderRadius: 6,
                }]
              }} options={chartOptions} />
            ) : <div className="empty-state"><p>Belum ada data.</p></div>}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Metode Pembayaran</span></div>
          <div style={{ height: 250 }} className="flex-center">
            {data.payment_breakdown?.length ? (
              <Doughnut data={{
                labels: data.payment_breakdown.map(d => d.method),
                datasets: [{
                  data: data.payment_breakdown.map(d => d.total),
                  backgroundColor: ['#d4a843', '#8b6914', '#c67b3e', '#4ade80', '#60a5fa'],
                  borderWidth: 0,
                }]
              }} options={{ ...chartOptions, scales: undefined, plugins: { ...chartOptions.plugins, legend: { display: true, position: 'bottom', labels: { color: '#a89b8c', padding: 16 } } } }} />
            ) : <div className="empty-state"><p>Belum ada data.</p></div>}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">🏆 Top 5 Menu</span></div>
          {data.top_menu?.length ? (
            <div>
              {data.top_menu.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span><span className="badge badge-gold" style={{marginRight:8}}>{i+1}</span> {m.name}</span>
                  <span className="text-gold font-mono">{m.qty} terjual</span>
                </div>
              ))}
            </div>
          ) : <div className="empty-state"><p>Belum ada data.</p></div>}
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">⚠️ Stok Menipis</span></div>
          {data.low_stock?.length ? (
            <div>
              {data.low_stock.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <span>{s.name}</span>
                  <div>
                    <span className="badge badge-danger">{s.current_stock} {s.unit_code}</span>
                    <span className="text-muted" style={{ marginLeft: 8, fontSize: '0.75rem' }}>min: {s.min_stock}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-muted" style={{ padding: 20, textAlign: 'center' }}>✅ Semua stok aman</div>}
        </div>
      </div>
    </div>
  );
}

function CashierDashboard({ data }) {
  return (
    <div className="animate-in">
      <div className="kpi-grid">
        <KPICard label="Transaksi Hari Ini" value={data.today_transactions} icon={ShoppingBag} gold />
        <KPICard label="Item Terjual" value={data.today_items} icon={Coffee} />
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title">🔥 Menu Populer Hari Ini</span></div>
        {data.popular_today?.length ? (
          <div>
            {data.popular_today.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span><span className="badge badge-gold" style={{marginRight:8}}>{i+1}</span> {m.name}</span>
                <span className="text-gold font-mono">{m.qty}x</span>
              </div>
            ))}
          </div>
        ) : <div className="empty-state"><p>Belum ada transaksi hari ini.</p></div>}
      </div>
    </div>
  );
}

function KPICard({ label, value, icon: Icon, gold, green }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${gold ? 'gold' : ''} ${green ? 'green' : ''}`}>{value}</div>
      <div className="kpi-icon"><Icon size={20} /></div>
    </div>
  );
}
