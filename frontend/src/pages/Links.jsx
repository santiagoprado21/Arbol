import { Link } from 'react-router-dom';
import { ArrowRight, Globe, Instagram, MessageCircle } from 'lucide-react';
import Logo from '../components/Logo';
import { whatsappLink } from '../lib/format';

export default function Links() {
  const instagram = import.meta.env.VITE_INSTAGRAM;
  const links = [
    { href: '/', icon: Globe, label: 'Entrar a la página', internal: true, primary: true },
    instagram && { href: `https://instagram.com/${instagram}`, icon: Instagram, label: 'Instagram', sub: `@${instagram}` },
    { href: whatsappLink('Hola Árbol, vi su QR y quiero más información'), icon: MessageCircle, label: 'WhatsApp', sub: 'Escríbenos' },
  ].filter(Boolean);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      <div className="absolute inset-0 bg-grid [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-seed/10 blur-[120px]" />

      <div className="relative w-full max-w-sm animate-rise text-center">
        <Logo variant="icon" className="mx-auto w-32" />
        <Logo variant="wordmark" className="mx-auto mt-6 h-7 w-auto" />
        <p className="eyebrow mt-3">Private Studio</p>
        <p className="mt-6 text-bone-muted">Entrena con intención. Crece desde la raíz.</p>

        <div className="mt-10 space-y-3">
          {links.map(({ href, icon: Icon, label, sub, internal, primary }) => {
            const className = `flex w-full items-center gap-4 rounded-2xl border px-5 py-4 text-left transition ${
              primary ? 'border-seed bg-seed text-white hover:bg-seed/90' : 'border-ink-600 bg-ink-900 hover:border-ink-500'
            }`;
            const content = (
              <>
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">
                  <span className="block font-medium">{label}</span>
                  {sub && <span className={`block text-xs ${primary ? 'text-white/80' : 'text-bone-dim'}`}>{sub}</span>}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
              </>
            );
            return internal ? (
              <Link key={label} to={href} className={className}>{content}</Link>
            ) : (
              <a key={label} href={href} target="_blank" rel="noreferrer" className={className}>{content}</a>
            );
          })}
        </div>
        <p className="mt-10 text-xs text-bone-dim">© {new Date().getFullYear()} Árbol Private Studio</p>
      </div>
    </div>
  );
}
