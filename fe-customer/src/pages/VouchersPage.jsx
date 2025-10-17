import { useMemo } from 'react';
import { Alert, Badge, Card } from 'react-bootstrap';
import { useSession } from '../context/SessionContext.jsx';

const statusVariant = {
    AVAILABLE: 'success',
    REDEEMED: 'secondary',
    EXPIRED: 'warning',
    REVOKED: 'danger'
};

const formatPrice = (cents) => `USD ${(cents / 100).toFixed(2)}`;

const VoucherCard = ({ entry }) => {
    const voucher = entry.voucher || {};
    const promotion = entry.promotion || {};
    const status = entry.status || 'AVAILABLE';
    const statusLabel = status.charAt(0) + status.slice(1).toLowerCase();
    const validUntil = entry.expiresAt || voucher.validUntil || promotion.endsAt || null;
    const validFrom = voucher.validFrom || promotion.startsAt || null;
    const tiers = (voucher.tiers || []).slice().sort((a, b) => (a.minSpendCents || 0) - (b.minSpendCents || 0));

    return (
        <Card className="voucher-card shadow-sm">
            <Card.Body className="d-flex flex-column gap-2">
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <div className="voucher-card__title">{voucher.name || promotion.name || 'Voucher'}</div>
                        {promotion.headline && <div className="text-muted small">{promotion.headline}</div>}
                    </div>
                    <Badge bg={statusVariant[status] || 'secondary'}>{statusLabel}</Badge>
                </div>
                {voucher.code ? (
                    <div className="voucher-card__code">Code: {voucher.code}</div>
                ) : null}
                {voucher.description ? <p className="text-muted small mb-0">{voucher.description}</p> : null}
                <div className="voucher-card__meta text-muted small">
                    {validFrom ? `Valid from ${new Date(validFrom).toLocaleDateString()}` : 'Valid now'}
                    {' · '}
                    {validUntil ? `Expires ${new Date(validUntil).toLocaleDateString()}` : 'No expiry date'}
                </div>
                {tiers.length > 0 ? (
                    <div className="voucher-card__tiers">
                        <div className="text-muted small fw-semibold">Discount tiers</div>
                        <ul className="voucher-card__tier-list">
                            {tiers.map((tier) => (
                                <li key={tier.id || `${tier.minSpendCents}-${tier.discountPercent}`}>
                                    Spend {formatPrice(tier.minSpendCents)} → {tier.discountPercent}% off
                                    {tier.maxDiscountCents ? ` (max ${formatPrice(tier.maxDiscountCents)})` : ''}
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : null}
            </Card.Body>
        </Card>
    );
};

const VouchersPage = () => {
    const { session, vouchers } = useSession();
    const available = useMemo(() => vouchers?.available || [], [vouchers]);
    const redeemed = useMemo(() => vouchers?.redeemed || [], [vouchers]);
    const expired = useMemo(() => vouchers?.expired || [], [vouchers]);
    const revoked = useMemo(() => vouchers?.revoked || [], [vouchers]);
    const isMember = session?.membership?.status === 'MEMBER';
    const nothingSaved = available.length === 0 && redeemed.length === 0 && expired.length === 0 && revoked.length === 0;

    return (
        <div className="vouchers-page container py-4">
            <header className="mb-4">
                <h1 className="h4 mb-1">Your voucher bag</h1>
                <p className="text-muted mb-0">
                    {isMember
                        ? 'Apply these when you check out during your next visit.'
                        : 'Join the loyalty crew to unlock vouchers and perks.'}
                </p>
            </header>

            {!isMember ? (
                <Alert variant="warning">
                    <strong>Tip:</strong> Join the loyalty program from the menu tab to start collecting vouchers.
                </Alert>
            ) : null}

            {nothingSaved ? (
                <div className="empty-state-card empty-state-card--center">
                    <p className="mb-2 fw-semibold">No vouchers yet</p>
                    <p className="text-muted mb-0">
                        Claim promotions from your inbox or the menu tab and we&apos;ll stash them here.
                    </p>
                </div>
            ) : (
                <div className="d-flex flex-column gap-4">
                    {available.length > 0 ? (
                        <section>
                            <h2 className="h6 mb-3">Ready to use</h2>
                            <div className="d-flex flex-column gap-3">
                                {available.map((entry) => (
                                    <VoucherCard key={entry.id} entry={entry} />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {redeemed.length > 0 ? (
                        <section>
                            <h2 className="h6 mb-3">Redeemed</h2>
                            <div className="d-flex flex-column gap-3">
                                {redeemed.map((entry) => (
                                    <VoucherCard key={entry.id} entry={entry} />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {expired.length > 0 ? (
                        <section>
                            <h2 className="h6 mb-3">Expired</h2>
                            <div className="d-flex flex-column gap-3">
                                {expired.map((entry) => (
                                    <VoucherCard key={entry.id} entry={entry} />
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {revoked.length > 0 ? (
                        <section>
                            <h2 className="h6 mb-3">Revoked</h2>
                            <div className="d-flex flex-column gap-3">
                                {revoked.map((entry) => (
                                    <VoucherCard key={entry.id} entry={entry} />
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>
            )}
        </div>
    );
};

export default VouchersPage;
