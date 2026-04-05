'use client';

import { useEffect, useState } from 'react';

let showToastFn: (msg: string, type?: 'success' | 'error') => void = () => {};

export function toast(msg: string, type: 'success' | 'error' = 'success') {
  showToastFn(msg, type);
}

export default function Toast() {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'success' | 'error'>('success');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    showToastFn = (msg, t = 'success') => {
      setMessage(msg);
      setType(t);
      setVisible(true);
      setTimeout(() => setVisible(false), 2500);
    };
  }, []);

  return (
    <div className={`toast ${visible ? 'show' : ''} ${type === 'error' ? 'error' : ''}`}>
      {message}
    </div>
  );
}
