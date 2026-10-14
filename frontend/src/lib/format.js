export const TZ = 'America/Bogota';

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const formatMoney = (n) => money.format(Number(n) || 0);

export const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('es-CO', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });

export const formatDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(iso).toLocaleDateString('es-CO', { timeZone: TZ, ...opts });

// "YYYY-MM-DD" strings are calendar dates; render them without timezone shifting.
export const formatDay = (ymd, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-CO', { timeZone: 'UTC', ...opts });
};

const dayParts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// Built from parts because locale output (e.g. 'en-CA') is not a stable YYYY-MM-DD across browsers.
export const dayKey = (date) => {
  const p = Object.fromEntries(dayParts.formatToParts(new Date(date)).map(({ type, value }) => [type, value]));
  return `${p.year}-${p.month}-${p.day}`;
};

export const todayKey = () => dayKey(new Date());

export const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n, 12));
  return dt.toISOString().slice(0, 10);
};

export const CLASS_TYPES = {
  semi: { label: 'FLEX', short: 'FLEX', capacityLabel: 'máx. 6' },
  personal: { label: 'Personalizado 1:1', short: '1:1', capacityLabel: '1 atleta' },
  membership: { label: 'Membresía Founder', short: 'Founder', capacityLabel: '' },
};

export const CLIENT_TYPES = {
  regular: 'Regular',
  founder: 'Founder',
  founder_guest: 'Invitado Founder',
};

export const PRICE_TIERS = {
  regular: 'Tarifa regular',
  founder: 'Tarifa Founder',
  founder_bonus: 'Tarifa Founder + bono mensual',
  membership: 'Membresía anual',
};

export const EVALUATION_LABEL = 'Valoración biomecánica y prueba';
// Display only; the charged amount comes from the API (EVALUATION_PRICE in backend/src/membership.js).
export const EVALUATION_PRICE = 50000;

export const RESERVATION_STATUS = {
  booked: { label: 'Reservada', tone: 'blue' },
  attended: { label: 'Asistió', tone: 'green' },
  no_show: { label: 'No asistió', tone: 'red' },
  late_cancel: { label: 'Cancelación tardía', tone: 'amber' },
  cancelled: { label: 'Cancelada', tone: 'gray' },
};

export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const whatsappLink = (text = '') => {
  const phone = import.meta.env.VITE_WHATSAPP || '573000000000';
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
};
