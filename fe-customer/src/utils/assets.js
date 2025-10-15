import api from '../services/api';

const resolveAssetUrl = (url) => {
    if (!url) {
        return '';
    }

    if (/^https?:\/\//i.test(url)) {
        return url;
    }

    const base = api.defaults.baseURL || '';

    try {
        const withTrailing = base.endsWith('/') ? base : base + '/';
        const parsed = new URL(withTrailing);
        const normalizedPath = url.startsWith('/') ? url : '/' + url;
        return parsed.origin + normalizedPath;
    } catch (error) {
        const normalizedBase = base.replace(/\/$/, '');
        const normalizedPath = url.startsWith('/') ? url : '/' + url;
        if (!normalizedBase) {
            return normalizedPath;
        }
        return normalizedBase + normalizedPath;
    }
};

export default resolveAssetUrl;
