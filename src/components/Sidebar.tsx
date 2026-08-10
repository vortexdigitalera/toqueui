'use client';

import React from 'react';
import Link from 'next/link';
import AppLogo from './ui/AppLogo';
import Icon from './ui/AppIcon';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
  badgeVariant?: 'primary' | 'warning' | 'success' | 'error';
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Authentication', href: '/', icon: 'KeyIcon', group: 'Operations' },
  { label: 'Send Visa', href: '/send-visa-panel', icon: 'PaperAirplaneIcon', group: 'Operations' },
  { label: 'Schedule', href: '/schedule-panel', icon: 'ClockIcon', badge: 2, badgeVariant: 'primary', group: 'Operations' },
  { label: 'Pulling', href: '/pulling-panel', icon: 'ArrowDownTrayIcon', group: 'Operations' },
  { label: 'Captcha', href: '/captcha-panel', icon: 'ShieldCheckIcon', group: 'Operations' },
  { label: 'Network', href: '/network-panel', icon: 'SignalIcon', group: 'Monitoring' },
  { label: 'Benchmarking', href: '/benchmarking-panel', icon: 'ChartBarIcon', group: 'Monitoring' },
  { label: 'API Builder', href: '/api-builder', icon: 'CodeBracketIcon', group: 'Developer' },
];

const BADGE_COLORS: Record<string, string> = {
  primary: 'bg-primary/10 text-accent border border-primary/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
  success: 'bg-success/10 text-success border border-success/20',
  error: 'bg-error/10 text-error border border-error/20',
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeRoute: string;
}

export default function Sidebar({ collapsed, onToggle, activeRoute }: SidebarProps) {
  const groups = Array.from(new Set(NAV_ITEMS.map(i => i.group)));

  return (
    <aside
      className="flex flex-col h-full shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
      style={{
        width: collapsed ? '64px' : '240px',
        backgroundColor: 'var(--card)',
        borderRight: '1px solid var(--border)',
      }}
    >
      {/* Logo + collapse icon in header */}
      <div
        className="flex items-center justify-between h-14 px-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <AppLogo size={28} />
          {!collapsed && (
            <span
              className="font-semibold text-lg tracking-tight truncate"
              style={{ color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}
            >
              ToqueUI
            </span>
          )}
        </div>
        {/* Collapse toggle icon — always visible in header */}
        <button
          onClick={onToggle}
          className="btn-ghost p-1.5 rounded-md shrink-0 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ marginLeft: collapsed ? 'auto' : '0' }}
        >
          <Icon
            name={collapsed ? 'Bars3Icon' : 'ChevronDoubleLeftIcon'}
            size={16}
          />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
        {groups.map(group => (
          <div key={group} className="mb-3">
            {!collapsed && (
              <p
                className="px-2 mb-1.5 uppercase tracking-widest font-semibold"
                style={{ fontSize: '10px', color: 'var(--muted-foreground)', letterSpacing: '0.1em' }}
              >
                {group}
              </p>
            )}
            <ul className="space-y-0.5 list-none p-0 m-0">
              {NAV_ITEMS.filter(i => i.group === group).map(item => {
                const isActive = activeRoute === item.href;
                return (
                  <li key={`nav-${item.href}`}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={`sidebar-item ${isActive ? 'active' : ''}`}
                      style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400 }}
                    >
                      <span className="shrink-0">
                        <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={18} variant={isActive ? 'solid' : 'outline'} />
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.badge !== undefined && (
                            <span
                              className={`text-2xs px-1.5 py-0.5 rounded-full font-mono font-semibold ${BADGE_COLORS[item.badgeVariant ?? 'primary']}`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}