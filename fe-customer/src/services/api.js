import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_BASE_URL || 'http://localhost:3301/api/v1',
    timeout: 15000
});

export default api;
