import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Info,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import type { ToastMessage } from '../../contexts/AppContext';
import type { ModuleKey } from '../../types';
import { ACCENT_TOKENS, type AccentTone, useModuleAccent, useModuleKey } from '../../config/theme';

export function PageHeader({
  title,
  subtitle,
  actions,
  accent,
  module: moduleOverride,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  accent?: AccentTone;
  module?: ModuleKey;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const resolvedModule = useModuleKey(moduleOverride);
  const resolvedAccent = useModuleAccent(accent);
  return (
    <div
      data-module={accent ? undefined : resolvedModule}
      data-accent={resolvedAccent}
      className="ec-page-header rounded-[14px] border px-5 sm:px-6 py-5 mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print"
    >
      <div className="flex items-start sm:items-center gap-3.5 min-w-0">
        {Icon && (
          <div className="ec-page-header-icon hidden sm:flex w-11 h-11 rounded-[11px] border items-center justify-center shrink-0">
            <Icon className="w-[22px] h-[22px]" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-[28px] sm:text-[32px] leading-[1.2] font-bold tracking-[-0.02em] text-slate-900">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[15px] sm:text-[16px] leading-relaxed text-slate-600 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  subtext,
  actionLabel,
  onAction,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: AccentTone;
}) {
  const resolvedAccent = useModuleAccent(accent);
  const tokens = ACCENT_TOKENS[resolvedAccent];
  return (
    <div
      className={`bg-white border border-slate-200/90 ${tokens.topBorder} rounded-[12px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_18px_-6px_rgba(15,23,42,0.09)] hover:border-slate-300/90 transition-all duration-150 flex flex-col justify-between`}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="text-[14px] font-medium text-slate-600 leading-snug">{label}</div>
          {Icon && (
            <div
              className={`w-9 h-9 rounded-[9px] border ${tokens.iconBox} flex items-center justify-center shrink-0`}
            >
              <Icon className="w-[18px] h-[18px]" />
            </div>
          )}
        </div>
        <div
          className={`text-[28px] sm:text-[32px] leading-[1.15] font-bold ${tokens.valueAccent} tabular-nums tracking-[-0.02em] mt-3 font-display`}
        >
          {value}
        </div>
        {subtext && <div className="text-[13.5px] text-slate-500 mt-1.5 leading-snug">{subtext}</div>}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={`mt-4 pt-3 border-t border-slate-100 inline-flex items-center justify-between w-full text-[13.5px] font-semibold ${tokens.actionText} group transition-colors`}
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
  noPadding = false,
  accent,
  variant = 'default',
  icon: Icon,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  accent?: AccentTone;
  variant?: 'default' | 'tinted-header' | 'top-accent';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const resolvedAccent = useModuleAccent(accent);
  const tokens = ACCENT_TOKENS[resolvedAccent];
  return (
    <section
      className={`bg-white border border-slate-200/90 ${
        variant === 'top-accent' ? tokens.topBorder : ''
      } rounded-[12px] shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden ${className}`}
    >
      {(title || action) && (
        <div
          className={`px-5 sm:px-6 py-4 border-b border-slate-200/75 flex items-start sm:items-center justify-between gap-4 ${
            variant === 'tinted-header' ? tokens.sectionHeaderBg : 'bg-white'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {Icon && (
              <div
                className={`w-8 h-8 rounded-[8px] border ${tokens.iconBox} flex items-center justify-center shrink-0`}
              >
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h2 className="text-[17px] sm:text-[18px] font-semibold text-slate-900 tracking-[-0.01em]">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-[13.5px] text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5 sm:p-6'}>{children}</div>
    </section>
  );
}

export function FormSection({
  title,
  description,
  children,
  withDivider = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  withDivider?: boolean;
}) {
  return (
    <div className={withDivider ? 'border-t border-slate-200 pt-5 mt-5' : ''}>
      <div className="mb-4">
        <h3 className="text-[16px] font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-[13.5px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function FormField({
  label,
  required,
  helper,
  error,
  children,
  className = '',
}: {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[14px] font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-red-600 ml-0.5">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-red-700 mt-1">{error}</p>
      ) : helper ? (
        <p className="text-[13px] text-slate-500 mt-1">{helper}</p>
      ) : null}
    </div>
  );
}

export function Avatar({
  src,
  name,
  size = 'md',
}: {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const dims = {
    sm: 'w-8 h-8 text-[12px]',
    md: 'w-9 h-9 text-[13px]',
    lg: 'w-11 h-11 text-[15px]',
    xl: 'w-16 h-16 text-[20px]',
  }[size];

  const initials = (name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'User avatar'}
        referrerPolicy="no-referrer"
        className={`${dims} rounded-[10px] object-cover border border-slate-200 shrink-0 bg-slate-100`}
      />
    );
  }

  return (
    <div
      className={`${dims} rounded-[10px] bg-blue-50 border border-blue-200/80 text-blue-900 font-semibold flex items-center justify-center shrink-0`}
    >
      {initials}
    </div>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className = '',
  accent,
}: {
  items: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
  accent?: AccentTone;
}) {
  const resolvedAccent = useModuleAccent(accent);
  const tokens = ACCENT_TOKENS[resolvedAccent];
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/55 border border-slate-200/90 rounded-[10px] w-fit ${className}`}
      role="tablist"
    >
      {items.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`px-3.5 py-2 text-[14px] font-medium rounded-[8px] transition-all duration-150 whitespace-nowrap shrink-0 ${
              active
                ? `${tokens.tabActive} font-semibold`
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={`ml-1.5 text-[12.5px] tabular-nums ${active ? tokens.tabBadgeActive : 'text-slate-400'}`}>
                ({tab.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="w-[18px] h-[18px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2.5 text-[14.5px] text-slate-900 bg-white border border-slate-300 rounded-[10px] placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function FilterBar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {children}
    </div>
  );
}

export function Skeleton({
  variant = 'rect',
  lines = 3,
  columns = 5,
  className = '',
}: {
  variant?: 'rect' | 'text' | 'heading' | 'circle' | 'card' | 'table-row';
  lines?: number;
  columns?: number;
  className?: string;
}) {
  if (variant === 'circle') {
    return <div aria-hidden="true" className={`ec-skeleton rounded-full shrink-0 ${className || 'w-10 h-10'}`} />;
  }

  if (variant === 'heading') {
    return <div aria-hidden="true" className={`ec-skeleton rounded-[6px] h-7 ${className || 'w-48'}`} />;
  }

  if (variant === 'text') {
    return (
      <div aria-hidden="true" className={`space-y-2.5 ${className}`}>
        {Array.from({ length: Math.max(1, lines) }).map((_, i) => (
          <div
            key={i}
            className={`ec-skeleton h-3.5 rounded-[5px] ${
              i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full'
            }`}
          />
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        aria-hidden="true"
        className={`bg-white border border-slate-200/90 border-t-2 border-t-slate-200 rounded-[12px] p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between ${className}`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="ec-skeleton h-4 w-28 rounded-[5px]" />
            <div className="ec-skeleton w-9 h-9 rounded-[9px] shrink-0" />
          </div>
          <div className="ec-skeleton h-8 w-24 rounded-[6px] mt-3.5" />
          <div className="ec-skeleton h-3.5 w-36 rounded-[5px] mt-2" />
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="ec-skeleton h-3.5 w-24 rounded-[5px]" />
          <div className="ec-skeleton h-3.5 w-4 rounded-[4px]" />
        </div>
      </div>
    );
  }

  if (variant === 'table-row') {
    return (
      <tr aria-hidden="true" className="ec-tr">
        {Array.from({ length: Math.max(1, columns) }).map((_, idx) => (
          <td key={idx} className="ec-td">
            <div
              className={`ec-skeleton h-4 rounded-[5px] ${
                idx === 0
                  ? 'w-24'
                  : idx === columns - 1
                    ? 'w-20 ml-auto'
                    : idx % 2 === 1
                      ? 'w-40'
                      : 'w-28'
              }`}
            />
          </td>
        ))}
      </tr>
    );
  }

  return <div aria-hidden="true" className={`ec-skeleton rounded-[8px] ${className || 'h-4 w-full'}`} />;
}

export function LoadingState({
  variant = 'cards',
  message,
  columns = 5,
  rows = 5,
}: {
  variant?: 'cards' | 'table' | 'shell';
  message?: string;
  columns?: number;
  rows?: number;
}) {
  if (variant === 'shell') {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex">
        <div className="hidden lg:flex w-[264px] bg-[#F7F9FC] border-r border-slate-200 p-5 flex-col gap-6 shrink-0">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-[10px] shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24 rounded-[5px]" />
              <Skeleton className="h-3 w-32 rounded-[5px]" />
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 rounded-[8px]" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="h-[68px] bg-white border-b border-slate-200 px-6 flex items-center justify-between">
            <Skeleton className="h-5 w-48 rounded-[6px]" />
            <Skeleton className="h-9 w-56 rounded-[10px]" />
          </div>
          <div className="p-6 sm:p-8 max-w-[1440px] w-full mx-auto space-y-6">
            <div className="space-y-2.5">
              <Skeleton variant="heading" className="w-64" />
              <Skeleton className="h-4 w-80 rounded-[5px]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="card" />
              ))}
            </div>
            {message && <p className="text-[14px] text-slate-500">{message}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="bg-white border border-slate-200/90 rounded-[12px] overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-64 rounded-[10px]" />
          <Skeleton className="h-10 w-36 rounded-[10px]" />
        </div>
        <div className="overflow-x-auto">
          <table className="ec-table">
            <thead className="ec-thead">
              <tr>
                {Array.from({ length: Math.max(2, columns) }).map((_, i) => (
                  <th key={i} className="ec-th">
                    <Skeleton className={`h-3.5 rounded-[5px] ${i === columns - 1 ? 'w-16 ml-auto' : 'w-24'}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="ec-tbody">
              {Array.from({ length: Math.max(1, rows) }).map((_, i) => (
                <Skeleton key={i} variant="table-row" columns={Math.max(2, columns)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} variant="card" />
      ))}
    </div>
  );
}

export function ErrorState({
  title = 'Unable to load records',
  description = 'Something went wrong while loading this section. Please try again.',
  onRetry,
  retryLabel = 'Try Again',
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="bg-white border border-red-200/90 rounded-[12px] p-8 sm:p-10 text-center flex flex-col items-center justify-center shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="w-12 h-12 rounded-[12px] bg-red-50 border border-red-200/80 flex items-center justify-center text-red-700 mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-[18px] font-semibold text-slate-900">{title}</h3>
      <p className="text-[15px] text-slate-600 mt-1.5 max-w-md leading-relaxed">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-[14px] font-medium text-white bg-blue-800 rounded-[10px] hover:bg-blue-900 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function Dropdown({
  trigger,
  children,
  align = 'right',
}: {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen((v) => !v))}
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 bg-white border border-slate-200 rounded-[12px] shadow-[0_10px_30px_-8px_rgba(15,23,42,0.16)] z-40`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
}) {
  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  return (
    <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[13.5px] text-slate-600">
      <div className="tabular-nums">
        Showing {totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1}–
        {Math.min(safePage * pageSize, totalItems)} of {totalItems} records
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className="inline-flex items-center justify-center w-9 h-9 border border-slate-300 bg-white rounded-[8px] disabled:opacity-40 hover:bg-slate-50 transition-colors"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-2 tabular-nums font-medium text-slate-700">
          Page {safePage} of {totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          className="inline-flex items-center justify-center w-9 h-9 border border-slate-300 bg-white rounded-[8px] disabled:opacity-40 hover:bg-slate-50 transition-colors"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface StatusVisualStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
}

const STATUS_STYLES: Record<string, StatusVisualStyle> = {
  // Positive / Active / Confirmed states
  active: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Active' },
  current: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Current Session' },
  current_session: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Current Session' },
  configured: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Configured' },
  present: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Present' },
  paid: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Paid' },
  recorded: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Recorded' },
  approved: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Approved' },
  accepted: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Accepted' },
  enrolled: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Enrolled' },
  completed: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Completed' },
  published: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Published' },
  verified: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Verified' },
  returned: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Returned' },
  available: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Available' },
  graded: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Graded' },
  pass: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Pass' },
  passed: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Passed' },
  income: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Income' },
  yes: { bg: 'bg-emerald-50/90', text: 'text-emerald-800', border: 'border-emerald-200/85', label: 'Yes' },

  // Pending / Partial / Attention states
  pending: { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/85', label: 'Pending' },
  partial: { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/85', label: 'Partial' },
  late: { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/85', label: 'Late' },
  under_review: { bg: 'bg-violet-50/90', text: 'text-violet-800', border: 'border-violet-200/85', label: 'Under Review' },
  documents_pending: { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/85', label: 'Docs Pending' },
  reserved: { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/85', label: 'Reserved' },
  on_leave: { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/85', label: 'On Leave' },
  leave: { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/85', label: 'Leave' },
  maintenance: { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/85', label: 'Maintenance' },
  flagged: { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/85', label: 'Flagged' },
  not_configured: { bg: 'bg-amber-50/90', text: 'text-amber-800', border: 'border-amber-200/85', label: 'Not Configured' },

  // Informational / In-progress states
  scheduled: { bg: 'bg-blue-50/90', text: 'text-blue-800', border: 'border-blue-200/85', label: 'Scheduled' },
  ongoing: { bg: 'bg-blue-50/90', text: 'text-blue-800', border: 'border-blue-200/85', label: 'Ongoing' },
  submitted: { bg: 'bg-blue-50/90', text: 'text-blue-800', border: 'border-blue-200/85', label: 'Submitted' },
  issued: { bg: 'bg-blue-50/90', text: 'text-blue-800', border: 'border-blue-200/85', label: 'Issued' },
  occupied: { bg: 'bg-blue-50/90', text: 'text-blue-800', border: 'border-blue-200/85', label: 'Occupied' },

  // Negative / Critical / Alert states
  absent: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Absent' },
  unpaid: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Unpaid' },
  overdue: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Overdue' },
  rejected: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Rejected' },
  revoked: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Revoked' },
  suspended: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Suspended' },
  withdrawn: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Withdrawn' },
  refunded: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Refunded' },
  failed: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Failed' },
  fail: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Fail' },
  lost: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Lost' },
  damaged: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Damaged' },
  out_of_stock: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Out of Stock' },
  cancelled: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Cancelled' },
  expense: { bg: 'bg-red-50/90', text: 'text-red-800', border: 'border-red-200/85', label: 'Expense' },

  // Neutral / Inactive / Archived states
  inactive: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'Inactive' },
  draft: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'Draft' },
  archived: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'Archived' },
  graduated: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'Graduated' },
  transferred: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'Transferred' },
  resigned: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'Resigned' },
  waived: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'Waived' },
  checked_out: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'Checked Out' },
  closed: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'Closed' },
  holiday: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'Holiday' },
  no: { bg: 'bg-slate-100/95', text: 'text-slate-700', border: 'border-slate-300/80', label: 'No' },
};

function formatStatusLabel(raw: string): string {
  return raw
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function isKnownStatus(status: string): boolean {
  const key = status.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return Boolean(STATUS_STYLES[key]);
}

export function StatusBadge({
  status,
  label,
  size = 'md',
}: {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const key = status.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const s = STATUS_STYLES[key] || {
    bg: 'bg-slate-100/95',
    text: 'text-slate-700',
    border: 'border-slate-300/80',
    label: formatStatusLabel(status),
  };
  const sizing =
    size === 'sm'
      ? 'px-2 py-0.5 text-[12px]'
      : 'px-2.5 py-1 text-[12.5px]';

  return (
    <span
      className={`inline-flex items-center justify-center font-semibold leading-none tracking-[0.01em] rounded-[6px] border whitespace-nowrap ${sizing} ${s.bg} ${s.text} ${s.border}`}
    >
      {label || s.label}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  accent,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: React.ReactNode;
  accent?: AccentTone;
}) {
  const resolvedAccent = useModuleAccent(accent);
  const tokens = ACCENT_TOKENS[resolvedAccent];
  return (
    <div className="bg-white border border-slate-200/90 rounded-[12px] px-6 py-14 text-center flex flex-col items-center justify-center shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      {Icon && (
        <div className={`w-14 h-14 rounded-[12px] border ${tokens.iconBox} flex items-center justify-center mb-4`}>
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h3 className="text-[18px] font-semibold text-slate-900">{title}</h3>
      <p className="text-[15px] text-slate-500 mt-1.5 max-w-md leading-relaxed">{description}</p>
      {(actionLabel || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="px-5 py-2.5 text-[14px] font-medium text-white bg-blue-800 rounded-[10px] hover:bg-blue-900 transition-colors shadow-[0_1px_2px_rgba(30,64,175,0.2)]"
            >
              {actionLabel}
            </button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'lg',
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeMap = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4 overflow-y-auto no-print"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white border border-slate-200 rounded-[14px] shadow-[0_20px_50px_-12px_rgba(15,23,42,0.25)] w-full ${sizeMap[size]} max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 shrink-0">
          <div>
            <h2 className="text-[19px] font-semibold text-slate-900 tracking-[-0.01em]">{title}</h2>
            {subtitle && <p className="text-[14px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-[8px] hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-end gap-3 shrink-0 rounded-b-[14px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 text-[14px] font-medium text-slate-700 bg-white border border-slate-300 rounded-[10px] hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2.5 text-[14px] font-medium text-white rounded-[10px] transition-colors disabled:opacity-60 ${
              destructive ? 'bg-red-700 hover:bg-red-800' : 'bg-blue-800 hover:bg-blue-900'
            }`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-[15px] text-slate-600 leading-relaxed">{description}</p>
    </Modal>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0 no-print">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`flex items-start gap-3 p-4 rounded-[12px] border shadow-[0_10px_25px_-5px_rgba(15,23,42,0.14)] bg-white ${
            t.type === 'error'
              ? 'border-red-300 text-red-900'
              : t.type === 'success'
                ? 'border-emerald-300 text-emerald-900'
                : 'border-slate-300 text-slate-900'
          }`}
        >
          {t.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          ) : t.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div className="text-[14px] font-medium flex-1 leading-snug">{t.text}</div>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  meta?: string;
}

export function SearchableSelect({
  label,
  required,
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  disabled = false,
}: {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options
      .filter(
        (o) => o.label.toLowerCase().includes(q) || (o.meta && o.meta.toLowerCase().includes(q)),
      )
      .slice(0, 60);
  }, [options, queryText]);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-[14px] font-medium text-slate-700 mb-1.5">
          {label}
          {required && <span className="text-red-600 ml-0.5">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-[15px] bg-white border border-slate-300 rounded-[10px] text-left hover:border-slate-400 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15 disabled:bg-slate-100"
      >
        <span className={selected ? 'text-slate-900 truncate' : 'text-slate-400 truncate'}>
          {selected ? `${selected.label}${selected.meta ? ` · ${selected.meta}` : ''}` : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 w-full bg-white border border-slate-200 rounded-[10px] shadow-[0_12px_28px_-6px_rgba(15,23,42,0.16)]">
          <div className="p-2.5 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-3 py-2 text-[14px] border border-slate-200 rounded-[8px] focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="w-full px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-50 text-left"
              >
                Clear selection
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-3.5 py-4 text-[13.5px] text-slate-500 text-center">
                No matching records found
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setQueryText('');
                  }}
                  className={`w-full px-3.5 py-2.5 text-[14px] text-left flex items-center justify-between hover:bg-slate-50 ${
                    opt.value === value ? 'bg-blue-50 text-blue-900 font-medium' : 'text-slate-800'
                  }`}
                >
                  <div className="truncate">
                    <span>{opt.label}</span>
                    {opt.meta && <span className="text-[13px] text-slate-500 ml-2">{opt.meta}</span>}
                  </div>
                  {opt.value === value && <Check className="w-4 h-4 text-blue-800 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right';
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  defaultHidden?: boolean;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  searchPlaceholder = 'Search records...',
  searchFilter,
  filters,
  onExport,
  bulkActions,
  emptyState,
  pageSize = 15,
  loading = false,
}: {
  rows: T[];
  columns: TableColumn<T>[];
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  filters?: React.ReactNode;
  onExport?: (filteredRows: T[]) => void;
  bulkActions?: (selectedIds: string[], clearSelection: () => void) => React.ReactNode;
  emptyState: React.ReactNode;
  pageSize?: number;
  loading?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() =>
    columns.filter((c) => c.defaultHidden).map((c) => c.key),
  );
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !searchFilter) return rows;
    return rows.filter((r) => searchFilter(r, q));
  }, [rows, search, searchFilter]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return filtered;
    const fn = col.sortValue;
    return [...filtered].sort((a, b) => {
      const av = fn(a);
      const bv = fn(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const visibleColumns = columns.filter((c) => !hiddenCols.includes(c.key));

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selectedIds.includes(r.id));

  const toggleAllOnPage = () => {
    if (allOnPageSelected) {
      const pageIds = new Set(pageRows.map((r) => r.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const next = new Set(selectedIds);
      pageRows.forEach((r) => next.add(r.id));
      setSelectedIds(Array.from(next));
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-[12px] overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-64 rounded-[10px]" />
          <Skeleton className="h-10 w-36 rounded-[10px]" />
        </div>
        <div className="overflow-x-auto">
          <table className="ec-table">
            <thead className="ec-thead">
              <tr>
                {bulkActions && <th className="w-12 px-5 py-4" />}
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`ec-th ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="ec-tbody">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton
                  key={idx}
                  variant="table-row"
                  columns={visibleColumns.length + (bulkActions ? 1 : 0)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-[12px] overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="p-4 border-b border-slate-200 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-white">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {searchFilter && (
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="w-[17px] h-[17px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-10 pr-3.5 py-2 text-[14.5px] text-slate-900 border border-slate-300 rounded-[10px] placeholder:text-slate-400 focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
              />
            </div>
          )}
          {filters}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {bulkActions && selectedIds.length > 0 && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-[10px]">
              <span className="text-[13.5px] font-semibold text-blue-900 tabular-nums">
                {selectedIds.length} selected
              </span>
              {bulkActions(selectedIds, () => setSelectedIds([]))}
            </div>
          )}
          <div ref={colMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setColMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13.5px] font-medium text-slate-700 bg-white border border-slate-300 rounded-[10px] hover:bg-slate-50 transition-colors"
            >
              <Columns3 className="w-4 h-4 text-slate-500" />
              Columns
            </button>
            {colMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-[10px] shadow-[0_12px_28px_-6px_rgba(15,23,42,0.16)] z-30 p-2">
                {columns.map((c) => {
                  const checked = !hiddenCols.includes(c.key);
                  return (
                    <label
                      key={c.key}
                      className="flex items-center gap-2.5 px-2.5 py-2 text-[13.5px] text-slate-700 hover:bg-slate-50 rounded-[8px] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setHiddenCols((prev) =>
                            checked ? [...prev, c.key] : prev.filter((k) => k !== c.key),
                          )
                        }
                        className="rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                      />
                      <span>{c.header}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          {onExport && (
            <button
              type="button"
              onClick={() => onExport(sorted)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13.5px] font-medium text-slate-700 bg-white border border-slate-300 rounded-[10px] hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="ec-table">
          <thead className="ec-thead">
            <tr>
              {bulkActions && (
                <th className="w-12 px-5 py-4">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select all on page"
                    className="rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                  />
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  className={`ec-th ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors"
                    >
                      <span>{col.header}</span>
                      {sortKey === col.key && (
                        <span className="text-blue-800">{sortDir === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="ec-tbody">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (bulkActions ? 1 : 0)}
                  className="px-5 py-12 text-center text-[15px] text-slate-500"
                >
                  No matching records found for the current search or filter.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const isSelected = selectedIds.includes(row.id);
                return (
                <tr
                  key={row.id}
                  className={`transition-colors ${
                    isSelected ? 'bg-blue-50/75 hover:bg-blue-50/90' : 'ec-tr'
                  }`}
                >
                  {bulkActions && (
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() =>
                          setSelectedIds((prev) =>
                            prev.includes(row.id)
                              ? prev.filter((id) => id !== row.id)
                              : [...prev, row.id],
                          )
                        }
                        aria-label="Select row"
                        className="rounded border-slate-300 text-blue-800 focus:ring-blue-700"
                      />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`ec-td ${
                        col.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        totalItems={sorted.length}
        pageSize={pageSize}
        onPageChange={setPage}
      />
    </div>
  );
}

export function QrCodeCanvas({ value, size = 96 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).catch((err) => console.error('QR render failed:', err));
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-[8px] border border-slate-200 bg-white"
    />
  );
}
