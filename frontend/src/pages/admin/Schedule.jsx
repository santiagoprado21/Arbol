import { useCallback, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { ErrorNote, Field, Modal, PageLoader } from '../../components/ui';
import { api } from '../../lib/api';
import { CLASS_TYPES, WEEKDAYS } from '../../lib/format';

const ORDER = [1, 2, 3, 4, 5, 6, 0];

const to12h = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a.m.' : 'p.m.'}`;
};

function TemplateForm({ onDone }) {
  const [form, setForm] = useState({ weekdays: [1, 2, 3, 4, 5], start_time: '06:00', class_type: 'semi', capacity: 6, duration_min: 60 });
  const [error, setError] = useState('');

  const toggleDay = (d) =>
    setForm({ ...form, weekdays: form.weekdays.includes(d) ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d] });

  const submit = async (e) => {
    e.preventDefault();
    if (form.weekdays.length === 0) return setError('Selecciona al menos un día');
    try {
      await api('/admin/templates', { method: 'POST', body: form });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <span className="label">Días</span>
        <div className="flex flex-wrap gap-2">
          {ORDER.map((d) => (
            <button
              type="button"
              key={d}
              onClick={() => toggleDay(d)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                form.weekdays.includes(d) ? 'border-seed bg-seed/15 text-bone' : 'border-ink-600 text-bone-muted'
              }`}
            >
              {WEEKDAYS[d].slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hora de inicio">
          <input type="time" required className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
        </Field>
        <Field label="Duración (min)">
          <input type="number" min="15" step="15" className="input" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Modalidad">
          <select
            className="input"
            value={form.class_type}
            onChange={(e) => setForm({ ...form, class_type: e.target.value, capacity: e.target.value === 'semi' ? 6 : 1 })}
          >
            <option value="semi">Semi-personalizado</option>
            <option value="personal">Personalizado 1:1</option>
          </select>
        </Field>
        <Field label="Cupo máximo">
          <input type="number" min="1" max="20" className="input" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
        </Field>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary w-full">Agregar franja</button>
    </form>
  );
}

export default function Schedule() {
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => setTemplates((await api('/admin/templates')).templates), []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  const remove = async (t) => {
    if (!window.confirm(`¿Eliminar la franja de ${WEEKDAYS[t.weekday]} ${to12h(t.start_time)}? Las clases futuras sin reservas se borrarán.`)) return;
    try {
      await api(`/admin/templates/${t.id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (!templates) return error ? <ErrorNote>{error}</ErrorNote> : <PageLoader />;

  return (
    <div>
      <PageHeader title="Horarios" subtitle="Franjas semanales recurrentes. Las clases se generan automáticamente con 3 semanas de anticipación.">
        <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Nueva franja
        </button>
      </PageHeader>
      <ErrorNote>{error}</ErrorNote>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ORDER.map((d) => {
          const list = templates.filter((t) => t.weekday === d);
          return (
            <div key={d} className="card p-5">
              <p className="font-medium">{WEEKDAYS[d]}</p>
              <div className="mt-4 space-y-2">
                {list.length === 0 && <p className="text-sm text-bone-dim">Sin franjas</p>}
                {list.map((t) => (
                  <div key={t.id} className="group flex items-center justify-between rounded-xl bg-ink-850 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{to12h(t.start_time)}</p>
                      <p className="text-[11px] text-bone-dim">
                        {CLASS_TYPES[t.class_type].short} · {t.capacity} {t.capacity === 1 ? 'cupo' : 'cupos'} · {t.duration_min} min
                      </p>
                    </div>
                    <button
                      onClick={() => remove(t)}
                      className="rounded-lg p-1 text-bone-dim opacity-0 transition hover:bg-ink-700 hover:text-red-400 group-hover:opacity-100"
                      aria-label="Eliminar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva franja semanal">
        <TemplateForm
          onDone={() => {
            setOpen(false);
            load();
          }}
        />
      </Modal>
    </div>
  );
}
