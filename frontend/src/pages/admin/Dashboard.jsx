import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarCheck, CircleDollarSign, Clock, TrendingUp, UserCheck, Users, Wallet } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { ALERT_TONES, Badge, EmptyState, ErrorNote, PageLoader, ProgressBar, StatCard } from '../../components/ui';
import { api } from '../../lib/api';
import { CLASS_TYPES, formatDay, formatMoney } from '../../lib/format';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-850 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 text-bone-muted">{formatDay(label, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/admin/stats').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return <PageLoader />;

  const { clients, attendance, today } = data;
  const attendanceTotal = attendance.attended + attendance.no_show;
  const attendanceRate = attendanceTotal ? Math.round((attendance.attended / attendanceTotal) * 100) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' })}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Clientes" value={clients.total} sub={`${clients.founder} Founders · ${clients.new_this_month} nuevos este mes`} />
        <StatCard icon={UserCheck} label="Con plan activo" value={clients.active} sub={`${clients.without_plan} sin plan`} />
        <StatCard icon={CircleDollarSign} label="Ingresos del mes" value={formatMoney(data.revenue_month)} sub="Pagos confirmados" />
        <StatCard
          icon={Wallet}
          label="Pagos pendientes"
          value={data.pending_payments.n}
          sub={formatMoney(data.pending_payments.total)}
          accent={data.pending_payments.n > 0}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={CalendarCheck}
          label="Reservas hoy"
          value={`${today.booked} / ${today.capacity}`}
          sub={`${today.slots} franjas programadas`}
        />
        <StatCard
          icon={TrendingUp}
          label="Asistencia 30 días"
          value={attendanceRate === null ? '—' : `${attendanceRate}%`}
          sub={`${attendance.no_show} inasistencias · ${attendance.late_cancel} cancelaciones tardías`}
        />
        <StatCard icon={Clock} label="Vencen en 7 días" value={data.expiring_soon} sub="Planes por renovar" accent={data.expiring_soon > 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <p className="font-medium">Reservas y asistencia</p>
          <p className="text-xs text-bone-dim">Últimos 14 días</p>
          <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ left: -20, right: 8 }}>
                <defs>
                  <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f5f5f4" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#f5f5f4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gAtt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e30613" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#e30613" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f1f1f" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => formatDay(d, { day: 'numeric', month: 'short' })}
                  stroke="#525252"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis allowDecimals={false} stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="reservations" name="Reservas" stroke="#f5f5f4" fill="url(#gRes)" strokeWidth={2} />
                <Area type="monotone" dataKey="attended" name="Asistieron" stroke="#e30613" fill="url(#gAtt)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <p className="font-medium">Ocupación próximos 7 días</p>
          <p className="text-xs text-bone-dim">Cupos reservados vs. disponibles</p>
          <div className="mt-6 space-y-6">
            {data.occupancy.length === 0 && <p className="text-sm text-bone-muted">No hay horarios programados.</p>}
            {data.occupancy.map((o) => {
              const pct = o.capacity ? Math.round((o.booked / o.capacity) * 100) : 0;
              return (
                <div key={o.class_type}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span>{CLASS_TYPES[o.class_type].label}</span>
                    <span className="text-bone-muted">{pct}%</span>
                  </div>
                  <ProgressBar value={o.booked} max={o.capacity} danger={pct >= 85} />
                  <p className="mt-1.5 text-xs text-bone-dim">
                    {o.booked} de {o.capacity} cupos
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between border-b border-ink-700 px-6 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-seed" />
            <p className="font-medium">Requieren atención</p>
          </div>
          <Link to="/admin/clientes" className="text-xs text-bone-muted hover:text-bone">
            Ver todos →
          </Link>
        </div>
        {data.attention.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Todo al día">Ningún cliente con pagos pendientes o planes por vencer.</EmptyState>
          </div>
        ) : (
          <div className="divide-y divide-ink-700">
            {data.attention.map((c) => (
              <Link
                key={c.id}
                to={`/admin/clientes/${c.id}`}
                className="flex items-center justify-between gap-4 px-6 py-3.5 transition hover:bg-ink-800"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.full_name}</p>
                  <p className="truncate text-xs text-bone-dim">
                    {c.plan_name} · {c.sessions_total - c.sessions_used} sesiones restantes · vence {formatDay(c.end_date)}
                  </p>
                </div>
                <Badge tone={ALERT_TONES[c.alert.code]}>{c.alert.label}</Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
