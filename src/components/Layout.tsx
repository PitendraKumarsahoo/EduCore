import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Calendar,
  CalendarCheck,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  FolderLock,
  GraduationCap,
  HelpCircle,
  Home,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { ROLE_LABELS } from '../config/permissions';
import { ACCENT_TOKENS, MODULE_ACCENTS, ModuleAccentProvider } from '../config/theme';
import { formatDateTime } from '../utils/format';
import { upsertInstDoc } from '../lib/db';
import { Avatar, Dropdown, Modal } from './ui/Primitives';
import type { ModuleKey } from '../types';

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { key: 'setup_wizard', label: 'Setup Wizard', icon: ListChecks, group: 'Overview' },
  { key: 'admissions', label: 'Admissions', icon: UserCheck, group: 'Student Lifecycle' },
  { key: 'students', label: 'Students', icon: GraduationCap, group: 'Student Lifecycle' },
  { key: 'faculty', label: 'Faculty', icon: Users, group: 'Human Resources' },
  { key: 'staff', label: 'Staff', icon: Briefcase, group: 'Human Resources' },
  { key: 'leave', label: 'Leave', icon: CalendarCheck, group: 'Human Resources' },
  { key: 'academics', label: 'Academics', icon: Landmark, group: 'Academic Structure' },
  { key: 'departments', label: 'Departments', icon: Building2, group: 'Academic Structure' },
  { key: 'programs', label: 'Programs', icon: Layers, group: 'Academic Structure' },
  { key: 'classes', label: 'Classes / Sections', icon: ClipboardList, group: 'Academic Structure' },
  { key: 'subjects', label: 'Subjects', icon: BookOpen, group: 'Academic Structure' },
  { key: 'attendance', label: 'Attendance', icon: CheckSquare, group: 'Daily Operations' },
  { key: 'timetable', label: 'Timetable', icon: Clock, group: 'Daily Operations' },
  { key: 'examinations', label: 'Examinations', icon: FileText, group: 'Assessment' },
  { key: 'results', label: 'Results', icon: Award, group: 'Assessment' },
  { key: 'assignments', label: 'Assignments', icon: ClipboardList, group: 'Assessment' },
  { key: 'fees', label: 'Fees', icon: CreditCard, group: 'Finance' },
  { key: 'accounting', label: 'Accounting', icon: BarChart3, group: 'Finance' },
  { key: 'library', label: 'Library', icon: BookOpen, group: 'Campus Services' },
  { key: 'transport', label: 'Transport', icon: Bus, group: 'Campus Services' },
  { key: 'hostel', label: 'Hostel', icon: Home, group: 'Campus Services' },
  { key: 'communication', label: 'Communication', icon: MessageSquare, group: 'Engagement' },
  { key: 'notices', label: 'Notices', icon: Megaphone, group: 'Engagement' },
  { key: 'calendar', label: 'Calendar', icon: Calendar, group: 'Engagement' },
  { key: 'reports', label: 'Reports', icon: BarChart3, group: 'Administration' },
  { key: 'documents', label: 'Documents', icon: FolderLock, group: 'Administration' },
  { key: 'users_roles', label: 'Users & Roles', icon: Shield, group: 'Administration' },
  { key: 'audit_logs', label: 'Audit Logs', icon: ShieldAlert, group: 'Administration' },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'Administration' },
];

export function Layout({
  children,
  onOpenProfile,
}: {
  children: React.ReactNode;
  onOpenProfile: () => void;
}) {
  const {
    institution,
    institutions,
    switchInstitution,
    member,
    userAccount,
    activeModule,
    setActiveModule,
    activeYearId,
    setActiveYearId,
    academicYears,
    can,
    logout,
    students,
    employees,
    classes,
    programs,
    subjects,
    examinations,
    notices,
    studentFees,
    notifications,
    setSelectedStudentIdForProfile,
    setSelectedEmployeeIdForProfile,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const visibleNav = useMemo(() => {
    return NAV_ITEMS.filter((item) => can(item.key, 'view'));
  }, [can]);

  const groupedNav = useMemo(() => {
    const groups: Record<string, NavItem[]> = {};
    for (const item of visibleNav) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return Object.entries(groups);
  }, [visibleNav]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  const markNotifRead = async (id: string) => {
    if (!institution?.id) return;
    await upsertInstDoc(institution.id, 'notifications', id, { isRead: true });
  };

  // Global authorized search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: { category: string; title: string; subtitle: string; onClick: () => void }[] = [];

    if (can('students', 'view')) {
      students
        .filter((s) =>
          `${s.firstName} ${s.lastName} ${s.studentCode} ${s.admissionNumber || ''} ${s.email || ''}`
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 5)
        .forEach((s) =>
          results.push({
            category: 'Student',
            title: `${s.firstName} ${s.lastName}`,
            subtitle: `${s.studentCode}${s.rollNumber ? ` · Roll ${s.rollNumber}` : ''}`,
            onClick: () => {
              setSelectedStudentIdForProfile(s.id);
              setActiveModule('students');
              setSearchOpen(false);
            },
          }),
        );
    }

    if (can('faculty', 'view') || can('staff', 'view')) {
      employees
        .filter((emp) =>
          `${emp.firstName} ${emp.lastName} ${emp.employeeCode} ${emp.designation || ''}`
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 5)
        .forEach((emp) =>
          results.push({
            category: emp.staffType === 'faculty' ? 'Faculty' : 'Staff',
            title: `${emp.firstName} ${emp.lastName}`,
            subtitle: `${emp.employeeCode} · ${emp.designation || emp.staffType}`,
            onClick: () => {
              setSelectedEmployeeIdForProfile(emp.id);
              setActiveModule(emp.staffType === 'faculty' ? 'faculty' : 'staff');
              setSearchOpen(false);
            },
          }),
        );
    }

    if (can('classes', 'view')) {
      classes
        .filter((c) => `${c.name} ${c.code || ''}`.toLowerCase().includes(q))
        .slice(0, 4)
        .forEach((c) =>
          results.push({
            category: 'Class',
            title: c.name,
            subtitle: c.code || 'Academic Class',
            onClick: () => {
              setActiveModule('classes');
              setSearchOpen(false);
            },
          }),
        );
    }

    if (can('programs', 'view')) {
      programs
        .filter((p) => `${p.name} ${p.code}`.toLowerCase().includes(q))
        .slice(0, 4)
        .forEach((p) =>
          results.push({
            category: 'Program',
            title: p.name,
            subtitle: p.code,
            onClick: () => {
              setActiveModule('programs');
              setSearchOpen(false);
            },
          }),
        );
    }

    if (can('subjects', 'view')) {
      subjects
        .filter((sub) => `${sub.name} ${sub.code}`.toLowerCase().includes(q))
        .slice(0, 4)
        .forEach((sub) =>
          results.push({
            category: 'Subject',
            title: sub.name,
            subtitle: sub.code,
            onClick: () => {
              setActiveModule('subjects');
              setSearchOpen(false);
            },
          }),
        );
    }

    if (can('examinations', 'view')) {
      examinations
        .filter((ex) => ex.name.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((ex) =>
          results.push({
            category: 'Examination',
            title: ex.name,
            subtitle: `${ex.examType} · ${ex.status}`,
            onClick: () => {
              setActiveModule('examinations');
              setSearchOpen(false);
            },
          }),
        );
    }

    if (can('fees', 'view')) {
      studentFees
        .filter((f) => `${f.invoiceNumber} ${f.studentName || ''} ${f.title}`.toLowerCase().includes(q))
        .slice(0, 4)
        .forEach((f) =>
          results.push({
            category: 'Fee Invoice',
            title: `${f.invoiceNumber} · ${f.title}`,
            subtitle: `${f.studentName || f.studentId} · ${f.status}`,
            onClick: () => {
              setActiveModule('fees');
              setSearchOpen(false);
            },
          }),
        );
    }

    if (can('notices', 'view')) {
      notices
        .filter((n) => `${n.title} ${n.content}`.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((n) =>
          results.push({
            category: 'Notice',
            title: n.title,
            subtitle: n.publishDate || n.status,
            onClick: () => {
              setActiveModule('notices');
              setSearchOpen(false);
            },
          }),
        );
    }

    return results;
  }, [
    searchQuery,
    can,
    students,
    employees,
    classes,
    programs,
    subjects,
    examinations,
    studentFees,
    notices,
    setActiveModule,
    setSelectedStudentIdForProfile,
    setSelectedEmployeeIdForProfile,
  ]);

  const moduleAccent = MODULE_ACCENTS[activeModule] || 'blue';
  const pageBgClass = ACCENT_TOKENS[moduleAccent].pageBg;

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[#F7F9FC] border-r border-slate-200/90 w-[264px] shrink-0">
      <div className="h-[68px] px-5 border-b border-slate-200/90 bg-gradient-to-b from-blue-50/90 to-[#F7F9FC] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[10px] bg-blue-900 flex items-center justify-center text-white shrink-0 shadow-[0_2px_6px_rgba(30,58,138,0.28)]">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[18px] font-bold text-slate-900 tracking-tight truncate font-display leading-tight">
              EduCore
            </div>
            <div className="text-[12.5px] text-slate-500 truncate mt-0.5">Academic Platform</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-[8px] hover:bg-slate-100"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6" aria-label="Main navigation">
        {groupedNav.map(([group, items]) => (
          <div key={group}>
            <div className="px-3 mb-2 text-[12px] font-semibold text-slate-500 tracking-wide">
              {group}
            </div>
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveModule(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`relative w-full flex items-center gap-3 px-3 py-2.5 text-[14.5px] rounded-[10px] transition-colors text-left ${
                      active
                        ? 'bg-blue-100/75 text-blue-950 font-semibold'
                        : 'text-slate-700 hover:bg-blue-50/55 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-blue-800"
                      />
                    )}
                    <Icon
                      className={`w-[19px] h-[19px] shrink-0 ${
                        active ? 'text-blue-800' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3.5 border-t border-slate-200/90 bg-slate-100/80">
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full flex items-center gap-3 p-2 rounded-[10px] hover:bg-white border border-transparent hover:border-blue-200/80 transition-colors text-left"
        >
          <Avatar src={userAccount?.photoUrl} name={userAccount?.displayName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-slate-900 truncate leading-snug">
              {userAccount?.displayName}
            </div>
            <div className="text-[12.5px] text-slate-500 truncate leading-snug">
              {member ? ROLE_LABELS[member.role] : ''}
            </div>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${pageBgClass} flex`}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen no-print">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 h-full shadow-2xl">{SidebarContent}</div>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-[68px] bg-white border-b border-slate-200/90 px-4 sm:px-7 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-[10px] hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 min-w-0">
              {institution?.logoUrl ? (
                <img
                  src={institution.logoUrl}
                  alt={institution.name}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-[9px] object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="hidden sm:flex w-9 h-9 rounded-[9px] bg-blue-50 border border-blue-200/80 items-center justify-center text-blue-800 shrink-0">
                  <Building2 className="w-[18px] h-[18px]" />
                </div>
              )}
              {institutions.length > 1 ? (
                <select
                  value={institution?.id || ''}
                  onChange={(e) => switchInstitution(e.target.value)}
                  aria-label="Switch institution"
                  className="text-[15.5px] font-semibold text-slate-900 bg-white border border-slate-300 rounded-[9px] px-3 py-1.5 max-w-[210px] sm:max-w-xs truncate focus:outline-none focus:border-blue-700"
                >
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[16px] sm:text-[17px] font-semibold text-slate-900 truncate tracking-[-0.01em]">
                  {institution?.name}
                </span>
              )}
            </div>

            {academicYears.length > 0 && (
              <div className="hidden md:flex items-center gap-2 pl-3.5 border-l border-slate-200">
                <span className="text-[13px] font-medium text-slate-500">Session</span>
                <select
                  value={activeYearId}
                  onChange={(e) => setActiveYearId(e.target.value)}
                  aria-label="Select academic year"
                  className="text-[13.5px] font-medium text-slate-800 bg-blue-50/40 border border-blue-200/70 rounded-[8px] px-2.5 py-1.5 focus:outline-none focus:border-blue-700"
                >
                  <option value="">All Years</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="inline-flex items-center justify-between gap-3 px-3.5 py-2 sm:min-w-[190px] text-[14px] text-slate-500 bg-[#F4F7FB] border border-slate-200/90 rounded-[10px] hover:bg-blue-50/70 hover:border-blue-200 transition-colors"
              aria-label="Global search"
            >
              <span className="inline-flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline font-medium text-slate-600">Search...</span>
              </span>
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono font-medium text-slate-500 bg-white border border-slate-200 rounded-[5px]">
                Ctrl+K
              </kbd>
            </button>

            <Dropdown
              align="right"
              trigger={(_, toggle) => (
                <button
                  type="button"
                  onClick={toggle}
                  className="relative p-2.5 text-slate-600 hover:text-blue-900 rounded-[10px] border border-transparent hover:border-blue-200/80 hover:bg-blue-50/70 transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-[18px] h-[18px]" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 text-[10.5px] font-semibold bg-blue-800 text-white rounded-full flex items-center justify-center tabular-nums">
                      {unreadCount}
                    </span>
                  )}
                </button>
              )}
            >
              {(close) => (
                <div className="w-80 sm:w-96 overflow-hidden rounded-[12px]">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
                    <span className="text-[14px] font-semibold text-slate-900">Notifications</span>
                    <button
                      type="button"
                      onClick={close}
                      className="text-[13px] font-medium text-slate-500 hover:text-slate-800"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="px-6 py-10 text-center">
                        <Bell className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                        <p className="text-[14px] font-medium text-slate-700">No notifications yet</p>
                        <p className="text-[13px] text-slate-500 mt-0.5">
                          Institutional alerts and updates will appear here.
                        </p>
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            markNotifRead(n.id);
                            if (n.linkModule) setActiveModule(n.linkModule as ModuleKey);
                            close();
                          }}
                          className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors ${
                            n.isRead ? 'opacity-75' : 'bg-blue-50/45'
                          }`}
                        >
                          <div className="text-[14px] font-semibold text-slate-900">{n.title}</div>
                          <div className="text-[13.5px] text-slate-600 mt-0.5 line-clamp-2">{n.message}</div>
                          <div className="text-[12px] text-slate-400 mt-1.5">{formatDateTime(n.createdAt)}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </Dropdown>

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="p-2.5 text-slate-600 hover:text-blue-900 rounded-[10px] border border-transparent hover:border-blue-200/80 hover:bg-blue-50/70 transition-colors"
              aria-label="Help"
              title="System Reference"
            >
              <HelpCircle className="w-[18px] h-[18px]" />
            </button>

            <Dropdown
              align="right"
              trigger={(_, toggle) => (
                <button
                  type="button"
                  onClick={toggle}
                  className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-[10px] border border-blue-200/70 bg-blue-50/40 hover:bg-blue-50/85 hover:border-blue-300/80 transition-colors text-left"
                >
                  <Avatar src={userAccount?.photoUrl} name={userAccount?.displayName} size="sm" />
                  <div className="hidden md:block">
                    <div className="text-[13.5px] font-semibold text-slate-900 leading-tight max-w-[130px] truncate">
                      {userAccount?.displayName}
                    </div>
                    <div className="text-[12px] text-slate-500 leading-tight mt-0.5">
                      {member ? ROLE_LABELS[member.role] : ''}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                </button>
              )}
            >
              {(close) => (
                <div className="w-60 p-1.5">
                  <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                    <div className="text-[14px] font-semibold text-slate-900 truncate">
                      {userAccount?.displayName}
                    </div>
                    <div className="text-[12.5px] text-slate-500 truncate">{userAccount?.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      onOpenProfile();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[14px] text-slate-700 hover:bg-slate-50 rounded-[8px] text-left"
                  >
                    <UserCog className="w-4 h-4 text-slate-500" />
                    <span>Account &amp; Preferences</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setHelpOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[14px] text-slate-700 hover:bg-slate-50 rounded-[8px] text-left"
                  >
                    <HelpCircle className="w-4 h-4 text-slate-500" />
                    <span>System Reference</span>
                  </button>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      logout();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[14px] font-medium text-red-700 hover:bg-red-50 rounded-[8px] text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </Dropdown>

            <button
              type="button"
              onClick={logout}
              className="sm:hidden inline-flex items-center justify-center p-2 text-slate-700 border border-slate-200 rounded-[10px] hover:bg-slate-50"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-5 sm:p-7 lg:p-8 max-w-[1440px] w-full mx-auto">
          <ModuleAccentProvider accent={moduleAccent} moduleKey={activeModule}>{children}</ModuleAccentProvider>
        </main>
      </div>

      {/* Global Search Modal */}
      <Modal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Global Institutional Search"
        subtitle="Search across records authorized for your current role."
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-[18px] h-[18px] text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search students, faculty, classes, subjects, invoices, exams, notices..."
              className="w-full pl-10 pr-4 py-2.5 text-[15px] text-slate-900 border border-slate-300 rounded-[10px] focus:outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-700/15"
            />
          </div>
          {searchQuery.trim() === '' ? (
            <p className="text-[14px] text-slate-500 py-6 text-center">
              Start typing a name, ID code, invoice number, or subject code.
            </p>
          ) : searchResults.length === 0 ? (
            <p className="text-[15px] text-slate-500 py-8 text-center">
              No authorized records matched "{searchQuery}".
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-[10px] overflow-hidden">
              {searchResults.map((res, idx) => (
                <button
                  key={`${res.category}_${idx}`}
                  type="button"
                  onClick={res.onClick}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <div>
                    <div className="text-[15px] font-medium text-slate-900">{res.title}</div>
                    <div className="text-[13.5px] text-slate-500 mt-0.5">{res.subtitle}</div>
                  </div>
                  <span className="text-[12.5px] font-semibold text-blue-800 bg-blue-50 border border-blue-200/70 px-2.5 py-1 rounded-[6px] shrink-0">
                    {res.category}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Help Modal */}
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="EduCore System Reference" size="md">
        <div className="space-y-5 text-[15px] text-slate-600 leading-relaxed">
          <div>
            <h3 className="text-[16px] font-semibold text-slate-900">Getting Started</h3>
            <p className="mt-1.5">
              Use the <strong>Setup Wizard</strong> to configure your academic year, departments, programs,
              classes, sections, subjects, working days, fee categories, and team invitations.
            </p>
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-slate-900">Your Current Access Scope</h3>
            <p className="mt-1.5">
              Signed in as <strong>{userAccount?.email}</strong> with role{' '}
              <strong>{member ? ROLE_LABELS[member.role] : 'Unknown'}</strong>. Navigation and database
              queries are automatically restricted to your authorized permissions.
            </p>
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-slate-900">Keyboard Shortcuts &amp; Printing</h3>
            <p className="mt-1.5">
              Press <code className="font-mono text-[13px] bg-slate-100 px-1.5 py-0.5 rounded">Ctrl+K</code> or{' '}
              <code className="font-mono text-[13px] bg-slate-100 px-1.5 py-0.5 rounded">Cmd+K</code> to open global
              search. Printable receipts, ID cards, result sheets, and reports automatically hide sidebar
              navigation when printing.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
