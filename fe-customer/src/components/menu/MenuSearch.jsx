import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { searchMenuItems } from '../../services/session.js';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&h=400&fit=crop&crop=center';
const SUGGESTIONS = [
    'Show me spicy dishes',
    'I want some cold drinks',
    'Any vegetarian pasta?',
    'Need gluten-free options'
];

const MenuSearch = ({ sessionToken, onAdd, formatPrice }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [available, setAvailable] = useState(true);
    const [lastQuery, setLastQuery] = useState('');
    const [searched, setSearched] = useState(false);

    const handleSearch = async (inputQuery) => {
        const prompt = (inputQuery ?? query).trim();
        if (prompt.length < 3) {
            setError('Describe what you are craving (at least 3 characters).');
            return;
        }
        if (!sessionToken) {
            setError('Start or resume a session to search the menu.');
            return;
        }

        setLoading(true);
        setError('');
        setSearched(true);
        try {
            const response = await searchMenuItems(sessionToken, prompt);
            const payload = response.data?.data || { items: [] };
            setResults(payload.items || []);
            setLastQuery(prompt);
            setAvailable(payload.available !== false);
        } catch (err) {
            const message = err.response?.data?.message || 'Unable to search the menu right now.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        handleSearch();
    };

    const handleSuggestion = (text) => {
        setQuery(text);
        handleSearch(text);
    };

    const renderResults = () => {
        if (loading) {
            return (
                <div className="menu-search-empty">
                    <Spinner animation="border" size="sm" />
                    <span>Finding matches...</span>
                </div>
            );
        }

        if (error) {
            return (
                <div className="menu-search-empty menu-search-empty--error">
                    {error}
                </div>
            );
        }

        if (!available) {
            return (
                <div className="menu-search-empty">
                    Smart search is not enabled for this restaurant yet.
                </div>
            );
        }

        if (!searched) {
            return (
                <div className="menu-search-empty">
                    Try asking for “spicy dishes” or “cold drinks” and we will shortlist items instantly.
                </div>
            );
        }

        if (results.length === 0) {
            return (
                <div className="menu-search-empty">
                    No matches found for “{lastQuery}”. Try a different craving or keyword.
                </div>
            );
        }

        return (
            <div className="menu-search-results">
                {results.map((item) => (
                    <article key={item.id} className="menu-search-result">
                        <div className="menu-search-result__media">
                            <img src={item.imageUrl || FALLBACK_IMAGE} alt={item.name} loading="lazy" />
                        </div>
                        <div className="menu-search-result__info">
                            {item.category?.name && (
                                <span className="menu-search-result__category">{item.category.name}</span>
                            )}
                            <h3 className="menu-search-result__title">{item.name}</h3>
                            {item.description && (
                                <p className="menu-search-result__description">{item.description}</p>
                            )}
                            <div className="menu-search-result__meta">
                                {item.spiceLevel && (
                                    <span className="menu-search-pill">{`Spice: ${item.spiceLevel}`}</span>
                                )}
                                {(item.dietaryTags || []).slice(0, 2).map((tag) => (
                                    <span key={`${item.id}-${tag}`} className="menu-search-pill">
                                        {tag.replace(/-/g, ' ')}
                                    </span>
                                ))}
                            </div>
                            {item.matchReasons?.length ? (
                                <div className="menu-search-reasons">
                                    {item.matchReasons.map((reason, index) => (
                                        <span key={`${item.id}-reason-${index}`} className="menu-search-reason">
                                            {reason}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        <div className="menu-search-result__cta">
                            <span className="menu-search-result__price">{formatPrice(item.priceCents)}</span>
                            <Button size="sm" onClick={() => onAdd(item)}>
                                Add to cart
                            </Button>
                        </div>
                    </article>
                ))}
            </div>
        );
    };

    return (
        <section className="menu-search-card shadow-sm">
            <div className="menu-search-header">
                <div>
                    <p className="menu-search-eyebrow">smart search</p>
                    <h2 className="menu-search-title">Describe what you&apos;re craving.</h2>
                </div>
                <span className="menu-search-badge">beta</span>
            </div>
            <Form onSubmit={handleSubmit} className="menu-search-form">
                <Form.Control
                    type="text"
                    placeholder="e.g. I want some spicy dishes or Cold drinks for brunch"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    disabled={loading || !sessionToken}
                />
                <Button type="submit" disabled={loading || !sessionToken}>
                    {loading ? 'Searching…' : 'Search'}
                </Button>
            </Form>
            <div className="menu-search-suggestions">
                {SUGGESTIONS.map((suggestion) => (
                    <button
                        type="button"
                        key={suggestion}
                        className="menu-search-suggestion"
                        onClick={() => handleSuggestion(suggestion)}
                        disabled={loading}
                    >
                        {suggestion}
                    </button>
                ))}
            </div>
            {renderResults()}
        </section>
    );
};

export default MenuSearch;
