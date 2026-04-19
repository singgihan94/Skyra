import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const ThemeContext = createContext(null);

// Generate HSL variants from a hex color
function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyTheme(mode, brandColor, bgImageUrl) {
  const root = document.documentElement;
  const body = document.body;

  // ─── Apply theme mode ───────────────────
  if (mode === 'light') {
    root.style.setProperty('--bg-primary', '#f5f2ee');
    root.style.setProperty('--bg-secondary', '#ebe6df');
    root.style.setProperty('--bg-card', '#ffffff');
    root.style.setProperty('--bg-card-hover', '#f9f6f2');
    root.style.setProperty('--bg-input', '#f5f2ee');
    root.style.setProperty('--bg-sidebar', '#faf8f5');
    root.style.setProperty('--text-primary', '#1a1612');
    root.style.setProperty('--text-secondary', '#5c5249');
    root.style.setProperty('--text-muted', '#8a7e72');
    root.style.setProperty('--text-inverse', '#f5f0e8');
    root.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
    root.style.setProperty('--border-light', 'rgba(0, 0, 0, 0.05)');
    root.style.setProperty('--shadow-sm', '0 1px 3px rgba(0,0,0,0.08)');
    root.style.setProperty('--shadow-md', '0 4px 16px rgba(0,0,0,0.08)');
    root.style.setProperty('--shadow-lg', '0 8px 32px rgba(0,0,0,0.12)');
    root.style.setProperty('--shadow-glow', '0 0 20px rgba(0,0,0,0.04)');
  } else {
    root.style.setProperty('--bg-primary', '#0f0d0a');
    root.style.setProperty('--bg-secondary', '#1a1612');
    root.style.setProperty('--bg-card', '#221e18');
    root.style.setProperty('--bg-card-hover', '#2a2520');
    root.style.setProperty('--bg-input', '#1a1612');
    root.style.setProperty('--bg-sidebar', '#151210');
    root.style.setProperty('--text-primary', '#f5f0e8');
    root.style.setProperty('--text-secondary', '#a89b8c');
    root.style.setProperty('--text-muted', '#6d6259');
    root.style.setProperty('--text-inverse', '#0f0d0a');
    root.style.setProperty('--border-color', 'rgba(212, 168, 67, 0.12)');
    root.style.setProperty('--border-light', 'rgba(245, 240, 232, 0.06)');
    root.style.setProperty('--shadow-sm', '0 1px 3px rgba(0,0,0,0.3)');
    root.style.setProperty('--shadow-md', '0 4px 16px rgba(0,0,0,0.4)');
    root.style.setProperty('--shadow-lg', '0 8px 32px rgba(0,0,0,0.5)');
    root.style.setProperty('--shadow-glow', '0 0 20px rgba(212, 168, 67, 0.08)');
  }

  // ─── Apply brand color ──────────────────
  if (brandColor && brandColor !== '#d4a843') {
    const hsl = hexToHsl(brandColor);
    const hover = `hsl(${hsl.h}, ${Math.min(hsl.s + 10, 100)}%, ${Math.min(hsl.l + 10, 90)}%)`;
    const glow = `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.15)`;
    const darker = `hsl(${hsl.h}, ${hsl.s}%, ${Math.max(hsl.l - 20, 10)}%)`;

    root.style.setProperty('--accent-gold', brandColor);
    root.style.setProperty('--accent-gold-hover', hover);
    root.style.setProperty('--accent-gold-glow', glow);
    root.style.setProperty('--accent-coffee', darker);

    if (mode === 'dark') {
      root.style.setProperty('--border-color', `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.12)`);
      root.style.setProperty('--shadow-glow', `0 0 20px hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, 0.08)`);
    }
  } else {
    // Reset to default gold
    root.style.setProperty('--accent-gold', '#d4a843');
    root.style.setProperty('--accent-gold-hover', '#e6bc56');
    root.style.setProperty('--accent-gold-glow', 'rgba(212, 168, 67, 0.15)');
    root.style.setProperty('--accent-coffee', '#8b6914');
  }

  // ─── Apply background image ─────────────
  if (bgImageUrl) {
    const url = bgImageUrl.startsWith('http') ? bgImageUrl : `${bgImageUrl}`;
    body.style.setProperty('--custom-bg-image', `url(${url})`);
    body.classList.add('has-custom-bg');
  } else {
    body.style.removeProperty('--custom-bg-image');
    body.classList.remove('has-custom-bg');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState({ 
    mode: 'dark', 
    brandColor: '#d4a843', 
    bgImageUrl: '',
    storeName: 'Skyra Coffee',
    storeLogoUrl: ''
  });
  const [loaded, setLoaded] = useState(false);

  // Load theme from server settings
  useEffect(() => {
    api.get('/api/settings/public')
      .then(s => {
        if (s) {
          const t = {
            mode: s.theme_mode || 'dark',
            brandColor: s.brand_color || '#d4a843',
            bgImageUrl: s.bg_image_url || '',
            storeName: s.store_name || 'Skyra Coffee',
            storeLogoUrl: s.store_logo_url || ''
          };
          setTheme(t);
          applyTheme(t.mode, t.brandColor, t.bgImageUrl);
          if (t.storeName) document.title = `${t.storeName} POS`;
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const updateTheme = useCallback((newTheme) => {
    const merged = { ...theme, ...newTheme };
    setTheme(merged);
    applyTheme(merged.mode, merged.brandColor, merged.bgImageUrl);
    if (merged.storeName) document.title = `${merged.storeName} POS`;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, loaded }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider');
  return ctx;
}
