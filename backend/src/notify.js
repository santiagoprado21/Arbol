import { query, TZ } from './db.js';

// Email is optional: without SMTP_HOST nothing is sent. nodemailer is loaded lazily because it needs Node 20+.
const {
  SMTP_HOST,
  SMTP_PORT = '465',
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  NOTIFY_EMAIL = '',
  APP_URL = '',
} = process.env;

const studioEmails = NOTIFY_EMAIL.split(',').map((e) => e.trim()).filter(Boolean);
let transportPromise;

function transport() {
  if (!SMTP_HOST) return null;
  transportPromise ||= import('nodemailer').then(({ default: nodemailer }) =>
    nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    }),
  );
  return transportPromise;
}

async function send(to, subject, lines) {
  const t = transport();
  if (!t || !to || (Array.isArray(to) && to.length === 0)) return;
  const text = lines.join('\n');
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">${lines
    .map((l) => (l ? `<p style="margin:0 0 8px">${escapeHtml(l)}</p>` : '<br>'))
    .join('')}</div>`;
  await (await t).sendMail({ from: MAIL_FROM || SMTP_USER, to, subject, text, html });
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const when = (date) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));

async function loadReservation(reservationId) {
  const { rows: [r] } = await query(
    `SELECT r.status, s.starts_at, s.class_type, u.full_name, u.email, u.phone,
            e.amount AS evaluation_amount
     FROM reservations r JOIN class_slots s ON s.id = r.slot_id JOIN users u ON u.id = r.user_id
     LEFT JOIN evaluations e ON e.reservation_id = r.id
     WHERE r.id = $1`,
    [reservationId],
  );
  return r;
}

const label = (r) =>
  r.evaluation_amount != null ? 'Valoración Biomecánica y Prueba' : r.class_type === 'personal' ? 'sesión 1:1' : 'clase FLEX';

const money = (n) => `$${Number(n).toLocaleString('es-CO')}`;

// event: 'booked' | 'cancelled'. `byAdmin` skips the studio copy, since the studio made the change itself.
export function notifyReservation(reservationId, event, { byAdmin = false } = {}) {
  if (!SMTP_HOST) return;
  (async () => {
    const r = await loadReservation(reservationId);
    if (!r) return;
    const what = label(r);
    const at = when(r.starts_at);
    const first = r.full_name.split(' ')[0];
    const link = APP_URL ? [`Ver mis reservas: ${APP_URL.replace(/\/$/, '')}/app`] : [];

    if (event === 'booked') {
      await send(r.email, `Reserva confirmada · ${what} · ${at}`, [
        `Hola ${first},`,
        `Tu ${what} quedó reservada para el ${at}`,
        ...(r.evaluation_amount != null ? [`Valor: ${money(r.evaluation_amount)}, abonables a tu plan si te inscribes.`] : []),
        'Si no puedes asistir, cancela con al menos 12 horas de anticipación para no perder la sesión.',
        ...link,
        '',
        'Nos vemos en Árbol.',
      ]);
      if (!byAdmin) {
        await send(studioEmails, `Nueva reserva: ${r.full_name} · ${what} · ${at}`, [
          `${r.full_name} reservó ${what} para el ${at}`,
          `Correo: ${r.email}${r.phone ? ` · Teléfono: ${r.phone}` : ''}`,
        ]);
      }
    } else {
      const late = r.status === 'late_cancel';
      await send(r.email, `Reserva cancelada · ${what} · ${at}`, [
        `Hola ${first},`,
        `Cancelamos tu ${what} del ${at}`,
        late
          ? 'Como faltaban menos de 12 horas, la sesión se descuenta de tu plan.'
          : r.evaluation_amount != null
            ? 'Puedes agendar otra fecha cuando quieras.'
            : 'La sesión vuelve a tu plan.',
        ...link,
      ]);
      if (!byAdmin) {
        await send(studioEmails, `Cancelación: ${r.full_name} · ${what} · ${at}`, [
          `${r.full_name} canceló ${what} del ${at}${late ? ' (cancelación tardía)' : ''}`,
          'El cupo quedó libre.',
        ]);
      }
    }
  })().catch((err) => console.error('[notify] No se pudo enviar el correo:', err.message));
}
