import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../context/AuthContext';

const LINKS = [
  ['#estudio', 'El estudio'],
  ['#modalidades', 'Modalidades'],
  ['#planes', 'Planes'],
  ['#como-funciona', 'Cómo funciona'],
];

export default function Navbar() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const panelPath = user?.role === 'admin' ? '/admin' : '/app';

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
        scrolled || open ? 'border-b border-ink-700 bg-black/85 backdrop-blur-md' : 'bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to="/" className="flex items-center">
          <Logo variant="wordmark" className="h-5 w-auto sm:h-6" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="text-sm text-bone-muted transition hover:text-bone">
              {label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <Link to={panelPath} className="btn-primary btn-sm">
              {user.role === 'admin' ? 'Panel admin' : 'Mi cuenta'}
            </Link>
          ) : (
            <>
              <Link to="/ingresar" className="text-sm text-bone-muted hover:text-bone">
                Ingresar
              </Link>
              <Link to="/registro" className="btn-primary btn-sm">
                Quiero entrenar
              </Link>
            </>
          )}
        </div>

        <button className="text-bone md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menú">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="space-y-1 border-t border-ink-700 px-5 pb-6 pt-3 md:hidden">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} className="block py-2.5 text-bone-muted">
              {label}
            </a>
          ))}
          <div className="flex gap-3 pt-3">
            {user ? (
              <Link to={panelPath} className="btn-primary flex-1">
                {user.role === 'admin' ? 'Panel admin' : 'Mi cuenta'}
              </Link>
            ) : (
              <>
                <Link to="/ingresar" className="btn-ghost flex-1">
                  Ingresar
                </Link>
                <Link to="/registro" className="btn-primary flex-1">
                  Registrarme
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
