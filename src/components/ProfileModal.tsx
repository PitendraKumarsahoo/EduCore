import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { updateUserAccountFields, writeAuditLog } from '../lib/db';
import { formatUserFriendlyError } from '../lib/firestore-error';
import { ROLE_LABELS } from '../config/permissions';
import { fileToConstrainedDataUrl, formatDateTime } from '../utils/format';
import { Avatar, FormField, FormSection, Modal } from './ui/Primitives';

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userAccount, firebaseUser, institution, member, pushToast, refreshSession } = useApp();
  const [displayName, setDisplayName] = useState(userAccount?.displayName || '');
  const [phone, setPhone] = useState(userAccount?.phone || '');
  const [photoUrl, setPhotoUrl] = useState(userAccount?.photoUrl || '');
  const [inApp, setInApp] = useState(userAccount?.notificationPrefs?.inApp ?? true);
  const [feeAlerts, setFeeAlerts] = useState(userAccount?.notificationPrefs?.feeAlerts ?? true);
  const [examAlerts, setExamAlerts] = useState(userAccount?.notificationPrefs?.examAlerts ?? true);
  const [saving, setSaving] = useState(false);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await fileToConstrainedDataUrl(file, 200 * 1024);
      setPhotoUrl(url);
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      await updateUserAccountFields(firebaseUser.uid, {
        displayName: displayName.trim() || userAccount?.displayName || 'User',
        phone: phone.trim() || undefined,
        photoUrl: photoUrl || undefined,
        notificationPrefs: { inApp, feeAlerts, examAlerts, emailDigest: false },
      });
      if (institution?.id) {
        await writeAuditLog(institution.id, {
          userUid: firebaseUser.uid,
          userEmail: firebaseUser.email || '',
          userName: displayName.trim(),
          userRole: member?.role || '',
          action: 'update',
          module: 'profile',
          recordId: firebaseUser.uid,
          summary: 'Updated user profile and notification preferences',
        });
      }
      await refreshSession();
      pushToast('success', 'Profile preferences saved.');
      onClose();
    } catch (err) {
      pushToast('error', formatUserFriendlyError(err, 'Unable to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="User Profile & Security" size="lg">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex items-center gap-4 pb-5 border-b border-slate-200">
          <Avatar src={photoUrl || undefined} name={displayName || userAccount?.displayName} size="xl" />
          <div>
            <div className="text-[16px] font-semibold text-slate-900">{userAccount?.email}</div>
            <div className="text-[13.5px] text-slate-500 mt-0.5">
              Role: {member ? ROLE_LABELS[member.role] : '—'} · Verified Google Account
            </div>
            <label className="inline-block mt-2.5 text-[13.5px] font-medium text-blue-800 hover:underline cursor-pointer">
              Upload Profile Photo (max 200 KB)
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
          </div>
        </div>

        <FormSection title="Personal Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name" required>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="ec-input"
              />
            </FormField>
            <FormField label="Phone Number">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="ec-input"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Notification Preferences" withDivider>
          <div className="space-y-2.5 text-[14.5px] text-slate-700">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={inApp}
                onChange={(e) => setInApp(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-800 focus:ring-blue-700"
              />
              <span>In-app institutional notifications</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={feeAlerts}
                onChange={(e) => setFeeAlerts(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-800 focus:ring-blue-700"
              />
              <span>Fee due &amp; payment receipt alerts</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={examAlerts}
                onChange={(e) => setExamAlerts(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-800 focus:ring-blue-700"
              />
              <span>Examination schedule &amp; result alerts</span>
            </label>
          </div>
        </FormSection>

        <div className="border-t border-slate-200 pt-4 bg-slate-50 p-4 rounded-[10px] border border-slate-200/80">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            Authentication &amp; Session Status
          </div>
          <div className="mt-2 text-[13.5px] text-slate-600 space-y-1">
            <div>Provider: Google OAuth 2.0 (Verified Email)</div>
            <div>Last Login: {formatDateTime(userAccount?.lastLoginAt)}</div>
            <div>
              Password &amp; 2FA Management: Managed securely through your Google Workspace / Google Account
              security settings.
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-2">
          <button type="button" onClick={onClose} className="ec-btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="ec-btn-primary">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
