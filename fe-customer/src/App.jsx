import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { SessionProvider, useSession } from './context/SessionContext.jsx';
import LoadingScreen from './components/common/LoadingScreen.jsx';
import ErrorScreen from './components/common/ErrorScreen.jsx';
import SessionSetup from './components/common/SessionSetup.jsx';
import HeaderBar from './components/common/HeaderBar.jsx';
import BottomNav from './components/common/BottomNav.jsx';
import MenuPage from './pages/MenuPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';

const AppContent = () => {
    const { status, error, clearSession, loading, session } = useSession();

    if (status === 'error') {
        return <ErrorScreen message={error} onRetry={clearSession} />;
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
                        <Route path="/orders" element={<OrdersPage />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </main>
                <BottomNav />
            </div>
        );
    }

    return <LoadingScreen message={loading ? 'Starting your session...' : 'Loading...'} />;
};

const App = () => (
    <SessionProvider>
        <AppContent />
        <ToastContainer position="top-center" autoClose={2500} closeOnClick pauseOnHover={false} />
    </SessionProvider>
);

export default App;
