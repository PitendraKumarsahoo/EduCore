import React, { useEffect, useState } from 'react';
import { ShieldAlert, CheckCircle2, ArrowLeft } from 'lucide-react';
import { AppProvider, useApp } from './contexts/AppContext';
import { testFirestoreConnection } from './lib/firebase';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGate } from './components/AuthGate';
import { Layout } from './components/Layout';
import { ProfileModal } from './components/ProfileModal';
import { EmptyState, LoadingState, SectionCard, StatusBadge, ToastContainer } from './components/ui/Primitives';
import { DashboardModule } from './modules/DashboardModule';
import { SetupWizardModule } from './modules/SetupWizardModule';
import { AcademicsModule } from './modules/AcademicsModule';
import { AdmissionsModule } from './modules/AdmissionsModule';
import { StudentsModule } from './modules/StudentsModule';
import { PeopleModule } from './modules/PeopleModule';
import { AttendanceTimetableModule } from './modules/AttendanceTimetableModule';
import { ExamsResultsAssignmentsModule } from './modules/ExamsResultsAssignmentsModule';
import { FeesAccountingModule } from './modules/FeesAccountingModule';
import { CampusServicesModule } from './modules/CampusServicesModule';
import { EngagementModule } from './modules/EngagementModule';
import { AdminReportsSettingsModule } from './modules/AdminReportsSettingsModule';

function VerifyIdView({ type, id, onExit }: { type: string; id: string; onExit: () => void }) {
  const { institution, students, employees, classes } = useApp();
  const classMap = new Map(classes.map((c) => [c.id, c.name]));

  if (type === 'student') {
    const s = students.find((x) => x.id === id);
    return (
      <div className="max-w-lg mx-auto">
        <SectionCard
          title="Student ID Verification"
          action={
            <button type="button" onClick={onExit} className="ec-btn-secondary px-3 py-1.5 text-[13.5px]">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          }
        >
          {s ? (
            <div className="space-y-3 text-[15px]">
              <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-5 h-5" /> Verified Institutional Record
              </div>
              <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100">
                <div><span className="text-slate-500">Institution:</span> <span className="font-medium text-slate-900">{institution?.name}</span></div>
                <div><span className="text-slate-500">Name:</span> <span className="font-semibold text-slate-900">{s.firstName} {s.lastName}</span></div>
                <div><span className="text-slate-500">Student Code:</span> <span className="font-mono text-slate-900">{s.studentCode}</span></div>
                <div><span className="text-slate-500">Class:</span> <span className="text-slate-900">{classMap.get(s.classId || '') || 'Unassigned'}</span></div>
                <div className="flex items-center gap-2"><span className="text-slate-500">Status:</span> <StatusBadge status={s.status} /></div>
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-slate-500">Student record not found or you do not have permission to verify it.</p>
          )}
        </SectionCard>
      </div>
    );
  }

  const emp = employees.find((x) => x.id === id);
  return (
    <div className="max-w-lg mx-auto">
      <SectionCard
        title="Employee ID Verification"
        action={
          <button type="button" onClick={onExit} className="ec-btn-secondary px-3 py-1.5 text-[13.5px]">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        }
      >
        {emp ? (
          <div className="space-y-3 text-[15px]">
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-5 h-5" /> Verified Staff Record
            </div>
            <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100">
              <div><span className="text-slate-500">Institution:</span> <span className="font-medium text-slate-900">{institution?.name}</span></div>
              <div><span className="text-slate-500">Name:</span> <span className="font-semibold text-slate-900">{emp.firstName} {emp.lastName}</span></div>
              <div><span className="text-slate-500">Employee Code:</span> <span className="font-mono text-slate-900">{emp.employeeCode}</span></div>
              <div><span className="text-slate-500">Designation:</span> <span className="text-slate-900">{emp.designation || emp.staffType}</span></div>
              <div className="flex items-center gap-2"><span className="text-slate-500">Status:</span> <StatusBadge status={emp.status} /></div>
            </div>
          </div>
        ) : (
          <p className="text-[15px] text-slate-500">Employee record not found or unauthorized.</p>
        )}
      </SectionCard>
    </div>
  );
}

function WorkspaceShell() {
  const {
    authReady,
    firebaseUser,
    institution,
    member,
    activeModule,
    setActiveModule,
    can,
    toasts,
    dismissToast,
  } = useApp();

  const [profileOpen, setProfileOpen] = useState(false);
  const [verifyRoute, setVerifyRoute] = useState<{ type: string; id: string } | null>(null);

  useEffect(() => {
    const syncHash = () => {
      const h = window.location.hash;
      const m = h.match(/^#verify\/(student|employee)\/([^/]+)$/);
      if (m) {
        setVerifyRoute({ type: m[1], id: m[2] });
      } else {
        setVerifyRoute(null);
      }
    };
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  if (!authReady) {
    return <LoadingState variant="shell" />;
  }

  if (!firebaseUser || !institution || !member) {
    return (
      <>
        <AuthGate />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  const renderActiveModule = () => {
    if (verifyRoute) {
      return (
        <VerifyIdView
          type={verifyRoute.type}
          id={verifyRoute.id}
          onExit={() => {
            window.location.hash = '';
            setVerifyRoute(null);
          }}
        />
      );
    }

    if (!can(activeModule, 'view')) {
      return (
        <EmptyState
          icon={ShieldAlert}
          title="403 · Access Restricted"
          description="Your current institutional role does not have permission to view this module."
          actionLabel="Return to Dashboard"
          onAction={() => setActiveModule('dashboard')}
        />
      );
    }

    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule />;
      case 'setup_wizard':
        return <SetupWizardModule />;
      case 'academics':
      case 'departments':
      case 'programs':
      case 'classes':
      case 'subjects':
        return <AcademicsModule />;
      case 'admissions':
        return <AdmissionsModule />;
      case 'students':
        return <StudentsModule />;
      case 'faculty':
      case 'staff':
      case 'leave':
        return <PeopleModule />;
      case 'attendance':
      case 'timetable':
        return <AttendanceTimetableModule />;
      case 'examinations':
      case 'results':
      case 'assignments':
        return <ExamsResultsAssignmentsModule />;
      case 'fees':
      case 'accounting':
        return <FeesAccountingModule />;
      case 'library':
      case 'transport':
      case 'hostel':
        return <CampusServicesModule />;
      case 'notices':
      case 'calendar':
      case 'communication':
      case 'documents':
        return <EngagementModule />;
      case 'reports':
      case 'users_roles':
      case 'audit_logs':
      case 'settings':
        return <AdminReportsSettingsModule />;
      default:
        return (
          <EmptyState
            title="404 · Module Not Found"
            description="The requested section does not exist."
            actionLabel="Return to Dashboard"
            onAction={() => setActiveModule('dashboard')}
          />
        );
    }
  };

  return (
    <>
      <Layout onOpenProfile={() => setProfileOpen(true)}>
        <div
          key={verifyRoute ? `verify_${verifyRoute.type}_${verifyRoute.id}` : activeModule}
          className="ec-page-transition"
        >
          {renderActiveModule()}
        </div>
      </Layout>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

export default function App() {
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  return (
    <ErrorBoundary>
      <AppProvider>
        <WorkspaceShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
