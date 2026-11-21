import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Dumbbell, Plus, Ruler, Target, Trash2, Trophy } from 'lucide-react';
import { ErrorNote, Field, Spinner } from './ui';
import { formatDay, todayKey } from '../lib/format';

// `better` colors the change since the first record green when it moves that way; the rest stay neutral on purpose.
export const METRICS = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg' },
  { key: 'body_fat_pct', label: 'Grasa corporal', unit: '%', better: 'down' },
  { key: 'muscle_pct', label: 'Masa muscular', unit: '%', better: 'up' },
  { key: 'waist_cm', label: 'Cintura', unit: 'cm' },
  { key: 'hip_cm', label: 'Cadera', unit: 'cm' },
  { key: 'chest_cm', label: 'Pecho', unit: 'cm' },
  { key: 'arm_cm', label: 'Brazo', unit: 'cm' },
  { key: 'thigh_cm', label: 'Pierna', unit: 'cm' },
];

const EXERCISES = ['Sentadilla', 'Peso muerto', 'Press de banca', 'Press militar', 'Hip thrust', 'Dominadas', 'Remo con barra'];

const num = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const fmt = (n, unit) => `${num.format(n)}${unit === '%' ? '%' : ` ${unit}`}`;
const signed = (n, unit) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n), unit)}`;
const shortDay = (d) => formatDay(d, { day: 'numeric', month: 'short' });

function deltaTone(delta, better) {
  if (!better || delta === 0) return 'text-bone-muted';
  return (better === 'down' ? delta < 0 : delta > 0) ? 'text-emerald-400' : 'text-bone-muted';
}

function ChartTooltip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-850 px-3 py-2 text-xs shadow-xl">
      <p className="text-bone-muted">{formatDay(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
      <p className="mt-0.5 font-semibold text-bone">{fmt(p.value, unit)}{p.reps > 1 && ` × ${p.reps}`}</p>
    </div>
  );
}

function TrendChart({ points, unit }) {
  if (points.length < 2) {
    return <p className="py-6 text-center text-xs text-bone-dim">La gráfica aparece desde el segundo registro.</p>;
  }
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ left: -16, right: 12, top: 8 }}>
          <CartesianGrid stroke="#1f1f1f" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDay} stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis domain={['auto', 'auto']} tickFormatter={(v) => num.format(v)} stroke="#525252" fontSize={11} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<ChartTooltip unit={unit} />} />
          <Line type="monotone" dataKey="value" stroke="#e30613" strokeWidth={2.5} dot={{ r: 3.5, fill: '#e30613' }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeleteButton({ onClick, title }) {
  return (
    <button className="rounded-full p-1.5 text-bone-dim hover:bg-ink-700 hover:text-red-400" title={title} onClick={onClick}>
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, action }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-6 py-4">
      <p className="flex items-center gap-2 font-medium"><Icon className="h-4 w-4 text-seed" /> {title}</p>
      {action}
    </div>
  );
}

function Measurements({ measurements, onAdd, onDelete }) {
  const tracked = METRICS.filter((m) => measurements.some((r) => r[m.key] != null));
  const [selected, setSelected] = useState(null);
  const metric = tracked.find((m) => m.key === selected) || tracked[0];
  const points = metric
    ? measurements.filter((r) => r[metric.key] != null).map((r) => ({ date: r.measured_on, value: r[metric.key] }))
    : [];

  return (
    <section className="card">
      <SectionHeader
        icon={Ruler}
        title="Medidas corporales"
        action={onAdd && <button className="btn-ghost btn-sm" onClick={onAdd}><Plus className="h-4 w-4" /> Nueva medición</button>}
      />
      {measurements.length === 0 ? (
        <p className="px-6 py-8 text-sm text-bone-muted">
          {onAdd ? 'Aún no hay mediciones. Registra la primera en su valoración.' : 'Tu coach registrará tus medidas en tu próxima valoración.'}
        </p>
      ) : (
        <div className="space-y-5 p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tracked.map((m) => {
              const values = measurements.filter((r) => r[m.key] != null);
              const latest = values[values.length - 1][m.key];
              const delta = latest - values[0][m.key];
              const active = m.key === metric.key;
              return (
                <button
                  key={m.key}
                  onClick={() => setSelected(m.key)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${active ? 'border-seed bg-seed/10' : 'border-ink-700 bg-ink-850 hover:border-ink-500'}`}
                >
                  <p className="text-[11px] uppercase tracking-wider text-bone-dim">{m.label}</p>
                  <p className="mt-1 text-xl font-semibold">{fmt(latest, m.unit)}</p>
                  <p className={`mt-0.5 text-xs ${deltaTone(delta, m.better)}`}>
                    {values.length > 1 ? `${signed(delta, m.unit)} desde el inicio` : 'Primer registro'}
                  </p>
                </button>
              );
            })}
          </div>
          <div>
            <p className="mb-2 text-xs text-bone-dim">Evolución · {metric.label}</p>
            <TrendChart points={points} unit={metric.unit} />
          </div>
          <div className="divide-y divide-ink-700 rounded-xl border border-ink-700">
            {[...measurements].reverse().map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatDay(r.measured_on, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="mt-0.5 text-xs text-bone-muted">
                    {METRICS.filter((m) => r[m.key] != null).map((m) => `${m.label} ${fmt(r[m.key], m.unit)}`).join(' · ')}
                  </p>
                  {r.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-bone-dim">{r.notes}</p>}
                </div>
                {onDelete && <DeleteButton title="Eliminar medición" onClick={() => onDelete(r)} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Strength({ records, onAdd, onDelete }) {
  const exercises = [...new Set(records.map((r) => r.exercise))];
  const [selected, setSelected] = useState(null);
  const exercise = exercises.includes(selected) ? selected : exercises[0];
  const list = records.filter((r) => r.exercise === exercise);
  const best = list.reduce((a, b) => (b.load_kg > a.load_kg || (b.load_kg === a.load_kg && b.reps > a.reps) ? b : a), list[0]);
  const delta = list.length > 1 ? list[list.length - 1].load_kg - list[0].load_kg : 0;

  return (
    <section className="card">
      <SectionHeader
        icon={Dumbbell}
        title="Marcas de fuerza"
        action={onAdd && <button className="btn-ghost btn-sm" onClick={onAdd}><Plus className="h-4 w-4" /> Nueva marca</button>}
      />
      {records.length === 0 ? (
        <p className="px-6 py-8 text-sm text-bone-muted">
          {onAdd ? 'Aún no hay marcas registradas.' : 'Aquí verás cómo suben tus pesos en los ejercicios principales.'}
        </p>
      ) : (
        <div className="space-y-5 p-6">
          <div className="flex flex-wrap gap-2">
            {exercises.map((e) => (
              <button
                key={e}
                onClick={() => setSelected(e)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${e === exercise ? 'border-seed bg-seed/15 text-bone' : 'border-ink-600 text-bone-muted hover:border-ink-500'}`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-3">
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-bone-dim"><Trophy className="h-3 w-3 text-seed" /> Mejor marca</p>
              <p className="mt-1 text-xl font-semibold">{fmt(best.load_kg, 'kg')}{best.reps > 1 && <span className="text-sm text-bone-muted"> × {best.reps}</span>}</p>
              <p className="mt-0.5 text-xs text-bone-muted">{shortDay(best.recorded_on)}</p>
            </div>
            <div className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-3">
              <p className="text-[11px] uppercase tracking-wider text-bone-dim">Progreso</p>
              <p className={`mt-1 text-xl font-semibold ${deltaTone(delta, 'up')}`}>{list.length > 1 ? signed(delta, 'kg') : '—'}</p>
              <p className="mt-0.5 text-xs text-bone-muted">{list.length} registro{list.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <TrendChart points={list.map((r) => ({ date: r.recorded_on, value: r.load_kg, reps: r.reps }))} unit="kg" />
          <div className="divide-y divide-ink-700 rounded-xl border border-ink-700">
            {[...list].reverse().map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{fmt(r.load_kg, 'kg')} × {r.reps}</span>
                    <span className="text-bone-dim"> · {formatDay(r.recorded_on, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </p>
                  {r.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-bone-dim">{r.notes}</p>}
                </div>
                {onDelete && <DeleteButton title="Eliminar marca" onClick={() => onDelete(r)} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// Read-only unless the edit callbacks are passed (admin view).
export function ProgressPanel({ progress, onAddMeasurement, onDeleteMeasurement, onAddStrength, onDeleteStrength }) {
  return (
    <div className="space-y-6">
      {progress.goal && (
        <section className="card flex items-start gap-3 border-seed/40 p-5">
          <Target className="mt-0.5 h-5 w-5 shrink-0 text-seed" />
          <div>
            <p className="text-xs uppercase tracking-wider text-bone-dim">Objetivo</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{progress.goal}</p>
          </div>
        </section>
      )}
      <Measurements measurements={progress.measurements} onAdd={onAddMeasurement} onDelete={onDeleteMeasurement} />
      <Strength records={progress.strength} onAdd={onAddStrength} onDelete={onDeleteStrength} />
    </div>
  );
}

function useSubmit(onSubmit) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = (body) => async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSubmit(body);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

export function MeasurementForm({ onSubmit }) {
  const [form, setForm] = useState(() => ({ measured_on: todayKey(), notes: '', ...Object.fromEntries(METRICS.map((m) => [m.key, ''])) }));
  const { error, busy, submit } = useSubmit(onSubmit);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <form onSubmit={submit(form)} className="space-y-4">
      <Field label="Fecha">
        <input type="date" className="input" required max={todayKey()} value={form.measured_on} onChange={set('measured_on')} />
      </Field>
      <p className="text-xs text-bone-dim">Llena solo lo que mediste hoy; lo demás puede quedar vacío.</p>
      <div className="grid grid-cols-2 gap-3">
        {METRICS.map((m) => (
          <Field key={m.key} label={`${m.label} (${m.unit})`}>
            <input type="number" step="0.1" min="0" inputMode="decimal" className="input" value={form[m.key]} onChange={set(m.key)} />
          </Field>
        ))}
      </div>
      <Field label="Observaciones" hint="El cliente las ve en su app.">
        <textarea rows={2} className="input resize-none" value={form.notes} onChange={set('notes')} />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? <Spinner className="h-4 w-4 text-white" /> : 'Guardar medición'}
      </button>
    </form>
  );
}

export function StrengthForm({ knownExercises = [], onSubmit }) {
  const [form, setForm] = useState({ exercise: knownExercises[0] || '', recorded_on: todayKey(), load_kg: '', reps: 1, notes: '' });
  const { error, busy, submit } = useSubmit(onSubmit);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const options = [...new Set([...knownExercises, ...EXERCISES])];

  return (
    <form onSubmit={submit(form)} className="space-y-4">
      <Field label="Ejercicio" hint="Elige uno o escribe otro.">
        <input className="input" list="exercise-options" required value={form.exercise} onChange={set('exercise')} />
        <datalist id="exercise-options">
          {options.map((e) => <option key={e} value={e} />)}
        </datalist>
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Peso (kg)">
          <input type="number" step="0.5" min="0" inputMode="decimal" className="input" required value={form.load_kg} onChange={set('load_kg')} />
        </Field>
        <Field label="Reps">
          <input type="number" min="1" max="100" className="input" required value={form.reps} onChange={set('reps')} />
        </Field>
        <Field label="Fecha">
          <input type="date" className="input" required max={todayKey()} value={form.recorded_on} onChange={set('recorded_on')} />
        </Field>
      </div>
      <Field label="Observaciones" hint="El cliente las ve en su app.">
        <input className="input" value={form.notes} onChange={set('notes')} placeholder="Técnica, RPE…" />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? <Spinner className="h-4 w-4 text-white" /> : 'Guardar marca'}
      </button>
    </form>
  );
}
