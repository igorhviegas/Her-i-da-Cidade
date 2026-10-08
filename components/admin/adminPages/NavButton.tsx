import React from 'react';
import type { NavBadge, NavItem } from '../AdminNav';

function badgeView(badge: NavBadge | undefined) {
  const showCount = !!badge && (badge.failed || (badge.count !== null && badge.count > 0));
  const label = badge ? (badge.failed ? badge.failedLabel : badge.label(badge.count ?? 0)) : '';
  return { showCount, label };
}

interface NavButtonProps<Id extends string> {
  item: NavItem<Id>;
  active: boolean;
  badge: NavBadge | undefined;
  variant: 'desktop' | 'mobile';
  onSelect: (id: Id) => void;
  extra?: Partial<React.ButtonHTMLAttributes<HTMLButtonElement>>;
}

export function NavButton<Id extends string>({ item, active, badge, variant, onSelect, extra }: NavButtonProps<Id>) {
  const Icon = item.icon;
  const { showCount, label } = badgeView(badge);
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active ? `bg-blue-600 text-white${variant === 'desktop' ? ' shadow-lg shadow-blue-600/20' : ''}` : 'text-white/70 hover:bg-white/5 hover:text-white'
      }`}
      {...extra}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className={`w-4 h-4 shrink-0 ${active || variant === 'mobile' ? 'text-white' : 'text-white/50'}`} />
        <span className="truncate">{item.label}</span>
      </span>
      {showCount && (
        <span
          className={`flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none tabular-nums ${
            badge.failed ? 'bg-white/15 text-white/70' : 'bg-amber-400 text-[#0B1120]'
          }`}
          aria-label={label}
          title={label}
        >
          {badge.failed ? '!' : badge.count > 99 ? '99+' : badge.count}
        </span>
      )}
    </button>
  );
}
