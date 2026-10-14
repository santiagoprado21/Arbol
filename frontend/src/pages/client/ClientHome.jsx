import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, CalendarDays, Clock, LogOut, MessageCircle, Snowflake, Sprout, Users } from 'lucide-react';
import Logo from '../../components/Logo';
import { Badge, ClientTypeBadge, EmptyState, ErrorNote, Field, Modal, PageLoader, ProgressBar, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  CLASS_TYPES,
  EVALUATION_LABEL,
  EVALUATION_PRICE,
  RESERVATION_STATUS,
  addDays,
  dayKey,
  formatDate,
  formatDay,
  formatMoney,
  formatTime,
  todayKey,
  whatsappLink,
} from '../../lib/format';

const SLOT_FETCH_DAYS = 22;

function FreezeRequest({ membership, policy, onDone }) {
  const usedDays = membership.freezes.reduce((sum, f) => sum + f.days, 0);
  const freezesLeft = policy.maxFreezes - membership.freezes.length;
  const daysLeft = policy.maxDays - usedDays;
  const tomorrow = addDays(todayKey(), 1);
  const [form, setForm] = useState({ start_date: tomorrow, days: Math.min(7, daysLeft), reason: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (freezesLeft <= 0 || daysLeft <= 0) {
    return (
      <p className="text-sm text-bone-muted">
        Ya usaste los congelamientos disponibles para este plan. Si necesitas más tiempo, escríbenos por WhatsApp.
      </p>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { cancelled } = await api(`/me/memberships/${membership.id}/freezes`, { method: 'POST', body: form });
      onDone(
        `Plan congelado ${form.days} días desde el ${formatDay(form.start_date, { day: 'numeric', month: 'long' })}. Tu vencimiento se corrió.` +
          (cancelled ? ` Cancelamos ${cancelled} reserva(s) de esas fechas y las sesiones volvieron a tu plan.` : ''),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-bone-muted">
        Pausa tu plan si viajas o necesitas descansar: los días congelados se suman a tu fecha de vencimiento.
      </p>
      <p className="rounded-xl bg-ink-850 px-4 py-3 text-xs text-bone-muted">
        Te quedan {freezesLeft} congelamiento(s) y {daysLeft} días en este plan.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Desde">
          <input type="date" className="input" required min={tomorrow} max={membership.end_date} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        </Field>
        <Field label="Días">
          <input type="number" className="input" required min="1" max={daysLeft} value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Motivo (opcional)">
        <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary w-full" disabled={busy}>
        {busy ? <Spinner className="h-4 w-4 text-white" /> : 'Congelar plan'}
      </button>
    </form>
  );
}

function EvaluationPicker({ onBook }) {
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    api('/evaluation/slots').then((d) => setSlots(d.slots)).catch((e) => setError(e.message));
  }, []);

  const book = async (slot) => {
    setBusy(slot.id);
    setError('');
    try {
      await onBook(slot);
    } catch (err) {
      setError(err.message);
      setBusy(null);
    }
  };

  const byDay = (slots || []).reduce((acc, s) => {
    (acc[dayKey(s.starts_at)] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <p className="text-sm text-bone-muted">
        Sesión 1:1 con tu coach para evaluar tu movimiento y probar el entrenamiento. Cuesta {formatMoney(EVALUATION_PRICE)} y,
        si luego adquieres un plan, te abonamos ese valor.
      </p>
      <ErrorNote>{error}</ErrorNote>
      {!slots ? (
        <PageLoader />
      ) : slots.length === 0 ? (
        <EmptyState icon={Clock} title="No hay horarios 1:1 libres">
          <a href={whatsappLink(`Hola, quiero agendar mi ${EVALUATION_LABEL}`)} target="_blank" rel="noreferrer" className="underline">
            Escríbenos por WhatsApp
          </a>{' '}
          y te buscamos un espacio.
        </EmptyState>
      ) : (
        <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {Object.entries(byDay).map(([day, list]) => (
            <div key={day}>
              <p className="mb-2 text-xs uppercase tracking-wider text-bone-dim">{formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((s) => (
                  <button key={s.id} className="btn-ghost btn-sm" disabled={busy !== null} onClick={() => book(s)}>
                    {busy === s.id ? <Spinner className="h-3.5 w-3.5" /> : formatTime(s.starts_at)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientHome() {
  const { user, logout } = useAuth();
  const [memberships, setMemberships] = useState(null);
  const [status, setStatus] = useState(null);
  const [evaluationCredit, setEvaluationCredit] = useState(0);
  const [slots, setSlots] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [busySlot, setBusySlot] = useState(null);
  const [notice, setNotice] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [freezing, setFreezing] = useState(null);
  const [evaluationOpen, setEvaluationOpen] = useState(false);

  const load = useCallback(async () => {
    const [m, s, r] = await Promise.all([
      api('/me/memberships'),
      api(`/slots?from=${todayKey()}&days=${SLOT_FETCH_DAYS}`),
      api('/me/reservations'),
    ]);
    setMemberships(m.memberships);
    setStatus(m.status);
    setEvaluationCredit(m.evaluation_credit);
    setSlots(s.slots);
    setReservations(r.reservations);
    setSelectedDay((prev) => {
      const days = new Set(s.slots.map((slot) => dayKey(slot.starts_at)));
      return days.has(prev) ? prev : [...days][0] || prev;
    });
  }, []);

  useEffect(() => {
    load().catch((err) => setNotice({ type: 'error', text: err.message }));
  }, [load]);

  const horizon = status?.booking_horizon_days ?? 14;
  const days = useMemo(() => Array.from({ length: horizon }, (_, i) => addDays(todayKey(), i)), [horizon]);
  const daySlots = slots.filter((s) => dayKey(s.starts_at) === selectedDay);
  const sessionPlans = (memberships || []).filter((m) => m.class_type !== 'membership');
  const founderMembership = (memberships || []).find((m) => m.class_type === 'membership');
  const hasPersonalPlan = sessionPlans.some((m) => m.class_type === 'personal');
  const personalLink = whatsappLink(`Hola, soy ${user.full_name} y quiero agendar mi sesión personalizada 1:1`);
  const upcoming = reservations
    .filter((r) => r.status === 'booked' && new Date(r.starts_at) > new Date())
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const history = reservations.filter((r) => !upcoming.includes(r)).slice(0, 8);
  const hasUpcomingEvaluation = upcoming.some((r) => r.is_evaluation);

  const act = async (fn, slotId) => {
    setBusySlot(slotId);
    setNotice(null);
    try {
      const text = await fn();
      setNotice({ type: 'ok', text });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setBusySlot(null);
    }
  };

  const confirmByWhatsApp = (slot, what) => {
    const when = `${formatDate(slot.starts_at, { weekday: 'long', day: 'numeric', month: 'long' })} a las ${formatTime(slot.starts_at)}`;
    const link = whatsappLink(`Hola, soy ${user.full_name}. Reservé mi ${what} para el ${when}. ¡Nos vemos en Árbol!`);
    setConfirmation({ when, link });
    window.open(link, '_blank');
    return when;
  };

  const book = (slot) =>
    act(async () => {
      await api('/reservations', { method: 'POST', body: { slot_id: slot.id } });
      return `Listo: reservaste el ${confirmByWhatsApp(slot, 'clase FLEX')}.`;
    }, slot.id);

  const bookEvaluation = async (slot) => {
    await api('/evaluations', { method: 'POST', body: { slot_id: slot.id } });
    setEvaluationOpen(false);
    const when = confirmByWhatsApp(slot, `${EVALUATION_LABEL.toLowerCase()} (${formatMoney(EVALUATION_PRICE)})`);
    setNotice({ type: 'ok', text: `Tu valoración quedó agendada para el ${when}.` });
    await load();
  };

  const cancel = (reservationId, slotId, startsAt, isEvaluation = false) => {
    const hours = (new Date(startsAt) - Date.now()) / 36e5;
    const msg = isEvaluation
      ? hours < 12
        ? 'Faltan menos de 12 horas: si cancelas, la valoración se cobra igualmente. ¿Cancelar de todos modos?'
        : '¿Cancelar tu valoración?'
      : hours < 12
        ? 'Faltan menos de 12 horas: si cancelas, la sesión se descuenta de tu plan. ¿Cancelar de todos modos?'
        : '¿Cancelar esta reserva? La sesión vuelve a tu plan.';
    if (!window.confirm(msg)) return;
    act(async () => (await api(`/reservations/${reservationId}`, { method: 'DELETE' })).message, slotId);
  };

  if (!memberships) {
    return notice?.type === 'error' ? (
      <div className="mx-auto max-w-md p-10"><ErrorNote>{notice.text}</ErrorNote></div>
    ) : (
      <PageLoader />
    );
  }

  const firstName = user.full_name.split(' ')[0];
  const reservationLabel = (r) => (r.is_evaluation ? EVALUATION_LABEL : CLASS_TYPES[r.class_type].label);

  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-30 border-b border-ink-700 bg-black/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link to="/"><Logo variant="wordmark" className="h-6 w-auto" /></Link>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-bone-muted hover:text-bone">
            <LogOut className="h-4 w-4" /> Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-5 pt-10">
        <div className="animate-rise">
          <p className="eyebrow">Mi cuenta</p>
          <h1 className="mt-3 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">
            Hola, {firstName}.
            {(status.founder || status.client_type === 'founder_guest') && <ClientTypeBadge type={status.client_type} />}
          </h1>
        </div>

        {founderMembership && (
          <section className="card relative overflow-hidden border-seed/40 p-6">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-seed/15 blur-3xl" />
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-seed">
              <Sprout className="h-4 w-4" /> Founder
            </p>
            <p className="mt-1 text-lg font-semibold">{founderMembership.plan_name}</p>
            <p className="mt-1 text-sm text-bone-muted">Vigente hasta el {formatDay(founderMembership.end_date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <ul className="mt-4 grid gap-2 text-sm text-bone-muted sm:grid-cols-2">
              <li>· Tarifas exclusivas Founder{status.bonus_active && ' con bono mensual'}</li>
              <li>· Reservas con {status.booking_horizon_days} días de anticipación</li>
              <li>· Horarios Founders Only</li>
              <li>· Un invitado con tarifa Founder</li>
              <li>· Congelamiento flexible: {status.freeze_policy.maxFreezes} veces, hasta {status.freeze_policy.maxDays} días por plan</li>
            </ul>
            {status.bonus_active && (
              <p className="mt-4 text-xs text-bone-dim">Tu bono mensual se mantiene mientras renueves tu plan mes a mes.</p>
            )}
          </section>
        )}

        {/* Plan */}
        <section className="grid gap-4 md:grid-cols-2">
          {sessionPlans.length === 0 ? (
            <div className="card relative overflow-hidden p-6 md:col-span-2">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-seed/15 blur-3xl" />
              <p className="text-lg font-semibold">Aún no tienes un plan activo</p>
              <p className="mt-2 max-w-xl text-sm text-bone-muted">
                Escríbenos para elegir tu modalidad y activar tu plan. Mientras tanto puedes ver los horarios disponibles.
              </p>
              {evaluationCredit > 0 && (
                <p className="mt-3 text-sm text-emerald-300">
                  Tienes {formatMoney(evaluationCredit)} de tu valoración abonados a tu primer plan.
                </p>
              )}
              <a
                href={whatsappLink(`Hola, soy ${user.full_name} y quiero activar mi plan en Árbol`)}
                target="_blank"
                rel="noreferrer"
                className="btn-primary mt-5"
              >
                <MessageCircle className="h-4 w-4" /> Activar mi plan
              </a>
            </div>
          ) : (
            sessionPlans.map((m) => {
              const remaining = m.sessions_total - m.sessions_used;
              const upcomingPlan = m.start_date > todayKey();
              const activeFreeze = m.freezes.find((f) => f.end_date >= todayKey());
              return (
                <div key={m.id} className="card p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-bone-muted">
                        Plan activo
                        {upcomingPlan && ` · desde ${formatDay(m.start_date, { day: 'numeric', month: 'short' })}`}
                      </p>
                      <p className="mt-1 text-lg font-semibold">{m.plan_name}</p>
                    </div>
                    {m.payment_status === 'pending' && <Badge tone="amber">Pago pendiente</Badge>}
                  </div>
                  <div className="mt-6 flex items-end justify-between">
                    <p>
                      <span className="text-4xl font-semibold">{remaining}</span>
                      <span className="text-bone-muted"> / {m.sessions_total} sesiones</span>
                    </p>
                    <p className={`text-sm ${m.days_left <= 5 ? 'text-red-400' : 'text-bone-muted'}`}>
                      Vence {formatDay(m.end_date, { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={m.sessions_used} max={m.sessions_total} danger={remaining <= 1} />
                  </div>
                  {activeFreeze && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-sky-300">
                      <Snowflake className="h-3.5 w-3.5" />
                      Congelado del {formatDay(activeFreeze.start_date, { day: 'numeric', month: 'short' })} al{' '}
                      {formatDay(activeFreeze.end_date, { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {m.class_type === 'personal' && (
                      <a href={personalLink} target="_blank" rel="noreferrer" className="btn-primary btn-sm">
                        <MessageCircle className="h-4 w-4" /> Agendar sesión 1:1
                      </a>
                    )}
                    <button className="btn-ghost btn-sm" onClick={() => setFreezing(m)}>
                      <Snowflake className="h-4 w-4" /> Congelar plan
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        {notice && (
          notice.type === 'error' ? (
            <ErrorNote>{notice.text}</ErrorNote>
          ) : (
            <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">{notice.text}</p>
          )
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold">Próximas sesiones</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.map((r) => (
                <div key={r.id} className="card flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-seed/15 text-seed">
                      <span className="text-[10px] uppercase">{formatDate(r.starts_at, { weekday: 'short' })}</span>
                      <span className="text-lg font-semibold leading-none">{formatDate(r.starts_at, { day: 'numeric' })}</span>
                    </div>
                    <div>
                      <p className="font-medium">{formatTime(r.starts_at)}</p>
                      <p className="text-xs text-bone-muted">
                        {reservationLabel(r)}
                        {r.is_evaluation && r.evaluation_payment === 'pending' && ` · ${formatMoney(r.evaluation_amount)} por pagar`}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn-ghost btn-sm"
                    disabled={busySlot !== null}
                    onClick={() => cancel(r.id, null, r.starts_at, r.is_evaluation)}
                  >
                    Cancelar
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Schedule */}
        <section>
          <div className="mb-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className="h-5 w-5 text-seed" /> Reservar clase
            </h2>
            <p className="mt-1 text-sm text-bone-muted">
              FLEX · máximo 6 atletas por clase
              {status.founder && ` · como Founder reservas con ${horizon} días de anticipación`}
            </p>
          </div>

          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none]">
            {days.map((d) => {
              const active = d === selectedDay;
              const count = slots.filter((s) => dayKey(s.starts_at) === d).length;
              return (
                <button
                  key={d}
                  onClick={() => setSelectedDay(d)}
                  className={`flex min-w-[64px] flex-col items-center rounded-2xl border px-3 py-3 transition ${
                    active ? 'border-seed bg-seed/15 text-bone' : 'border-ink-700 bg-ink-900 text-bone-muted hover:border-ink-500'
                  } ${count === 0 ? 'opacity-40' : ''}`}
                >
                  <span className="text-[11px] uppercase">{formatDay(d, { weekday: 'short' })}</span>
                  <span className="mt-1 text-xl font-semibold">{formatDay(d, { day: 'numeric' })}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {daySlots.length === 0 && (
              <div className="sm:col-span-2 lg:col-span-3">
                <EmptyState icon={Clock} title="Sin clases este día">Prueba con otro día.</EmptyState>
              </div>
            )}
            {daySlots.map((slot) => {
              const past = new Date(slot.starts_at) <= new Date();
              const full = slot.taken >= slot.capacity;
              const mine = Boolean(slot.my_reservation_id);
              const spots = slot.capacity - slot.taken;
              return (
                <div
                  key={slot.id}
                  className={`card flex items-center justify-between p-4 transition ${mine ? 'border-seed/60 bg-seed/5' : ''} ${past ? 'opacity-40' : ''}`}
                >
                  <div>
                    <p className="text-lg font-semibold">{formatTime(slot.starts_at)}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-bone-muted">
                      <Users className="h-3.5 w-3.5" />
                      {slot.capacity === 1
                        ? full ? 'Ocupado' : 'Disponible'
                        : `${spots} de ${slot.capacity} cupos`}
                    </p>
                    {slot.founders_only && <Badge tone="red" className="mt-1.5">Founders Only</Badge>}
                  </div>
                  {busySlot === slot.id ? (
                    <Spinner />
                  ) : mine ? (
                    <button
                      className="btn-ghost btn-sm"
                      onClick={() => cancel(slot.my_reservation_id, slot.id, slot.starts_at)}
                    >
                      Cancelar
                    </button>
                  ) : (
                    <button
                      className="btn-primary btn-sm"
                      disabled={past || full || busySlot !== null}
                      onClick={() => book(slot)}
                    >
                      {full ? 'Lleno' : 'Reservar'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {!hasUpcomingEvaluation && (
          <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <Activity className="h-4 w-4 text-seed" /> {EVALUATION_LABEL}
              </p>
              <p className="mt-1 text-sm text-bone-muted">
                Sesión 1:1 para evaluar tu movimiento y probar Árbol · {formatMoney(EVALUATION_PRICE)}, abonables a tu plan.
              </p>
            </div>
            <button className="btn-primary shrink-0" onClick={() => setEvaluationOpen(true)}>
              Agendar valoración
            </button>
          </section>
        )}

        {!hasPersonalPlan && (
          <section className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">¿Prefieres entrenar 1:1?</p>
              <p className="mt-1 text-sm text-bone-muted">
                Las sesiones personalizadas se agendan directamente con tu coach para encontrar tu mejor horario.
              </p>
            </div>
            <a href={personalLink} target="_blank" rel="noreferrer" className="btn-ghost shrink-0">
              <MessageCircle className="h-4 w-4" /> Escribir por WhatsApp
            </a>
          </section>
        )}

        {/* History */}
        {history.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-semibold">Historial reciente</h2>
            <div className="card divide-y divide-ink-700">
              {history.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span>
                    {formatDate(r.starts_at)} · {formatTime(r.starts_at)}{' '}
                    <span className="text-bone-dim">· {r.is_evaluation ? 'Valoración' : CLASS_TYPES[r.class_type].short}</span>
                  </span>
                  <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <Modal open={Boolean(confirmation)} onClose={() => setConfirmation(null)} title="¡Reserva confirmada!">
        {confirmation && (
          <div className="space-y-5">
            <p className="text-sm text-bone-muted">
              Tu cita quedó para el <span className="capitalize text-bone">{confirmation.when}</span>. Envíanos la
              confirmación por WhatsApp para que tu coach te tenga en la lista.
            </p>
            <a href={confirmation.link} target="_blank" rel="noreferrer" className="btn-primary w-full py-3">
              <MessageCircle className="h-4 w-4" /> Enviar confirmación por WhatsApp
            </a>
            <button className="btn-ghost w-full" onClick={() => setConfirmation(null)}>
              Listo
            </button>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(freezing)} onClose={() => setFreezing(null)} title="Congelar plan">
        {freezing && (
          <FreezeRequest
            membership={freezing}
            policy={status.freeze_policy}
            onDone={async (text) => {
              setFreezing(null);
              setNotice({ type: 'ok', text });
              await load();
            }}
          />
        )}
      </Modal>

      <Modal open={evaluationOpen} onClose={() => setEvaluationOpen(false)} title={EVALUATION_LABEL}>
        {evaluationOpen && <EvaluationPicker onBook={bookEvaluation} />}
      </Modal>
    </div>
  );
}
