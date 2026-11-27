import React, { createContext, useContext } from 'react';
import type { ModuleKey } from '../types';

export type AccentTone =
  | 'blue'
  | 'violet'
  | 'teal'
  | 'indigo'
  | 'emerald'
  | 'amber'
  | 'cyan'
  | 'rose'
  | 'purple'
  | 'orange'
  | 'slate';

export interface AccentTokenSet {
  pageBg: string;
  headerBg: string;
  headerBorder: string;
  iconBox: string;
  topBorder: string;
  sectionHeaderBg: string;
  actionText: string;
  tabActive: string;
  tabBadgeActive: string;
  softSurface: string;
  barColor: string;
  valueAccent: string;
}

export const ACCENT_TOKENS: Record<AccentTone, AccentTokenSet> = {
  blue: {
    pageBg: 'bg-[#F4F7FB]',
    headerBg: 'bg-gradient-to-r from-blue-50/85 via-white to-white',
    headerBorder: 'border-blue-200/70',
    iconBox: 'bg-blue-50 text-blue-700 border-blue-200/80',
    topBorder: 'border-t-2 border-t-blue-700',
    sectionHeaderBg: 'bg-blue-50/40',
    actionText: 'text-blue-800 hover:text-blue-900',
    tabActive: 'bg-blue-50 text-blue-900 border border-blue-200/90 shadow-[0_1px_2px_rgba(30,64,175,0.08)]',
    tabBadgeActive: 'text-blue-700',
    softSurface: 'bg-blue-50/50 border-blue-200/75',
    barColor: 'bg-blue-700',
    valueAccent: 'text-blue-950',
  },
  violet: {
    pageBg: 'bg-[#F6F5FC]',
    headerBg: 'bg-gradient-to-r from-violet-50/80 via-white to-white',
    headerBorder: 'border-violet-200/70',
    iconBox: 'bg-violet-50 text-violet-700 border-violet-200/80',
    topBorder: 'border-t-2 border-t-violet-600',
    sectionHeaderBg: 'bg-violet-50/40',
    actionText: 'text-violet-800 hover:text-violet-900',
    tabActive: 'bg-violet-50 text-violet-900 border border-violet-200/90 shadow-[0_1px_2px_rgba(109,40,217,0.08)]',
    tabBadgeActive: 'text-violet-700',
    softSurface: 'bg-violet-50/50 border-violet-200/75',
    barColor: 'bg-violet-600',
    valueAccent: 'text-violet-950',
  },
  teal: {
    pageBg: 'bg-[#F3FAF9]',
    headerBg: 'bg-gradient-to-r from-teal-50/80 via-white to-white',
    headerBorder: 'border-teal-200/70',
    iconBox: 'bg-teal-50 text-teal-700 border-teal-200/80',
    topBorder: 'border-t-2 border-t-teal-600',
    sectionHeaderBg: 'bg-teal-50/40',
    actionText: 'text-teal-800 hover:text-teal-900',
    tabActive: 'bg-teal-50 text-teal-900 border border-teal-200/90 shadow-[0_1px_2px_rgba(13,148,136,0.08)]',
    tabBadgeActive: 'text-teal-700',
    softSurface: 'bg-teal-50/50 border-teal-200/75',
    barColor: 'bg-teal-600',
    valueAccent: 'text-teal-950',
  },
  indigo: {
    pageBg: 'bg-[#F4F6FC]',
    headerBg: 'bg-gradient-to-r from-indigo-50/80 via-white to-white',
    headerBorder: 'border-indigo-200/70',
    iconBox: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    topBorder: 'border-t-2 border-t-indigo-600',
    sectionHeaderBg: 'bg-indigo-50/40',
    actionText: 'text-indigo-800 hover:text-indigo-900',
    tabActive: 'bg-indigo-50 text-indigo-900 border border-indigo-200/90 shadow-[0_1px_2px_rgba(67,56,202,0.08)]',
    tabBadgeActive: 'text-indigo-700',
    softSurface: 'bg-indigo-50/50 border-indigo-200/75',
    barColor: 'bg-indigo-600',
    valueAccent: 'text-indigo-950',
  },
  emerald: {
    pageBg: 'bg-[#F3FAF6]',
    headerBg: 'bg-gradient-to-r from-emerald-50/80 via-white to-white',
    headerBorder: 'border-emerald-200/70',
    iconBox: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    topBorder: 'border-t-2 border-t-emerald-600',
    sectionHeaderBg: 'bg-emerald-50/40',
    actionText: 'text-emerald-800 hover:text-emerald-900',
    tabActive: 'bg-emerald-50 text-emerald-900 border border-emerald-200/90 shadow-[0_1px_2px_rgba(5,150,105,0.08)]',
    tabBadgeActive: 'text-emerald-700',
    softSurface: 'bg-emerald-50/50 border-emerald-200/75',
    barColor: 'bg-emerald-600',
    valueAccent: 'text-emerald-950',
  },
  amber: {
    pageBg: 'bg-[#FCF9F2]',
    headerBg: 'bg-gradient-to-r from-amber-50/85 via-white to-white',
    headerBorder: 'border-amber-200/75',
    iconBox: 'bg-amber-50 text-amber-700 border-amber-200/85',
    topBorder: 'border-t-2 border-t-amber-600',
    sectionHeaderBg: 'bg-amber-50/45',
    actionText: 'text-amber-800 hover:text-amber-900',
    tabActive: 'bg-amber-50 text-amber-900 border border-amber-200/90 shadow-[0_1px_2px_rgba(217,119,6,0.08)]',
    tabBadgeActive: 'text-amber-700',
    softSurface: 'bg-amber-50/50 border-amber-200/75',
    barColor: 'bg-amber-600',
    valueAccent: 'text-amber-950',
  },
  cyan: {
    pageBg: 'bg-[#F2F9FC]',
    headerBg: 'bg-gradient-to-r from-cyan-50/80 via-white to-white',
    headerBorder: 'border-cyan-200/75',
    iconBox: 'bg-cyan-50 text-cyan-700 border-cyan-200/85',
    topBorder: 'border-t-2 border-t-cyan-600',
    sectionHeaderBg: 'bg-cyan-50/40',
    actionText: 'text-cyan-800 hover:text-cyan-900',
    tabActive: 'bg-cyan-50 text-cyan-900 border border-cyan-200/90 shadow-[0_1px_2px_rgba(8,145,178,0.08)]',
    tabBadgeActive: 'text-cyan-700',
    softSurface: 'bg-cyan-50/50 border-cyan-200/75',
    barColor: 'bg-cyan-600',
    valueAccent: 'text-cyan-950',
  },
  rose: {
    pageBg: 'bg-[#FDF5F7]',
    headerBg: 'bg-gradient-to-r from-rose-50/80 via-white to-white',
    headerBorder: 'border-rose-200/75',
    iconBox: 'bg-rose-50 text-rose-700 border-rose-200/85',
    topBorder: 'border-t-2 border-t-rose-600',
    sectionHeaderBg: 'bg-rose-50/40',
    actionText: 'text-rose-800 hover:text-rose-900',
    tabActive: 'bg-rose-50 text-rose-900 border border-rose-200/90 shadow-[0_1px_2px_rgba(225,29,72,0.08)]',
    tabBadgeActive: 'text-rose-700',
    softSurface: 'bg-rose-50/50 border-rose-200/75',
    barColor: 'bg-rose-600',
    valueAccent: 'text-rose-950',
  },
  purple: {
    pageBg: 'bg-[#F7F5FC]',
    headerBg: 'bg-gradient-to-r from-purple-50/80 via-white to-white',
    headerBorder: 'border-purple-200/75',
    iconBox: 'bg-purple-50 text-purple-700 border-purple-200/85',
    topBorder: 'border-t-2 border-t-purple-600',
    sectionHeaderBg: 'bg-purple-50/40',
    actionText: 'text-purple-800 hover:text-purple-900',
    tabActive: 'bg-purple-50 text-purple-900 border border-purple-200/90 shadow-[0_1px_2px_rgba(147,51,234,0.08)]',
    tabBadgeActive: 'text-purple-700',
    softSurface: 'bg-purple-50/50 border-purple-200/75',
    barColor: 'bg-purple-600',
    valueAccent: 'text-purple-950',
  },
  orange: {
    pageBg: 'bg-[#FCF7F2]',
    headerBg: 'bg-gradient-to-r from-orange-50/80 via-white to-white',
    headerBorder: 'border-orange-200/75',
    iconBox: 'bg-orange-50 text-orange-700 border-orange-200/85',
    topBorder: 'border-t-2 border-t-orange-600',
    sectionHeaderBg: 'bg-orange-50/40',
    actionText: 'text-orange-800 hover:text-orange-900',
    tabActive: 'bg-orange-50 text-orange-900 border border-orange-200/90 shadow-[0_1px_2px_rgba(234,88,12,0.08)]',
    tabBadgeActive: 'text-orange-700',
    softSurface: 'bg-orange-50/50 border-orange-200/75',
    barColor: 'bg-orange-600',
    valueAccent: 'text-orange-950',
  },
  slate: {
    pageBg: 'bg-[#F4F7FB]',
    headerBg: 'bg-gradient-to-r from-slate-100/85 via-white to-white',
    headerBorder: 'border-slate-200/90',
    iconBox: 'bg-slate-100 text-slate-700 border-slate-200/90',
    topBorder: 'border-t-2 border-t-slate-600',
    sectionHeaderBg: 'bg-slate-100/60',
    actionText: 'text-blue-800 hover:text-blue-900',
    tabActive: 'bg-blue-50 text-blue-900 border border-blue-200/90 shadow-[0_1px_2px_rgba(30,64,175,0.08)]',
    tabBadgeActive: 'text-blue-700',
    softSurface: 'bg-slate-100/65 border-slate-200/85',
    barColor: 'bg-slate-600',
    valueAccent: 'text-slate-900',
  },
};

export const MODULE_ACCENTS: Record<ModuleKey, AccentTone> = {
  dashboard: 'blue',
  setup_wizard: 'blue',
  admissions: 'cyan',
  students: 'blue',
  faculty: 'violet',
  staff: 'teal',
  leave: 'rose',
  academics: 'indigo',
  departments: 'indigo',
  programs: 'indigo',
  classes: 'indigo',
  subjects: 'indigo',
  attendance: 'emerald',
  timetable: 'emerald',
  examinations: 'purple',
  results: 'indigo',
  assignments: 'indigo',
  fees: 'amber',
  accounting: 'emerald',
  library: 'teal',
  transport: 'orange',
  hostel: 'purple',
  communication: 'blue',
  notices: 'blue',
  calendar: 'violet',
  reports: 'indigo',
  documents: 'slate',
  users_roles: 'slate',
  audit_logs: 'slate',
  settings: 'slate',
};

const ModuleAccentContext = createContext<AccentTone>('blue');
const ModuleKeyContext = createContext<ModuleKey>('dashboard');

export function ModuleAccentProvider({
  accent,
  moduleKey = 'dashboard',
  children,
}: {
  accent: AccentTone;
  moduleKey?: ModuleKey;
  children: React.ReactNode;
}) {
  return React.createElement(
    ModuleKeyContext.Provider,
    { value: moduleKey },
    React.createElement(ModuleAccentContext.Provider, { value: accent }, children),
  );
}

export function useModuleAccent(override?: AccentTone): AccentTone {
  const ctx = useContext(ModuleAccentContext);
  return override || ctx || 'blue';
}

export function useModuleKey(override?: ModuleKey): ModuleKey {
  const ctx = useContext(ModuleKeyContext);
  return override || ctx || 'dashboard';
}
