import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'https://eagle-engineering-server-15wn.onrender.com/api';

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

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (originalRequest && (!originalRequest.method || originalRequest.method.toLowerCase() === 'get')) {
      originalRequest._retryCount = originalRequest._retryCount || 0;
      const isTransientError =
        !error.response ||
        error.code === 'ERR_NETWORK' ||
        [502, 503, 504].includes(error.response?.status);

      if (isTransientError && originalRequest._retryCount < 3) {
        originalRequest._retryCount += 1;
        const delay = originalRequest._retryCount * 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

export const getImageUrl = (imagePath) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('/uploads')) {
    return `https://eagle-engineering-server-15wn.onrender.com${imagePath}`;
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
