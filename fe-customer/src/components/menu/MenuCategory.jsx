import resolveAssetUrl from '../../utils/assets.js';

const formatPrice = (cents) => `USD ${(cents / 100).toFixed(2)}`;
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&h=600&fit=crop&crop=center';

const MenuCategory = ({ category, onAdd, onShowSimilar = undefined }) => {
    if (!category.items || category.items.length === 0) {
        return null;
    }

    return (
        <section className="menu-category" id={`category-${category.id}`}>
            <div className="menu-category__header">
                <div>
                    <p className="menu-category__eyebrow">fan favorite</p>
                    <h2 className="menu-category__title">{category.name}</h2>
                </div>
                <span className="menu-category__count">{category.items.length} picks</span>
            </div>
            <div className="menu-category__grid">
                {category.items.map((item) => (
                    <article key={item.id} className="menu-item-card">
                        <div className="menu-item-card__image-wrapper">
                            <img
                                src={resolveAssetUrl(item.imageUrl) || FALLBACK_IMAGE}
                                alt={item.name}
                                loading="lazy"
                                className="menu-item-card__image"
                            />
                            <button type="button" className="menu-item-card__add" onClick={() => onAdd(item)}>
                                Add
                            </button>
                        </div>
                        <div className="menu-item-card__body">
                            <span className="menu-item-card__price">{formatPrice(item.priceCents)}</span>
                            <h3 className="menu-item-card__name">{item.name}</h3>
                            {item.description && <p className="menu-item-card__description">{item.description}</p>}
                            {typeof onShowSimilar === 'function' && (
                                <button
                                    type="button"
                                    className="menu-item-card__similar"
                                    onClick={() => onShowSimilar(item)}
                                >
                                    Find similar
                                </button>
                            )}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
};
export default MenuCategory;
