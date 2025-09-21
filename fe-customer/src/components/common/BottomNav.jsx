import { NavLink } from 'react-router-dom';
import { useCart } from '../../context/CartContext.jsx';

const BottomNav = () => {
    const { cartQuantity } = useCart();

    return (
        <nav className="customer-bottom-nav">
            <NavLink to="/" end className="customer-bottom-nav__link">
                Menu
            </NavLink>
            <NavLink to="/checkout" className="customer-bottom-nav__link customer-bottom-nav__link--cart">
                Cart
                {cartQuantity > 0 && <span className="customer-bottom-nav__badge">{cartQuantity}</span>}
            </NavLink>
            <NavLink to="/orders" className="customer-bottom-nav__link">
                Orders
            </NavLink>
        </nav>
    );
};

export default BottomNav;
