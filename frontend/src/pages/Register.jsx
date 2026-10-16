import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from './AuthLayout';
import { ErrorNote, Field, Modal, Spinner } from '../components/ui';
import Terms from '../components/Terms';
import { useAuth } from '../context/AuthContext';

const EMPTY = {
  full_name: '',
  cedula: '',
  phone: '',
  email: '',
  password: '',
  medical_notes: '',
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const set = (key) => (e) =>
    setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const onSubmit = (e) => {
    e.preventDefault();
    setError('');
    setShowTerms(true);
  };

  const acceptAndRegister = async () => {
    setBusy(true);
    try {
      await register({ ...form, accept_terms: true });
      navigate('/app', { replace: true });
    } catch (err) {
      setShowTerms(false);
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

        <ErrorNote>{error}</ErrorNote>
        <button className="btn-primary w-full py-3">Continuar</button>
        <p className="text-center text-xs text-bone-dim">Antes de crear tu cuenta te mostraremos los términos y condiciones.</p>
      </form>

      <Modal open={showTerms} onClose={() => !busy && setShowTerms(false)} title="Términos y condiciones" wide>
        <div className="max-h-[55vh] overflow-y-auto pr-2">
          <Terms />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button className="btn-ghost flex-1" disabled={busy} onClick={() => setShowTerms(false)}>
            Volver
          </button>
          <button className="btn-primary flex-1" disabled={busy} onClick={acceptAndRegister}>
            {busy ? <Spinner className="h-4 w-4 text-white" /> : 'Aceptar y crear mi cuenta'}
          </button>
        </div>
      </Modal>
    </AuthLayout>
  );
}
