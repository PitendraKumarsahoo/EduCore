import type { GradingRule } from '../types';

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function generateId(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  return prefix ? `${prefix}_${rnd}` : rnd;
}

export function sanitizeEmailKey(email: string): string {
  return email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${currency} ${safe.toFixed(2)}`;
  }
}

export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function computeGradeFromScale(
  percentage: number,
  scale?: GradingRule[],
): { grade: string; gpa: number; remarks: string } {
  if (!scale || scale.length === 0) {
    return { grade: 'N/A', gpa: 0, remarks: 'No grading scale configured' };
  }
  const matched = scale.find((rule) => percentage >= rule.minPercent && percentage <= rule.maxPercent);
  if (matched) {
    return {
      grade: matched.grade,
      gpa: matched.gpaPoint,
      remarks: matched.remarks || '',
    };
  }
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent);
  const lowest = sorted[sorted.length - 1];
  return {
    grade: lowest?.grade || 'F',
    gpa: lowest?.gpaPoint ?? 0,
    remarks: lowest?.remarks || '',
  };
}

export function fileToConstrainedDataUrl(file: File, maxBytes = 320 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxBytes) {
      reject(new Error(`File "${file.name}" exceeds the ${Math.round(maxBytes / 1024)} KB secure upload limit.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function sanitizeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
