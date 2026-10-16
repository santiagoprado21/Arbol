import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { PageLoader } from './components/ui';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

const ClientHome = lazy(() => import('./pages/client/ClientHome'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Clients = lazy(() => import('./pages/admin/Clients'));
const ClientDetail = lazy(() => import('./pages/admin/ClientDetail'));
const Agenda = lazy(() => import('./pages/admin/Agenda'));
const Schedule = lazy(() => import('./pages/admin/Schedule'));
const Plans = lazy(() => import('./pages/admin/Plans'));
const Checkin = lazy(() => import('./pages/admin/Checkin'));
const Links = lazy(() => import('./pages/Links'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/ingresar" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/enlaces" element={<Links />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute role="client">
              <ClientHome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="clientes" element={<Clients />} />
          <Route path="clientes/:id" element={<ClientDetail />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="checkin" element={<Checkin />} />
          <Route path="horarios" element={<Schedule />} />
          <Route path="planes" element={<Plans />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
