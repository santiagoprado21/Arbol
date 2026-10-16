import { EVALUATION_PRICE, formatMoney } from '../lib/format';

const SECTIONS = [
  [
    'Reservas',
    'Las clases FLEX se reservan desde la app según los cupos disponibles (máximo 6 atletas por clase). Las sesiones personalizadas 1:1 se agendan con tu coach por WhatsApp. Para reservar necesitas un plan vigente con sesiones disponibles.',
  ],
  [
    'Cancelaciones e inasistencias',
    'Puedes cancelar sin costo hasta 12 horas antes de tu clase y la sesión vuelve a tu plan. Si cancelas con menos de 12 horas o no asistes, la sesión se descuenta de tu plan.',
  ],
  [
    'Planes y pagos',
    'Los planes se activan una vez confirmado el pago y tienen una vigencia definida. Las sesiones no usadas dentro de la vigencia no son acumulables ni reembolsables. Puedes congelar tu plan según las condiciones de tu tipo de cliente; los días congelados se suman a tu vencimiento.',
  ],
  [
    'Valoración biomecánica',
    `La valoración biomecánica y prueba tiene un costo de ${formatMoney(EVALUATION_PRICE)}. Si adquieres un plan, ese valor se abona a tu primer plan.`,
  ],
  [
    'Salud y exoneración de responsabilidad',
    'Declaro que la información de salud que suministro es veraz y completa, y que informaré a mi coach cualquier cambio. Entiendo que la actividad física implica riesgos y participo de forma voluntaria, siguiendo las indicaciones del equipo de Árbol. Árbol Private Studio no se hace responsable por lesiones derivadas de información médica omitida o de no seguir las indicaciones del coach.',
  ],
  [
    'Datos personales',
    'Autorizo a Árbol Private Studio a tratar mis datos personales para gestionar mis planes, reservas y comunicaciones por WhatsApp o correo, conforme a la Ley 1581 de 2012. Puedo solicitar la consulta, actualización o eliminación de mis datos en cualquier momento.',
  ],
];

export default function Terms() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-bone-muted">
      {SECTIONS.map(([title, text], i) => (
        <section key={title}>
          <p className="font-medium text-bone">
            {i + 1}. {title}
          </p>
          <p className="mt-1">{text}</p>
        </section>
      ))}
    </div>
  );
}
