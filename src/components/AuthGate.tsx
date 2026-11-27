import React, { useState } from 'react';
import { Building2, CheckCircle2, GraduationCap, LogOut, Plus, ShieldCheck } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatUserFriendlyError } from '../lib/firestore-error';
import { ROLE_LABELS } from '../config/permissions';
import { Avatar, FormField, SectionCard } from './ui/Primitives';
import type { Institution } from '../types';

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Dubai',
  'Australia/Sydney',
];

const COMMON_CURRENCIES = ['USD', 'INR', 'GBP', 'EUR', 'CAD', 'AUD', 'SGD', 'AED'];

export function AuthGate() {
  const {
    firebaseUser,
    signInWithGoogle,
    logout,
    pendingInvites,
    claimInvite,
    institutions,
    switchInstitution,
    createInstitution,
    pushToast,
  } = useApp();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<Institution['type']>('school');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [currency, setCurrency] = useState('USD');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-[#F4F7FB] flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full ec-card overflow-hidden">
          <div className="px-8 sm:px-9 pt-8 pb-6 bg-gradient-to-b from-blue-50/80 to-white border-b border-blue-100/80 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-[12px] bg-blue-900 flex items-center justify-center text-white shadow-[0_3px_10px_rgba(30,58,138,0.28)]">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-slate-900 tracking-tight font-display leading-tight">
                EduCore
              </h1>
              <p className="text-[13.5px] text-slate-600 mt-0.5">Academic Platform</p>
            </div>
          </div>

          <div className="p-8 sm:p-9 pt-6">
            <div className="mb-7">
            <h2 className="text-[20px] font-semibold text-slate-900 tracking-[-0.01em]">
              Institutional Sign In
            </h2>
            <p className="text-[15px] text-slate-600 mt-2 leading-relaxed">
              Sign in with your verified Google Workspace or institutional email account to access
              academics, administration, faculty, student, or guardian portals.
            </p>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            className="ec-btn-primary w-full py-3 text-[15px]"
          >
            <ShieldCheck className="w-5 h-5" />
            Sign in with Google
          </button>

          <div className="mt-7 pt-5 border-t border-slate-100 text-[13.5px] text-slate-500 space-y-2 leading-relaxed">
            <p>Role-based access control is enforced for all 11 institutional roles.</p>
            <p>All session actions are verified and logged for institutional security.</p>
          </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (name.trim().length < 2) {
      setErrorMsg('Please enter an official institution name (at least 2 characters).');
      return;
    }
    setSubmitting(true);
    try {
      await createInstitution({
        name: name.trim(),
        type,
        code: code.trim() || undefined,
        email: email.trim() || firebaseUser.email || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        timezone,
        currency,
      });
      pushToast('success', 'Institution created. Continue with the Setup Wizard.');
    } catch (err) {
      setErrorMsg(formatUserFriendlyError(err, 'Unable to create institution.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col">
      <header className="h-[68px] bg-white border-b border-slate-200/90 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-blue-900 flex items-center justify-center text-white shadow-[0_2px_6px_rgba(30,58,138,0.25)]">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-[18px] font-display">EduCore</span>
            <span className="hidden sm:inline text-[13.5px] text-slate-500 ml-2.5">
              Academic Platform
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2.5">
            <Avatar src={firebaseUser.photoURL || undefined} name={firebaseUser.displayName || 'User'} size="sm" />
            <div className="text-left">
              <div className="text-[13.5px] font-semibold text-slate-900 leading-tight">
                {firebaseUser.displayName || 'Authenticated User'}
              </div>
              <div className="text-[12.5px] text-slate-500 leading-tight">{firebaseUser.email}</div>
            </div>
          </div>
          <button type="button" onClick={logout} className="ec-btn-secondary px-3.5 py-2 text-[13.5px]">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-8 space-y-7">
        {pendingInvites.length > 0 && (
          <SectionCard
            variant="tinted-header"
            accent="blue"
            title="Pending Institutional Invitations"
            subtitle={`Your email (${firebaseUser.email}) has been invited to join the following institution(s):`}
          >
            <div className="space-y-3">
              {pendingInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border border-blue-200/80 rounded-[10px] bg-blue-50/35"
                >
                  <div>
                    <div className="text-[16px] font-semibold text-slate-900">
                      {inv.institutionName || inv.institutionId}
                    </div>
                    <div className="text-[14px] text-slate-600 mt-1">
                      Assigned Role: <span className="font-semibold text-slate-800">{ROLE_LABELS[inv.role]}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => claimInvite(inv)}
                    className="ec-btn-primary shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Accept &amp; Enter Portal
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {institutions.length > 0 && !creating && (
          <SectionCard
            title="Select Institution"
            subtitle="Choose an institution workspace to manage."
            action={
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="ec-btn-primary"
              >
                <Plus className="w-4 h-4" />
                New Institution
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {institutions.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => switchInstitution(inst.id)}
                  className="text-left p-5 ec-card-interactive"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[10px] bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800 shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[16px] text-slate-900 truncate">{inst.name}</div>
                      <div className="text-[13.5px] text-slate-500 mt-0.5 capitalize">
                        {inst.type.replace(/_/g, ' ')} · {inst.currency} · {inst.timezone}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        )}

        {(institutions.length === 0 || creating) && (
          <SectionCard
            title="Register New Institution"
            subtitle="Step 1 of Setup: Create your school, college, or university workspace."
            action={
              institutions.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="ec-btn-secondary px-3.5 py-2 text-[13.5px]"
                >
                  Back to list
                </button>
              ) : undefined
            }
          >
            {errorMsg && (
              <div className="mb-5 p-3.5 text-[14px] text-red-800 bg-red-50 border border-red-200 rounded-[10px]">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <FormField label="Institution Name" required className="sm:col-span-2">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. St. Xavier Institute of Technology"
                  className="ec-input"
                />
              </FormField>

              <FormField label="Institution Type" required>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as Institution['type'])}
                  className="ec-select"
                >
                  <option value="school">School (K-12)</option>
                  <option value="college">College</option>
                  <option value="university">University</option>
                  <option value="k12_and_college">Combined School &amp; College</option>
                </select>
              </FormField>

              <FormField label="Institution Code">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Optional code (e.g. SXIT)"
                  className="ec-input"
                />
              </FormField>

              <FormField label="Official Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={firebaseUser.email || 'admin@institution.edu'}
                  className="ec-input"
                />
              </FormField>

              <FormField label="Phone">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="ec-input"
                />
              </FormField>

              <FormField label="Time Zone" required>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="ec-select"
                >
                  {!COMMON_TIMEZONES.includes(timezone) && <option value={timezone}>{timezone}</option>}
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Currency" required>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="ec-select"
                >
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Campus Address" className="sm:col-span-2">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, State, Postal Code"
                  className="ec-input"
                />
              </FormField>

              <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="ec-btn-primary px-6 py-2.5"
                >
                  {submitting ? 'Creating Workspace...' : 'Create Institution & Start Setup'}
                </button>
              </div>
            </form>
          </SectionCard>
        )}
      </main>
    </div>
  );
}
