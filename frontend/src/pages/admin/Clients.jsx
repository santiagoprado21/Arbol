import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import { ALERT_TONES, Badge, EmptyState, ErrorNote, PageLoader, ProgressBar } from '../../components/ui';
import { api } from '../../lib/api';
import { formatDay } from '../../lib/format';

const FILTERS = [
  ['all', 'Todos'],
  ['attention', 'Requieren atención'],
  ['ok', 'Al día'],
  ['no_plan', 'Sin plan'],
  ['founder', 'Founders'],
];

export default function Clients() {
  const [clients, setClients] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api('/admin/clients').then((d) => setClients(d.clients)).catch((e) => setError(e.message));
  }, []);

  const visible = useMemo(() => {
    if (!clients) return [];
    const term = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (term && ![c.full_name, c.email, c.cedula, c.phone].some((v) => v?.toLowerCase().includes(term))) return false;
      if (filter === 'attention') return ['expired', 'pending', 'expiring'].includes(c.alert.code);
      if (filter === 'founder') return c.client_type === 'founder';
      if (filter !== 'all') return c.alert.code === filter;
      return true;
    });
  }, [clients, q, filter]);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!clients) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Clientes" subtitle={`${clients.length} atletas registrados`} />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-bone-dim" />
          <input
            className="input pl-10"
            placeholder="Buscar por nombre, cédula, correo o teléfono"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full border px-3.5 py-1.5 text-xs transition ${
                filter === value ? 'border-bone bg-bone text-ink-950' : 'border-ink-600 text-bone-muted hover:text-bone'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Users} title="No hay clientes que coincidan" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-bone-dim">
                <tr>
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium">Sesiones</th>
                  <th className="px-5 py-3 font-medium">Vence</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700">
                {visible.map((c) => {
                  const remaining = c.membership_id ? c.sessions_total - c.sessions_used : null;
                  return (
                    <tr key={c.id} className="transition hover:bg-ink-800">
                      <td className="px-5 py-3.5">
                        <Link to={`/admin/clientes/${c.id}`} className="group block">
                          <p className="font-medium group-hover:text-seed">
                            {c.full_name}
                            {c.client_type === 'founder' && (
                              <Badge tone="white" className="ml-2 align-middle">Founder</Badge>
                            )}
                            {c.status !== 'active' && <Badge className="ml-2 align-middle">{c.status === 'paused' ? 'Pausa' : 'Inactivo'}</Badge>}
                          </p>
                          <p className="text-xs text-bone-dim">{c.phone} · CC {c.cedula}</p>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-bone-muted">{c.plan_name || '—'}</td>
                      <td className="w-44 px-5 py-3.5">
                        {remaining === null ? (
                          <span className="text-bone-dim">—</span>
                        ) : (
                          <div>
                            <p className="mb-1.5 text-xs">
                              <span className="font-semibold text-bone">{remaining}</span>
                              <span className="text-bone-dim"> de {c.sessions_total} restantes</span>
                            </p>
                            <ProgressBar value={c.sessions_used} max={c.sessions_total} danger={remaining <= 1} />
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-bone-muted">{c.end_date ? formatDay(c.end_date) : '—'}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={ALERT_TONES[c.alert.code]}>{c.alert.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
