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
const appUrl = APP_URL.replace(/\/$/, '');
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

const RED = '#e30613';
const FONT = `Inter,'Helvetica Neue',Helvetica,Arial,sans-serif`;
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Email clients only support table layouts with inline styles; the logo is served by the frontend at APP_URL.
function renderHtml({ preheader, eyebrow, title, intro, details, note, noteAlert, cta }) {
  const logo = appUrl
    ? `<img src="${appUrl}/brand/full.png" width="150" alt="Árbol Private Studio" style="display:block;margin:0 auto;width:150px;max-width:150px;height:auto;border:0">`
    : `<p style="margin:0;font-family:${FONT};font-size:22px;letter-spacing:8px;color:#ffffff;font-weight:600">ÁRBOL</p>`;
  const rows = details
    .map(
      ([k, v], i) => `<tr>
        <td style="padding:${i ? '12px' : '0'} 0 0;font-family:${FONT};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#737373">${escapeHtml(k)}</td>
      </tr><tr>
        <td style="padding:2px 0 0;font-family:${FONT};font-size:16px;color:#ffffff;font-weight:500">${escapeHtml(v)}</td>
      </tr>`,
    )
    .join('');
  const button = cta
    ? `<tr><td align="center" style="padding:28px 0 4px">
        <a href="${cta.href}" style="display:inline-block;background:${RED};color:#ffffff;font-family:${FONT};font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:999px">${escapeHtml(cta.label)}</a>
      </td></tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#000000">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
      <tr><td align="center" style="padding:8px 0 28px">${logo}</td></tr>
      <tr><td style="background:#0a0a0a;border:1px solid #1f1f1f;border-top:3px solid ${RED};border-radius:16px;padding:32px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="font-family:${FONT};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${RED};font-weight:600">${escapeHtml(eyebrow)}</td></tr>
          <tr><td style="padding:10px 0 0;font-family:${FONT};font-size:24px;line-height:1.3;color:#ffffff;font-weight:600">${escapeHtml(title)}</td></tr>
          <tr><td style="padding:12px 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:#a3a3a3">${escapeHtml(intro)}</td></tr>
          <tr><td style="padding:24px 0 0">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#151515;border-left:3px solid ${RED};border-radius:10px">
              <tr><td style="padding:18px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>
            </table>
          </td></tr>
          ${note ? `<tr><td style="padding:20px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${noteAlert ? '#f87171' : '#737373'}">${escapeHtml(note)}</td></tr>` : ''}
          ${button}
        </table>
      </td></tr>
      <tr><td align="center" style="padding:28px 0 0;font-family:${FONT};font-size:12px;line-height:1.7;color:#737373">
        Entrena con intención. Crece desde la raíz.<br>
        <span style="color:#3a3a3a;letter-spacing:2px">ÁRBOL · PRIVATE STUDIO</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function renderText({ title, intro, details, note, cta }) {
  return [
    title,
    '',
    intro,
    '',
    ...details.map(([k, v]) => `${k}: ${v}`),
    ...(note ? ['', note] : []),
    ...(cta ? ['', `${cta.label}: ${cta.href}`] : []),
    '',
    'Árbol · Private Studio',
  ].join('\n');
}

async function send(to, subject, email) {
  const t = transport();
  if (!t || !to || (Array.isArray(to) && to.length === 0)) return;
  await (await t).sendMail({
    from: MAIL_FROM || SMTP_USER,
    to,
    subject,
    text: renderText(email),
    html: renderHtml(email),
  });
}

const fmt = (date, opts) => new Intl.DateTimeFormat('es-CO', { timeZone: TZ, ...opts }).format(new Date(date));
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const money = (n) => `$${Number(n).toLocaleString('es-CO')}`;

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

// event: 'booked' | 'cancelled'. `byAdmin` skips the studio copy, since the studio made the change itself.
export function notifyReservation(reservationId, event, { byAdmin = false } = {}) {
  if (!SMTP_HOST) return;
  (async () => {
    const r = await loadReservation(reservationId);
    if (!r) return;
    const isEvaluation = r.evaluation_amount != null;
    const what = isEvaluation ? 'Valoración Biomecánica y Prueba' : r.class_type === 'personal' ? 'Sesión 1:1' : 'Clase FLEX';
    const day = capitalize(fmt(r.starts_at, { weekday: 'long', day: 'numeric', month: 'long' }));
    const time = fmt(r.starts_at, { hour: 'numeric', minute: '2-digit' });
    const at = `${day}, ${time}`;
    const first = r.full_name.split(' ')[0];
    const details = [
      ['Sesión', what],
      ['Fecha', day],
      ['Hora', time],
      ...(isEvaluation && event === 'booked' ? [['Valor', `${money(r.evaluation_amount)} · abonables a tu plan`]] : []),
    ];
    const clientCta = appUrl ? { label: 'Ver mis reservas', href: `${appUrl}/app` } : null;
    const studioCta = appUrl ? { label: 'Abrir agenda', href: `${appUrl}/admin/agenda` } : null;
    const contact = [['Contacto', [r.email, r.phone].filter(Boolean).join(' · ')]];

    if (event === 'booked') {
      await send(r.email, `Reserva confirmada · ${what} · ${at}`, {
        preheader: `${what} · ${at}. Te esperamos en Árbol.`,
        eyebrow: 'Reserva confirmada',
        title: `¡Listo, ${first}!`,
        intro: 'Tu lugar está apartado. Te esperamos en el estudio.',
        details,
        note: 'Si no puedes asistir, cancela con al menos 12 horas de anticipación para no perder la sesión.',
        cta: clientCta,
      });
      if (!byAdmin) {
        await send(studioEmails, `Nueva reserva: ${r.full_name} · ${what} · ${at}`, {
          preheader: `${r.full_name} reservó ${what} · ${at}`,
          eyebrow: 'Nueva reserva',
          title: r.full_name,
          intro: 'Reservó desde la app.',
          details: [...contact, ...details.slice(0, 3)],
          cta: studioCta,
        });
      }
    } else {
      const late = r.status === 'late_cancel';
      await send(r.email, `Reserva cancelada · ${what} · ${at}`, {
        preheader: `Cancelamos tu ${what.toLowerCase()} del ${at}.`,
        eyebrow: 'Reserva cancelada',
        title: `Hola, ${first}`,
        intro: 'Tu reserva quedó cancelada.',
        details,
        note: late
          ? 'Como faltaban menos de 12 horas, la sesión se descuenta de tu plan.'
          : isEvaluation
            ? 'Puedes agendar otra fecha cuando quieras.'
            : 'La sesión vuelve a tu plan. ¡Te esperamos pronto!',
        noteAlert: late,
        cta: clientCta,
      });
      if (!byAdmin) {
        await send(studioEmails, `Cancelación: ${r.full_name} · ${what} · ${at}`, {
          preheader: `${r.full_name} canceló ${what} · ${at}`,
          eyebrow: late ? 'Cancelación tardía' : 'Cancelación',
          title: r.full_name,
          intro: 'Canceló su reserva. El cupo quedó libre.',
          details: [...contact, ...details.slice(0, 3)],
          note: late ? 'Faltaban menos de 12 horas: la sesión se descontó de su plan.' : null,
          noteAlert: late,
          cta: studioCta,
        });
      }
    }
  })().catch((err) => console.error('[notify] No se pudo enviar el correo:', err.message));
}
