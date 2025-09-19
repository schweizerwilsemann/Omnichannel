import MainLayout from '../components/layout/MainLayout.jsx';

const DashboardPage = () => (
    <MainLayout>
        <div className="d-flex flex-column gap-3">
            <h2>Welcome to Omnichannel Admin</h2>
            <p>Use the navigation to manage restaurants, track orders, and monitor kitchen activity in real-time.</p>
            <div className="p-4 bg-white rounded shadow-sm">
                <h5 className="mb-2">Next Steps</h5>
                <ul className="mb-0">
                    <li>Configure restaurant tables and assign QR codes.</li>
                    <li>Invite managers to oversee day-to-day operations.</li>
                    <li>Track live orders and kitchen display statuses.</li>
                </ul>
            </div>
        </div>
    </MainLayout>
);

export default DashboardPage;
