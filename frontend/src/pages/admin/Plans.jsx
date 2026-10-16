import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { ErrorNote, Field, Modal, PageLoader, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { CLASS_TYPES, formatMoney } from '../../lib/format';

const PRICE_FIELDS = ['price_regular', 'price_founder', 'price_founder_bonus'];

function PlanRow({ plan, onSaved }) {
  const initial = () => ({
    price_regular: plan.price_regular,
    price_founder: plan.price_founder ?? '',
    price_founder_bonus: plan.price_founder_bonus ?? '',
    active: plan.active,
  });
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isMembership = plan.class_type === 'membership';
  const dirty =
    PRICE_FIELDS.some((k) => String(form[k]) !== String(plan[k] ?? '')) || form.active !== plan.active;

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const { plan: updated } = await api(`/admin/plans/${plan.id}`, { method: 'PATCH', body: form });
      onSaved(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const priceInput = (key, placeholder) => (
    <input
      type="number"
      min="0"
      className="input w-32 py-2"
      placeholder={placeholder}
      value={form[key]}
      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
    />
  );

  return (
    <tr className={!form.active ? 'opacity-50' : ''}>
      <td className="px-5 py-3">
        <p className="font-medium">{plan.name}</p>
        <p className="text-xs text-bone-dim">
          {isMembership
            ? `${plan.duration_months} meses · habilita los beneficios Founder`
            : `${CLASS_TYPES[plan.class_type].label} · ${plan.sessions} sesiones${plan.duration_months > 1 ? ` · ${plan.duration_months} meses` : ''} · ${formatMoney(form.price_regular / plan.sessions)} c/u`}
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </td>
      <td className="px-5 py-3">{priceInput('price_regular')}</td>
      <td className="px-5 py-3">{isMembership ? <span className="text-bone-dim">—</span> : priceInput('price_founder', 'Igual a regular')}</td>
      <td className="px-5 py-3">
        {isMembership ? <span className="text-bone-dim">—</span> : priceInput('price_founder_bonus', 'Igual a Founder')}
      </td>
      <td className="px-5 py-3">
        <input type="checkbox" className="h-4 w-4 accent-seed" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
      </td>
      <td className="px-5 py-3 text-right">
        <button className="btn-light btn-sm" disabled={!dirty || busy} onClick={save}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : 'Guardar'}
        </button>
      </td>
    </tr>
  );
}

function NewPlanForm({ onCreated }) {
  const [form, setForm] = useState({
    name: '',
    class_type: 'semi',
    sessions: 8,
    duration_months: 1,
    price_regular: '',
    price_founder: '',
    price_founder_bonus: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const suggestedName = `${CLASS_TYPES[form.class_type].label} · ${form.sessions || '?'} sesiones`;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { plan } = await api('/admin/plans', { method: 'POST', body: { ...form, name: form.name || suggestedName } });
      onCreated(plan);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Modalidad">
          <select className="input" value={form.class_type} onChange={set('class_type')}>
            <option value="semi">FLEX</option>
            <option value="personal">Personalizado 1:1</option>
          </select>
        </Field>
        <Field label="Sesiones">
          <input type="number" min="1" required className="input" value={form.sessions} onChange={set('sessions')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" hint="Si lo dejas vacío se usa el sugerido">
          <input className="input" placeholder={suggestedName} value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Duración (meses)">
          <input type="number" min="1" max="12" required className="input" value={form.duration_months} onChange={set('duration_months')} />
        </Field>
      </div>
      <Field label="Precio regular">
        <input type="number" min="0" required className="input" value={form.price_regular} onChange={set('price_regular')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Founder (sin bono)" hint="Opcional">
          <input type="number" min="0" className="input" placeholder="Igual a regular" value={form.price_founder} onChange={set('price_founder')} />
        </Field>
        <Field label="Founder con bono" hint="Opcional">
          <input type="number" min="0" className="input" placeholder="Igual a Founder" value={form.price_founder_bonus} onChange={set('price_founder_bonus')} />
        </Field>
      </div>
      <p className="text-xs text-bone-dim">El plan queda activo y aparece de inmediato en la página principal y al activar planes.</p>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? <Spinner className="h-4 w-4 text-white" /> : 'Crear plan'}
      </button>
    </form>
  );
}

export default function Plans() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api('/admin/plans').then((d) => setPlans(d.plans)).catch((e) => setError(e.message));
  }, []);

  if (!plans) return error ? <ErrorNote>{error}</ErrorNote> : <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Planes y precios"
        subtitle="La tarifa se elige sola al activar un plan: regular, Founder (también para Invitados Founder) o Founder con bono mensual, que se mantiene mientras el Founder renueve su plan mes a mes."
      >
        <button className="btn-primary btn-sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" /> Nuevo plan
        </button>
      </PageHeader>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-bone-dim">
            <tr>
              <th className="px-5 py-3 font-medium">Plan</th>
              <th className="px-5 py-3 font-medium">Regular</th>
              <th className="px-5 py-3 font-medium">Founder (sin bono)</th>
              <th className="px-5 py-3 font-medium">Founder con bono</th>
              <th className="px-5 py-3 font-medium">Activo</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-700">
            {plans.map((p) => (
              <PlanRow key={p.id} plan={p} onSaved={(u) => setPlans(plans.map((x) => (x.id === u.id ? u : x)))} />
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nuevo plan">
        {creating && (
          <NewPlanForm
            onCreated={(plan) => {
              setCreating(false);
              setPlans([...plans, plan]);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
