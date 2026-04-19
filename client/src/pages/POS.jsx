import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, formatRp } from '../api';
import { useBluetooth } from '../context/BluetoothContext';
import { useShift } from '../context/ShiftContext';
import ShiftModal from '../components/ShiftModal';
import { Search, Plus, Minus, Trash2, X, ShoppingCart, CheckCircle, Printer, Lock } from 'lucide-react';
import { generateDynamicQRIS } from '../utils/qris';
import { imageToEscPos } from '../utils/printImage';

export default function POS() {
  const navigate = useNavigate();
  const { currentShift, loadingShift } = useShift();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(null);
  const [showModifier, setShowModifier] = useState(null);
  const [showOpenShift, setShowOpenShift] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [storeSettings, setStoreSettings] = useState({ store_name: 'Skyra Coffee', store_instagram: '@skyra.coffee', receipt_footer: 'Terima Kasih!', store_address: '' });
  const { btStatus, sendToPrinter } = useBluetooth();

  useEffect(() => {
    // Check if shift is closed then show modal
    if (!loadingShift && !currentShift) {
       setShowOpenShift(true);
    }
  }, [currentShift, loadingShift]);

  useEffect(() => {
    api.get('/api/products/active').then(setProducts).catch(console.error);
    api.get('/api/categories').then(setCategories).catch(console.error);
    api.get('/api/pos/payment-methods').then(setPaymentMethods).catch(console.error);
    api.get('/api/settings').then(s => { if (s && s.store_name) setStoreSettings(s); }).catch(console.error);
  }, []);

  const filteredProducts = products.filter(p => {
    const matchCat = selectedCat === 'all' || p.category_id === parseInt(selectedCat);
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  function addToCart(product) {
    if (product.modifier_groups?.length > 0) {
      setShowModifier({ product, selectedOptions: [], notes: '' });
    } else {
      const key = `${product.id}-no-mod`;
      setCart(prev => {
        const existing = prev.find(i => i.key === key);
        if (existing) {
          return prev.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i);
        }
        return [...prev, { key, product_id: product.id, name: product.name, price: product.selling_price, qty: 1, modifier_option_ids: [], modifierLabels: [], notes: '' }];
      });
    }
  }

  function addWithModifiers() {
    if (!showModifier) return;
    const { product, selectedOptions, notes } = showModifier;
    const key = `${product.id}-${selectedOptions.sort().join('-')}`;
    let extraPrice = 0;
    const labels = [];

    selectedOptions.forEach(optId => {
      product.modifier_groups?.forEach(g => {
        const opt = g.options?.find(o => o.id === optId);
        if (opt) {
          extraPrice += opt.price_adjustment;
          labels.push(opt.name);
        }
      });
    });

    const totalPrice = product.selling_price + extraPrice;

    setCart(prev => {
      const existing = prev.find(i => i.key === key);
      if (existing) {
        return prev.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { key, product_id: product.id, name: product.name, price: totalPrice, qty: 1, modifier_option_ids: selectedOptions, modifierLabels: labels, notes }];
    });

    setShowModifier(null);
  }

  function updateQty(key, delta) {
    setCart(prev => prev.map(i => i.key === key ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  }

  function removeItem(key) {
    setCart(prev => prev.filter(i => i.key !== key));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = subtotal - discount;

  function clearCart() {
    setCart([]);
    setDiscount(0);
  }

  async function handlePrint(receipt) {
    if (btStatus === 'connected') {
      try {
        const encoder = new TextEncoder();
        const ESC = 0x1B;
        const GS = 0x1D;

        // format item values without "Rp" to save space
        const fRp = (num) => num.toLocaleString('id-ID');

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
            console.warn('Logo print failed, skipping:', logoErr);
          }
        }

        if (!printedStoreName) {
          cmds = cmds.concat([
            new Uint8Array([ESC, 0x61, 0x01]),    // Center (re-set after image)
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

        cmds = cmds.concat([
          encoder.encode(`\n${receipt.invoice_no}\n`),
          encoder.encode(`${new Date(receipt.sold_at).toLocaleString('id-ID')}\n`),
          encoder.encode(`Kasir: ${receipt.cashier || 'Kasir'}\n`),
          encoder.encode('--------------------------------\n'),
          new Uint8Array([ESC, 0x61, 0x00]), // Left align
        ]);

        for (const item of receipt.items) {
          const name = products.find(p => p.id === item.product_id)?.name || `Menu #${item.product_id}`;
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
        
        const subTxt = `Subtotal`;
        const subVal = fRp(receipt.subtotal);
        cmds.push(encoder.encode(`${subTxt.padEnd(32 - subVal.length)}${subVal}\n`));
        
        if (receipt.discount_amount > 0) {
          const dTxt = `Diskon`;
          const dVal = `-${fRp(receipt.discount_amount)}`;
          cmds.push(encoder.encode(`${dTxt.padEnd(32 - dVal.length)}${dVal}\n`));
        }
        
        new Uint8Array([ESC, 0x45, 0x01]),    // Bold
        cmds.push(new Uint8Array([ESC, 0x45, 0x01]));
        const tTxt = `TOTAL`;
        const tVal = fRp(receipt.total);
        cmds.push(encoder.encode(`${tTxt.padEnd(32 - tVal.length)}${tVal}\n`));
        cmds.push(new Uint8Array([ESC, 0x45, 0x00]));

        cmds.push(encoder.encode('--------------------------------\n'));

        const pTxt = `Bayar (${receipt.payment_method})`;
        const pVal = fRp(receipt.cash_received);
        cmds.push(encoder.encode(`${pTxt.padEnd(32 - pVal.length)}${pVal}\n`));

        if (receipt.change_amount > 0) {
           const cTxt = `Kembalian`;
           const cVal = fRp(receipt.change_amount);
           cmds.push(encoder.encode(`${cTxt.padEnd(32 - cVal.length)}${cVal}\n`));
        }

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
        return;
      } catch (err) {
        console.error('Bluetooth print failed, falling back to window.print', err);
      }
    }
    
    // Fallback logic
    window.print();
  }

  return (
    <div className="pos-layout" style={{ padding: 0 }}>
      {/* Left: Menu */}
      <div style={{ padding: 20, overflow: 'auto' }}>
        {/* Search */}
        <div className="search-bar">
          <Search className="search-icon" size={18} />
          <input placeholder="Cari menu..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Category Pills */}
        <div className="category-pills">
          <button className={`category-pill ${selectedCat === 'all' ? 'active' : ''}`} onClick={() => setSelectedCat('all')}>Semua</button>
          {categories.map(c => (
            <button key={c.id} className={`category-pill ${selectedCat === String(c.id) ? 'active' : ''}`} onClick={() => setSelectedCat(String(c.id))}>{c.name}</button>
          ))}
        </div>

        {/* Menu Grid */}
        <div className="pos-menu-grid">
          {filteredProducts.map(product => (
            <div key={product.id} className="pos-menu-card" onClick={() => addToCart(product)} style={{ padding: product.image_url ? '0' : '16px', overflow: 'hidden' }}>
              {product.image_url && (
                <div style={{ height: 100, overflow: 'hidden' }}>
                  <img src={`${product.image_url}`} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ padding: product.image_url ? '12px' : '0' }}>
                <div className="menu-category">{product.category_name}</div>
                <div className="menu-name">{product.name}</div>
                <div className="menu-price">{formatRp(product.selling_price)}</div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <p>Tidak ada menu ditemukan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="pos-cart">
        <div className="pos-cart-header">
          <span><ShoppingCart size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />Order</span>
          {cart.length > 0 && <button className="btn btn-ghost btn-sm" onClick={clearCart}>Hapus Semua</button>}
        </div>

        <div className="pos-cart-items">
          {cart.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p>Belum ada item</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.key} className="pos-cart-item">
                <div className="pos-cart-item-header">
                  <span className="pos-cart-item-name">{item.name}</span>
                  <span className="pos-cart-item-price">{formatRp(item.price * item.qty)}</span>
                </div>
                {item.modifierLabels.length > 0 && (
                  <div className="pos-cart-item-mods">{item.modifierLabels.join(', ')}</div>
                )}
                <div className="pos-cart-item-controls">
                  <button onClick={() => updateQty(item.key, -1)}><Minus size={14} /></button>
                  <span className="qty">{item.qty}</span>
                  <button onClick={() => updateQty(item.key, 1)}><Plus size={14} /></button>
                  <span style={{ flex: 1 }} />
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>@{formatRp(item.price)}</span>
                  <button onClick={() => removeItem(item.key)} style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pos-cart-footer">
          <div className="pos-cart-total">
            <span>Subtotal</span>
            <span className="font-mono">{formatRp(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="pos-cart-total">
              <span>Diskon</span>
              <span className="text-danger font-mono">-{formatRp(discount)}</span>
            </div>
          )}
          <div className="pos-cart-total grand">
            <span>Total</span>
            <span className="total-amount font-mono">{formatRp(total)}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const d = prompt('Masukkan jumlah diskon (Rp):');
              if (d) setDiscount(parseInt(d) || 0);
            }}>Diskon</button>
          </div>
          <button
            className="btn btn-primary pos-pay-btn"
            disabled={cart.length === 0}
            onClick={() => setShowPayment(true)}
          >
            Bayar — {formatRp(total)}
          </button>
        </div>
      </div>

      {/* Modifier Modal */}
      {showModifier && (
        <div className="modal-overlay" onClick={() => setShowModifier(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Customize: {showModifier.product.name}</h3>
              <button className="modal-close" onClick={() => setShowModifier(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {showModifier.product.modifier_groups?.map(group => (
                <div key={group.id} style={{ marginBottom: 16 }}>
                  <label className="form-label">{group.name} {group.is_required ? '*' : ''}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {group.options?.map(opt => {
                      const selected = showModifier.selectedOptions.includes(opt.id);
                      return (
                        <button
                          key={opt.id}
                          className={`category-pill ${selected ? 'active' : ''}`}
                          onClick={() => {
                            setShowModifier(prev => {
                              let opts = [...prev.selectedOptions];
                              if (group.is_multiple) {
                                opts = selected ? opts.filter(id => id !== opt.id) : [...opts, opt.id];
                              } else {
                                // Remove other options from same group
                                const groupOptIds = group.options.map(o => o.id);
                                opts = opts.filter(id => !groupOptIds.includes(id));
                                if (!selected) opts.push(opt.id);
                              }
                              return { ...prev, selectedOptions: opts };
                            });
                          }}
                        >
                          {opt.name} {opt.price_adjustment > 0 ? `+${formatRp(opt.price_adjustment)}` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Catatan</label>
                <input className="form-input" placeholder="Catatan khusus..." value={showModifier.notes} onChange={e => setShowModifier(prev => ({ ...prev, notes: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModifier(null)}>Batal</button>
              <button className="btn btn-primary" onClick={addWithModifiers}>
                <Plus size={16} /> Tambah ke Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          total={total}
          subtotal={subtotal}
          discount={discount}
          cart={cart}
          paymentMethods={Array.isArray(paymentMethods) ? paymentMethods : []}
          storeSettings={storeSettings}
          onClose={() => setShowPayment(false)}
          onSuccess={(receipt) => {
            setShowPayment(false);
            setShowReceipt(receipt);
            clearCart();
          }}
        />
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <div className="modal-overlay" onClick={() => setShowReceipt(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title"><CheckCircle size={20} style={{ color: 'var(--success)', verticalAlign: 'middle', marginRight: 8 }} />Transaksi Berhasil</h3>
              <button className="modal-close" onClick={() => setShowReceipt(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="receipt">
                <div className="receipt-header">
                  <h3>☕ {storeSettings.store_name}</h3>
                  {storeSettings.store_address && <p style={{ fontSize: '0.7rem', color: '#888' }}>{storeSettings.store_address}</p>}
                  <p style={{ fontSize: '0.75rem', color: '#888' }}>{showReceipt.invoice_no}</p>
                  <p style={{ fontSize: '0.75rem', color: '#888' }}>{new Date(showReceipt.sold_at).toLocaleString('id-ID')}</p>
                  <p style={{ fontSize: '0.75rem', color: '#888' }}>Kasir: {showReceipt.cashier}</p>
                </div>
                <div className="receipt-divider" />
                {showReceipt.items?.map((item, i) => (
                  <div key={i}>
                    <div className="receipt-row">
                      <span>{item.qty}x {products.find(p => p.id === item.product_id)?.name || `Menu #${item.product_id}`}</span>
                      <span>{formatRp(item.line_total)}</span>
                    </div>
                    {item.modifiers?.map((m, j) => (
                      <div key={j} style={{ fontSize: '0.75rem', color: '#888', paddingLeft: 16 }}>+ {m.option_name_snapshot}</div>
                    ))}
                  </div>
                ))}
                <div className="receipt-divider" />
                <div className="receipt-row"><span>Subtotal</span><span>{formatRp(showReceipt.subtotal)}</span></div>
                {showReceipt.discount_amount > 0 && <div className="receipt-row"><span>Diskon</span><span>-{formatRp(showReceipt.discount_amount)}</span></div>}
                <div className="receipt-row receipt-total"><span>TOTAL</span><span>{formatRp(showReceipt.total)}</span></div>
                <div className="receipt-divider" />
                <div className="receipt-row"><span>Bayar ({showReceipt.payment_method})</span><span>{formatRp(showReceipt.cash_received)}</span></div>
                {showReceipt.change_amount > 0 && <div className="receipt-row"><span>Kembalian</span><span>{formatRp(showReceipt.change_amount)}</span></div>}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => handlePrint(showReceipt)}><Printer size={16} /> Cetak Struk</button>
              <button className="btn btn-primary" onClick={() => setShowReceipt(null)}>Selesai</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Section for Thermal Printer */}
      <div id="print-section" className="no-print-display">
        {showReceipt && (
          <div className="receipt-print">
            <div className="center">
              <h2 style={{ margin: '0 0 4px 0' }}>☕ {storeSettings.store_name}</h2>
              {storeSettings.store_address && <p style={{ fontSize: '8pt', margin: 0 }}>{storeSettings.store_address}</p>}
              <p style={{ fontSize: '9pt', margin: 0 }}>{showReceipt.invoice_no}</p>
              <p style={{ fontSize: '8pt', margin: 0 }}>{new Date(showReceipt.sold_at).toLocaleString('id-ID')}</p>
            </div>
            <div className="divider" />
            <div className="row" style={{ fontWeight: 'bold' }}>
              <span style={{ flex: 1 }}>Menu</span>
              <span style={{ width: '15mm', textAlign: 'right' }}>Total</span>
            </div>
            {showReceipt.items?.map((item, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <div className="row">
                  <span style={{ flex: 1 }}>{item.qty}x {products.find(p => p.id === item.product_id)?.name || `Menu #${item.product_id}`}</span>
                  <span style={{ width: '15mm', textAlign: 'right' }}>{formatRp(item.line_total)}</span>
                </div>
                {item.modifiers?.map((m, j) => (
                  <div key={j} style={{ fontSize: '8pt', paddingLeft: 8 }}>+ {m.option_name_snapshot}</div>
                ))}
              </div>
            ))}
            <div className="divider" />
            <div className="row"><span>Subtotal</span><span>{formatRp(showReceipt.subtotal)}</span></div>
            {showReceipt.discount_amount > 0 && <div className="row"><span>Diskon</span><span>-{formatRp(showReceipt.discount_amount)}</span></div>}
            <div className="row total"><span>TOTAL</span><span>{formatRp(showReceipt.total)}</span></div>
            <div className="divider" />
            <div className="row"><span>Bayar ({showReceipt.payment_method})</span><span>{formatRp(showReceipt.cash_received)}</span></div>
            {showReceipt.change_amount > 0 && <div className="row"><span>Kembalian</span><span>{formatRp(showReceipt.change_amount)}</span></div>}
            <div className="footer">
              <div className="divider" />
              <p>{storeSettings.receipt_footer}</p>
              {storeSettings.store_instagram && <p>Follow IG: {storeSettings.store_instagram}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Shift Blocker */}
      {showOpenShift && (
        <ShiftModal 
          mode="open" 
          onClose={() => navigate('/')} 
          onComplete={() => setShowOpenShift(false)} 
        />
      )}
    </div>
  );
}

function PaymentModal({ total, subtotal, discount, cart, paymentMethods, storeSettings, onClose, onSuccess }) {
  const { sendToPrinter, btStatus } = useBluetooth();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [cashReceived, setCashReceived] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQrisMock, setShowQrisMock] = useState(false);

  const change = (parseInt(cashReceived) || 0) - total;
  const isCash = Array.isArray(paymentMethods) && paymentMethods.find(m => m.id === selectedMethod)?.name === 'Cash';
  const isQRIS = Array.isArray(paymentMethods) && paymentMethods.find(m => m.id === selectedMethod)?.name === 'QRIS';

  async function processSale() {
    setLoading(true);
    setError('');
    try {
      const receipt = await api.post('/api/pos/sale', {
        payment_method_id: selectedMethod,
        customer_name: customerName || null,
        discount_amount: discount,
        cash_received: isCash ? parseInt(cashReceived) : total,
        notes: notes || null,
        items: cart.map(i => ({
          product_id: i.product_id,
          qty: i.qty,
          modifier_option_ids: i.modifier_option_ids,
          notes: i.notes
        }))
      });
      onSuccess(receipt);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (!selectedMethod) return setError('Pilih metode pembayaran.');
    if (isCash && (parseInt(cashReceived) || 0) < total) return setError('Uang yang diterima kurang.');

    if (isQRIS) {
      // Tampilkan Mock QRIS
      setShowQrisMock(true);
    } else {
      await processSale();
    }
  }

  async function handlePrintQR() {
    if (btStatus !== 'connected') return alert('Printer belum terhubung! Silakan hubungkan di menu Pengaturan.');
    if (!storeSettings?.qris_base_string) return alert('QRIS belum dikonfigurasi.');

    try {
      const qrisData = generateDynamicQRIS(storeSettings.qris_base_string, total);
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(qrisData);
      
      // pL pH = length of data + 3 (for cn, fn, m)
      const pL = (dataBytes.length + 3) & 0xFF;
      const pH = ((dataBytes.length + 3) >> 8) & 0xFF;

      const cmds = [
        new Uint8Array([0x1B, 0x40]), // Init
        new Uint8Array([0x1B, 0x61, 0x01]), // Center
        encoder.encode(`${storeSettings.store_name}\n\n`),
        
        // GS ( k — QR Code commands (cn=0x31 for QR Code)
        // 1. Select QR model 2: cn=49, fn=65, n1=50(Model2), n2=0
        new Uint8Array([0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
        
        // 2. Set module size to 6: cn=49, fn=67, n=6
        new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x06]),
        
        // 3. Set error correction level M: cn=49, fn=69, n=49(M)
        new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31]),
        
        // 4. Store QR data: cn=49, fn=80, m=48
        new Uint8Array([0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30, ...dataBytes]),
        
        // 5. Print QR symbol: cn=49, fn=81, m=48
        new Uint8Array([0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30]),
        
        encoder.encode(`\nTOTAL: ${formatRp(total)}\n`),
        encoder.encode('Silakan Scan untuk Bayar\n'),
        encoder.encode('\n\n\n\n'),
        new Uint8Array([0x1D, 0x56, 0x00]), // Cut
      ];

      await sendToPrinter(cmds);
    } catch (err) {
      console.error('Print QR failed:', err);
      alert('Gagal mencetak QR: ' + err.message);
    }
  }

  const quickCash = [total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, 100000].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 4);

  if (showQrisMock) {
    return (
      <div className="modal-overlay" onClick={() => setShowQrisMock(false)}>
        <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title">QRIS Dinamis (Simulasi)</h3>
            <button className="modal-close" onClick={() => setShowQrisMock(false)}><X size={20} /></button>
          </div>
          <div className="modal-body text-center">
            <p className="text-muted" style={{ marginBottom: 16 }}>Silakan scan kode QR di bawah menggunakan BCA, Gopay, OVO, Dana, dll.</p>
            <div style={{ background: 'white', padding: 24, borderRadius: 16, display: 'inline-block', marginBottom: 16 }}>
              {storeSettings?.qris_base_string ? (
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(generateDynamicQRIS(storeSettings.qris_base_string, total))}`} 
                  alt="QRIS" 
                  width={250} 
                  height={250} 
                />
              ) : (
                <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #ccc', color: '#888' }}>
                  QRIS belum dikonfigurasi di Pengaturan
                </div>
              )}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{formatRp(total)}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--success)', marginTop: 8 }} className="animate-pulse">Menunggu pembayaran...</p>
            
            <div style={{ marginTop: 24, background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, fontSize: '0.8rem', textAlign: 'left', color: 'var(--text-muted)' }}>
              <p>💡 <b>Konfirmasi Manual:</b> Setelah pelanggan membayar, silakan klik tombol di bawah untuk menyelesaikan pesanan.</p>
            </div>
          </div>
          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setShowQrisMock(false)} style={{ marginRight: 'auto' }}>Batal</button>
            <div style={{ display: 'flex', gap: 8 }}>
              {btStatus === 'connected' && (
                <button 
                  className="btn btn-secondary" 
                  onClick={handlePrintQR}
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                >
                  <Printer size={16} /> Cetak QR
                </button>
              )}
              <button className="btn btn-primary" onClick={() => {
                processSale();
              }} disabled={loading}>
                {loading ? 'Memproses...' : '✓ Konfirmasi Sudah Bayar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Pembayaran</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div className="text-muted" style={{ fontSize: '0.85rem' }}>Total Pembayaran</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-gold)' }}>{formatRp(total)}</div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Metode Pembayaran</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {Array.isArray(paymentMethods) && paymentMethods.map(m => (
                <button key={m.id} className={`category-pill ${selectedMethod === m.id ? 'active' : ''}`} onClick={() => setSelectedMethod(m.id)} style={{ flex: 1 }}>{m.name}</button>
              ))}
            </div>
          </div>

          {isCash && (
            <>
              <div className="form-group">
                <label className="form-label">Uang Diterima</label>
                <input className="form-input" type="number" placeholder="0" value={cashReceived} onChange={e => setCashReceived(e.target.value)} autoFocus style={{ fontSize: '1.2rem', fontWeight: 700, textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {quickCash.map(v => (
                  <button key={v} className="btn btn-secondary btn-sm" style={{ flex: 1, fontSize: '0.75rem' }} onClick={() => setCashReceived(String(v))}>{formatRp(v)}</button>
                ))}
              </div>
              {change >= 0 && cashReceived && (
                <div style={{ textAlign: 'center', padding: 12, background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>Kembalian</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{formatRp(change)}</div>
                </div>
              )}
            </>
          )}

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nama Pelanggan (opsional)</label>
              <input className="form-input" placeholder="Nama pelanggan" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <input className="form-input" placeholder="Catatan" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={handlePay} disabled={loading}>
            {loading ? 'Memproses...' : '✓ Proses Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  );
}

