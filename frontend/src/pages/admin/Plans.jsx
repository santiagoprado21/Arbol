import { useEffect, useState } from 'react';
import { PageHeader } from './AdminLayout';
import { ErrorNote, PageLoader, Spinner } from '../../components/ui';
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
            : `${CLASS_TYPES[plan.class_type].label} · ${plan.sessions} sesiones · ${formatMoney(form.price_regular / plan.sessions)} c/u`}
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

export default function Plans() {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/plans').then((d) => setPlans(d.plans)).catch((e) => setError(e.message));
  }, []);

  if (!plans) return error ? <ErrorNote>{error}</ErrorNote> : <PageLoader />;

  return (
    <div>
      <PageHeader
        title="Planes y precios"
        subtitle="La tarifa se elige sola al activar un plan: regular, Founder (también para Invitados Founder) o Founder con bono mensual, que se mantiene mientras el Founder renueve su plan mes a mes."
      />
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
    </div>
  );
}
