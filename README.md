# Árbol · Private Studio

App web del gimnasio privado Árbol: landing pública, registro de atletas, reservas con cupos y panel administrativo.

- `frontend/` — React + Vite + Tailwind. Se despliega en **Vercel**.
- `backend/` — API Node/Express + Postgres. Se despliega en **Render** (web service + Postgres).

## Desarrollo local

```bash
# API (sin DATABASE_URL usa PGlite, un Postgres embebido en backend/.pglite)
cd backend && npm install && npm run dev      # http://localhost:4000

# Frontend
cd frontend && npm install && npm run dev     # http://localhost:5173
```

Admin local por defecto: `admin@arbol.co` / `arbol123`. Para empezar de cero, borra `backend/.pglite`.

## Reglas de negocio actuales

- Modalidades: **Personalizado 1:1** y **FLEX** (antes semi-personalizado, cupo máximo 6). FLEX ya no tiene plan de 4 clases.
- Los clientes solo reservan desde la app clases FLEX; las 1:1 se agendan por WhatsApp (el admin puede registrarlas en la agenda).
- Para reservar, el cliente necesita un plan vigente de esa modalidad con sesiones disponibles (y no congelado en esa fecha).
- Se puede reservar hasta 14 días adelante (21 para Founders). Las clases se generan automáticamente desde las franjas semanales (pestaña Horarios).
- Cancelar con 12 h o más devuelve la sesión; con menos de 12 h queda como cancelación tardía y la sesión se descuenta. Las inasistencias también descuentan.
- Tipos de cliente: **Regular**, **Founder** e **Invitado Founder** (cada Founder puede tener uno).
- Los beneficios Founder se activan con la **Membresía Founder · Anual** (plan de 12 meses sin sesiones). Al activarla, el cliente pasa a Founder automáticamente. Beneficios: tarifas Founder, reservas con 21 días, franjas **Founders Only**, un invitado y congelamiento flexible.
- Tarifas por plan: regular, Founder (también para Invitados Founder) y Founder con bono mensual. El bono se mantiene si cada plan nuevo empieza a más tardar 5 días después de que vence el anterior; si no, se pierde (el admin puede reactivarlo en el perfil).
- Congelamiento por plan: regulares 1 vez hasta 7 días; Founders 2 veces hasta 21 días. El cliente lo solicita desde la app (desde mañana); el admin puede congelar sin límites. Los días congelados extienden el vencimiento y cancelan las reservas de esas fechas sin descontar sesiones.
- **Valoración biomecánica y prueba**: $50.000, se agenda solo en franjas 1:1 libres (no Founders Only). Una vez pagada, se abona al siguiente plan que compre el cliente.
- Ajustes rápidos (días, límites, precio de la valoración) en `backend/src/membership.js`.
- **Check-in con QR**: cada atleta tiene su QR en "Mi QR". En el panel (Check-in QR) el admin lo escanea con la cámara: confirma (marca "Asistió") la reserva de una clase que empieza dentro de 60 min o empezó hace menos de 90 min; si no hay, muestra "No tenía reserva".
- **QR de la entrada**: `/enlaces` es una página pública con accesos a la web, Instagram (`VITE_INSTAGRAM`) y WhatsApp. Su QR se descarga desde la página de Check-in.
- Cambios de esquema o de datos van en `backend/src/migrations.js` y se aplican una sola vez al arrancar la API.

## Despliegue

### Backend en Render

1. Sube el repo a GitHub.
2. En Render: **New → Blueprint** y selecciona el repo. `render.yaml` crea la base `arbol-db` y el servicio `arbol-api`.
3. Completa las variables: `CORS_ORIGINS` (URL de Vercel, ej. `https://arbol.vercel.app`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. Las tablas, planes y franjas por defecto se crean solos al arrancar.

### Frontend en Vercel

1. **Add New → Project**, selecciona el repo y define **Root Directory = `frontend`** (Vite se detecta solo).
2. Variables de entorno: `VITE_API_URL` (URL de Render, ej. `https://arbol-api.onrender.com`), `VITE_WHATSAPP` (ej. `573001234567`), `VITE_INSTAGRAM` (opcional).
