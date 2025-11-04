import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table, Tab, Tabs, Pagination } from 'react-bootstrap';
import { toast } from 'react-toastify';
import MainLayout from '../components/layout/MainLayout.jsx';
import {
    fetchMenuCatalog,
    createMenuItem,
    updateMenuItem,
    createMenuCombo,
    updateMenuCombo,
    fetchCustomers,
    createCustomerMembership,
    updateCustomerMembership,
    fetchTables,
    createTable,
    updateTable
} from '../services/management.service.js';
import { uploadAsset as uploadAssetFile } from '../services/asset.service.js';
import appConfig from '../config/appConfig.js';
import PromotionsPanel from '../components/promotions/PromotionsPanel.jsx';
import RecommendationInsightsPanel from '../components/recommendations/RecommendationInsightsPanel.jsx';
import KnowledgeSyncPanel from '../components/knowledge/KnowledgeSyncPanel.jsx';

const MANAGEMENT_TABS = Object.freeze({
    MENU: 'menu',
    CUSTOMERS: 'customers',
    TABLES: 'tables',
    PROMOTIONS: 'promotions',
    RECOMMENDATIONS: 'recommendations',
    KNOWLEDGE: 'knowledge'
});

const TABLE_STATUS_VARIANTS = Object.freeze({
    AVAILABLE: 'success',
    RESERVED: 'warning',
    OUT_OF_SERVICE: 'secondary'
});

const DEFAULT_PAGE_SIZE = 10;

const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
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

const toPaginationState = (pagination = {}, fallbackPage = 1, fallbackPageSize = DEFAULT_PAGE_SIZE, fallbackTotalItems = 0) => {
    const rawPage = toNumber(pagination.page) ?? fallbackPage;
    const rawPageSize = toNumber(pagination.pageSize) ?? fallbackPageSize;
    const safePageSize = Math.max(rawPageSize, 1);
    const totalItems = toNumber(pagination.totalItems) ?? Math.max(fallbackTotalItems, 0);
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / safePageSize) : 0;
    const safePage = Math.max(rawPage, 1);
    const currentPage = totalPages > 0 ? Math.min(safePage, totalPages) : 1;

    const hasNext = typeof pagination.hasNext === 'boolean' ? pagination.hasNext : totalPages > 0 && currentPage < totalPages;
    const hasPrevious =
        typeof pagination.hasPrevious === 'boolean' ? pagination.hasPrevious : totalPages > 0 && currentPage > 1;

    return {
        page: currentPage,
        pageSize: safePageSize,
        totalItems,
        totalPages,
        hasNext,
        hasPrevious
    };
};

const describeRange = (pagination, currentCount) => {
    if (!pagination || pagination.totalItems === 0 || currentCount === 0) {
        return 'No records';
    }
    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(start + currentCount - 1, pagination.totalItems);
    return `Showing ${start}-${end} of ${pagination.totalItems}`;
};

const formatCurrency = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) {
        return 'USD 0.00';
    }
    return 'USD ' + (amount / 100).toFixed(2);
};

const resolveCustomerName = (customer) => {
    if (!customer) {
        return 'Guest';
    }
    const parts = [];
    if (customer.firstName) {
        parts.push(customer.firstName);
    }
    if (customer.lastName) {
        parts.push(customer.lastName);
    }
    if (parts.length > 0) {
        return parts.join(' ');
    }
    return 'Guest';
};

const resolveMembershipNumber = (customer) => {
    if (!customer || !customer.membershipNumber) {
        return 'N/A';
    }
    return customer.membershipNumber;
};

const initialMenuForm = {
    categoryId: '',
    name: '',
    sku: '',
    price: '',
    description: '',
    prepTimeSeconds: '',
    imageUrl: '',
    isAvailable: true
};

const createInitialComboForm = () => ({
    restaurantId: '',
    name: '',
    sku: '',
    price: '',
    description: '',
    prepTimeSeconds: '',
    imageUrl: '',
    isAvailable: true,
    components: [{ menuItemId: '', quantity: '1' }]
});

const initialCustomerForm = {
    restaurantId: '',
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    membershipNumber: '',
    status: 'GUEST',
    loyaltyPoints: '0',
    discountBalance: '0'
};

const initialTableForm = {
    restaurantId: '',
    name: '',
    qrSlug: '',
    capacity: '2',
    status: 'AVAILABLE'
};

const ManagementPage = () => {
    const [activeKey, setActiveKey] = useState(MANAGEMENT_TABS.MENU);
    const [loading, setLoading] = useState({ menu: false, customers: false, tables: false });
    const [loaded, setLoaded] = useState({ menu: false, customers: false, tables: false });
    const [saving, setSaving] = useState({ menu: false, combos: false, customers: false, tables: false });
    const [menuData, setMenuData] = useState({ restaurants: [], categories: [], items: [], combos: [], menuLibrary: [] });
    const [customerData, setCustomerData] = useState({ restaurants: [], memberships: [] });
    const [tableData, setTableData] = useState({ restaurants: [], tables: [] });
    const [menuForm, setMenuForm] = useState(initialMenuForm);
    const [comboForm, setComboForm] = useState(createInitialComboForm());
    const [customerForm, setCustomerForm] = useState(initialCustomerForm);
    const [tableForm, setTableForm] = useState(initialTableForm);
    const [mutations, setMutations] = useState({ menuItems: {}, menuCombos: {}, memberships: {}, tables: {} });
    const menuImageInputRef = useRef(null);
    const [menuImageFile, setMenuImageFile] = useState(null);
    const [menuImagePreview, setMenuImagePreview] = useState('');
    const [menuImageUploading, setMenuImageUploading] = useState(false);
    const comboImageInputRef = useRef(null);
    const [comboImageFile, setComboImageFile] = useState(null);
    const [comboImagePreview, setComboImagePreview] = useState('');
    const [comboImageUploading, setComboImageUploading] = useState(false);
    const [comboSearch, setComboSearch] = useState('');
    const [menuPagination, setMenuPagination] = useState({
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalItems: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false
    });
    const [customerPagination, setCustomerPagination] = useState({
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalItems: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false
    });
    const [tablePagination, setTablePagination] = useState({
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        totalItems: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false
    });

    const menuLoaded = loaded.menu;
    const customersLoaded = loaded.customers;
    const tablesLoaded = loaded.tables;

    useEffect(() => () => {
        if (menuImagePreview) {
            URL.revokeObjectURL(menuImagePreview);
        }
    }, [menuImagePreview]);
    useEffect(() => () => {
        if (comboImagePreview) {
            URL.revokeObjectURL(comboImagePreview);
        }
    }, [comboImagePreview]);
    useEffect(() => {
        if (!comboForm.restaurantId && menuData.restaurants.length > 0) {
            setComboForm((prev) => ({
                ...prev,
                restaurantId: menuData.restaurants[0].id
            }));
            setComboSearch('');
        }
    }, [comboForm.restaurantId, menuData.restaurants]);
    const loadMenuData = useCallback(
        async (overrides = {}) => {
            const nextPage = overrides.page ?? menuPagination.page;
            const nextPageSize = overrides.pageSize ?? menuPagination.pageSize;

            setLoading((prev) => ({ ...prev, menu: true }));
            try {
                const response = await fetchMenuCatalog({ page: nextPage, pageSize: nextPageSize });
                const payload = response.data?.data || {};

                let uniqueMenuLibrary = null;
                if (nextPage === 1) {
                    let menuLibrary = Array.isArray(payload.items) ? [...payload.items] : [];
                    const totalPages = payload.pagination?.totalPages || 1;
                    const pageSizeForFetch = payload.pagination?.pageSize || nextPageSize;

                    if (totalPages > 1) {
                        const extraRequests = [];
                        for (let pageIndex = 2; pageIndex <= totalPages; pageIndex++) {
                            extraRequests.push(fetchMenuCatalog({ page: pageIndex, pageSize: pageSizeForFetch }));
                        }
                        try {
                            const extraResponses = await Promise.all(extraRequests);
                            extraResponses.forEach((extra) => {
                                const extraPayload = extra.data?.data || {};
                                if (Array.isArray(extraPayload.items)) {
                                    menuLibrary = menuLibrary.concat(extraPayload.items);
                                }
                            });
                        } catch (error) {
                            console.warn('Unable to load additional menu items for combo selector', error);
                        }
                    }

                    uniqueMenuLibrary = Array.from(
                        new Map(
                            menuLibrary
                                .filter((item) => item && item.id)
                                .map((item) => [item.id, item])
                        ).values()
                    );
                    uniqueMenuLibrary.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                }

                setMenuData((prev) => ({
                    restaurants: payload.restaurants || [],
                    categories: payload.categories || [],
                    items: payload.items || [],
                    combos: payload.combos || [],
                    menuLibrary:
                        nextPage === 1
                            ? uniqueMenuLibrary ??
                                (Array.isArray(payload.items)
                                    ? [...payload.items].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                    : [])
                            : prev.menuLibrary
                }));
                setMenuPagination(
                    toPaginationState(payload.pagination || {}, nextPage, nextPageSize, payload.items?.length ?? 0)
                );
                setLoaded((prev) => ({ ...prev, menu: true }));
            } catch (error) {
                toast.error(error.response?.data?.message || 'Unable to load menu catalog');
            } finally {
                setLoading((prev) => ({ ...prev, menu: false }));
            }
        },
        [menuPagination.page, menuPagination.pageSize]
    );

    const loadCustomerData = useCallback(
        async (overrides = {}) => {
            const nextPage = overrides.page ?? customerPagination.page;
            const nextPageSize = overrides.pageSize ?? customerPagination.pageSize;

            setLoading((prev) => ({ ...prev, customers: true }));
            try {
                const response = await fetchCustomers({ page: nextPage, pageSize: nextPageSize });
                const payload = response.data?.data || {};
                setCustomerData({
                    restaurants: payload.restaurants || [],
                    memberships: payload.memberships || []
                });
                setCustomerPagination(
                    toPaginationState(payload.pagination || {}, nextPage, nextPageSize, payload.memberships?.length ?? 0)
                );
                setLoaded((prev) => ({ ...prev, customers: true }));
            } catch (error) {
                toast.error(error.response?.data?.message || 'Unable to load customers');
            } finally {
                setLoading((prev) => ({ ...prev, customers: false }));
            }
        },
        [customerPagination.page, customerPagination.pageSize]
    );

    const loadTableData = useCallback(
        async (overrides = {}) => {
            const nextPage = overrides.page ?? tablePagination.page;
            const nextPageSize = overrides.pageSize ?? tablePagination.pageSize;

            setLoading((prev) => ({ ...prev, tables: true }));
            try {
                const response = await fetchTables({ page: nextPage, pageSize: nextPageSize });
                const payload = response.data?.data || {};
                setTableData({
                    restaurants: payload.restaurants || [],
                    tables: payload.tables || []
                });
                setTablePagination(
                    toPaginationState(payload.pagination || {}, nextPage, nextPageSize, payload.tables?.length ?? 0)
                );
                setLoaded((prev) => ({ ...prev, tables: true }));
            } catch (error) {
                toast.error(error.response?.data?.message || 'Unable to load tables');
            } finally {
                setLoading((prev) => ({ ...prev, tables: false }));
            }
        },
        [tablePagination.page, tablePagination.pageSize]
    );

    useEffect(() => {
        if (!menuLoaded && !loading.menu) {
            loadMenuData();
        }
    }, [menuLoaded, loading.menu, loadMenuData]);

    useEffect(() => {
        if (activeKey === MANAGEMENT_TABS.CUSTOMERS && !customersLoaded && !loading.customers) {
            loadCustomerData();
        }
        if (activeKey === MANAGEMENT_TABS.TABLES && !tablesLoaded && !loading.tables) {
            loadTableData();
        }
    }, [activeKey, customersLoaded, tablesLoaded, loading.customers, loading.tables, loadCustomerData, loadTableData]);

    const handleMenuFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        setMenuForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const clearMenuImageSelection = () => {
        if (menuImagePreview) {
            URL.revokeObjectURL(menuImagePreview);
        }
        setMenuImagePreview('');
        setMenuImageFile(null);
        if (menuImageInputRef.current) {
            menuImageInputRef.current.value = '';
        }
        setMenuForm((prev) => ({ ...prev, imageUrl: '' }));
    };

    const handleMenuImageFileChange = (event) => {
        const file = event.target.files?.[0] || null;

        if (!file) {
            clearMenuImageSelection();
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast.warning('Vui lòng chọn tệp hình ảnh hợp lệ.');
            clearMenuImageSelection();
            return;
        }

        if (menuImagePreview) {
            URL.revokeObjectURL(menuImagePreview);
        }

        const previewUrl = URL.createObjectURL(file);
        setMenuImageFile(file);
        setMenuImagePreview(previewUrl);
    };

    const handleComboFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        if (name === 'restaurantId') {
            setComboForm((prev) => ({
                ...prev,
                restaurantId: value,
                components: [{ menuItemId: '', quantity: '1' }]
            }));
            setComboSearch('');
            return;
        }
        setComboForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const clearComboImageSelection = () => {
        if (comboImagePreview) {
            URL.revokeObjectURL(comboImagePreview);
        }
        setComboImagePreview('');
        setComboImageFile(null);
        if (comboImageInputRef.current) {
            comboImageInputRef.current.value = '';
        }
        setComboForm((prev) => ({ ...prev, imageUrl: '' }));
    };

    const handleComboImageFileChange = (event) => {
        const file = event.target.files?.[0] || null;

        if (!file) {
            clearComboImageSelection();
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast.warning('Vui lòng chọn tệp hình ảnh hợp lệ.');
            clearComboImageSelection();
            return;
        }

        if (comboImagePreview) {
            URL.revokeObjectURL(comboImagePreview);
        }

        const previewUrl = URL.createObjectURL(file);
        setComboImageFile(file);
        setComboImagePreview(previewUrl);
    };

    const handleComboComponentChange = (index, field, value) => {
        setComboForm((prev) => {
            const nextComponents = prev.components.map((component, componentIndex) =>
                componentIndex === index ? { ...component, [field]: value } : component
            );
            return { ...prev, components: nextComponents };
        });
    };

    const handleAddComboComponent = () => {
        setComboForm((prev) => ({
            ...prev,
            components: [...prev.components, { menuItemId: '', quantity: '1' }]
        }));
    };

    const handleRemoveComboComponent = (index) => {
        setComboForm((prev) => {
            if (prev.components.length <= 1) {
                return prev;
            }
            const nextComponents = prev.components.filter((_, componentIndex) => componentIndex !== index);
            return {
                ...prev,
                components: nextComponents.length > 0 ? nextComponents : [{ menuItemId: '', quantity: '1' }]
            };
        });
    };

    const handleCustomerFormChange = (event) => {
        const { name, value } = event.target;
        setCustomerForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleTableFormChange = (event) => {
        const { name, value } = event.target;
        setTableForm((prev) => ({ ...prev, [name]: value }));
    };

    const normalizeText = (value) => {
        if (typeof value !== 'string') {
            return value;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : null;
    };

    const handleCreateMenuItem = async (event) => {
        event.preventDefault();
        if (saving.menu || menuImageUploading) {
            return;
        }
        if (!menuForm.categoryId) {
            toast.warning('Please select a category');
            return;
        }
        const priceValue = parseFloat(menuForm.price);
        if (!Number.isFinite(priceValue)) {
            toast.warning('Please enter a valid price');
            return;
        }
        const payload = {
            categoryId: menuForm.categoryId,
            name: normalizeText(menuForm.name),
            sku: normalizeText(menuForm.sku),
            description: normalizeText(menuForm.description),
            priceCents: Math.max(0, Math.round(priceValue * 100)),
            isAvailable: Boolean(menuForm.isAvailable),
            prepTimeSeconds: menuForm.prepTimeSeconds ? Number.parseInt(menuForm.prepTimeSeconds, 10) : null
        };
        if (!payload.name || !payload.sku) {
            toast.warning('Name and SKU are required');
            return;
        }
        if (Number.isNaN(payload.prepTimeSeconds)) {
            payload.prepTimeSeconds = null;
        }

        setSaving((prev) => ({ ...prev, menu: true }));
        try {
            let resolvedImageUrl = normalizeText(menuForm.imageUrl);

            if (menuImageFile) {
                setMenuImageUploading(true);
                try {
                    const uploadResponse = await uploadAssetFile(menuImageFile);
                    const uploaded = uploadResponse.data?.data;
                    resolvedImageUrl =
                        uploaded?.publicUrl || uploaded?.downloadUrl || uploaded?.fileName || resolvedImageUrl;
                    if (resolvedImageUrl) {
                        setMenuForm((prev) => ({ ...prev, imageUrl: resolvedImageUrl }));
                    }
                } catch (error) {
                    toast.error(error.response?.data?.message || 'Unable to upload image');
                    return;
                } finally {
                    setMenuImageUploading(false);
                }
            }

            const response = await createMenuItem({
                ...payload,
                imageUrl: resolvedImageUrl || null
            });
            const created = response.data?.data;
            if (created) {
                toast.success('Menu item created');
                clearMenuImageSelection();
                setMenuForm((prev) => ({ ...initialMenuForm, categoryId: prev.categoryId }));
                await loadMenuData({ page: 1 });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to create menu item');
        } finally {
            setSaving((prev) => ({ ...prev, menu: false }));
        }
    };
    const handleToggleMenuItemAvailability = async (item) => {
        const nextValue = !item.isAvailable;
        setMutations((prev) => ({
            ...prev,
            menuItems: { ...prev.menuItems, [item.id]: true }
        }));
        try {
            const response = await updateMenuItem(item.id, { isAvailable: nextValue });
            const updated = response.data?.data;
            setMenuData((prev) => ({
                ...prev,
                items: prev.items.map((entry) => (entry.id === item.id ? updated || { ...entry, isAvailable: nextValue } : entry))
            }));
            toast.success(nextValue ? 'Menu item marked as available' : 'Menu item marked as unavailable');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to update menu item');
        } finally {
            setMutations((prev) => {
                const nextMenu = { ...prev.menuItems };
                delete nextMenu[item.id];
                return { ...prev, menuItems: nextMenu };
            });
        }
    };

    const handleCreateCombo = async (event) => {
        event.preventDefault();
        if (saving.combos || comboImageUploading) {
            return;
        }
        if (!comboForm.restaurantId) {
            toast.warning('Please choose a restaurant for this combo');
            return;
        }
        const priceValue = parseFloat(comboForm.price);
        if (!Number.isFinite(priceValue)) {
            toast.warning('Please enter a valid combo price');
            return;
        }

        const componentPayload = comboForm.components
            .filter((component) => component.menuItemId)
            .map((component) => ({
                menuItemId: component.menuItemId,
                quantity: Math.max(1, Number.parseInt(component.quantity, 10) || 1)
            }));

        if (componentPayload.length === 0) {
            toast.warning('Add at least one menu item to the combo');
            return;
        }

        const payload = {
            restaurantId: comboForm.restaurantId,
            name: normalizeText(comboForm.name),
            sku: normalizeText(comboForm.sku),
            description: normalizeText(comboForm.description),
            priceCents: Math.max(0, Math.round(priceValue * 100)),
            isAvailable: Boolean(comboForm.isAvailable),
            prepTimeSeconds: comboForm.prepTimeSeconds ? Number.parseInt(comboForm.prepTimeSeconds, 10) : null,
            items: componentPayload
        };

        if (!payload.name || !payload.sku) {
            toast.warning('Name and SKU are required for combos');
            return;
        }

        if (Number.isNaN(payload.prepTimeSeconds)) {
            payload.prepTimeSeconds = null;
        }

        setSaving((prev) => ({ ...prev, combos: true }));
        try {
            let resolvedImageUrl = normalizeText(comboForm.imageUrl);

            if (comboImageFile) {
                setComboImageUploading(true);
                try {
                    const uploadResponse = await uploadAssetFile(comboImageFile);
                    const uploaded = uploadResponse.data?.data;
                    resolvedImageUrl =
                        uploaded?.publicUrl || uploaded?.downloadUrl || uploaded?.fileName || resolvedImageUrl;
                    if (resolvedImageUrl) {
                        setComboForm((prev) => ({ ...prev, imageUrl: resolvedImageUrl }));
                    }
                } catch (error) {
                    toast.error(error.response?.data?.message || 'Unable to upload combo image');
                    return;
                } finally {
                    setComboImageUploading(false);
                }
            }

            const response = await createMenuCombo({
                ...payload,
                imageUrl: resolvedImageUrl || null
            });
            const created = response.data?.data;
            if (created) {
                toast.success('Menu combo created');
                clearComboImageSelection();
                setComboForm((prev) => ({
                    ...createInitialComboForm(),
                    restaurantId: prev.restaurantId || ''
                }));
                setComboSearch('');
                await loadMenuData({ page: 1 });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to create menu combo');
        } finally {
            setSaving((prev) => ({ ...prev, combos: false }));
        }
    };

    const handleToggleComboAvailability = async (combo) => {
        const nextValue = !combo.isAvailable;
        setMutations((prev) => ({
            ...prev,
            menuCombos: { ...prev.menuCombos, [combo.id]: true }
        }));
        try {
            const response = await updateMenuCombo(combo.id, { isAvailable: nextValue });
            const updated = response.data?.data;
            setMenuData((prev) => ({
                ...prev,
                combos: prev.combos.map((entry) =>
                    entry.id === combo.id ? updated || { ...entry, isAvailable: nextValue } : entry
                )
            }));
            toast.success(nextValue ? 'Combo is now visible to guests' : 'Combo hidden from guests');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to update menu combo');
        } finally {
            setMutations((prev) => {
                const nextCombos = { ...prev.menuCombos };
                delete nextCombos[combo.id];
                return { ...prev, menuCombos: nextCombos };
            });
        }
    };

    const handleCreateCustomerMembership = async (event) => {
        event.preventDefault();
        if (saving.customers) {
            return;
        }
        if (!customerForm.restaurantId) {
            toast.warning('Please choose a restaurant');
            return;
        }
        const loyaltyPointsValue = Number.parseInt(customerForm.loyaltyPoints, 10);
        const discountValue = Number.parseFloat(customerForm.discountBalance);
        const payload = {
            restaurantId: customerForm.restaurantId,
            status: customerForm.status,
            loyaltyPoints: Number.isNaN(loyaltyPointsValue) ? 0 : Math.max(0, loyaltyPointsValue),
            discountBalanceCents: Number.isNaN(discountValue) ? 0 : Math.max(0, Math.round(discountValue * 100)),
            customer: {
                firstName: normalizeText(customerForm.firstName),
                lastName: normalizeText(customerForm.lastName),
                email: normalizeText(customerForm.email),
                phoneNumber: normalizeText(customerForm.phoneNumber),
                membershipNumber: normalizeText(customerForm.membershipNumber)
            }
        };

        setSaving((prev) => ({ ...prev, customers: true }));
        try {
            const response = await createCustomerMembership(payload);
            const created = response.data?.data;
            if (created) {
                toast.success('Customer membership created');
                setCustomerForm((prev) => ({ ...initialCustomerForm, restaurantId: prev.restaurantId }));
                await loadCustomerData({ page: 1 });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to create customer membership');
        } finally {
            setSaving((prev) => ({ ...prev, customers: false }));
        }
    };

    const handleToggleMembershipStatus = async (membership) => {
        const nextStatus = membership.status === 'MEMBER' ? 'GUEST' : 'MEMBER';
        setMutations((prev) => ({
            ...prev,
            memberships: { ...prev.memberships, [membership.id]: true }
        }));
        try {
            const response = await updateCustomerMembership(membership.id, { status: nextStatus });
            const updated = response.data?.data;
            setCustomerData((prev) => ({
                ...prev,
                memberships: prev.memberships.map((entry) =>
                    entry.id === membership.id ? updated || { ...entry, status: nextStatus } : entry
                )
            }));
            toast.success(nextStatus === 'MEMBER' ? 'Customer promoted to member' : 'Customer marked as guest');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to update customer membership');
        } finally {
            setMutations((prev) => {
                const nextMemberships = { ...prev.memberships };
                delete nextMemberships[membership.id];
                return { ...prev, memberships: nextMemberships };
            });
        }
    };

    const handleCreateTable = async (event) => {
        event.preventDefault();
        if (saving.tables) {
            return;
        }
        if (!tableForm.restaurantId) {
            toast.warning('Please choose a restaurant');
            return;
        }
        const capacityValue = Number.parseInt(tableForm.capacity, 10);
        if (!Number.isFinite(capacityValue) || capacityValue <= 0) {
            toast.warning('Capacity must be a positive number');
            return;
        }
        const payload = {
            restaurantId: tableForm.restaurantId,
            name: normalizeText(tableForm.name),
            qrSlug: normalizeText(tableForm.qrSlug),
            capacity: capacityValue,
            status: tableForm.status
        };
        if (!payload.name || !payload.qrSlug) {
            toast.warning('Table name and QR slug are required');
            return;
        }

        setSaving((prev) => ({ ...prev, tables: true }));
        try {
            const response = await createTable(payload);
            const created = response.data?.data;
            if (created) {
                toast.success('Table created');
                setTableForm((prev) => ({ ...initialTableForm, restaurantId: prev.restaurantId }));
                await loadTableData({ page: 1 });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to create table');
        } finally {
            setSaving((prev) => ({ ...prev, tables: false }));
        }
    };

    const handleUpdateTableStatus = async (table, nextStatus) => {
        setMutations((prev) => ({
            ...prev,
            tables: { ...prev.tables, [table.id]: true }
        }));
        try {
            const response = await updateTable(table.id, { status: nextStatus });
            const updated = response.data?.data;
            setTableData((prev) => ({
                ...prev,
                tables: prev.tables.map((entry) => (entry.id === table.id ? updated || { ...entry, status: nextStatus } : entry))
            }));
            toast.success('Table status updated');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Unable to update table');
        } finally {
            setMutations((prev) => {
                const nextTables = { ...prev.tables };
                delete nextTables[table.id];
                return { ...prev, tables: nextTables };
            });
        }
    };

    const handleMenuPageChange = (nextPage) => {
        const target = Math.max(1, nextPage);
        if (target === menuPagination.page || loading.menu) {
            return;
        }
        loadMenuData({ page: target });
    };

    const handleCustomerPageChange = (nextPage) => {
        const target = Math.max(1, nextPage);
        if (target === customerPagination.page || loading.customers) {
            return;
        }
        loadCustomerData({ page: target });
    };

    const handleTablePageChange = (nextPage) => {
        const target = Math.max(1, nextPage);
        if (target === tablePagination.page || loading.tables) {
            return;
        }
        loadTableData({ page: target });
    };

    const categoryOptions = useMemo(() => menuData.categories, [menuData.categories]);
    const menuItems = useMemo(() => menuData.items, [menuData.items]);
    const menuLibrary = useMemo(() => menuData.menuLibrary || [], [menuData.menuLibrary]);
    const menuCombos = useMemo(() => menuData.combos || [], [menuData.combos]);
    const customerMemberships = useMemo(() => customerData.memberships, [customerData.memberships]);
    const menuItemsByRestaurant = useMemo(() => {
        const mapping = new Map();
        menuLibrary.forEach((item) => {
            const restaurantId = item.category?.restaurantId;
            if (!restaurantId) {
                return;
            }
            if (!mapping.has(restaurantId)) {
                mapping.set(restaurantId, []);
            }
            mapping.get(restaurantId).push(item);
        });
        mapping.forEach((entries) => {
            entries.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        });
        return mapping;
    }, [menuLibrary]);
    const restaurantOptions = useMemo(() => {
        const restaurantMap = new Map();
        const sources = [menuData.restaurants, customerData.restaurants, tableData.restaurants];
        sources.forEach((collection) => {
            collection.forEach((restaurant) => {
                if (restaurant && restaurant.id && !restaurantMap.has(restaurant.id)) {
                    restaurantMap.set(restaurant.id, restaurant);
                }
            });
        });
        return Array.from(restaurantMap.values());
    }, [menuData.restaurants, customerData.restaurants, tableData.restaurants]);

    const comboAvailableOptions = useMemo(
        () => (comboForm.restaurantId ? menuItemsByRestaurant.get(comboForm.restaurantId) || [] : []),
        [comboForm.restaurantId, menuItemsByRestaurant]
    );
    const comboFilteredOptions = useMemo(() => {
        if (!comboSearch.trim()) {
            return comboAvailableOptions;
        }
        const keyword = comboSearch.trim().toLowerCase();
        return comboAvailableOptions.filter((item) => {
            const nameMatch = item.name?.toLowerCase().includes(keyword);
            const skuMatch = item.sku?.toLowerCase().includes(keyword);
            return Boolean(nameMatch || skuMatch);
        });
    }, [comboAvailableOptions, comboSearch]);
    const tableEntries = useMemo(() => tableData.tables, [tableData.tables]);
    const menuImagePreviewUrl = menuImagePreview
        ? menuImagePreview
        : resolveAssetUrl(normalizeText(menuForm.imageUrl));
    const comboImagePreviewUrl = comboImagePreview
        ? comboImagePreview
        : resolveAssetUrl(normalizeText(comboForm.imageUrl));
    return (
        <MainLayout>
            <div className="d-flex flex-column gap-4">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                        <h2 className="mb-1">Management</h2>
                        <p className="text-muted mb-0">Manage menu items, loyal customers, and dining tables from one workspace.</p>
                    </div>
                </div>

                <Tabs activeKey={activeKey} onSelect={(key) => key && setActiveKey(key)} justify>
                    <Tab eventKey={MANAGEMENT_TABS.MENU} title="Menu">
                        <div className="pt-4 d-flex flex-column gap-4">
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <h5 className="mb-0">Menu items</h5>
                                <Button variant="outline-secondary" size="sm" onClick={() => loadMenuData()} disabled={loading.menu}>
                                    {loading.menu ? 'Refreshing…' : 'Refresh'}
                                </Button>
                            </div>

                            <Card className="shadow-sm">
                                <Card.Body>
                                    <Form onSubmit={handleCreateMenuItem} className="d-flex flex-column gap-3">
                                        <Row className="g-3">
                                            <Col md={4}>
                                                <Form.Group controlId="menu-category">
                                                    <Form.Label>Category</Form.Label>
                                                    <Form.Select
                                                        name="categoryId"
                                                        value={menuForm.categoryId}
                                                        onChange={handleMenuFormChange}
                                                        required
                                                        disabled={categoryOptions.length === 0}
                                                    >
                                                        <option value="">Select category</option>
                                                        {categoryOptions.map((category) => (
                                                            <option key={category.id} value={category.id}>
                                                                {category.name}
                                                            </option>
                                                        ))}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="menu-name">
                                                    <Form.Label>Name</Form.Label>
                                                    <Form.Control
                                                        name="name"
                                                        value={menuForm.name}
                                                        onChange={handleMenuFormChange}
                                                        placeholder="E.g. Grilled salmon"
                                                        required
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="menu-sku">
                                                    <Form.Label>SKU</Form.Label>
                                                    <Form.Control
                                                        name="sku"
                                                        value={menuForm.sku}
                                                        onChange={handleMenuFormChange}
                                                        placeholder="Internal code"
                                                        required
                                                    />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Row className="g-3">
                                            <Col md={3}>
                                                <Form.Group controlId="menu-price">
                                                    <Form.Label>Price (USD)</Form.Label>
                                                    <Form.Control
                                                        name="price"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={menuForm.price}
                                                        onChange={handleMenuFormChange}
                                                        required
                                                        disabled={saving.menu}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={3}>
                                                <Form.Group controlId="menu-prep-time">
                                                    <Form.Label>Prep time (seconds)</Form.Label>
                                                    <Form.Control
                                                        name="prepTimeSeconds"
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={menuForm.prepTimeSeconds}
                                                        onChange={handleMenuFormChange}
                                                        disabled={saving.menu}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={6}>
                                                <Form.Group controlId="menu-image-file">
                                                    <Form.Label>Dish image</Form.Label>
                                                    <Form.Control
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleMenuImageFileChange}
                                                        ref={menuImageInputRef}
                                                        disabled={saving.menu || menuImageUploading}
                                                    />
                                                    <Form.Text muted>
                                                        Optional. Ảnh sẽ được tải lên MinIO và lưu đường dẫn tự động.
                                                    </Form.Text>
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Form.Group controlId="menu-description">
                                            <Form.Label>Description</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={2}
                                                name="description"
                                                value={menuForm.description}
                                                onChange={handleMenuFormChange}
                                                placeholder="Notes for guests or kitchen"
                                                disabled={saving.menu}
                                            />
                                        </Form.Group>
                                        <Form.Check
                                            type="switch"
                                            id="menu-availability"
                                            name="isAvailable"
                                            label="Available to guests"
                                            checked={menuForm.isAvailable}
                                            onChange={handleMenuFormChange}
                                            disabled={saving.menu}
                                        />
                                        <div>
                                            <Button
                                                type="submit"
                                                disabled={saving.menu || menuImageUploading || categoryOptions.length === 0}
                                            >
                                                {saving.menu ? (
                                                    <>
                                                        <Spinner animation="border" size="sm" className="me-2" /> Saving…
                                                    </>
                                                ) : (
                                                    'Add menu item'
                                                )}
                                            </Button>
                                        </div>
                                        {menuImagePreviewUrl || menuForm.imageUrl ? (
                                            <Row className="g-3">
                                                {menuImagePreviewUrl ? (
                                                    <Col md={4}>
                                                        <div className="border rounded p-3 bg-light d-flex flex-column gap-2 align-items-center">
                                                            <span className="fw-semibold small">Preview</span>
                                                            <img
                                                                src={menuImagePreviewUrl}
                                                                alt="Menu item preview"
                                                                className="img-fluid rounded"
                                                                style={{ maxHeight: 160, objectFit: 'cover' }}
                                                            />
                                                        </div>
                                                    </Col>
                                                ) : null}
                                                {menuForm.imageUrl ? (
                                                    <Col md={8}>
                                                        <div className="small text-muted">
                                                            Stored image path: <code>{menuForm.imageUrl}</code>
                                                        </div>
                                                    </Col>
                                                ) : null}
                                            </Row>
                                        ) : null}
                                        {categoryOptions.length === 0 ? (
                                            <Alert variant="warning" className="mb-0">
                                                No menu categories found. Add categories through the API or database before creating menu items.
                                            </Alert>
                                        ) : null}
                                    </Form>
                            </Card.Body>
                        </Card>

                        <Card className="shadow-sm">
                            <Card.Body>
                                <Form onSubmit={handleCreateCombo} className="d-flex flex-column gap-3">
                                    <Row className="g-3">
                                        <Col md={4}>
                                            <Form.Group controlId="combo-restaurant">
                                                <Form.Label>Restaurant</Form.Label>
                                                <Form.Select
                                                    name="restaurantId"
                                                    value={comboForm.restaurantId}
                                                    onChange={handleComboFormChange}
                                                    required
                                                    disabled={menuData.restaurants.length === 0 || saving.combos}
                                                >
                                                    <option value="">Select restaurant</option>
                                                    {menuData.restaurants.map((restaurant) => (
                                                        <option key={restaurant.id} value={restaurant.id}>
                                                            {restaurant.name}
                                                        </option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col md={4}>
                                            <Form.Group controlId="combo-name">
                                                <Form.Label>Name</Form.Label>
                                                <Form.Control
                                                    name="name"
                                                    value={comboForm.name}
                                                    onChange={handleComboFormChange}
                                                    placeholder="E.g. Family platter"
                                                    required
                                                    disabled={saving.combos}
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={4}>
                                            <Form.Group controlId="combo-sku">
                                                <Form.Label>SKU</Form.Label>
                                                <Form.Control
                                                    name="sku"
                                                    value={comboForm.sku}
                                                    onChange={handleComboFormChange}
                                                    placeholder="Internal code"
                                                    required
                                                    disabled={saving.combos}
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <Row className="g-3">
                                        <Col md={3}>
                                            <Form.Group controlId="combo-price">
                                                <Form.Label>Combo price (USD)</Form.Label>
                                                <Form.Control
                                                    name="price"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={comboForm.price}
                                                    onChange={handleComboFormChange}
                                                    required
                                                    disabled={saving.combos}
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={3}>
                                            <Form.Group controlId="combo-prep-time">
                                                <Form.Label>Prep time (seconds)</Form.Label>
                                                <Form.Control
                                                    name="prepTimeSeconds"
                                                    type="number"
                                                    min="0"
                                                    value={comboForm.prepTimeSeconds}
                                                    onChange={handleComboFormChange}
                                                    disabled={saving.combos}
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col md={3}>
                                            <Form.Group controlId="combo-available" className="d-flex flex-column">
                                                <Form.Label>Availability</Form.Label>
                                                <Form.Check
                                                    type="switch"
                                                    name="isAvailable"
                                                    label={comboForm.isAvailable ? 'Available' : 'Hidden'}
                                                    checked={comboForm.isAvailable}
                                                    onChange={handleComboFormChange}
                                                    disabled={saving.combos}
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <Form.Group controlId="combo-description">
                                    <Form.Label>Description</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={2}
                                            name="description"
                                            value={comboForm.description}
                                            onChange={handleComboFormChange}
                                            placeholder="What makes this combo great?"
                                            disabled={saving.combos}
                                        />
                                    </Form.Group>
                                    <div className="d-flex flex-column gap-2">
                                        <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-2">
                                            <Form.Label className="mb-0">Included dishes</Form.Label>
                                            <Form.Control
                                                type="search"
                                                placeholder="Search by name or SKU"
                                                value={comboSearch}
                                                onChange={(event) => setComboSearch(event.target.value)}
                                                disabled={!comboForm.restaurantId || comboAvailableOptions.length === 0}
                                                style={{ maxWidth: 280 }}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline-secondary"
                                                size="sm"
                                                onClick={handleAddComboComponent}
                                                disabled={
                                                    saving.combos ||
                                                    !comboForm.restaurantId ||
                                                    comboAvailableOptions.length === 0
                                                }
                                            >
                                                Add item
                                            </Button>
                                        </div>
                                        {comboForm.components.map((component, index) => {
                                            const selectedOption = comboAvailableOptions.find(
                                                (item) => item.id === component.menuItemId
                                            );
                                            const optionChoices = selectedOption
                                                ? [
                                                      selectedOption,
                                                      ...comboFilteredOptions.filter(
                                                          (item) => item.id !== selectedOption.id
                                                      )
                                                  ]
                                                : comboFilteredOptions;

                                            return (
                                                <Row className="g-2 align-items-end" key={`combo-component-${index}`}>
                                                    <Col md={6}>
                                                        <Form.Group>
                                                            <Form.Label className="visually-hidden">Menu item</Form.Label>
                                                            <Form.Select
                                                                value={component.menuItemId}
                                                                onChange={(event) =>
                                                                    handleComboComponentChange(
                                                                        index,
                                                                        'menuItemId',
                                                                        event.target.value
                                                                    )
                                                                }
                                                                disabled={
                                                                    saving.combos ||
                                                                    !comboForm.restaurantId ||
                                                                    comboAvailableOptions.length === 0
                                                                }
                                                            >
                                                                <option value="">Select menu item</option>
                                                                {optionChoices.map((item) => (
                                                                    <option key={item.id} value={item.id}>
                                                                        {item.name}
                                                                    </option>
                                                                ))}
                                                            </Form.Select>
                                                        </Form.Group>
                                                    </Col>
                                                    <Col xs={6} md={3}>
                                                        <Form.Group>
                                                            <Form.Label className="visually-hidden">Quantity</Form.Label>
                                                            <Form.Control
                                                                type="number"
                                                            min="1"
                                                            value={component.quantity}
                                                            onChange={(event) =>
                                                                handleComboComponentChange(
                                                                    index,
                                                                    'quantity',
                                                                    event.target.value
                                                                )
                                                            }
                                                            disabled={saving.combos}
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col xs={6} md={3}>
                                                    <Button
                                                        type="button"
                                                        variant="outline-danger"
                                                        size="sm"
                                                        onClick={() => handleRemoveComboComponent(index)}
                                                        disabled={saving.combos || comboForm.components.length <= 1}
                                                    >
                                                        Remove
                                                    </Button>
                                                    </Col>
                                                </Row>
                                            );
                                        })}
                                        {comboForm.restaurantId && comboAvailableOptions.length === 0 ? (
                                            <Alert variant="warning" className="mb-0">
                                                Add menu items for this restaurant before composing combos.
                                            </Alert>
                                        ) : null}
                                        {comboForm.restaurantId &&
                                        comboAvailableOptions.length > 0 &&
                                        comboFilteredOptions.length === 0 ? (
                                            <Alert variant="light" className="mb-0">
                                                No dishes match your search. Try another keyword.
                                            </Alert>
                                        ) : null}
                                    </div>
                                    <Row className="g-3 align-items-end">
                                        <Col md={6}>
                                            <Form.Group controlId="combo-image-upload">
                                                <Form.Label className="d-flex justify-content-between align-items-center">
                                                    <span>Combo image</span>
                                                    {comboImageUploading ? (
                                                        <Spinner animation="border" size="sm" role="status" />
                                                    ) : null}
                                                </Form.Label>
                                                <Form.Control
                                                    type="file"
                                                    accept="image/*"
                                                    ref={comboImageInputRef}
                                                    onChange={handleComboImageFileChange}
                                                    disabled={saving.combos || comboImageUploading}
                                                />
                                                <Form.Text muted>
                                                    Optional. Ảnh sẽ được tải lên MinIO và lưu đường dẫn tự động.
                                                </Form.Text>
                                            </Form.Group>
                                        </Col>
                                        <Col md={6}>
                                            <div className="d-flex gap-2 justify-content-end">
                                                {comboImageFile ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline-secondary"
                                                        onClick={clearComboImageSelection}
                                                        disabled={saving.combos || comboImageUploading}
                                                    >
                                                        Clear upload
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    type="submit"
                                                    disabled={
                                                        saving.combos ||
                                                        comboImageUploading ||
                                                        !comboForm.restaurantId ||
                                                        comboAvailableOptions.length === 0
                                                    }
                                                >
                                                    {saving.combos ? (
                                                        <>
                                                            <Spinner animation="border" size="sm" className="me-2" /> Saving…
                                                        </>
                                                    ) : (
                                                        'Create combo'
                                                    )}
                                                </Button>
                                            </div>
                                        </Col>
                                    </Row>
                                    {comboImagePreviewUrl || comboForm.imageUrl ? (
                                        <Row className="g-3">
                                            {comboImagePreviewUrl ? (
                                                <Col md={4}>
                                                    <div className="border rounded p-3 bg-light d-flex flex-column gap-2 align-items-center">
                                                        <span className="fw-semibold small">Combo preview</span>
                                                        <img
                                                            src={comboImagePreviewUrl}
                                                            alt="Combo preview"
                                                            className="img-fluid rounded"
                                                            style={{ maxHeight: 160, objectFit: 'cover' }}
                                                        />
                                                    </div>
                                                </Col>
                                            ) : null}
                                            {comboForm.imageUrl ? (
                                                <Col md={8}>
                                                    <div className="small text-muted">
                                                        Stored image path: <code>{comboForm.imageUrl}</code>
                                                    </div>
                                                </Col>
                                            ) : null}
                                        </Row>
                                    ) : null}
                                </Form>
                            </Card.Body>
                        </Card>

                        <Card className="shadow-sm">
                            <Card.Body className="d-flex flex-column gap-3">
                                <div className="d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0">Combos</h5>
                                    <div className="text-muted small">{menuCombos.length} combos</div>
                                </div>
                                {loading.menu && menuCombos.length === 0 ? (
                                    <div className="d-flex justify-content-center py-4">
                                        <Spinner animation="border" role="status" />
                                    </div>
                                ) : null}
                                {!loading.menu && menuCombos.length === 0 ? (
                                    <Alert variant="light" className="mb-0">
                                        No combos yet. Build your first combo above to bundle fan favourites.
                                    </Alert>
                                ) : null}
                                {menuCombos.length > 0 ? (
                                    <div className="table-responsive">
                                        <Table hover size="sm" className="mb-0">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: '20%' }}>Name</th>
                                                    <th style={{ width: '12%' }}>SKU</th>
                                                    <th style={{ width: '12%' }} className="text-end">
                                                        Price
                                                    </th>
                                                    <th>Included items</th>
                                                    <th style={{ width: '10%' }} className="text-center">
                                                        Status
                                                    </th>
                                                    <th style={{ width: '12%' }} className="text-end">
                                                        Actions
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {menuCombos.map((combo) => (
                                                    <tr key={combo.id}>
                                                        <td className="fw-semibold">{combo.name}</td>
                                                        <td>{combo.sku}</td>
                                                        <td className="text-end">{formatCurrency(combo.priceCents)}</td>
                                                        <td>
                                                            <ul className="list-unstyled mb-0 small text-muted">
                                                                {combo.items.map((component) => (
                                                                    <li key={`${combo.id}-${component.id}`}>
                                                                        {component.quantity}× {component.name}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </td>
                                                        <td className="text-center">
                                                            <Badge bg={combo.isAvailable ? 'success' : 'secondary'}>
                                                                {combo.isAvailable ? 'available' : 'hidden'}
                                                            </Badge>
                                                        </td>
                                                        <td className="text-end">
                                                            <Button
                                                                variant={
                                                                    combo.isAvailable ? 'outline-secondary' : 'outline-success'
                                                                }
                                                                size="sm"
                                                                onClick={() => handleToggleComboAvailability(combo)}
                                                                disabled={Boolean(mutations.menuCombos[combo.id])}
                                                            >
                                                                {mutations.menuCombos[combo.id] ? (
                                                                    <Spinner animation="border" size="sm" />
                                                                ) : combo.isAvailable ? (
                                                                    'Hide combo'
                                                                ) : (
                                                                    'Show combo'
                                                                )}
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                ) : null}
                            </Card.Body>
                        </Card>

                        <Card className="shadow-sm">
                            <Card.Body className="d-flex flex-column gap-3">
                                <div className="d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0">Existing items</h5>
                                    <div className="text-muted small">{menuItems.length} items</div>
                                    </div>
                                    {loading.menu && menuItems.length === 0 ? (
                                        <div className="d-flex justify-content-center py-4">
                                            <Spinner animation="border" role="status" />
                                        </div>
                                    ) : null}
                                    {!loading.menu && menuItems.length === 0 ? (
                                        <Alert variant="light" className="mb-0">
                                            No menu items yet. Add your first dish using the form above.
                                        </Alert>
                                    ) : null}
                                    {menuItems.length > 0 ? (
                                        <>
                                            <div className="table-responsive">
                                                <Table hover size="sm" className="mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '22%' }}>Name</th>
                                                            <th style={{ width: '14%' }}>Category</th>
                                                            <th style={{ width: '10%' }}>SKU</th>
                                                            <th style={{ width: '10%' }} className="text-end">
                                                                Price
                                                            </th>
                                                            <th style={{ width: '10%' }} className="text-center">
                                                                Status
                                                            </th>
                                                            <th>Description</th>
                                                            <th style={{ width: '12%' }} className="text-end">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {menuItems.map((item) => (
                                                            <tr key={item.id}>
                                                                <td className="fw-semibold">{item.name}</td>
                                                                <td>{item.category?.name || '--'}</td>
                                                                <td>{item.sku}</td>
                                                                <td className="text-end">{formatCurrency(item.priceCents)}</td>
                                                                <td className="text-center">
                                                                    <Badge bg={item.isAvailable ? 'success' : 'secondary'}>
                                                                        {item.isAvailable ? 'available' : 'unavailable'}
                                                                    </Badge>
                                                                </td>
                                                                <td className="text-muted small">{item.description || '--'}</td>
                                                                <td className="text-end">
                                                                    <Button
                                                                        variant={item.isAvailable ? 'outline-secondary' : 'outline-success'}
                                                                        size="sm"
                                                                        onClick={() => handleToggleMenuItemAvailability(item)}
                                                                        disabled={Boolean(mutations.menuItems[item.id])}
                                                                    >
                                                                        {mutations.menuItems[item.id] ? (
                                                                            <Spinner animation="border" size="sm" />
                                                                        ) : item.isAvailable ? (
                                                                            'Mark unavailable'
                                                                        ) : (
                                                                            'Mark available'
                                                                        )}
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            </div>
                                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3">
                                                <div className="text-muted small">{describeRange(menuPagination, menuItems.length)}</div>
                                                {menuPagination.totalPages > 1 ? (
                                                    <Pagination className="mb-0">
                                                        <Pagination.Prev
                                                            disabled={!menuPagination.hasPrevious || loading.menu}
                                                            onClick={() => handleMenuPageChange(menuPagination.page - 1)}
                                                        />
                                                        <Pagination.Item active>{menuPagination.page}</Pagination.Item>
                                                        <Pagination.Next
                                                            disabled={!menuPagination.hasNext || loading.menu}
                                                            onClick={() => handleMenuPageChange(menuPagination.page + 1)}
                                                        />
                                                    </Pagination>
                                                ) : null}
                                            </div>
                                        </>
                                    ) : null}
                                </Card.Body>
                            </Card>
                        </div>
                    </Tab>
                    <Tab eventKey={MANAGEMENT_TABS.CUSTOMERS} title="Customers">
                        <div className="pt-4 d-flex flex-column gap-4">
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <h5 className="mb-0">Customer memberships</h5>
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={() => loadCustomerData()}
                                    disabled={loading.customers}
                                >
                                    {loading.customers ? 'Refreshing…' : 'Refresh'}
                                </Button>
                            </div>

                            <Card className="shadow-sm">
                                <Card.Body>
                                    <Form onSubmit={handleCreateCustomerMembership} className="d-flex flex-column gap-3">
                                        <Row className="g-3">
                                            <Col md={4}>
                                                <Form.Group controlId="customer-restaurant">
                                                    <Form.Label>Restaurant</Form.Label>
                                                    <Form.Select
                                                        name="restaurantId"
                                                        value={customerForm.restaurantId}
                                                        onChange={handleCustomerFormChange}
                                                        required
                                                        disabled={restaurantOptions.length === 0}
                                                    >
                                                        <option value="">Select restaurant</option>
                                                        {restaurantOptions.map((restaurant) => (
                                                            <option key={restaurant.id} value={restaurant.id}>
                                                                {restaurant.name}
                                                            </option>
                                                        ))}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="customer-first-name">
                                                    <Form.Label>First name</Form.Label>
                                                    <Form.Control
                                                        name="firstName"
                                                        value={customerForm.firstName}
                                                        onChange={handleCustomerFormChange}
                                                        placeholder="Guest first name"
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="customer-last-name">
                                                    <Form.Label>Last name</Form.Label>
                                                    <Form.Control
                                                        name="lastName"
                                                        value={customerForm.lastName}
                                                        onChange={handleCustomerFormChange}
                                                        placeholder="Guest last name"
                                                    />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Row className="g-3">
                                            <Col md={4}>
                                                <Form.Group controlId="customer-email">
                                                    <Form.Label>Email</Form.Label>
                                                    <Form.Control
                                                        name="email"
                                                        type="email"
                                                        value={customerForm.email}
                                                        onChange={handleCustomerFormChange}
                                                        placeholder="guest@example.com"
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="customer-phone">
                                                    <Form.Label>Phone</Form.Label>
                                                    <Form.Control
                                                        name="phoneNumber"
                                                        value={customerForm.phoneNumber}
                                                        onChange={handleCustomerFormChange}
                                                        placeholder="Optional"
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="customer-membership-number">
                                                    <Form.Label>Membership #</Form.Label>
                                                    <Form.Control
                                                        name="membershipNumber"
                                                        value={customerForm.membershipNumber}
                                                        onChange={handleCustomerFormChange}
                                                        placeholder="Optional"
                                                    />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Row className="g-3">
                                            <Col md={4}>
                                                <Form.Group controlId="customer-status">
                                                    <Form.Label>Status</Form.Label>
                                                    <Form.Select name="status" value={customerForm.status} onChange={handleCustomerFormChange}>
                                                        <option value="GUEST">Guest</option>
                                                        <option value="MEMBER">Member</option>
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="customer-loyalty-points">
                                                    <Form.Label>Loyalty points</Form.Label>
                                                    <Form.Control
                                                        name="loyaltyPoints"
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={customerForm.loyaltyPoints}
                                                        onChange={handleCustomerFormChange}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="customer-discount">
                                                    <Form.Label>Discount balance (USD)</Form.Label>
                                                    <Form.Control
                                                        name="discountBalance"
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={customerForm.discountBalance}
                                                        onChange={handleCustomerFormChange}
                                                    />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <div>
                                            <Button type="submit" disabled={saving.customers || restaurantOptions.length === 0}>
                                                {saving.customers ? (
                                                    <>
                                                        <Spinner animation="border" size="sm" className="me-2" /> Saving…
                                                    </>
                                                ) : (
                                                    'Add customer'
                                                )}
                                            </Button>
                                        </div>
                                        {restaurantOptions.length === 0 ? (
                                            <Alert variant="warning" className="mb-0">
                                                No restaurants found for this account. Create restaurants before adding memberships.
                                            </Alert>
                                        ) : null}
                                    </Form>
                                </Card.Body>
                            </Card>

                            <Card className="shadow-sm">
                                <Card.Body className="d-flex flex-column gap-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0">Members directory</h5>
                                        <div className="text-muted small">{customerMemberships.length} records</div>
                                    </div>
                                    {loading.customers && customerMemberships.length === 0 ? (
                                        <div className="d-flex justify-content-center py-4">
                                            <Spinner animation="border" role="status" />
                                        </div>
                                    ) : null}
                                    {!loading.customers && customerMemberships.length === 0 ? (
                                        <Alert variant="light" className="mb-0">
                                            No memberships found. Register a guest using the form above to get started.
                                        </Alert>
                                    ) : null}
                                    {customerMemberships.length > 0 ? (
                                        <>
                                            <div className="table-responsive">
                                                <Table hover size="sm" className="mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '22%' }}>Customer</th>
                                                            <th style={{ width: '16%' }}>Contact</th>
                                                            <th style={{ width: '14%' }}>Membership</th>
                                                            <th style={{ width: '14%' }}>Restaurant</th>
                                                            <th style={{ width: '10%' }} className="text-end">
                                                                Loyalty
                                                            </th>
                                                            <th style={{ width: '10%' }} className="text-end">
                                                                Discount
                                                            </th>
                                                            <th style={{ width: '14%' }} className="text-end">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {customerMemberships.map((membership) => (
                                                            <tr key={membership.id}>
                                                                <td>
                                                                    <div className="fw-semibold">{resolveCustomerName(membership.customer)}</div>
                                                                    <div className="text-muted small">#{resolveMembershipNumber(membership.customer)}</div>
                                                                </td>
                                                                <td className="text-muted small">
                                                                    <div>{membership.customer?.email || '--'}</div>
                                                                    <div>{membership.customer?.phoneNumber || '--'}</div>
                                                                </td>
                                                                <td>
                                                                    <Badge bg={membership.status === 'MEMBER' ? 'success' : 'secondary'}>
                                                                        {membership.status.toLowerCase()}
                                                                    </Badge>
                                                                </td>
                                                                <td>{membership.restaurant?.name || '--'}</td>
                                                                <td className="text-end">{membership.loyaltyPoints}</td>
                                                                <td className="text-end">{formatCurrency(membership.discountBalanceCents)}</td>
                                                                <td className="text-end">
                                                                    <Button
                                                                        variant={membership.status === 'MEMBER' ? 'outline-secondary' : 'outline-success'}
                                                                        size="sm"
                                                                        onClick={() => handleToggleMembershipStatus(membership)}
                                                                        disabled={Boolean(mutations.memberships[membership.id])}
                                                                    >
                                                                        {mutations.memberships[membership.id] ? (
                                                                            <Spinner animation="border" size="sm" />
                                                                        ) : membership.status === 'MEMBER' ? (
                                                                            'Mark guest'
                                                                        ) : (
                                                                            'Promote to member'
                                                                        )}
                                                                    </Button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            </div>
                                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3">
                                                <div className="text-muted small">
                                                    {describeRange(customerPagination, customerMemberships.length)}
                                                </div>
                                                {customerPagination.totalPages > 1 ? (
                                                    <Pagination className="mb-0">
                                                        <Pagination.Prev
                                                            disabled={!customerPagination.hasPrevious || loading.customers}
                                                            onClick={() => handleCustomerPageChange(customerPagination.page - 1)}
                                                        />
                                                        <Pagination.Item active>{customerPagination.page}</Pagination.Item>
                                                        <Pagination.Next
                                                            disabled={!customerPagination.hasNext || loading.customers}
                                                            onClick={() => handleCustomerPageChange(customerPagination.page + 1)}
                                                        />
                                                    </Pagination>
                                                ) : null}
                                            </div>
                                        </>
                                    ) : null}
                                </Card.Body>
                            </Card>
                        </div>
                    </Tab>
                    <Tab eventKey={MANAGEMENT_TABS.TABLES} title="Tables">
                        <div className="pt-4 d-flex flex-column gap-4">
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <h5 className="mb-0">Dining tables</h5>
                                <Button variant="outline-secondary" size="sm" onClick={() => loadTableData()} disabled={loading.tables}>
                                    {loading.tables ? 'Refreshing…' : 'Refresh'}
                                </Button>
                            </div>

                            <Card className="shadow-sm">
                                <Card.Body>
                                    <Form onSubmit={handleCreateTable} className="d-flex flex-column gap-3">
                                        <Row className="g-3">
                                            <Col md={4}>
                                                <Form.Group controlId="table-restaurant">
                                                    <Form.Label>Restaurant</Form.Label>
                                                    <Form.Select
                                                        name="restaurantId"
                                                        value={tableForm.restaurantId}
                                                        onChange={handleTableFormChange}
                                                        required
                                                        disabled={restaurantOptions.length === 0}
                                                    >
                                                        <option value="">Select restaurant</option>
                                                        {restaurantOptions.map((restaurant) => (
                                                            <option key={restaurant.id} value={restaurant.id}>
                                                                {restaurant.name}
                                                            </option>
                                                        ))}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="table-name">
                                                    <Form.Label>Name</Form.Label>
                                                    <Form.Control
                                                        name="name"
                                                        value={tableForm.name}
                                                        onChange={handleTableFormChange}
                                                        placeholder="Table 12"
                                                        required
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="table-qr-slug">
                                                    <Form.Label>QR slug</Form.Label>
                                                    <Form.Control
                                                        name="qrSlug"
                                                        value={tableForm.qrSlug}
                                                        onChange={handleTableFormChange}
                                                        placeholder="unique-table-slug"
                                                        required
                                                    />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Row className="g-3">
                                            <Col md={4}>
                                                <Form.Group controlId="table-capacity">
                                                    <Form.Label>Capacity</Form.Label>
                                                    <Form.Control
                                                        name="capacity"
                                                        type="number"
                                                        min="1"
                                                        step="1"
                                                        value={tableForm.capacity}
                                                        onChange={handleTableFormChange}
                                                        required
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col md={4}>
                                                <Form.Group controlId="table-status">
                                                    <Form.Label>Status</Form.Label>
                                                    <Form.Select name="status" value={tableForm.status} onChange={handleTableFormChange}>
                                                        <option value="AVAILABLE">Available</option>
                                                        <option value="RESERVED">Reserved</option>
                                                        <option value="OUT_OF_SERVICE">Out of service</option>
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <div>
                                            <Button type="submit" disabled={saving.tables || restaurantOptions.length === 0}>
                                                {saving.tables ? (
                                                    <>
                                                        <Spinner animation="border" size="sm" className="me-2" /> Saving…
                                                    </>
                                                ) : (
                                                    'Add table'
                                                )}
                                            </Button>
                                        </div>
                                        {restaurantOptions.length === 0 ? (
                                            <Alert variant="warning" className="mb-0">
                                                No restaurants found for this account. Create restaurants before adding tables.
                                            </Alert>
                                        ) : null}
                                    </Form>
                                </Card.Body>
                            </Card>

                            <Card className="shadow-sm">
                                <Card.Body className="d-flex flex-column gap-3">
                                    <div className="d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0">Registered tables</h5>
                                        <div className="text-muted small">{tableEntries.length} tables</div>
                                    </div>
                                    {loading.tables && tableEntries.length === 0 ? (
                                        <div className="d-flex justify-content-center py-4">
                                            <Spinner animation="border" role="status" />
                                        </div>
                                    ) : null}
                                    {!loading.tables && tableEntries.length === 0 ? (
                                        <Alert variant="light" className="mb-0">
                                            No tables registered yet. Use the form above to add your first dining table.
                                        </Alert>
                                    ) : null}
                                    {tableEntries.length > 0 ? (
                                        <>
                                            <div className="table-responsive">
                                                <Table hover size="sm" className="mb-0">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ width: '20%' }}>Table</th>
                                                            <th style={{ width: '18%' }}>Restaurant</th>
                                                            <th style={{ width: '12%' }}>Capacity</th>
                                                            <th style={{ width: '18%' }}>QR slug</th>
                                                            <th style={{ width: '16%' }}>Status</th>
                                                            <th style={{ width: '16%' }} className="text-end">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {tableEntries.map((table) => (
                                                            <tr key={table.id}>
                                                                <td className="fw-semibold">{table.name}</td>
                                                                <td>{table.restaurant?.name || '--'}</td>
                                                                <td>{table.capacity}</td>
                                                                <td className="text-muted small">{table.qrSlug}</td>
                                                                <td>
                                                                    <Badge bg={TABLE_STATUS_VARIANTS[table.status] || 'secondary'}>
                                                                        {table.status ? table.status.toLowerCase() : ''}
                                                                    </Badge>
                                                                </td>
                                                                <td className="text-end">
                                                                    <Form.Select
                                                                        size="sm"
                                                                        value={table.status}
                                                                        onChange={(event) => handleUpdateTableStatus(table, event.target.value)}
                                                                        disabled={Boolean(mutations.tables[table.id])}
                                                                    >
                                                                        <option value="AVAILABLE">Available</option>
                                                                        <option value="RESERVED">Reserved</option>
                                                                        <option value="OUT_OF_SERVICE">Out of service</option>
                                                                    </Form.Select>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            </div>
                                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-3">
                                                <div className="text-muted small">{describeRange(tablePagination, tableEntries.length)}</div>
                                                {tablePagination.totalPages > 1 ? (
                                                    <Pagination className="mb-0">
                                                        <Pagination.Prev
                                                            disabled={!tablePagination.hasPrevious || loading.tables}
                                                            onClick={() => handleTablePageChange(tablePagination.page - 1)}
                                                        />
                                                        <Pagination.Item active>{tablePagination.page}</Pagination.Item>
                                                        <Pagination.Next
                                                            disabled={!tablePagination.hasNext || loading.tables}
                                                            onClick={() => handleTablePageChange(tablePagination.page + 1)}
                                                        />
                                                    </Pagination>
                                                ) : null}
                                            </div>
                                        </>
                                    ) : null}
                                </Card.Body>
                            </Card>
                        </div>
            </Tab>
            <Tab eventKey={MANAGEMENT_TABS.PROMOTIONS} title="Promotions">
                <PromotionsPanel />
            </Tab>
            <Tab eventKey={MANAGEMENT_TABS.RECOMMENDATIONS} title="Recommendations">
                <RecommendationInsightsPanel />
            </Tab>
            <Tab eventKey={MANAGEMENT_TABS.KNOWLEDGE} title="AI Assistant">
                <div className="pt-4">
                    <KnowledgeSyncPanel />
                </div>
            </Tab>
        </Tabs>
            </div>
        </MainLayout>
    );
};

export default ManagementPage;
