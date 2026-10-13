import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, LogOut, MessageCircle, Users } from 'lucide-react';
import Logo from '../../components/Logo';
import { Badge, EmptyState, ErrorNote, PageLoader, ProgressBar, Spinner } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import {
  CLASS_TYPES,
  RESERVATION_STATUS,
  addDays,
  dayKey,
  formatDate,
  formatDay,
  formatTime,
  todayKey,
  whatsappLink,
} from '../../lib/format';

const DAYS_SHOWN = 14;

export default function ClientHome() {
  const { user, logout } = useAuth();
  const [memberships, setMemberships] = useState(null);
  const [slots, setSlots] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [busySlot, setBusySlot] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    const [m, s, r] = await Promise.all([
      api('/me/memberships'),
      api(`/slots?from=${todayKey()}&days=${DAYS_SHOWN}`),
      api('/me/reservations'),
    ]);
    setMemberships(m.memberships);
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

  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(todayKey(), i)), []);
  const daySlots = slots.filter((s) => dayKey(s.starts_at) === selectedDay);
  const hasPersonalPlan = memberships?.some((m) => m.class_type === 'personal');
  const personalLink = whatsappLink(`Hola, soy ${user.full_name} y quiero agendar mi sesión personalizada 1:1`);
  const upcoming = reservations
    .filter((r) => r.status === 'booked' && new Date(r.starts_at) > new Date())
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const history = reservations.filter((r) => !upcoming.includes(r)).slice(0, 8);

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

  const book = (slot) =>
    act(async () => {
      await api('/reservations', { method: 'POST', body: { slot_id: slot.id } });
      return `Listo: reservaste ${formatDate(slot.starts_at, { weekday: 'long', day: 'numeric' })} a las ${formatTime(slot.starts_at)}.`;
    }, slot.id);

  const cancel = (reservationId, slotId, startsAt) => {
    const hours = (new Date(startsAt) - Date.now()) / 36e5;
    const msg =
      hours < 12
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
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Hola, {firstName}.</h1>
        </div>

        {/* Plan */}
        <section className="grid gap-4 md:grid-cols-2">
          {memberships.length === 0 ? (
            <div className="card relative overflow-hidden p-6 md:col-span-2">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-seed/15 blur-3xl" />
              <p className="text-lg font-semibold">Aún no tienes un plan activo</p>
              <p className="mt-2 max-w-xl text-sm text-bone-muted">
                Escríbenos para elegir tu modalidad y activar tu plan. Mientras tanto puedes ver los horarios disponibles.
              </p>
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
            memberships.map((m) => {
              const remaining = m.sessions_total - m.sessions_used;
              const upcomingPlan = m.start_date > todayKey();
              return (
                <div key={m.id} className="card p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-bone-muted">{upcomingPlan ? 'Próximo plan' : 'Plan activo'}</p>
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
                  {m.class_type === 'personal' && (
                    <a href={personalLink} target="_blank" rel="noreferrer" className="btn-primary btn-sm mt-5">
                      <MessageCircle className="h-4 w-4" /> Agendar sesión 1:1
                    </a>
                  )}
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
                      <p className="text-xs text-bone-muted">{CLASS_TYPES[r.class_type].label}</p>
                    </div>
                  </div>
                  <button
                    className="btn-ghost btn-sm"
                    disabled={busySlot !== null}
                    onClick={() => cancel(r.id, null, r.starts_at)}
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
            <p className="mt-1 text-sm text-bone-muted">Semi-personalizado · máximo 6 atletas por clase</p>
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
                    <span className="text-bone-dim">· {CLASS_TYPES[r.class_type].short}</span>
                  </span>
                  <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
