const TrendSparkline = ({ points = [], width = 110, height = 32, stroke = '#0d6efd' }) => {
    if (!Array.isArray(points) || points.length === 0) {
        return <div className="text-muted small">No history yet</div>;
    }

    const sanitized = points.slice(-20);
    const values = sanitized.map((entry) => Number(entry.attachRate) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 0.0001;
    const horizontalStep = sanitized.length > 1 ? (width - 4) / (sanitized.length - 1) : 0;

    const polylinePoints = sanitized
        .map((entry, index) => {
            const x = 2 + horizontalStep * index;
            const ratio = range > 0 ? (Number(entry.attachRate) - min) / range : 0.5;
            const y = height - 4 - ratio * (height - 8);
            return `${x},${y}`;
        })
        .join(' ');

    return (
        <svg width={width} height={height} role="img" aria-label="Attach rate trend">
            <line x1="2" y1={height - 4} x2={width - 2} y2={height - 4} stroke="#e9ecef" strokeWidth="1" />
            <polyline
                fill="none"
                stroke={stroke}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={polylinePoints}
            />
        </svg>
    );
};

export default TrendSparkline;
