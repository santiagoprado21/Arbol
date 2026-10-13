import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { CalendarClock, CalendarDays, LayoutDashboard, LogOut, Menu, Tags, Users, X } from 'lucide-react';
import Logo from '../../components/Logo';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { to: '/admin', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/clientes', icon: Users, label: 'Clientes' },
  { to: '/admin/agenda', icon: CalendarDays, label: 'Agenda del día' },
  { to: '/admin/horarios', icon: CalendarClock, label: 'Horarios' },
  { to: '/admin/planes', icon: Tags, label: 'Planes y precios' },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="px-6 py-6">
        <Logo variant="wordmark" className="h-6 w-auto" />
        <p className="eyebrow mt-2 text-[9px]">Panel administrativo</p>
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isActive ? 'bg-ink-700 text-bone' : 'text-bone-muted hover:bg-ink-800 hover:text-bone'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-4 w-4 ${isActive ? 'text-seed' : ''}`} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-ink-700 p-4">
        <p className="truncate text-sm font-medium">{user.full_name}</p>
        <p className="truncate text-xs text-bone-dim">{user.email}</p>
        <button onClick={logout} className="mt-3 flex items-center gap-2 text-xs text-bone-muted hover:text-bone">
          <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-ink-700 bg-ink-900 lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink-700 bg-black/90 px-4 backdrop-blur lg:hidden">
        <Logo variant="wordmark" className="h-5 w-auto" />
        <button onClick={() => setOpen(true)} aria-label="Menú">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-ink-700 bg-ink-900">
            <button className="absolute right-4 top-6" onClick={() => setOpen(false)} aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-bone-muted">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
