import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, HeartPulse, MessageCircle, Plus, Snowflake, Sprout, Trash2, X } from 'lucide-react';
import { Badge, ClientTypeBadge, ErrorNote, Field, Modal, PageLoader, ProgressBar, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import {
  CLASS_TYPES,
  EVALUATION_LABEL,
  PRICE_TIERS,
  RESERVATION_STATUS,
  formatDate,
  formatDay,
  formatMoney,
  formatTime,
  todayKey,
} from '../../lib/format';

const PAYMENT_METHODS = ['Bold', 'Transferencia', 'Efectivo', 'Nequi', 'Otro'];

function MembershipForm({ client, plans, initialPlanId, onDone }) {
  const [form, setForm] = useState({
    plan_id: initialPlanId || plans.find((p) => p.class_type !== 'membership')?.id || plans[0]?.id || '',
    start_date: todayKey(),
    amount: '',
    payment_status: 'paid',
    payment_method: 'Bold',
    payment_reference: '',
  });
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const plan = plans.find((p) => String(p.id) === String(form.plan_id));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  useEffect(() => {
    if (!form.plan_id || !form.start_date) return;
    let alive = true;
    setQuote(null);
    api(`/admin/clients/${client.id}/quote?plan_id=${form.plan_id}&start_date=${form.start_date}`)
      .then((d) => alive && setQuote(d.quote))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [client.id, form.plan_id, form.start_date]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/admin/clients/${client.id}/memberships`, { method: 'POST', body: form });
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
      {quote && (
        <div className="rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-sm">
          <p className="font-medium">{PRICE_TIERS[quote.tier]}</p>
          <p className="mt-0.5 text-xs text-bone-muted">
            {formatMoney(quote.base)}
            {quote.credit > 0 && ` − ${formatMoney(quote.credit)} abono de valoración = ${formatMoney(quote.amount)}`}
          </p>
          {quote.loses_bonus && (
            <p className="mt-2 text-xs text-amber-300">
              Hubo más de un mes sin plan desde el anterior: el bono mensual Founder se pierde al activar este plan.
            </p>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inicio" hint={plan?.duration_months === 12 ? 'Vence 12 meses después' : 'Vence un mes después'}>
          <input type="date" className="input" value={form.start_date} onChange={set('start_date')} required />
        </Field>
        <Field label="Valor" hint={quote ? `Sugerido: ${formatMoney(quote.amount)}` : ' '}>
          <input type="number" min="0" className="input" placeholder={quote ? String(quote.amount) : ''} value={form.amount} onChange={set('amount')} />
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
      <button className="btn-primary w-full" disabled={busy || !quote}>
        {busy ? <Spinner className="h-4 w-4 text-white" /> : plan?.class_type === 'membership' ? 'Activar membresía' : 'Activar plan'}
      </button>
    </form>
  );
}

function FreezeForm({ membership, policy, onDone }) {
  const used = membership.freezes.reduce((sum, f) => sum + f.days, 0);
  const [form, setForm] = useState({ start_date: todayKey(), days: 7, reason: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/admin/memberships/${membership.id}/freezes`, { method: 'POST', body: form });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-bone-muted">
        La vigencia del plan se extiende por los días congelados y las reservas de esas fechas se cancelan sin descontar sesiones.
      </p>
      <p className="rounded-xl bg-ink-850 px-4 py-3 text-xs text-bone-muted">
        Política de este cliente: {policy.maxFreezes} congelamiento(s) y hasta {policy.maxDays} días por plan. Usados:{' '}
        {membership.freezes.length} · {used} días. Como admin puedes excederla.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Desde">
          <input type="date" className="input" required value={form.start_date} min={membership.start_date} max={membership.end_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </Field>
        <Field label="Días">
          <input type="number" min="1" max="60" className="input" required value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Motivo">
        <input className="input" placeholder="Viaje, lesión…" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? <Spinner className="h-4 w-4 text-white" /> : 'Congelar plan'}
      </button>
    </form>
  );
}

function FounderCard({ user, status, guests, onActivate, onToggleBonus }) {
  if (user.client_type === 'founder_guest') {
    return (
      <section className="card space-y-2 p-6">
        <p className="flex items-center gap-2 font-medium"><Sprout className="h-4 w-4 text-seed" /> Invitado Founder</p>
        <p className="text-sm text-bone-muted">
          Accede a las tarifas Founder, sin bono mensual.
          {status.invited_by_name && <> Invitado por <Link to={`/admin/clientes/${status.invited_by}`} className="text-bone underline">{status.invited_by_name}</Link>.</>}
        </p>
      </section>
    );
  }
  if (user.client_type !== 'founder') return null;
  return (
    <section className="card space-y-4 border-seed/40 p-6">
      <p className="flex items-center gap-2 font-medium"><Sprout className="h-4 w-4 text-seed" /> Founder</p>
      {status.founder ? (
        <p className="text-sm text-bone-muted">
          Membresía anual vigente hasta <span className="text-bone">{formatDay(status.founder_until)}</span>. Tiene tarifas Founder,
          prioridad para agendar ({status.booking_horizon_days} días), horarios Founders Only y congelamiento flexible.
        </p>
      ) : (
        <>
          <p className="text-sm text-amber-300">Sin membresía anual vigente: por ahora no recibe beneficios Founder.</p>
          <button className="btn-primary btn-sm w-full" onClick={onActivate}>Activar membresía anual</button>
        </>
      )}
      <label className="flex items-start gap-3">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-seed" checked={user.founder_bonus_active} onChange={(e) => onToggleBonus(e.target.checked)} />
        <span className="text-sm">
          Bono mensual activo
          <span className="block text-xs text-bone-dim">Se pierde solo si pasa más de un mes sin plan. Puedes reactivarlo aquí.</span>
        </span>
      </label>
      <div>
        <p className="text-xs uppercase tracking-wider text-bone-dim">Invitado Founder</p>
        {guests.length === 0 ? (
          <p className="mt-1 text-sm text-bone-muted">Aún no tiene invitado. Asígnalo desde el perfil del invitado.</p>
        ) : (
          guests.map((g) => (
            <Link key={g.id} to={`/admin/clientes/${g.id}`} className="mt-1 block text-sm hover:text-seed">{g.full_name}</Link>
          ))
        )}
      </div>
    </section>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [founders, setFounders] = useState([]);
  const [error, setError] = useState('');
  const [planModal, setPlanModal] = useState(null);
  const [freezing, setFreezing] = useState(null);
  const [profile, setProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await api(`/admin/clients/${id}`);
    setData(d);
    setProfile({
      client_type: d.user.client_type,
      invited_by: d.user.invited_by ?? '',
      status: d.user.status,
      phone: d.user.phone || '',
      admin_notes: d.user.admin_notes || '',
    });
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api('/admin/plans').then((d) => setPlans(d.plans.filter((p) => p.active)));
    api('/admin/clients').then((d) =>
      setFounders(d.clients.filter((c) => c.client_type === 'founder' && String(c.id) !== String(id))),
    );
  }, [load, id]);

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
  const { user, status, guests, memberships, reservations } = data;
  const phoneDigits = (user.phone || '').replace(/\D/g, '');
  const waPhone = phoneDigits.length === 10 ? `57${phoneDigits}` : phoneDigits;
  const annualPlan = plans.find((p) => p.class_type === 'membership');

  return (
    <div className="space-y-6">
      <Link to="/admin/clientes" className="inline-flex items-center gap-2 text-sm text-bone-muted hover:text-bone">
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {user.full_name}
            <ClientTypeBadge type={user.client_type} active={status.founder} />
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
          <button className="btn-primary btn-sm" onClick={() => setPlanModal({})}>
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
                  const isMembership = m.class_type === 'membership';
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
                            {m.price_tier && !isMembership && ` · ${PRICE_TIERS[m.price_tier]}`}
                            {m.evaluation_credit > 0 && ` · abono valoración ${formatMoney(m.evaluation_credit)}`}
                            {m.payment_method && ` · ${m.payment_method}`}
                            {m.payment_reference && ` · Ref. ${m.payment_reference}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isMembership && m.days_left >= 0 && (
                            <button className="btn-ghost btn-sm" onClick={() => setFreezing(m)}>
                              <Snowflake className="h-3.5 w-3.5" /> Congelar
                            </button>
                          )}
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
                      {!isMembership && (
                        <div className="mt-3 flex items-center gap-4">
                          <div className="flex-1"><ProgressBar value={m.sessions_used} max={m.sessions_total} danger={remaining <= 1} /></div>
                          <p className="shrink-0 text-xs text-bone-muted">{remaining} de {m.sessions_total} restantes</p>
                        </div>
                      )}
                      {m.freezes.map((f) => (
                        <div key={f.id} className="mt-2 flex items-center justify-between rounded-lg bg-sky-500/5 px-3 py-1.5 text-xs text-sky-300">
                          <span>
                            <Snowflake className="mr-1.5 inline h-3 w-3" />
                            Congelado {formatDay(f.start_date)} → {formatDay(f.end_date)} ({f.days} d)
                            {f.reason && ` · ${f.reason}`}
                            {!f.created_by_admin && ' · solicitado por el cliente'}
                          </span>
                          <button
                            title="Quitar congelamiento"
                            className="rounded p-0.5 hover:bg-ink-700"
                            onClick={() =>
                              window.confirm('¿Quitar este congelamiento? La fecha de vencimiento vuelve a la anterior.') &&
                              run(() => api(`/admin/freezes/${f.id}`, { method: 'DELETE' }))
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
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
                      <span className="text-bone-dim"> · {r.evaluation_id ? EVALUATION_LABEL : CLASS_TYPES[r.class_type].short}</span>
                      {r.evaluation_id && (
                        <span className="ml-2 inline-flex items-center gap-2">
                          <span className="text-xs text-bone-dim">{formatMoney(r.evaluation_amount)}</span>
                          {r.evaluation_payment === 'paid' ? (
                            <Badge tone="green">{r.credited_membership_id ? 'Pagada · abonada' : 'Pagada'}</Badge>
                          ) : (
                            r.status !== 'cancelled' && (
                              <button
                                className="btn-sm btn rounded-full bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                                onClick={() => run(() => api(`/admin/evaluations/${r.evaluation_id}`, { method: 'PATCH', body: { payment_status: 'paid' } }))}
                              >
                                Marcar pagada
                              </button>
                            )
                          )}
                        </span>
                      )}
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
          <FounderCard
            user={user}
            status={status}
            guests={guests}
            onActivate={() => setPlanModal({ planId: annualPlan?.id })}
            onToggleBonus={(v) => run(() => api(`/admin/clients/${id}`, { method: 'PATCH', body: { founder_bonus_active: v } }))}
          />

          <section className="card p-6">
            <p className="flex items-center gap-2 font-medium">
              <HeartPulse className="h-4 w-4 text-seed" /> Notas médicas
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm text-bone-muted">{user.medical_notes || 'Sin observaciones registradas.'}</p>
          </section>

          <section className="card space-y-4 p-6">
            <p className="font-medium">Perfil</p>
            <Field label="Tipo de cliente" hint={profile.client_type === 'founder' ? 'Los beneficios se activan con la membresía anual Founder.' : undefined}>
              <select className="input" value={profile.client_type} onChange={(e) => setProfile({ ...profile, client_type: e.target.value })}>
                <option value="regular">Regular</option>
                <option value="founder">Founder</option>
                <option value="founder_guest">Invitado Founder</option>
              </select>
            </Field>
            {profile.client_type === 'founder_guest' && (
              <Field label="Invitado por" hint="Cada Founder puede tener un invitado.">
                <select className="input" value={profile.invited_by} onChange={(e) => setProfile({ ...profile, invited_by: e.target.value })}>
                  <option value="">Selecciona un Founder…</option>
                  {founders.map((f) => (
                    <option key={f.id} value={f.id}>{f.full_name}</option>
                  ))}
                </select>
              </Field>
            )}
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

      <Modal open={Boolean(planModal)} onClose={() => setPlanModal(null)} title={`Nuevo plan · ${user.full_name}`}>
        {planModal && plans.length > 0 && (
          <MembershipForm
            client={user}
            plans={plans}
            initialPlanId={planModal.planId}
            onDone={() => {
              setPlanModal(null);
              load();
            }}
          />
        )}
      </Modal>

      <Modal open={Boolean(freezing)} onClose={() => setFreezing(null)} title={`Congelar · ${freezing?.plan_name ?? ''}`}>
        {freezing && (
          <FreezeForm
            membership={freezing}
            policy={status.freeze_policy}
            onDone={() => {
              setFreezing(null);
              load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
