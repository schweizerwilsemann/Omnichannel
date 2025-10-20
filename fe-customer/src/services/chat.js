const RAG_BASE_URL = process.env.REACT_APP_RAG_URL || 'http://localhost:8081/rag';

export const askAssistant = async ({ question, restaurantId, sessionId, topK } = {}) => {
    if (!question || !question.trim()) {
        throw new Error('Question is required');
    }

    const payload = {
        question: question.trim(),
        restaurant_id: restaurantId || null,
        session_id: sessionId || null
    };

    if (typeof topK === 'number') {
        payload.top_k = topK;
    }

    const response = await fetch(`${RAG_BASE_URL}/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const msg = await response.text();
        throw new Error(msg || 'Failed to query assistant');
    }

    return response.json();
};
