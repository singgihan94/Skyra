import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';

const ShiftContext = createContext(null);

export function ShiftProvider({ children }) {
  const { user } = useAuth();
  const [currentShift, setCurrentShift] = useState(null);
  const [loadingShift, setLoadingShift] = useState(true);

  useEffect(() => {
    if (user) {
      checkCurrentShift();
    } else {
      setCurrentShift(null);
      setLoadingShift(false);
    }
  }, [user]);

  async function checkCurrentShift() {
    try {
      setLoadingShift(true);
      const data = await api.get('/api/shifts/current');
      setCurrentShift(data.shift);
    } catch (err) {
      console.error('Failed to get current shift', err);
    } finally {
      setLoadingShift(false);
    }
  }

  return (
    <ShiftContext.Provider value={{ currentShift, loadingShift, checkCurrentShift }}>
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift() {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error('useShift must be within ShiftProvider');
  return ctx;
}
