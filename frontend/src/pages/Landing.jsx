import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  Clock,
  Dumbbell,
  HeartPulse,
  Instagram,
  MessageCircle,
  ShieldCheck,
  Target,
  UserPlus,
  Users,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Logo, { SeedMark } from '../components/Logo';
import { api } from '../lib/api';
import { formatMoney, whatsappLink } from '../lib/format';

const FALLBACK_PLANS = [
  { id: 'p4', class_type: 'personal', sessions: 4, price_regular: 300000 },
  { id: 'p8', class_type: 'personal', sessions: 8, price_regular: 580000 },
  { id: 'p12', class_type: 'personal', sessions: 12, price_regular: 810000 },
  { id: 's4', class_type: 'semi', sessions: 4, price_regular: 160000 },
  { id: 's8', class_type: 'semi', sessions: 8, price_regular: 280000 },
  { id: 's12', class_type: 'semi', sessions: 12, price_regular: 390000 },
];

const MODALITIES = [
  {
    type: 'personal',
    icon: Target,
    title: 'Personalizado 1:1',
    tag: '100% para ti',
    text: 'Un coach dedicado exclusivamente a ti durante toda la sesión. Programación individual, técnica milimétrica y progreso medido semana a semana.',
    points: ['Plan diseñado sobre tu historial y objetivos', 'Corrección técnica constante', 'Horario a tu medida: lo cuadramos por WhatsApp'],
  },
  {
    type: 'semi',
    icon: Users,
    title: 'Semi-personalizado',
    tag: 'Máximo 6 personas',
    text: 'La energía de entrenar acompañado sin perder la atención personalizada. Grupos reducidos donde cada atleta sigue su propia progresión.',
    points: ['Cupo máximo de 6 atletas por franja', 'Cargas y variantes adaptadas a cada persona', 'Comunidad que empuja'],
  },
];

const STEPS = [
  { icon: UserPlus, title: 'Crea tu perfil', text: 'Regístrate con tus datos y tu información de salud. Así sabemos desde dónde partimos.' },
  { icon: ShieldCheck, title: 'Activa tu plan', text: 'Elige modalidad y número de sesiones. Activamos tu plan apenas confirmamos el pago.' },
  {
    icon: CalendarCheck,
    title: 'Reserva tu horario',
    text: 'En semi-personalizado apartas tu cupo desde la app. En 1:1 cuadramos contigo el mejor horario por WhatsApp.',
  },
  { icon: Dumbbell, title: 'Entrena', text: 'Llega, entrena con tu coach y deja que el proceso haga lo suyo.' },
];

export default function Landing() {
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [planType, setPlanType] = useState('semi');

  useEffect(() => {
    api('/plans')
      .then(({ plans }) => plans.length && setPlans(plans))
      .catch(() => {});
  }, []);

  const visiblePlans = plans.filter((p) => p.class_type === planType);
  const instagram = import.meta.env.VITE_INSTAGRAM;

  return (
    <div className="overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative flex min-h-screen items-center pt-16">
        <div className="absolute inset-0 bg-grid [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        <div className="absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-seed/10 blur-[120px]" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.2fr_1fr]">
          <div className="animate-rise">
            <p className="eyebrow flex items-center gap-3">
              <span className="h-px w-8 bg-seed" /> Private Studio
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Entrena con intención.
              <br />
              <span className="text-bone-muted">Crece desde la raíz.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-bone-muted">
              Árbol es un gimnasio privado donde cada sesión está pensada para ti. Entrenamiento 100% personalizado o en
              grupos reducidos de máximo 6 personas — sin multitudes, sin esperas, sin improvisar.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/registro" className="btn-primary px-7 py-3 text-base">
                Quiero entrenar <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={whatsappLink('Hola Árbol, quiero conocer más sobre el estudio')}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost px-7 py-3 text-base"
              >
                <MessageCircle className="h-4 w-4" /> Hablemos
              </a>
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-sm animate-rise [animation-delay:150ms] lg:block">
            <div className="absolute inset-6 rounded-full border border-ink-700" />
            <div className="absolute inset-16 rounded-full border border-ink-700/60" />
            <Logo variant="icon" className="relative w-full" />
          </div>
        </div>

        <a
          href="#estudio"
          className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-bone-dim sm:flex"
        >
          <span className="eyebrow text-[9px]">Descubre</span>
          <span className="h-10 w-px bg-gradient-to-b from-bone-dim to-transparent" />
        </a>
      </section>

      {/* Highlights */}
      <section className="border-y border-ink-700 bg-ink-900/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 divide-ink-700 px-5 md:grid-cols-4 md:divide-x">
          {[
            ['6', 'Atletas máximo por grupo'],
            ['1:1', 'Coaching dedicado'],
            ['12h', 'Para cancelar sin costo'],
            ['24/7', 'Reservas desde la app'],
          ].map(([n, label]) => (
            <div key={label} className="px-4 py-8 text-center">
              <p className="font-display text-2xl text-bone sm:text-3xl">{n}</p>
              <p className="mt-2 text-xs uppercase tracking-wider text-bone-dim">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="estudio" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
        <div className="grid gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow">El estudio</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Un espacio privado, diseñado para el rendimiento.
            </h2>
          </div>
          <div className="space-y-5 text-bone-muted">
            <p className="text-lg leading-relaxed">
              Como un árbol, el rendimiento real crece desde raíces firmes: técnica, constancia y acompañamiento. En Árbol
              no eres un número más: tu coach conoce tu historia, tus lesiones y tus metas.
            </p>
            <div className="grid gap-4 pt-4 sm:grid-cols-2">
              {[
                [HeartPulse, 'Salud primero', 'Evaluamos tu historial antes de tu primera sesión.'],
                [Clock, 'Tu tiempo vale', 'Horario reservado: llegas y entrenas, sin filas por máquinas.'],
              ].map(([Icon, title, text]) => (
                <div key={title} className="card p-5">
                  <Icon className="h-5 w-5 text-seed" />
                  <p className="mt-3 font-medium text-bone">{title}</p>
                  <p className="mt-1 text-sm">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Modalities */}
      <section id="modalidades" className="scroll-mt-20 border-t border-ink-700 bg-ink-900/40 py-28">
        <div className="mx-auto max-w-6xl px-5">
          <p className="eyebrow">Modalidades</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Dos formas de entrenar. El mismo estándar.
          </h2>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {MODALITIES.map(({ type, icon: Icon, title, tag, text, points }) => (
              <article
                key={type}
                className="group card relative overflow-hidden p-8 transition duration-300 hover:border-ink-500"
              >
                <SeedMark className="absolute right-6 top-6 h-4 w-10 text-seed opacity-0 transition group-hover:opacity-100" />
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-700">
                  <Icon className="h-6 w-6 text-bone" />
                </div>
                <p className="mt-6 text-xs font-medium uppercase tracking-wider text-seed">{tag}</p>
                <h3 className="mt-2 text-2xl font-semibold">{title}</h3>
                <p className="mt-4 leading-relaxed text-bone-muted">{text}</p>
                <ul className="mt-6 space-y-2.5">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm text-bone-muted">
                      <span className="mt-2 h-1 w-3 shrink-0 bg-seed" /> {p}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="planes" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Planes mensuales</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Elige tu ritmo.</h2>
          </div>
          <div className="inline-flex rounded-full border border-ink-600 p-1">
            {[
              ['semi', 'Semi-personalizado'],
              ['personal', 'Personalizado 1:1'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setPlanType(value)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  planType === value ? 'bg-bone text-ink-950' : 'text-bone-muted hover:text-bone'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {visiblePlans.map((plan, i) => {
            const featured = i === 1;
            return (
              <div
                key={plan.id}
                className={`card relative flex flex-col p-8 ${featured ? 'border-seed/50 bg-gradient-to-b from-seed/10 to-transparent' : ''}`}
              >
                {featured && <span className="absolute -top-3 left-8 badge bg-seed text-white">Más elegido</span>}
                <p className="text-sm text-bone-muted">
                  {planType === 'semi' ? 'Semi-personalizado' : 'Personalizado 1:1'}
                </p>
                <p className="mt-2 text-2xl font-semibold">{plan.sessions} sesiones / mes</p>
                <p className="mt-6 text-4xl font-semibold tracking-tight">{formatMoney(plan.price_regular)}</p>
                <p className="mt-1 text-xs text-bone-dim">
                  {formatMoney(Math.round(plan.price_regular / plan.sessions))} por sesión
                </p>
                {planType === 'personal' ? (
                  <a
                    href={whatsappLink(`Hola, quiero el plan Personalizado 1:1 de ${plan.sessions} sesiones y cuadrar mi horario`)}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-8 ${featured ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    <MessageCircle className="h-4 w-4" /> Agendar por WhatsApp
                  </a>
                ) : (
                  <Link to="/registro" className={`mt-8 ${featured ? 'btn-primary' : 'btn-ghost'}`}>
                    Empezar
                  </Link>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-sm text-bone-dim">
          ¿Quieres ser parte de los <span className="text-bone">Founders</span>, la primera generación de Árbol con tarifa preferencial?{' '}
          <a href={whatsappLink('Hola, quiero información sobre la membresía Founder')} target="_blank" rel="noreferrer" className="text-bone underline decoration-seed underline-offset-4">
            Pregúntanos
          </a>
          .
        </p>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="scroll-mt-20 border-t border-ink-700 bg-ink-900/40 py-28">
        <div className="mx-auto max-w-6xl px-5">
          <p className="eyebrow">Cómo funciona</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">De registro a tu primera sesión.</h2>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className="relative">
                <p className="font-display text-5xl text-ink-600">0{i + 1}</p>
                <Icon className="mt-4 h-5 w-5 text-seed" />
                <p className="mt-3 font-medium">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-bone-muted">{text}</p>
              </div>
            ))}
          </div>

          <div className="card mt-16 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
            <Clock className="h-6 w-6 shrink-0 text-seed" />
            <p className="text-sm text-bone-muted">
              <span className="font-medium text-bone">Política de reservas:</span> puedes cancelar sin costo hasta 12
              horas antes de tu clase. Cancelaciones tardías o inasistencias descuentan la sesión de tu plan.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-32">
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-seed/10 blur-[100px]" />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <Logo variant="studio" className="mx-auto w-full max-w-md" />
          <h2 className="mt-10 text-3xl font-semibold tracking-tight sm:text-4xl">Tu lugar te está esperando.</h2>
          <p className="mt-4 text-bone-muted">Los cupos son limitados por diseño. Crea tu perfil y empieza.</p>
          <Link to="/registro" className="btn-primary mt-10 px-8 py-3 text-base">
            Crear mi perfil <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink-700">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row">
          <Logo variant="wordmark" className="h-5 w-auto" />
          <div className="flex items-center gap-5 text-bone-muted">
            <a href={whatsappLink()} target="_blank" rel="noreferrer" className="hover:text-bone" aria-label="WhatsApp">
              <MessageCircle className="h-5 w-5" />
            </a>
            {instagram && (
              <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noreferrer" className="hover:text-bone" aria-label="Instagram">
                <Instagram className="h-5 w-5" />
              </a>
            )}
          </div>
          <p className="text-xs text-bone-dim">© {new Date().getFullYear()} Árbol Private Studio</p>
        </div>
      </footer>
    </div>
  );
}
