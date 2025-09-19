import api from '../api/http.js';

const encodeName = (fileName) => encodeURIComponent(fileName);

export const listAssets = () => api.get('/assets');

export const uploadAsset = (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return api.post('/assets', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
};

export const deleteAsset = (fileName) => api.delete(`/assets/${encodeName(fileName)}`);
