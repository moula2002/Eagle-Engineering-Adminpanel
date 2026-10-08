import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'https://eagle-engineering-server.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('/uploads')) {
    return `https://eagle-engineering-server.onrender.com${imagePath}`;
  }
  return imagePath;
};

// --- Product Endpoints ---
export const getProducts = () => api.get('/products');
export const createProduct = (productData) => api.post('/products', productData);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

// --- Category Endpoints ---
export const getCategories = () => api.get('/categories');
export const createCategory = (categoryData) => api.post('/categories', categoryData);

export default api;
