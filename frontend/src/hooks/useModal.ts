import { useState, useCallback } from 'react';

export function useModal<T = any>() {
  const [visible, setVisible] = useState(false);
  const [editingData, setEditingData] = useState<T | null>(null);

  const open = useCallback((data?: T) => {
    setEditingData(data || null);
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setEditingData(null);
  }, []);

  return { visible, editingData, open, close };
}