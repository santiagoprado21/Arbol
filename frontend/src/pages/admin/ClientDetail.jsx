import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, HeartPulse, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { Badge, ErrorNote, Field, Modal, PageLoader, ProgressBar, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { CLASS_TYPES, RESERVATION_STATUS, formatDate, formatDay, formatMoney, formatTime, todayKey } from '../../lib/format';

const PAYMENT_METHODS = ['Bold', 'Transferencia', 'Efectivo', 'Nequi', 'Otro'];

function MembershipForm({ client, plans, onDone }) {
  const [form, setForm] = useState({
    plan_id: plans[0]?.id || '',
    start_date: todayKey(),
    amount: '',
    payment_status: 'paid',
    payment_method: 'Bold',
    payment_reference: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const plan = plans.find((p) => String(p.id) === String(form.plan_id));
  const suggested = plan
    ? client.client_type === 'founder' && plan.price_founder != null
      ? plan.price_founder
      : plan.price_regular
    : 0;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/admin/clients/${client.id}/memberships`, {
        method: 'POST',
        body: { ...form, amount: form.amount === '' ? suggested : Number(form.amount) },
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Plan">
        <select className="input" value={form.plan_id} onChange={set('plan_id')}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inicio" hint="Vence un mes después">
          <input type="date" className="input" value={form.start_date} onChange={set('start_date')} required />
        </Field>
        <Field label="Valor" hint={`Sugerido: ${formatMoney(suggested)}`}>
          <input type="number" min="0" className="input" placeholder={String(suggested)} value={form.amount} onChange={set('amount')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Estado del pago">
          <select className="input" value={form.payment_status} onChange={set('payment_status')}>
            <option value="paid">Pagado</option>
            <option value="pending">Pendiente</option>
          </select>
        </Field>
        <Field label="Medio de pago">
          <select className="input" value={form.payment_method} onChange={set('payment_method')}>
            {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Referencia / comprobante">
        <input className="input" value={form.payment_reference} onChange={set('payment_reference')} placeholder="Opcional" />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? <Spinner className="h-4 w-4 text-white" /> : 'Activar plan'}
      </button>
    </form>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await api(`/admin/clients/${id}`);
    setData(d);
    setProfile({
      client_type: d.user.client_type,
      status: d.user.status,
      phone: d.user.phone || '',
      admin_notes: d.user.admin_notes || '',
    });
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api('/admin/plans').then((d) => setPlans(d.plans.filter((p) => p.active)));
  }, [load]);

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    await run(() => api(`/admin/clients/${id}`, { method: 'PATCH', body: profile }));
    setSaving(false);
  };

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <PageLoader />;
  const { user, memberships, reservations } = data;
  const phoneDigits = (user.phone || '').replace(/\D/g, '');
  const waPhone = phoneDigits.length === 10 ? `57${phoneDigits}` : phoneDigits;

  return (
    <div className="space-y-6">
      <Link to="/admin/clientes" className="inline-flex items-center gap-2 text-sm text-bone-muted hover:text-bone">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {user.full_name}
            {user.client_type === 'founder' && <Badge tone="white">Founder</Badge>}
          </h1>
          <p className="mt-1 text-sm text-bone-muted">
            CC {user.cedula} · {user.email} · {user.phone}
          </p>
          <p className="mt-0.5 text-xs text-bone-dim">Registrado el {formatDate(user.created_at, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex gap-2">
          {waPhone && (
            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          <button className="btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Nuevo plan / pago
          </button>
        </div>
      </div>

      <ErrorNote>{error}</ErrorNote>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <p className="border-b border-ink-700 px-6 py-4 font-medium">Planes y pagos</p>
            {memberships.length === 0 ? (
              <p className="px-6 py-8 text-sm text-bone-muted">Este cliente aún no tiene planes.</p>
            ) : (
              <div className="divide-y divide-ink-700">
                {memberships.map((m) => {
                  const remaining = m.sessions_total - m.sessions_used;
                  const current = m.start_date <= todayKey() && m.days_left >= 0;
                  return (
                    <div key={m.id} className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {m.plan_name}
                            {current && <Badge tone="green" className="ml-2">Vigente</Badge>}
                            {m.days_left < 0 && <Badge className="ml-2">Finalizado</Badge>}
                          </p>
                          <p className="text-xs text-bone-dim">
                            {formatDay(m.start_date)} → {formatDay(m.end_date)} · {formatMoney(m.amount)}
                            {m.payment_method && ` · ${m.payment_method}`}
                            {m.payment_reference && ` · Ref. ${m.payment_reference}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.payment_status === 'paid' ? (
                            <Badge tone="green">Pagado</Badge>
                          ) : (
                            <button
                              className="btn-sm btn rounded-full bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                              onClick={() => run(() => api(`/admin/memberships/${m.id}`, { method: 'PATCH', body: { payment_status: 'paid' } }))}
                            >
                              Marcar pagado
                            </button>
                          )}
                          <button
                            className="rounded-full p-1.5 text-bone-dim hover:bg-ink-700 hover:text-red-400"
                            title="Eliminar plan"
                            onClick={() =>
                              window.confirm('¿Eliminar este plan? Las reservas quedarán sin plan asociado.') &&
                              run(() => api(`/admin/memberships/${m.id}`, { method: 'DELETE' }))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex-1"><ProgressBar value={m.sessions_used} max={m.sessions_total} danger={remaining <= 1} /></div>
                        <p className="shrink-0 text-xs text-bone-muted">{remaining} de {m.sessions_total} restantes</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card">
            <p className="border-b border-ink-700 px-6 py-4 font-medium">Reservas y asistencia</p>
            {reservations.length === 0 ? (
              <p className="px-6 py-8 text-sm text-bone-muted">Sin reservas todavía.</p>
            ) : (
              <div className="divide-y divide-ink-700">
                {reservations.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm">
                    <span>
                      {formatDate(r.starts_at)} · {formatTime(r.starts_at)}
                      <span className="text-bone-dim"> · {CLASS_TYPES[r.class_type].short}</span>
                    </span>
                    {r.status === 'cancelled' ? (
                      <Badge>{RESERVATION_STATUS.cancelled.label}</Badge>
                    ) : (
                      <select
                        className="rounded-lg border border-ink-600 bg-ink-850 px-2 py-1 text-xs"
                        value={r.status}
                        onChange={(e) => run(() => api(`/admin/reservations/${r.id}`, { method: 'PATCH', body: { status: e.target.value } }))}
                      >
                        {Object.entries(RESERVATION_STATUS).map(([value, { label }]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-6">
            <p className="flex items-center gap-2 font-medium">
              <HeartPulse className="h-4 w-4 text-seed" /> Notas médicas
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-bone-muted">{user.medical_notes || 'Sin observaciones registradas.'}</p>
          </section>

          <section className="card space-y-4 p-6">
            <p className="font-medium">Perfil</p>
            <Field label="Tipo de cliente">
              <select className="input" value={profile.client_type} onChange={(e) => setProfile({ ...profile, client_type: e.target.value })}>
                <option value="regular">Regular</option>
                <option value="founder">Founder</option>
              </select>
            </Field>
            <Field label="Estado">
              <select className="input" value={profile.status} onChange={(e) => setProfile({ ...profile, status: e.target.value })}>
                <option value="active">Activo</option>
                <option value="paused">En pausa</option>
                <option value="inactive">Inactivo</option>
              </select>
            </Field>
            <Field label="Teléfono">
              <input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </Field>
            <Field label="Notas internas">
              <textarea rows={3} className="input resize-none" value={profile.admin_notes} onChange={(e) => setProfile({ ...profile, admin_notes: e.target.value })} />
            </Field>
            <button className="btn-light w-full" onClick={saveProfile} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : 'Guardar cambios'}
            </button>
          </section>
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={`Nuevo plan · ${user.full_name}`}>
        {plans.length > 0 && (
          <MembershipForm
            client={user}
            plans={plans}
            onDone={() => {
              setShowForm(false);
              load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
