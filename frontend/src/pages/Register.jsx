import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { ErrorNote, Field, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const EMPTY = {
  full_name: '',
  cedula: '',
  phone: '',
  email: '',
  password: '',
  medical_notes: '',
  accept_terms: false,
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) =>
    setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Registro de atleta"
      subtitle="Cuéntanos quién eres. Esta información es confidencial y solo la ve tu coach."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/ingresar" className="text-bone underline decoration-seed underline-offset-4">
            Ingresa
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nombre completo">
          <input required className="input" value={form.full_name} onChange={set('full_name')} autoComplete="name" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cédula">
            <input required inputMode="numeric" className="input" value={form.cedula} onChange={set('cedula')} />
          </Field>
          <Field label="WhatsApp">
            <input required type="tel" className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="300 000 0000" />
          </Field>
        </div>
        <Field label="Correo">
          <input required type="email" className="input" value={form.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <Field label="Contraseña" hint="Mínimo 6 caracteres">
          <input required type="password" minLength={6} className="input" value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <Field label="Observaciones médicas / lesiones">
          <textarea
            rows={3}
            className="input resize-none"
            placeholder="Lesiones, cirugías, condiciones o medicamentos que debamos conocer. Si no aplica, déjalo vacío."
            value={form.medical_notes}
            onChange={set('medical_notes')}
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-600 bg-ink-850 p-4">
          <input
            type="checkbox"
            required
            checked={form.accept_terms}
            onChange={set('accept_terms')}
            className="mt-0.5 h-4 w-4 shrink-0 accent-seed"
          />
          <span className="text-xs leading-relaxed text-bone-muted">
            Acepto las políticas de reserva, las reglas de cancelación y no-show (12 horas) y la exoneración médica de
            Árbol Private Studio. Declaro que la información de salud suministrada es veraz.
          </span>
        </label>

        <ErrorNote>{error}</ErrorNote>
        <button className="btn-primary w-full py-3" disabled={busy}>
          {busy ? <Spinner className="h-4 w-4 text-white" /> : 'Crear mi perfil'}
        </button>
      </form>
    </AuthLayout>
  );
}
