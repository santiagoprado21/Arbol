import { useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

const TONES = {
  green: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  red: 'bg-seed/10 text-red-400 ring-1 ring-seed/30',
  amber: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
  blue: 'bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20',
  gray: 'bg-ink-700 text-bone-muted ring-1 ring-ink-600',
  white: 'bg-bone/10 text-bone ring-1 ring-bone/20',
};

export function Badge({ tone = 'gray', children, className = '' }) {
  return <span className={`badge ${TONES[tone]} ${className}`}>{children}</span>;
}

export const ALERT_TONES = { ok: 'green', pending: 'amber', expiring: 'amber', expired: 'red', no_plan: 'gray' };

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`animate-spin text-bone-muted ${className}`} />;
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <p className="rounded-xl border border-seed/30 bg-seed/10 px-4 py-2.5 text-sm text-red-300">{children}</p>;
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-bone-dim">{hint}</span>}
    </label>
  );
}

export function StatCard({ icon: Icon, label, value, sub, accent = false }) {
  return (
    <div className={`card relative overflow-hidden p-5 ${accent ? 'border-seed/40' : ''}`}>
      {accent && <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-seed/20 blur-3xl" />}
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-bone-muted">{label}</p>
        {Icon && <Icon className={`h-4 w-4 ${accent ? 'text-seed' : 'text-bone-dim'}`} />}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-bone-dim">{sub}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="absolute inset-0" onClick={onClose} />
      <div className={`card relative w-full animate-rise bg-ink-900 p-6 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-bone-muted hover:bg-ink-700 hover:text-bone">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, danger = false }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div
        className={`h-full rounded-full transition-all ${danger ? 'bg-seed' : 'bg-bone'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-600 px-6 py-12 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-bone-dim" />}
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-bone-muted">{children}</div>}
    </div>
  );
}
