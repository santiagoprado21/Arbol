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

- Modalidades: **Personalizado 1:1** (cupo 1) y **Semi-personalizado** (cupo máximo 6).
- Para reservar, el cliente necesita un plan vigente de esa modalidad con sesiones disponibles.
- Se puede reservar hasta 14 días adelante. Las clases se generan automáticamente desde las franjas semanales (pestaña Horarios).
- Cancelar con 12 h o más devuelve la sesión; con menos de 12 h queda como cancelación tardía y la sesión se descuenta. Las inasistencias también descuentan.
- Clientes **Essential**: el admin puede definir un precio mensual Essential por plan; se aplica automáticamente al activarles un plan.

## Despliegue

### Backend en Render

1. Sube el repo a GitHub.
2. En Render: **New → Blueprint** y selecciona el repo. `render.yaml` crea la base `arbol-db` y el servicio `arbol-api`.
3. Completa las variables: `CORS_ORIGINS` (URL de Vercel, ej. `https://arbol.vercel.app`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. Las tablas, planes y franjas por defecto se crean solos al arrancar.

### Frontend en Vercel

1. **Add New → Project**, selecciona el repo y define **Root Directory = `frontend`** (Vite se detecta solo).
2. Variables de entorno: `VITE_API_URL` (URL de Render, ej. `https://arbol-api.onrender.com`), `VITE_WHATSAPP` (ej. `573001234567`), `VITE_INSTAGRAM` (opcional).
