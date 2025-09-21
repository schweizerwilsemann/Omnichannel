import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { SessionProvider, useSession } from './context/SessionContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import LoadingScreen from './components/common/LoadingScreen.jsx';
import ErrorScreen from './components/common/ErrorScreen.jsx';
import SessionSetup from './components/common/SessionSetup.jsx';
import HeaderBar from './components/common/HeaderBar.jsx';
import BottomNav from './components/common/BottomNav.jsx';
import MenuPage from './pages/MenuPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';

const AppContent = () => {
    const { status, error, loading, session, qrSlug, refreshTableInfo } = useSession();

    if (status === 'error') {
        const canRetry = Boolean(qrSlug);
        return (
            <ErrorScreen
                message={error}
                onRetry={canRetry ? refreshTableInfo : undefined}
                retryLabel="Retry lookup"
            />
        );
    }

    if (status === 'needsSetup') {
        return <SessionSetup />;
    }

    if (status === 'ready' && session) {
        return (
            <div className="app-shell d-flex flex-column">
                <HeaderBar />
                <main className="flex-grow-1 container py-4">
                    <Routes>
                        <Route path="/" element={<MenuPage />} />
                        <Route path="/checkout" element={<CheckoutPage />} />
                        <Route path="/orders" element={<OrdersPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
                <BottomNav />
            </div>
        );
    }

    const fallbackMessage =
        status === 'loading' ? 'Checking your table...' : loading ? 'Starting your session...' : 'Loading...';
    return <LoadingScreen message={fallbackMessage} />;
};

const App = () => (
    <SessionProvider>
        <CartProvider>
            <AppContent />
            <ToastContainer position="top-center" autoClose={2500} closeOnClick pauseOnHover={false} />
        </CartProvider>
    </SessionProvider>
);

export default App;
