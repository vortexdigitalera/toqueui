'use client';

import React, { useEffect, useState } from 'react';
import Icon from './ui/AppIcon';
import { useTheme } from '@/context/ThemeContext';

interface TopHeaderProps {
  sidebarCollapsed: boolean;
}

export default function TopHeader({ sidebarCollapsed: _ }: TopHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const [baseUrl, setBaseUrl] = useState('https://toque.vortex.name.ng');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('disconnected');
  const [lastChecked, setLastChecked] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('toque_base_url');
    if (stored) setBaseUrl(stored);
    const storedStatus = localStorage.getItem('toque_connection_status') as typeof connectionStatus | null;
    if (storedStatus) setConnectionStatus(storedStatus);
    setLastChecked(new Date().toLocaleTimeString('en-US', { hour12: false }));
  }, []);

  const statusConfig = {
    connected: { color: 'var(--success)', label: 'Connected', dotClass: 'pulse-dot' },
    disconnected: { color: 'var(--muted-foreground)', label: 'Disconnected', dotClass: '' },
    checking: { color: 'var(--warning)', label: 'Checking...', dotClass: '' },
  };

  const status = statusConfig[connectionStatus];

  return (
    <header
      className="flex items-center justify-between h-14 px-6 shrink-0"
      style={{ backgroundColor: 'var(--card)', borderBottom: '1px solid var(--border)' }}
    >
      {/* Left: base URL */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded font-mono text-xs"
          style={{ backgroundColor: 'var(--input)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          <Icon name="GlobeAltIcon" size={13} />
          <span className="truncate max-w-[220px]" style={{ color: 'var(--foreground)' }}>
            {baseUrl}
          </span>
        </div>
      </div>

      {/* Right: status + timestamp + theme toggle */}
      <div className="flex items-center gap-4">
        {lastChecked && (
          <span className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>
            Checked {lastChecked}
          </span>
        )}
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${status.dotClass}`}
            style={{ backgroundColor: status.color }}
          />
          <span className="text-xs font-semibold" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
        >
          <Icon name="KeyIcon" size={12} />
          <span>API Key</span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="btn-ghost px-2.5 py-1.5"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? (
            <Icon name="SunIcon" size={16} />
          ) : (
            <Icon name="MoonIcon" size={16} />
          )}
        </button>
      </div>
    </header>
  );
}