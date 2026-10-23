import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Check, ChevronLeft, ChevronRight, RotateCcw, UserPlus, X } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { Badge, EmptyState, ErrorNote, Field, Modal, PageLoader } from '../../components/ui';
import { api } from '../../lib/api';
import {
  CLASS_TYPES,
  CLIENT_TYPES,
  EVALUATION_LABEL,
  EVALUATION_PRICE,
  RESERVATION_STATUS,
  addDays,
  formatDay,
  formatMoney,
  formatTime,
  todayKey,
} from '../../lib/format';

function AddAttendee({ slot, onDone }) {
  const [clients, setClients] = useState([]);
  const [userId, setUserId] = useState('');
  const [evaluation, setEvaluation] = useState(false);
  const [error, setError] = useState('');
  const canEvaluate = slot.class_type === 'personal' && slot.attendees.length === 0;

  useEffect(() => {
    api('/admin/clients').then((d) => setClients(d.clients.filter((c) => c.status === 'active')));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const body = { slot_id: slot.id, user_id: Number(userId) };
      await api(evaluation ? '/admin/evaluations' : '/admin/reservations', { method: 'POST', body });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-bone-muted">
        {CLASS_TYPES[slot.class_type].label} · {formatTime(slot.starts_at)}
      </p>
      <Field label="Cliente">
        <select required className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Selecciona…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name} {c.plan_name ? `· ${c.plan_name}` : '· sin plan'}
            </option>
          ))}
        </select>
      </Field>
      {canEvaluate && (
        <label className="flex items-start gap-3 rounded-xl border border-ink-600 p-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-seed" checked={evaluation} onChange={(e) => setEvaluation(e.target.checked)} />
          <span>
            <span className="block text-sm font-medium">{EVALUATION_LABEL}</span>
            <span className="block text-xs text-bone-dim">
              Cobro de {formatMoney(EVALUATION_PRICE)}, no descuenta sesiones. Se abona al primer plan que compre.
            </span>
          </span>
        </label>
      )}
      <ErrorNote>{error}</ErrorNote>
      <button className="btn-primary w-full">{evaluation ? 'Agendar valoración' : 'Agregar a la clase'}</button>
    </form>
  );
}

export default function Agenda() {
  const [date, setDate] = useState(todayKey());
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(null);

  const load = useCallback(async () => {
    const d = await api(`/admin/agenda?date=${date}`);
    setSlots(d.slots);
  }, [date]);

  useEffect(() => {
    setSlots(null);
    load().catch((e) => setError(e.message));
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

  const setStatus = (r, status) => run(() => api(`/admin/reservations/${r.id}`, { method: 'PATCH', body: { status } }));

  return (
    <div>
      <PageHeader title="Agenda del día" subtitle="Controla cupos y marca la asistencia de cada sesión.">
        <div className="flex items-center gap-1 rounded-full border border-ink-600 p-1">
          <button className="rounded-full p-1.5 hover:bg-ink-700" onClick={() => setDate(addDays(date, -1))} aria-label="Día anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="date"
            className="bg-transparent px-2 text-sm outline-none"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button className="rounded-full p-1.5 hover:bg-ink-700" onClick={() => setDate(addDays(date, 1))} aria-label="Día siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {date !== todayKey() && (
          <button className="btn-ghost btn-sm" onClick={() => setDate(todayKey())}>Hoy</button>
        )}
      </PageHeader>

      <p className="mb-5 text-sm capitalize text-bone-muted">{formatDay(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <ErrorNote>{error}</ErrorNote>

      {!slots ? (
        <PageLoader />
      ) : slots.length === 0 ? (
        <EmptyState title="No hay clases programadas este día">
          Configura franjas en <Link to="/admin/horarios" className="underline">Horarios</Link>.
        </EmptyState>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {slots.map((slot) => {
            const active = slot.attendees.filter((a) => a.status !== 'late_cancel');
            const cancelled = slot.status === 'cancelled';
            const past = new Date(slot.starts_at) < new Date();
            return (
              <div key={slot.id} className={`card flex flex-col p-5 ${cancelled ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xl font-semibold">{formatTime(slot.starts_at)}</p>
                    <p className="text-xs text-bone-muted">
                      {CLASS_TYPES[slot.class_type].label}
                      {slot.founders_only && <Badge tone="red" className="ml-2">Founders Only</Badge>}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tone={active.length >= slot.capacity ? 'red' : 'gray'}>
                      {active.length}/{slot.capacity}
                    </Badge>
                    {cancelled && <p className="mt-1 text-xs text-red-400">Cancelada</p>}
                  </div>
                </div>

                <div className="mt-4 flex-1 space-y-2">
                  {slot.attendees.length === 0 && <p className="text-sm text-bone-dim">Sin reservas</p>}
                  {slot.attendees.map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-ink-850 px-3 py-2">
                      <div className="min-w-0">
                        <Link to={`/admin/clientes/${a.user_id}`} className="block truncate text-sm hover:text-seed">
                          {a.full_name}
                        </Link>
                        <span className="text-[11px] text-bone-dim">
                          {[
                            a.founder && CLIENT_TYPES[a.client_type],
                            a.client_type === 'founder_guest' && 'Invitado Founder',
                            a.is_evaluation && 'Valoración',
                            a.status !== 'booked' && RESERVATION_STATUS[a.status].label,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {a.status === 'booked' ? (
                          <>
                            <button title="Asistió" onClick={() => setStatus(a, 'attended')} className="rounded-lg p-1.5 text-emerald-400 hover:bg-emerald-500/15">
                              <Check className="h-4 w-4" />
                            </button>
                            <button title="No asistió" onClick={() => setStatus(a, 'no_show')} className="rounded-lg p-1.5 text-red-400 hover:bg-seed/15">
                              <X className="h-4 w-4" />
                            </button>
                            {!past && (
                              <button
                                title="Cancelar reserva (devuelve la sesión)"
                                onClick={() => window.confirm(`¿Cancelar la reserva de ${a.full_name}?`) && setStatus(a, 'cancelled')}
                                className="rounded-lg p-1.5 text-bone-dim hover:bg-ink-700"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <button title="Deshacer" onClick={() => setStatus(a, 'booked')} className="rounded-lg p-1.5 text-bone-dim hover:bg-ink-700">
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2 border-t border-ink-700 pt-4">
                  {!cancelled && active.length < slot.capacity && (
                    <button className="btn-ghost btn-sm flex-1" onClick={() => setAdding(slot)}>
                      <UserPlus className="h-3.5 w-3.5" /> Agregar
                    </button>
                  )}
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() =>
                      (cancelled || window.confirm('¿Cancelar esta clase? Las reservas activas se cancelarán y las sesiones se devolverán.')) &&
                      run(() => api(`/admin/slots/${slot.id}`, { method: 'PATCH', body: { status: cancelled ? 'open' : 'cancelled' } }))
                    }
                  >
                    {cancelled ? 'Reabrir' : 'Cancelar clase'}
                  </button>
                  {!cancelled && !past && (
                    <button
                      className="btn-ghost btn-sm"
                      title="Solo esta clase. Para todas las semanas, edita la franja en Horarios."
                      onClick={() => run(() => api(`/admin/slots/${slot.id}`, { method: 'PATCH', body: { founders_only: !slot.founders_only } }))}
                    >
                      {slot.founders_only ? 'Abrir a todos' : 'Founders Only'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(adding)} onClose={() => setAdding(null)} title="Agregar cliente a la clase">
        {adding && (
          <AddAttendee
            slot={adding}
            onDone={() => {
              setAdding(null);
              load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
