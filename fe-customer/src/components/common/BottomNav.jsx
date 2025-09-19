import { NavLink } from 'react-router-dom';

const BottomNav = () => (
    <nav className="customer-bottom-nav">
        <NavLink to="/" end className="customer-bottom-nav__link">
            Menu
        </NavLink>
        <NavLink to="/orders" className="customer-bottom-nav__link">
            Orders
        </NavLink>
    </nav>
);

export default BottomNav;
