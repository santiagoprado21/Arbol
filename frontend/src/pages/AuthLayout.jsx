import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-16">
      <div className="absolute inset-0 bg-grid [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-seed/10 blur-[100px]" />

      <Link to="/" className="absolute left-5 top-5 flex items-center gap-2 text-sm text-bone-muted hover:text-bone">
        <ArrowLeft className="h-4 w-4" /> Inicio
      </Link>

      <div className="relative w-full max-w-md animate-rise">
        <Link to="/" className="mb-10 block">
          <Logo variant="wordmark" className="mx-auto h-8 w-auto" />
        </Link>
        <div className="card bg-ink-900/90 p-7 backdrop-blur sm:p-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-bone-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-sm text-bone-muted">{footer}</div>}
      </div>
    </div>
  );
}
