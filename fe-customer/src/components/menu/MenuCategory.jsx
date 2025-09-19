import { Col, Row, Button, Badge } from 'react-bootstrap';

const formatPrice = (cents) => `₫${(cents / 100).toFixed(2)}`;

const MenuCategory = ({ category, onAdd }) => {
    if (!category.items || category.items.length === 0) {
        return null;
    }

    return (
        <section className="menu-category">
            <div className="d-flex align-items-center justify-content-between mb-3">
                <h4 className="mb-0">{category.name}</h4>
                <Badge bg="light" text="dark">
                    {category.items.length} items
                </Badge>
            </div>
            <Row className="g-3">
                {category.items.map((item) => (
                    <Col xs={12} key={item.id}>
                        <div className="menu-item-card">
                            <div className="d-flex justify-content-between align-items-start gap-3">
                                <div>
                                    <h5 className="mb-1">{item.name}</h5>
                                    <div className="text-primary fw-semibold">{formatPrice(item.priceCents)}</div>
                                    {item.description && <p className="text-muted small mb-0 mt-2">{item.description}</p>}
                                </div>
                                <Button variant="primary" onClick={() => onAdd(item)}>
                                    Add
                                </Button>
                            </div>
                        </div>
                    </Col>
                ))}
            </Row>
        </section>
    );
};

export default MenuCategory;
