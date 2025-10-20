import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { askAssistant } from '../../services/chat.js';
import { useSession } from '../../context/SessionContext.jsx';
import './chat.css';

const ensurePortalRoot = () => {
    if (typeof document === 'undefined') {
        return null;
    }
    let node = document.getElementById('chat-widget-root');
    if (!node) {
        node = document.createElement('div');
        node.id = 'chat-widget-root';
        document.body.appendChild(node);
    }
    return node;
};

const formatAnswer = (text) => text?.trim() || 'No answer available.';

const makeId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2);
};

const MessageBubble = ({ message }) => {
    const { role, content, sources, error } = message;
    const isUser = role === 'user';
    const bubbleClass = [`chat-bubble`, isUser ? 'chat-bubble-user' : 'chat-bubble-bot'];
    if (error) {
        bubbleClass.push('error');
    }

    return (
        <div className={bubbleClass.join(' ')}>
            <p className="mb-0">{content}</p>
            {!isUser && sources?.length ? (
                <details className="chat-sources mt-2">
                    <summary>Sources ({sources.length})</summary>
                    <ul className="chat-source-list">
                        {sources.map((source, index) => (
                            <li key={index}>
                                <strong>{source.metadata?.source_id || `Source #${index + 1}`}</strong>
                                <div>{source.text}</div>
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </div>
    );
};

const ChatAssistant = () => {
    const portalTarget = useMemo(() => ensurePortalRoot(), []);
    const { session, tableInfo } = useSession();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState(() => []);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bodyRef = useRef(null);

    const restaurantId =
        session?.restaurant?.id ||
        session?.restaurantId ||
        tableInfo?.restaurant?.id ||
        tableInfo?.restaurantId ||
        null;
    const sessionToken = session?.sessionToken || null;
    const restaurantName =
        session?.restaurant?.name || tableInfo?.restaurant?.name || 'Your Restaurant Assistant';

    const handleSubmit = async (event) => {
        event.preventDefault();
        const question = input.trim();
        if (!question || loading) {
            return;
        }

        const userMessage = {
            id: makeId(),
            role: 'user',
            content: question
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await askAssistant({
                question,
                restaurantId,
                sessionId: sessionToken
            });

            const botMessage = {
                id: makeId(),
                role: 'assistant',
                content: formatAnswer(response.answer),
                sources: response.sources || [],
                cached: response.cached || false
            };

            setMessages((prev) => [...prev, botMessage]);
        } catch (error) {
            console.error('Assistant query failed', error);
            toast.error('Assistant is unavailable right now. Please try again shortly.');
            setMessages((prev) =>
                prev.map((message) =>
                    message.id === userMessage.id
                        ? {
                              ...message,
                              error: true,
                              content: `${message.content}
[failed to send]`
                          }
                        : message
                )
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!bodyRef.current) {
            return;
        }
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }, [messages, loading]);

    if (!portalTarget || !restaurantId) {
        return null;
    }

    const widget = (
        <div className={`chat-widget-container ${open ? 'chat-widget-open' : 'chat-widget-closed'}`}>
            <button
                type="button"
                className={`chat-widget-toggle ${open ? 'chat-widget-toggle-open' : ''}`.trim()}
                onClick={() => setOpen((prev) => !prev)}
                aria-label={open ? 'Hide assistant chat' : 'Open assistant chat'}
            >
                <span className="chat-toggle-icon" aria-hidden="true">
                    {open ? (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.8333 4.16669L4.16663 15.8334" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                            <path d="M4.16663 4.16669L15.8333 15.8334" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M5 4H19C20.1046 4 21 4.89543 21 6V14C21 15.1046 20.1046 16 19 16H8.41421C7.88378 16 7.37507 16.2107 7 16.5858L4.5 19.0858V6C4.5 4.89543 4.89543 4 5 4Z"
                                stroke="white"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <circle cx="9" cy="10.5" r="1" fill="white" />
                            <circle cx="12" cy="10.5" r="1" fill="white" />
                            <circle cx="15" cy="10.5" r="1" fill="white" />
                        </svg>
                    )}
                </span>
                <span className="chat-toggle-label">Ask our assistant</span>
            </button>

            {open ? (
                <div className="chat-widget-panel shadow-lg">
                    <header className="chat-widget-header">
                        <div>
                            <strong>{restaurantName}</strong>
                            <div className="chat-widget-subtitle">Need help? Ask our assistant.</div>
                        </div>
                    </header>

                    <div className="chat-widget-body" ref={bodyRef}>
                        {messages.length === 0 ? (
                            <div className="chat-widget-empty">
                                <p>
                                    Ask anything about the menu, promotions, or hours.
                                </p>
                            </div>
                        ) : (
                            messages.map((message) => <MessageBubble key={message.id} message={message} />)
                        )}
                        {loading ? (
                            <div className="chat-typing-indicator">
                                <span>Assistant is thinking</span>
                                <span className="chat-typing-dots" aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                </span>
                            </div>
                        ) : null}
                    </div>

                    <form className="chat-widget-input" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            placeholder="Ask about hours, menu, promos…"
                            disabled={loading}
                        />
                        <button type="submit" disabled={loading || !input.trim()}>
                            Send
                        </button>
                    </form>
                </div>
            ) : null}
        </div>
    );

    return createPortal(widget, portalTarget);
};

export default ChatAssistant;
