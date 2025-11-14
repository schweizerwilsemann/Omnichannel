import { Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import TablesPage from "./pages/TablesPage.jsx";
import AssetsPage from "./pages/AssetsPage.jsx";
import ManagementPage from "./pages/ManagementPage.jsx";
import RestaurantsPage from "./pages/RestaurantsPage.jsx";
import InvitationAcceptPage from "./pages/InvitationAcceptPage.jsx";
import PasswordResetRequestPage from "./pages/PasswordResetRequestPage.jsx";
import PasswordResetConfirmPage from "./pages/PasswordResetConfirmPage.jsx";

const App = () => (
  <>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/invitation" element={<InvitationAcceptPage />} />
      <Route path="/password-reset" element={<PasswordResetRequestPage />} />
      <Route
        path="/password-reset/confirm"
        element={<PasswordResetConfirmPage />}
      />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/tables" element={<TablesPage />} />
        <Route path="/assets" element={<AssetsPage />} />
        <Route path="/management" element={<ManagementPage />} />
        <Route path="/restaurants" element={<RestaurantsPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" />} />
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
    <ToastContainer
      position="top-right"
      autoClose={4000}
      newestOnTop
      closeOnClick
      pauseOnHover={false}
    />
  </>
);

export default App;
