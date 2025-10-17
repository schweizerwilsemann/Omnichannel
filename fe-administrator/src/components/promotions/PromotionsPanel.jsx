import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Badge,
    Button,
    Card,
    Col,
    Form,
    Modal,
    Row,
    Spinner
} from 'react-bootstrap';
import { toast } from 'react-toastify';
import {
    fetchMenuCatalog,
    fetchPromotions,
    createPromotion as createPromotionRequest,
    updatePromotion as updatePromotionRequest,
    dispatchPromotionEmails as dispatchPromotionEmailsRequest
} from '../../services/management.service.js';
import { uploadAsset as uploadAssetFile } from '../../services/asset.service.js';
import appConfig from '../../config/appConfig.js';

const PROMOTION_STATUS_VARIANTS = Object.freeze({
    DRAFT: 'secondary',
    SCHEDULED: 'info',
    ACTIVE: 'success',
    EXPIRED: 'warning',
    ARCHIVED: 'dark'
});

const VOUCHER_STATUS_VARIANTS = Object.freeze({
    ACTIVE: 'success',
    INACTIVE: 'secondary'
});

const DEFAULT_TIER = { minSpendCents: '2000', discountPercent: '10', maxDiscountCents: '' };
const DEFAULT_PROMOTION_FORM = {
    restaurantId: '',
    name: '',
    headline: '',
    description: '',
    bannerImageUrl: '',
    ctaLabel: 'Claim voucher',
    status: 'ACTIVE',
    startsAt: '',
    endsAt: '',
    emailSubject: '',
    emailPreviewText: '',
    vouchers: [
        {
            id: undefined,
            code: '',
            name: '',
            description: '',
            status: 'ACTIVE',
            allowStackWithPoints: false,
            claimsPerCustomer: '1',
            totalClaimLimit: '',
            validFrom: '',
            validUntil: '',
            tiers: [DEFAULT_TIER]
        }
    ]
};

const toInputDateTime = (value) => {
    if (!value) {
        return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    const tzOffsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

const fromInputDateTime = (value) => {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toISOString();
};

const promotionToForm = (promotion) => {
    if (!promotion) {
        return DEFAULT_PROMOTION_FORM;
    }

    return {
        restaurantId: promotion.restaurantId || '',
        name: promotion.name || '',
        headline: promotion.headline || '',
        description: promotion.description || '',
        bannerImageUrl: promotion.bannerImageUrl || '',
        ctaLabel: promotion.ctaLabel || 'Claim voucher',
        status: promotion.status || 'DRAFT',
        startsAt: toInputDateTime(promotion.startsAt),
        endsAt: toInputDateTime(promotion.endsAt),
        emailSubject: promotion.emailSubject || '',
        emailPreviewText: promotion.emailPreviewText || '',
        vouchers: (promotion.vouchers || []).map((voucher) => ({
            id: voucher.id,
            code: voucher.code || '',
            name: voucher.name || '',
            description: voucher.description || '',
            status: voucher.status || 'ACTIVE',
            allowStackWithPoints: Boolean(voucher.allowStackWithPoints),
            claimsPerCustomer: voucher.claimsPerCustomer?.toString() || '1',
            totalClaimLimit:
                voucher.totalClaimLimit === null || voucher.totalClaimLimit === undefined
                    ? ''
                    : voucher.totalClaimLimit.toString(),
            validFrom: toInputDateTime(voucher.validFrom),
            validUntil: toInputDateTime(voucher.validUntil),
            tiers: (voucher.tiers || []).map((tier) => ({
                id: tier.id,
                minSpendCents: tier.minSpendCents?.toString() || '0',
                discountPercent: tier.discountPercent?.toString() || '0',
                maxDiscountCents:
                    tier.maxDiscountCents === null || tier.maxDiscountCents === undefined
                        ? ''
                        : tier.maxDiscountCents.toString()
            }))
        }))
    };
};

const normalizeText = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim();
};

const resolveAssetUrl = (url) => {
    if (!url) {
        return '';
    }

    if (/^https?:\/\//i.test(url)) {
        return url;
    }

    const base = appConfig.baseUrl || '';

    try {
        const withTrailing = base.endsWith('/') ? base : `${base}/`;
        const parsed = new URL(withTrailing);
        const normalizedPath = url.startsWith('/') ? url : `/${url}`;
        return `${parsed.origin}${normalizedPath}`;
    } catch (error) {
        const normalizedBase = base.replace(/\/$/, '');
        const normalizedPath = url.startsWith('/') ? url : `/${url}`;
        if (!normalizedBase) {
            return normalizedPath;
        }
        return `${normalizedBase}${normalizedPath}`;
    }
};

const normalizePromotionPayload = (form, isUpdate = false) => {
    const vouchersPayload = (form.vouchers || []).map((voucher) => ({
        id: voucher.id,
        code: voucher.code,
        name: voucher.name,
        description: voucher.description,
        status: voucher.status,
        allowStackWithPoints: Boolean(voucher.allowStackWithPoints),
        claimsPerCustomer: voucher.claimsPerCustomer ? Number(voucher.claimsPerCustomer) : 1,
        totalClaimLimit:
            voucher.totalClaimLimit === '' || voucher.totalClaimLimit === null
                ? null
                : Number(voucher.totalClaimLimit),
        validFrom: fromInputDateTime(voucher.validFrom),
        validUntil: fromInputDateTime(voucher.validUntil),
        tiers: (voucher.tiers || []).map((tier) => ({
            id: tier.id,
            minSpendCents: Number(tier.minSpendCents || 0),
            discountPercent: Number(tier.discountPercent || 0),
            maxDiscountCents:
                tier.maxDiscountCents === '' || tier.maxDiscountCents === null
                    ? null
                    : Number(tier.maxDiscountCents)
        }))
    }));

    const payload = {
        name: form.name,
        headline: form.headline || null,
        description: form.description || null,
        bannerImageUrl: form.bannerImageUrl || null,
        ctaLabel: form.ctaLabel || null,
        status: form.status,
        startsAt: fromInputDateTime(form.startsAt),
        endsAt: fromInputDateTime(form.endsAt),
        emailSubject: form.emailSubject || null,
        emailPreviewText: form.emailPreviewText || null,
        emailBody: null,
        vouchers: vouchersPayload
    };

    if (!isUpdate) {
        payload.restaurantId = form.restaurantId;
    }

    return payload;
};

const PromotionsPanel = () => {
    const [loading, setLoading] = useState(false);
    const [promotions, setPromotions] = useState([]);
    const [restaurants, setRestaurants] = useState([]);
    const [dispatchingId, setDispatchingId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(DEFAULT_PROMOTION_FORM);
    const [editingPromotion, setEditingPromotion] = useState(null);
    const [bannerImageFile, setBannerImageFile] = useState(null);
    const [bannerImagePreview, setBannerImagePreview] = useState('');
    const [bannerImageUploading, setBannerImageUploading] = useState(false);
    const bannerImageInputRef = useRef(null);

    const updateBannerPreview = useCallback((nextPreview) => {
        setBannerImagePreview((previous) => {
            if (previous && previous.startsWith('blob:')) {
                URL.revokeObjectURL(previous);
            }
            return nextPreview || '';
        });
    }, []);

    const clearBannerImageFileSelection = useCallback(() => {
        setBannerImageFile(null);
        if (bannerImageInputRef.current) {
            bannerImageInputRef.current.value = '';
        }
    }, [bannerImageInputRef]);

    const resetBannerImageState = useCallback(() => {
        clearBannerImageFileSelection();
        updateBannerPreview('');
        setBannerImageUploading(false);
    }, [clearBannerImageFileSelection, updateBannerPreview]);

    useEffect(
        () => () => {
            if (bannerImagePreview && bannerImagePreview.startsWith('blob:')) {
                URL.revokeObjectURL(bannerImagePreview);
            }
        },
        [bannerImagePreview]
    );

    const hasPromotions = promotions.length > 0;

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [catalogResponse, promotionsResponse] = await Promise.all([
                fetchMenuCatalog({ page: 1, pageSize: 1 }),
                fetchPromotions()
            ]);
            const catalogPayload = catalogResponse.data?.data || {};
            const promotionsPayload = promotionsResponse.data?.data || [];
            setRestaurants(catalogPayload.restaurants || []);
            setPromotions(promotionsPayload);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to load promotions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenCreate = () => {
        resetBannerImageState();
        setEditingPromotion(null);
        setForm(DEFAULT_PROMOTION_FORM);
        setShowModal(true);
    };

    const handleEditPromotion = (promotion) => {
        resetBannerImageState();
        setEditingPromotion(promotion);
        setForm(promotionToForm(promotion));
        setShowModal(true);
    };

    const handleCloseModal = () => {
        if (saving || bannerImageUploading) {
            return;
        }
        resetBannerImageState();
        setShowModal(false);
        setForm(DEFAULT_PROMOTION_FORM);
        setEditingPromotion(null);
    };

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        if (name === 'bannerImageUrl') {
            clearBannerImageFileSelection();
            updateBannerPreview('');
        }
        setForm((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleBannerImageFileChange = (event) => {
        const file = event.target.files?.[0] || null;

        if (!file) {
            clearBannerImageFileSelection();
            updateBannerPreview(normalizeText(form.bannerImageUrl) || '');
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast.warning('Please select a valid image file.');
            clearBannerImageFileSelection();
            updateBannerPreview(normalizeText(form.bannerImageUrl) || '');
            return;
        }

        setBannerImageFile(file);
        updateBannerPreview(URL.createObjectURL(file));
        setForm((prev) => ({ ...prev, bannerImageUrl: '' }));
    };

    const handleVoucherChange = (index, field, value) => {
        setForm((prev) => {
            const vouchers = [...prev.vouchers];
            const nextVoucher = { ...vouchers[index], [field]: value };
            vouchers[index] = nextVoucher;
            return { ...prev, vouchers };
        });
    };

    const handleVoucherCheckboxChange = (index, field, checked) => {
        setForm((prev) => {
            const vouchers = [...prev.vouchers];
            vouchers[index] = { ...vouchers[index], [field]: checked };
            return { ...prev, vouchers };
        });
    };

    const handleTierChange = (voucherIndex, tierIndex, field, value) => {
        setForm((prev) => {
            const vouchers = [...prev.vouchers];
            const tiers = [...(vouchers[voucherIndex].tiers || [])];
            tiers[tierIndex] = { ...tiers[tierIndex], [field]: value };
            vouchers[voucherIndex] = { ...vouchers[voucherIndex], tiers };
            return { ...prev, vouchers };
        });
    };

    const handleAddTier = (voucherIndex) => {
        setForm((prev) => {
            const vouchers = [...prev.vouchers];
            const tiers = [...(vouchers[voucherIndex].tiers || [])];
            tiers.push({ ...DEFAULT_TIER });
            vouchers[voucherIndex] = { ...vouchers[voucherIndex], tiers };
            return { ...prev, vouchers };
        });
    };

    const handleRemoveTier = (voucherIndex, tierIndex) => {
        setForm((prev) => {
            const vouchers = [...prev.vouchers];
            const tiers = [...(vouchers[voucherIndex].tiers || [])];
            if (tiers.length <= 1) {
                return prev;
            }
            tiers.splice(tierIndex, 1);
            vouchers[voucherIndex] = { ...vouchers[voucherIndex], tiers };
            return { ...prev, vouchers };
        });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!form.restaurantId && !editingPromotion) {
            toast.warn('Please choose a restaurant for the promotion');
            return;
        }

        if (bannerImageUploading) {
            toast.info('Please wait for the banner upload to finish.');
            return;
        }

        const normalizedBannerInput = normalizeText(form.bannerImageUrl);
        let resolvedBannerUrl = normalizedBannerInput ? normalizedBannerInput : null;

        setSaving(true);
        try {
            if (bannerImageFile) {
                setBannerImageUploading(true);
                try {
                    const uploadResponse = await uploadAssetFile(bannerImageFile);
                    const uploaded = uploadResponse.data?.data;
                    resolvedBannerUrl =
                        uploaded?.publicUrl || uploaded?.downloadUrl || uploaded?.fileName || resolvedBannerUrl;
                } catch (error) {
                    toast.error(error.response?.data?.message || 'Unable to upload banner image');
                    return;
                } finally {
                    setBannerImageUploading(false);
                }
            }

            const payload = normalizePromotionPayload(
                { ...form, bannerImageUrl: resolvedBannerUrl || '' },
                Boolean(editingPromotion)
            );

            if (editingPromotion) {
                await updatePromotionRequest(editingPromotion.id, payload);
                toast.success('Promotion updated');
            } else {
                await createPromotionRequest(payload);
                toast.success('Promotion created');
            }
            await loadData();
            handleCloseModal();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to save promotion');
        } finally {
            setSaving(false);
        }
    };

    const handleDispatchEmails = async (promotionId) => {
        setDispatchingId(promotionId);
        try {
            const response = await dispatchPromotionEmailsRequest(promotionId);
            const payload = response.data?.data || {};
            const sent = payload.sent ?? 0;
            toast.success(`Dispatched campaign to ${sent} member${sent === 1 ? '' : 's'}`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to dispatch promotion emails');
        } finally {
            setDispatchingId(null);
        }
    };

    const restaurantOptions = useMemo(() => restaurants || [], [restaurants]);
    const bannerImagePreviewUrl = bannerImagePreview
        ? bannerImagePreview.startsWith('blob:')
            ? bannerImagePreview
            : resolveAssetUrl(bannerImagePreview)
        : resolveAssetUrl(normalizeText(form.bannerImageUrl));

    return (
        <div className="promotions-panel">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <h2 className="h5 mb-0">Promotions & campaigns</h2>
                    <p className="text-muted mb-0">Create voucher campaigns and nudge guests with email blasts.</p>
                </div>
                <div className="d-flex gap-2">
                    <Button variant="outline-secondary" onClick={loadData} disabled={loading}>
                        {loading ? 'Refreshing…' : 'Refresh'}
                    </Button>
                    <Button onClick={handleOpenCreate}>New promotion</Button>
                </div>
            </div>

            {loading ? (
                <div className="d-flex justify-content-center py-5">
                    <Spinner animation="border" />
                </div>
            ) : !hasPromotions ? (
                <Alert variant="info">No promotions yet. Create one to kickstart a voucher campaign.</Alert>
            ) : (
                promotions.map((promotion) => (
                    <Card className="mb-3" key={promotion.id}>
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
                                <div>
                                    <div className="d-flex align-items-center gap-2">
                                        <h3 className="h5 mb-0">{promotion.name}</h3>
                                        <Badge bg={PROMOTION_STATUS_VARIANTS[promotion.status] || 'secondary'}>
                                            {promotion.status}
                                        </Badge>
                                    </div>
                                    <div className="text-muted small mt-1">
                                        {promotion.restaurant?.name || 'Unassigned'} · Active vouchers: {promotion.vouchers?.length || 0}
                                    </div>
                                    {promotion.headline && <p className="mb-2 mt-2">{promotion.headline}</p>}
                                    <div className="text-muted small">
                                        {promotion.startsAt ? `Starts ${new Date(promotion.startsAt).toLocaleString()}` : 'Start: Anytime'}
                                        {' · '}
                                        {promotion.endsAt ? `Ends ${new Date(promotion.endsAt).toLocaleString()}` : 'No end date'}
                                    </div>
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                    <Button
                                        variant="outline-primary"
                                        size="sm"
                                        onClick={() => handleEditPromotion(promotion)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline-success"
                                        size="sm"
                                        onClick={() => handleDispatchEmails(promotion.id)}
                                        disabled={dispatchingId === promotion.id}
                                    >
                                        {dispatchingId === promotion.id ? 'Sending…' : 'Send campaign email'}
                                    </Button>
                                </div>
                            </div>

                            {(promotion.vouchers || []).map((voucher) => (
                                <Card className="mt-3" key={voucher.id}>
                                    <Card.Body>
                                        <div className="d-flex align-items-center gap-2">
                                            <h4 className="h6 mb-0">{voucher.name}</h4>
                                            <Badge bg={VOUCHER_STATUS_VARIANTS[voucher.status] || 'secondary'}>
                                                {voucher.status}
                                            </Badge>
                                        </div>
                                        <div className="text-muted small mt-1">
                                            Code: <strong>{voucher.code}</strong>{' '}
                                            · Allow stacking with loyalty: {voucher.allowStackWithPoints ? 'Yes' : 'No'}
                                        </div>
                                        {voucher.description && <p className="mb-2 mt-2">{voucher.description}</p>}
                                        <div className="text-muted small">
                                            {voucher.validFrom
                                                ? `Valid from ${new Date(voucher.validFrom).toLocaleDateString()}`
                                                : 'Valid immediately'}
                                            {' · '}
                                            {voucher.validUntil
                                                ? `Valid until ${new Date(voucher.validUntil).toLocaleDateString()}`
                                                : 'No set end date'}
                                        </div>
                                        <ul className="mt-3 mb-0 ps-3">
                                            {(voucher.tiers || []).map((tier) => (
                                                <li key={tier.id || `${tier.minSpendCents}-${tier.discountPercent}`}>
                                                    Spend {(tier.minSpendCents / 100).toFixed(2)} → {tier.discountPercent}% off
                                                    {tier.maxDiscountCents
                                                        ? ` (max ${(tier.maxDiscountCents / 100).toFixed(2)})`
                                                        : ''}
                                                </li>
                                            ))}
                                        </ul>
                                    </Card.Body>
                                </Card>
                            ))}
                        </Card.Body>
                    </Card>
                ))
            )}

            <Modal show={showModal} onHide={handleCloseModal} size="lg" centered>
                <Form onSubmit={handleSubmit}>
                    <Modal.Header closeButton>
                        <Modal.Title>{editingPromotion ? 'Edit promotion' : 'Create promotion'}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body className="d-flex flex-column gap-3">
                        {!editingPromotion && (
                            <Form.Group controlId="promotionRestaurant">
                                <Form.Label>Restaurant</Form.Label>
                                <Form.Select
                                    name="restaurantId"
                                    value={form.restaurantId}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value="">Select restaurant</option>
                                    {restaurantOptions.map((restaurant) => (
                                        <option key={restaurant.id} value={restaurant.id}>
                                            {restaurant.name}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        )}
                        <Row className="g-3">
                            <Col md={6}>
                                <Form.Group controlId="promotionName">
                                    <Form.Label>Name</Form.Label>
                                    <Form.Control
                                        name="name"
                                        value={form.name}
                                        onChange={handleFormChange}
                                        required
                                        placeholder="Summer Feast Bonanza"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="promotionStatus">
                                    <Form.Label>Status</Form.Label>
                                    <Form.Select name="status" value={form.status} onChange={handleFormChange}>
                                        <option value="DRAFT">Draft</option>
                                        <option value="SCHEDULED">Scheduled</option>
                                        <option value="ACTIVE">Active</option>
                                        <option value="EXPIRED">Expired</option>
                                        <option value="ARCHIVED">Archived</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row className="g-3">
                            <Col md={6}>
                                <Form.Group controlId="promotionStartsAt">
                                    <Form.Label>Starts at</Form.Label>
                                    <Form.Control
                                        type="datetime-local"
                                        name="startsAt"
                                        value={form.startsAt}
                                        onChange={handleFormChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="promotionEndsAt">
                                    <Form.Label>Ends at</Form.Label>
                                    <Form.Control
                                        type="datetime-local"
                                        name="endsAt"
                                        value={form.endsAt}
                                        onChange={handleFormChange}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group controlId="promotionHeadline">
                            <Form.Label>Headline</Form.Label>
                            <Form.Control
                                name="headline"
                                value={form.headline}
                                onChange={handleFormChange}
                                placeholder="Savor summer with layered savings"
                            />
                        </Form.Group>
                        <Form.Group controlId="promotionDescription">
                            <Form.Label>Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                name="description"
                                value={form.description}
                                onChange={handleFormChange}
                            />
                        </Form.Group>
                        <Row className="g-3">
                            <Col md={6}>
                                <Form.Group controlId="promotionBannerFile">
                                    <Form.Label>Banner image (upload)</Form.Label>
                                    <Form.Control
                                        type="file"
                                        accept="image/*"
                                        onChange={handleBannerImageFileChange}
                                        ref={bannerImageInputRef}
                                        disabled={saving || bannerImageUploading}
                                    />
                                    <Form.Text muted>
                                        Optional. Upload to store the banner and we will keep the generated link.
                                    </Form.Text>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="promotionCtaLabel">
                                    <Form.Label>CTA label</Form.Label>
                                    <Form.Control
                                        name="ctaLabel"
                                        value={form.ctaLabel}
                                        onChange={handleFormChange}
                                        disabled={saving}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Form.Group controlId="promotionBanner">
                            <Form.Label>Banner image URL</Form.Label>
                            <Form.Control
                                name="bannerImageUrl"
                                value={form.bannerImageUrl}
                                onChange={handleFormChange}
                                placeholder="https://..."
                                disabled={saving || bannerImageUploading}
                            />
                            <Form.Text muted>Optional. Paste an existing banner link if you already have one.</Form.Text>
                        </Form.Group>
                        {bannerImagePreviewUrl ? (
                            <Row>
                                <Col md={6}>
                                    <div className="border rounded p-3 bg-light d-flex flex-column gap-2 align-items-center">
                                        <span className="fw-semibold small">Preview</span>
                                        <img
                                            src={bannerImagePreviewUrl}
                                            alt="Promotion banner preview"
                                            className="img-fluid rounded"
                                            style={{ maxHeight: 160, objectFit: 'cover' }}
                                        />
                                    </div>
                                </Col>
                            </Row>
                        ) : null}
                        <Row className="g-3">
                            <Col md={6}>
                                <Form.Group controlId="promotionEmailSubject">
                                    <Form.Label>Email subject (optional)</Form.Label>
                                    <Form.Control
                                        name="emailSubject"
                                        value={form.emailSubject}
                                        onChange={handleFormChange}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="promotionEmailPreview">
                                    <Form.Label>Email preview text</Form.Label>
                                    <Form.Control
                                        name="emailPreviewText"
                                        value={form.emailPreviewText}
                                        onChange={handleFormChange}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        {(form.vouchers || []).map((voucher, voucherIndex) => (
                            <Card key={voucher.id || voucherIndex} className="mt-3">
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                        <div>
                                            <strong>Voucher #{voucherIndex + 1}</strong>
                                            {voucher.code && <span className="text-muted ms-2">({voucher.code})</span>}
                                        </div>
                                        <Badge bg={VOUCHER_STATUS_VARIANTS[voucher.status] || 'secondary'}>
                                            {voucher.status}
                                        </Badge>
                                    </div>
                                    <Row className="g-3">
                                        <Col md={4}>
                                            <Form.Group controlId={`voucherCode-${voucherIndex}`}>
                                                <Form.Label>Code</Form.Label>
                                                <Form.Control
                                                    value={voucher.code}
                                                    onChange={(event) =>
                                                        handleVoucherChange(voucherIndex, 'code', event.target.value)
                                                    }
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={4}>
                                            <Form.Group controlId={`voucherName-${voucherIndex}`}>
                                                <Form.Label>Name</Form.Label>
                                                <Form.Control
                                                    value={voucher.name}
                                                    onChange={(event) =>
                                                        handleVoucherChange(voucherIndex, 'name', event.target.value)
                                                    }
                                                    required
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={4}>
                                            <Form.Group controlId={`voucherStatus-${voucherIndex}`}>
                                                <Form.Label>Status</Form.Label>
                                                <Form.Select
                                                    value={voucher.status}
                                                    onChange={(event) =>
                                                        handleVoucherChange(voucherIndex, 'status', event.target.value)
                                                    }
                                                >
                                                    <option value="ACTIVE">Active</option>
                                                    <option value="INACTIVE">Inactive</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <Form.Group className="mt-3" controlId={`voucherDesc-${voucherIndex}`}>
                                        <Form.Label>Description</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={2}
                                            value={voucher.description}
                                            onChange={(event) =>
                                                handleVoucherChange(voucherIndex, 'description', event.target.value)
                                            }
                                        />
                                    </Form.Group>
                                    <Row className="g-3 mt-1">
                                        <Col md={4}>
                                            <Form.Group controlId={`voucherClaims-${voucherIndex}`}>
                                                <Form.Label>Claims per customer</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    min="1"
                                                    value={voucher.claimsPerCustomer}
                                                    onChange={(event) =>
                                                        handleVoucherChange(
                                                            voucherIndex,
                                                            'claimsPerCustomer',
                                                            event.target.value
                                                        )
                                                    }
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={4}>
                                            <Form.Group controlId={`voucherTotalLimit-${voucherIndex}`}>
                                                <Form.Label>Total claim limit</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    min="1"
                                                    value={voucher.totalClaimLimit}
                                                    onChange={(event) =>
                                                        handleVoucherChange(
                                                            voucherIndex,
                                                            'totalClaimLimit',
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Unlimited"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={4} className="d-flex align-items-center">
                                            <Form.Check
                                                type="switch"
                                                id={`voucherStack-${voucherIndex}`}
                                                label="Allow stacking with loyalty discount"
                                                checked={voucher.allowStackWithPoints}
                                                onChange={(event) =>
                                                    handleVoucherCheckboxChange(
                                                        voucherIndex,
                                                        'allowStackWithPoints',
                                                        event.target.checked
                                                    )
                                                }
                                            />
                                        </Col>
                                    </Row>
                                    <Row className="g-3 mt-1">
                                        <Col md={6}>
                                            <Form.Group controlId={`voucherValidFrom-${voucherIndex}`}>
                                                <Form.Label>Valid from</Form.Label>
                                                <Form.Control
                                                    type="datetime-local"
                                                    value={voucher.validFrom}
                                                    onChange={(event) =>
                                                        handleVoucherChange(
                                                            voucherIndex,
                                                            'validFrom',
                                                            event.target.value
                                                        )
                                                    }
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <Form.Group controlId={`voucherValidUntil-${voucherIndex}`}>
                                                <Form.Label>Valid until</Form.Label>
                                                <Form.Control
                                                    type="datetime-local"
                                                    value={voucher.validUntil}
                                                    onChange={(event) =>
                                                        handleVoucherChange(
                                                            voucherIndex,
                                                            'validUntil',
                                                            event.target.value
                                                        )
                                                    }
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    <div className="mt-3">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <strong>Discount tiers</strong>
                                            <Button
                                                variant="outline-secondary"
                                                size="sm"
                                                onClick={() => handleAddTier(voucherIndex)}
                                            >
                                                Add tier
                                            </Button>
                                        </div>
                                        {(voucher.tiers || []).map((tier, tierIndex) => (
                                            <Row className="g-3 align-items-end" key={tier.id || `${voucherIndex}-tier-${tierIndex}`}>
                                                <Col md={4}>
                                                    <Form.Group controlId={`tierMinSpend-${voucherIndex}-${tierIndex}`}>
                                                        <Form.Label>Min spend (cents)</Form.Label>
                                                        <Form.Control
                                                            type="number"
                                                            min="0"
                                                            value={tier.minSpendCents}
                                                            onChange={(event) =>
                                                                handleTierChange(
                                                                    voucherIndex,
                                                                    tierIndex,
                                                                    'minSpendCents',
                                                                    event.target.value
                                                                )
                                                            }
                                                            required
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={3}>
                                                    <Form.Group controlId={`tierPercent-${voucherIndex}-${tierIndex}`}>
                                                        <Form.Label>Discount %</Form.Label>
                                                        <Form.Control
                                                            type="number"
                                                            min="0"
                                                            max="50"
                                                            value={tier.discountPercent}
                                                            onChange={(event) =>
                                                                handleTierChange(
                                                                    voucherIndex,
                                                                    tierIndex,
                                                                    'discountPercent',
                                                                    event.target.value
                                                                )
                                                            }
                                                            required
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={3}>
                                                    <Form.Group controlId={`tierMaxDiscount-${voucherIndex}-${tierIndex}`}>
                                                        <Form.Label>Max discount (cents)</Form.Label>
                                                        <Form.Control
                                                            type="number"
                                                            min="0"
                                                            value={tier.maxDiscountCents}
                                                            onChange={(event) =>
                                                                handleTierChange(
                                                                    voucherIndex,
                                                                    tierIndex,
                                                                    'maxDiscountCents',
                                                                    event.target.value
                                                                )
                                                            }
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col md={2}>
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        className="w-100"
                                                        onClick={() => handleRemoveTier(voucherIndex, tierIndex)}
                                                        disabled={(voucher.tiers || []).length <= 1}
                                                    >
                                                        Remove
                                                    </Button>
                                                </Col>
                                            </Row>
                                        ))}
                                    </div>
                                </Card.Body>
                            </Card>
                        ))}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            variant="outline-secondary"
                            onClick={handleCloseModal}
                            disabled={saving || bannerImageUploading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving || bannerImageUploading}>
                            {saving ? 'Saving…' : editingPromotion ? 'Save changes' : 'Create promotion'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
};

export default PromotionsPanel;
