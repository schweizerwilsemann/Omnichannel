import { useState } from 'react';
import { Button, Form, Spinner } from 'react-bootstrap';
import { searchMenuItems, clarifyMenuSearch } from '../../services/session.js';

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
    const [clarification, setClarification] = useState('');
    const [ambiguityScore, setAmbiguityScore] = useState(null);
    const [clarificationId, setClarificationId] = useState('');
    const [clarificationOptions, setClarificationOptions] = useState([]);
    const [clarificationInput, setClarificationInput] = useState('');
    const [clarifying, setClarifying] = useState(false);
    const [clarificationError, setClarificationError] = useState('');

    const applySearchPayload = (payload = {}, fallbackQuery = '') => {
        const items = payload.items || [];
        setResults(items);
        setLastQuery(payload.query || fallbackQuery);
        setAvailable(payload.available !== false);
        setAmbiguityScore(
            typeof payload.ambiguityScore === 'number' ? payload.ambiguityScore : null
        );

        if (payload.needsClarification && payload.clarificationPrompt && payload.clarificationId) {
            setClarification(payload.clarificationPrompt);
            setClarificationId(payload.clarificationId);
            setClarificationOptions(payload.clarificationOptions || []);
        } else {
            setClarification('');
            setClarificationId('');
            setClarificationOptions([]);
        }

        setClarificationInput('');
        setClarificationError('');
    };

    const handleSearch = async (inputQuery) => {
        const prompt = (inputQuery ?? query).trim();
        if (prompt.length < 3) {
            setError('Describe what you are craving (at least 3 characters).');
            setClarification('');
            setClarificationId('');
            setClarificationOptions([]);
            setClarificationInput('');
            setClarificationError('');
            setAmbiguityScore(null);
            return;
        }
        if (!sessionToken) {
            setError('Start or resume a session to search the menu.');
            setClarification('');
            setClarificationId('');
            setClarificationOptions([]);
            setClarificationInput('');
            setClarificationError('');
            setAmbiguityScore(null);
            return;
        }

        setLoading(true);
        setError('');
        setSearched(true);
        setClarification('');
        setClarificationId('');
        setClarificationOptions([]);
        setClarificationInput('');
        setClarificationError('');
        setClarifying(false);
        setAmbiguityScore(null);
        try {
            const response = await searchMenuItems(sessionToken, prompt);
            const payload = response.data?.data || { items: [] };
            applySearchPayload(payload, prompt);
        } catch (err) {
            const message = err.response?.data?.message || 'Unable to search the menu right now.';
            setError(message);
            setClarification('');
            setClarificationId('');
            setClarificationOptions([]);
            setClarificationInput('');
            setClarificationError('');
            setAmbiguityScore(null);
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

    const handleClarificationOption = (value) => {
        setClarificationInput(value);
        setClarificationError('');
    };

    const handleClarificationSubmit = async (event) => {
        event.preventDefault();
        const answer = clarificationInput.trim();
        if (!clarificationId) {
            setClarificationError('Clarification request not found. Please try searching again.');
            return;
        }
        if (answer.length < 2) {
            setClarificationError('Please add a bit more detail (at least 2 characters).');
            return;
        }
        if (!sessionToken) {
            setClarificationError('You need an active session to continue.');
            return;
        }

        setClarifying(true);
        setClarificationError('');
        setError('');
        try {
            const response = await clarifyMenuSearch(sessionToken, clarificationId, answer);
            const payload = response.data?.data || { items: [] };
            setSearched(true);
            applySearchPayload(payload, payload.query || `${lastQuery} ${answer}`.trim());
        } catch (err) {
            const message = err.response?.data?.message || 'Unable to refine the search right now.';
            setClarificationError(message);
        } finally {
            setClarifying(false);
        }
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

        const showClarification = Boolean(clarification);
        const allowClarificationForm = Boolean(clarificationId);

        return (
            <div className="menu-search-results">
                {showClarification && (
                    <div className="menu-search-clarification">
                        <div className="menu-search-clarification__prompt">
                            <strong>Need more detail?</strong>
                            <span>{clarification}</span>
                            {ambiguityScore !== null && (
                                <span className="menu-search-clarification__score">
                                    {`${Math.round(ambiguityScore * 100)}% ambiguous`}
                                </span>
                            )}
                        </div>
                        {allowClarificationForm && clarificationOptions.length > 0 && (
                            <div className="menu-search-clarification__options">
                                {clarificationOptions.map((option) => (
                                    <button
                                        type="button"
                                        key={`clarification-option-${option}`}
                                        onClick={() => handleClarificationOption(option)}
                                        disabled={clarifying}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        )}
                        {allowClarificationForm ? (
                            <form className="menu-search-clarification__form" onSubmit={handleClarificationSubmit}>
                                <Form.Control
                                    type="text"
                                    placeholder="Add more detail (e.g. spice level, dish style)"
                                    value={clarificationInput}
                                    onChange={(event) => {
                                        setClarificationInput(event.target.value);
                                        if (clarificationError) {
                                            setClarificationError('');
                                        }
                                    }}
                                    disabled={clarifying}
                                />
                                <Button type="submit" size="sm" disabled={clarifying}>
                                    {clarifying ? 'Refining…' : 'Refine search'}
                                </Button>
                            </form>
                        ) : (
                            <div className="menu-search-clarification__note">
                                Try adding a bit more detail so I can narrow the list.
                            </div>
                        )}
                        {clarificationError && allowClarificationForm && (
                            <div className="menu-search-clarification__error">{clarificationError}</div>
                        )}
                    </div>
                )}
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
