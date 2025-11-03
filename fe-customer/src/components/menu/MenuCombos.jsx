import resolveAssetUrl from '../../utils/assets.js';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1556791001-0a4b9a1bfe28?w=800&h=600&fit=crop&crop=center';

const MenuCombos = ({ combos, onAdd, formatPrice }) => {
    if (!Array.isArray(combos) || combos.length === 0) {
        return null;
    }

    const renderPrice = (combo) => {
        if (typeof formatPrice === 'function') {
            return formatPrice(combo.priceCents);
        }
        return `USD ${(combo.priceCents / 100).toFixed(2)}`;
    };

    const handleAdd = (combo) => {
        if (typeof onAdd === 'function') {
            onAdd(combo);
        }
    };

    return (
        <section className="menu-combos gradient-card">
            <div className="menu-combos__headline">
                <p className="menu-combos__eyebrow">bundle &amp; save</p>
                <h2 className="menu-combos__title">Combos made for sharing</h2>
                <p className="menu-combos__subtitle">
                    Crowd-pleasing sets with a friendlier price than ordering a la carte.
                </p>
            </div>
            <div className="menu-combos__list">
                {combos.map((combo) => (
                    <article key={combo.id} className="menu-combos__card">
                        <div className="menu-combos__image-wrapper">
                            <img
                                src={resolveAssetUrl(combo.imageUrl) || FALLBACK_IMAGE}
                                alt={combo.name}
                                className="menu-combos__image"
                                loading="lazy"
                            />
                            <span className="menu-combos__tag">{renderPrice(combo)}</span>
                        </div>
                        <div className="menu-combos__body">
                            <h3 className="menu-combos__name">{combo.name}</h3>
                            {combo.description ? (
                                <p className="menu-combos__description">{combo.description}</p>
                            ) : null}
                            {Array.isArray(combo.items) && combo.items.length > 0 ? (
                                <ul className="menu-combos__items">
                                    {combo.items.map((item) => (
                                        <li key={`${combo.id}-${item.id}`}>
                                            <span className="menu-combos__item-qty">{item.quantity}×</span>
                                            <span className="menu-combos__item-name">{item.name}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            <button
                                type="button"
                                className="menu-combos__add"
                                onClick={() => handleAdd(combo)}
                            >
                                Add combo
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
};

export default MenuCombos;
