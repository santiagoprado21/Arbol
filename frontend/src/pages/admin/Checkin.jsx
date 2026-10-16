import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import jsQR from 'jsqr';
import { CheckCircle2, CircleAlert, Download, ExternalLink, XCircle } from 'lucide-react';
import { PageHeader } from './AdminLayout';
import QrCode, { qrDataUrl } from '../../components/QrCode';
import { ClientTypeBadge, ErrorNote, Spinner } from '../../components/ui';
import { api } from '../../lib/api';
import { CLASS_TYPES, EVALUATION_LABEL, formatDate, formatTime } from '../../lib/format';

const RESULT_HOLD_MS = 3500;
const SAME_CODE_COOLDOWN_MS = 8000;

function Scanner({ onCode }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const onCodeRef = useRef(onCode);
  const [error, setError] = useState('');
  onCodeRef.current = onCode;

  useEffect(() => {
    let stream;
    let frame;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) onCodeRef.current(code.data);
      }
      frame = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        videoRef.current.srcObject = s;
        return videoRef.current.play().then(tick);
      })
      .catch(() => setError('No pudimos abrir la cámara. Revisa que el navegador tenga permiso para usarla.'));
    if (!navigator.mediaDevices) setError('Este navegador no permite usar la cámara. Abre el panel desde el celular con Chrome o Safari.');

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-600 bg-black">
      <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />
      <div className="pointer-events-none absolute inset-[18%] rounded-3xl border-2 border-seed/80" />
      {error && <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6 text-center text-sm text-red-300">{error}</div>}
    </div>
  );
}

const RESULT_STYLES = {
  confirmed: { icon: CheckCircle2, tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300', title: 'Reserva confirmada' },
  already: { icon: CircleAlert, tone: 'border-sky-500/40 bg-sky-500/10 text-sky-300', title: 'Ya estaba confirmada' },
  no_reservation: { icon: XCircle, tone: 'border-seed/40 bg-seed/10 text-red-300', title: 'No tenía reserva' },
};

function ResultCard({ data }) {
  const style = RESULT_STYLES[data.result];
  const Icon = style.icon;
  const r = data.reservation;
  return (
    <div className={`rounded-2xl border p-5 ${style.tone}`}>
      <div className="flex items-center gap-3">
        <Icon className="h-8 w-8 shrink-0" />
        <div>
          <p className="text-lg font-semibold">{style.title}</p>
          <p className="flex flex-wrap items-center gap-2 text-bone">
            <Link to={`/admin/clientes/${data.user.id}`} className="hover:underline">{data.user.full_name}</Link>
            <ClientTypeBadge type={data.user.client_type} />
          </p>
        </div>
      </div>
      {r && (
        <p className="mt-3 text-sm text-bone-muted">
          {r.is_evaluation ? EVALUATION_LABEL : CLASS_TYPES[r.class_type].label} · {formatTime(r.starts_at)}
        </p>
      )}
      {data.result === 'no_reservation' && (
        <p className="mt-3 text-sm text-bone-muted">
          {data.next_reservation
            ? `Su próxima reserva es el ${formatDate(data.next_reservation.starts_at, { weekday: 'long', day: 'numeric', month: 'long' })} a las ${formatTime(data.next_reservation.starts_at)}.`
            : 'No tiene reservas próximas.'}{' '}
          Puedes agregarlo desde la Agenda si hay cupo.
        </p>
      )}
      {data.user.status !== 'active' && <p className="mt-2 text-xs text-amber-300">Atención: la cuenta de este atleta está en pausa o inactiva.</p>}
    </div>
  );
}

function EntranceQr() {
  const url = `${window.location.origin}/enlaces`;
  const download = async () => {
    const a = document.createElement('a');
    a.href = await qrDataUrl(url, 1200);
    a.download = 'arbol-qr-entrada.png';
    a.click();
  };
  return (
    <section className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
      <QrCode value={url} className="h-40 w-40 shrink-0 p-1" alt="QR de la entrada del gym" />
      <div className="space-y-3">
        <p className="font-medium">QR para la entrada del gym</p>
        <p className="text-sm text-bone-muted">
          Lleva a una página con accesos a la web, Instagram y WhatsApp de Árbol. Descárgalo e imprímelo para dejarlo afuera del estudio.
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary btn-sm" onClick={download}>
            <Download className="h-4 w-4" /> Descargar PNG
          </button>
          <a href="/enlaces" target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
            <ExternalLink className="h-4 w-4" /> Ver página
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Checkin() {
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const lockRef = useRef(false);
  const lastRef = useRef({ code: '', at: 0 });

  const handleCode = useCallback(async (code) => {
    const now = Date.now();
    if (lockRef.current || (code === lastRef.current.code && now - lastRef.current.at < SAME_CODE_COOLDOWN_MS)) return;
    lockRef.current = true;
    lastRef.current = { code, at: now };
    setBusy(true);
    setError('');
    try {
      const data = await api('/admin/checkin', { method: 'POST', body: { code } });
      setResult(data);
      navigator.vibrate?.(data.result === 'confirmed' ? 120 : [80, 60, 80]);
    } catch (err) {
      setResult(null);
      setError(err.message);
    } finally {
      setBusy(false);
      setTimeout(() => {
        lockRef.current = false;
      }, RESULT_HOLD_MS);
    }
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check-in"
        subtitle="Escanea el QR del atleta al iniciar la clase: si tiene reserva en la próxima hora (o en la que empezó hace poco), queda marcado como asistió."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {scanning ? (
            <Scanner onCode={handleCode} />
          ) : (
            <button className="btn-primary w-full py-4 text-base" onClick={() => setScanning(true)}>
              Abrir cámara y escanear
            </button>
          )}
          {scanning && (
            <button className="btn-ghost w-full" onClick={() => setScanning(false)}>
              Cerrar cámara
            </button>
          )}
        </div>
        <div className="space-y-4">
          {busy && <Spinner className="h-6 w-6" />}
          <ErrorNote>{error}</ErrorNote>
          {result ? (
            <ResultCard data={result} />
          ) : (
            !error && <p className="text-sm text-bone-muted">Apunta la cámara al QR que el atleta tiene en “Mi QR” dentro de su cuenta.</p>
          )}
        </div>
      </div>
      <EntranceQr />
    </div>
  );
}
