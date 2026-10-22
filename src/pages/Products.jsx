import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, MoreVertical, Edit2, Trash2, Box, X, Upload, RefreshCw, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import api from '../api/axios';
import { initialProducts, initialCategories } from '../data/catalogSnapshot';

const CACHE_KEY_PRODUCTS = 'eagle_admin_products';
const CACHE_KEY_CATEGORIES = 'eagle_admin_categories';
const CACHE_KEY_OVERRIDES = 'eagle_admin_product_overrides';

// Helper to convert any image File into compact, high-quality Base64 raw format
// Uses HTML5 Canvas resizing to guarantee clean base64 data URLs without crashing payloads or triggering network timeouts
const fileToBase64 = (file, maxWidth = 800, maxHeight = 800, quality = 0.82) => {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        // Clean white background in case source has transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Export as high-efficiency JPEG data URL to keep size under ~45KB
        const base64Url = canvas.toDataURL('image/jpeg', quality);
        resolve(base64Url);
      };
      img.onerror = () => {
        resolve(readerEvent.target.result);
      };
      img.src = readerEvent.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to keep localStorage cache safe while preserving base64 images in state
const sanitizeImageForStorage = (img) => {
  if (!img || typeof img !== 'string') return '';
  // Preserve image references; if oversized base64 (> 150KB), omit from full products list cache to prevent 5MB quota errors
  if (img.startsWith('data:') && img.length > 200000) return '';
  return img;
};

// Helper to get overrides map from localStorage
const getOverridesMap = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY_OVERRIDES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.warn('Failed to load product overrides', e);
  }
  return {};
};

// Helper to save a single product override to ensure changes survive quota purges and refreshes
const saveProductOverride = (product) => {
  if (!product || !product._id) return;
  try {
    const overrides = getOverridesMap();
    overrides[product._id] = {
      _id: product._id,
      name: product.name,
      sku: product.sku,
      brand: product.brand,
      status: product.status,
      category: product.category,
      subCategory: product.subCategory,
      mainImage: product.mainImage || '',
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      specifications: product.specifications,
      seo: product.seo,
      isFeatured: product.isFeatured,
      isNewProduct: product.isNewProduct,
      updatedAt: product.updatedAt || new Date().toISOString()
    };

    try {
      localStorage.setItem(CACHE_KEY_OVERRIDES, JSON.stringify(overrides));
    } catch (quotaErr) {
      // If quota exceeded, clear full products cache to reclaim space immediately
      try {
        localStorage.removeItem(CACHE_KEY_PRODUCTS);
        localStorage.setItem(CACHE_KEY_OVERRIDES, JSON.stringify(overrides));
      } catch (retryErr) {
        // Last resort: save essential product identifiers only
        const compactOverrides = {};
        for (const [id, o] of Object.entries(overrides)) {
          compactOverrides[id] = {
            _id: o._id,
            name: o.name,
            sku: o.sku,
            brand: o.brand,
            status: o.status,
            category: o.category,
            subCategory: o.subCategory,
            specifications: o.specifications,
            updatedAt: o.updatedAt
          };
        }
        try {
          localStorage.setItem(CACHE_KEY_OVERRIDES, JSON.stringify(compactOverrides));
        } catch (compactErr) {
          console.warn('Quota exceeded saving minimal overrides', compactErr);
        }
      }
    }
  } catch (e) {
    console.warn('Could not save product override to localStorage', e);
  }
};

// Helper to apply saved overrides on top of any products array
const applyOverrides = (list) => {
  if (!Array.isArray(list)) return [];
  const overrides = getOverridesMap();
  const overrideIds = Object.keys(overrides);
  if (overrideIds.length === 0) return list;

  const updated = list.map(item => {
    if (item && item._id && overrides[item._id]) {
      const override = overrides[item._id];
      return {
        ...item,
        ...override,
        mainImage: override.mainImage || item.mainImage
      };
    }
    return item;
  });

  return updated;
};

// Helper to load cached products safely with snapshot fallback and override merge
const getCachedProducts = () => {
  let baseList = [];
  try {
    const cached = localStorage.getItem(CACHE_KEY_PRODUCTS);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        baseList = parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse cached admin products', e);
  }

  if (baseList.length === 0 && Array.isArray(initialProducts)) {
    baseList = initialProducts;
  } else if (Array.isArray(initialProducts)) {
    // If baseList came from lightweight cache without base64, restore default images from snapshot
    const snapshotMap = new Map(initialProducts.map(p => [p._id, p]));
    baseList = baseList.map(p => {
      if (!p.mainImage && snapshotMap.has(p._id)) {
        return { ...p, mainImage: snapshotMap.get(p._id).mainImage };
      }
      return p;
    });
  }

  return applyOverrides(baseList);
};

// Helper to load cached categories safely with snapshot fallback
const getCachedCategories = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY_CATEGORIES);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse cached admin categories', e);
  }
  return Array.isArray(initialCategories) ? initialCategories : [];
};

const Products = () => {
  const [products, setProducts] = useState(() => getCachedProducts());
  const [categories, setCategories] = useState(() => getCachedCategories());
  const [allSubCategories, setAllSubCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const [searchQuery, setSearchQuery] = useState(() => sessionStorage.getItem('admin_prod_search') || '');
  const [selectedCategory, setSelectedCategory] = useState(() => sessionStorage.getItem('admin_prod_cat') || '');
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem('admin_prod_page');
    return saved ? parseInt(saved, 10) : 1;
  });

  useEffect(() => {
    sessionStorage.setItem('admin_prod_search', searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    sessionStorage.setItem('admin_prod_cat', selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    sessionStorage.setItem('admin_prod_page', currentPage.toString());
  }, [currentPage]);

  const itemsPerPage = 10;

  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('basic'); // basic, specs, seo, images
  
  const initialFormState = { 
    name: '', category: '', subCategory: '', status: 'Active',
    brand: '', shortDescription: '', fullDescription: '',
    mainImage: '', gallery: [],
    specifications: { size: '', length: '', diameter: '', material: '', finish: '', color: '', weight: '' },
    seo: { metaTitle: '', metaDescription: '', metaKeywords: '' },
    isFeatured: false, isNewProduct: false
  };
  
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState('');
  const [modalError, setModalError] = useState(null);
  const [mainImageFile, setMainImageFile] = useState(null);
  const [mainImagePreview, setMainImagePreview] = useState('');
  const [pendingGalleryFiles, setPendingGalleryFiles] = useState([]); // array of { id, file, preview, name }

  const showFeedback = (text, type = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http') || imagePath.startsWith('data:') || imagePath.startsWith('/products')) return imagePath;
    const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'https://eagle-engineering-server-dzor.onrender.com';
    return `${baseUrl}${imagePath}`;
  };

  // Helper to commit products state to memory, localStorage cache, and broadcast channel
  const updateProductsStateAndCache = useCallback((newList) => {
    const listWithOverrides = applyOverrides(newList);
    setProducts(listWithOverrides);
    try {
      // Store lightweight representation in localStorage to stay well within browser 5MB quota
      const lightweightList = listWithOverrides.map(p => ({
        _id: p._id,
        name: p.name,
        sku: p.sku,
        brand: p.brand,
        status: p.status,
        category: p.category,
        subCategory: p.subCategory,
        mainImage: sanitizeImageForStorage(p.mainImage),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        isFeatured: p.isFeatured,
        isNewProduct: p.isNewProduct
      }));
      localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(lightweightList));
    } catch (e) {
      // If quota is still exceeded, remove full cache without throwing error; overrides remain intact
      try {
        localStorage.removeItem(CACHE_KEY_PRODUCTS);
      } catch (clearErr) {}
    }

    try {
      const channel = new BroadcastChannel('eagle_sync_channel');
      channel.postMessage({ type: 'PRODUCTS_UPDATED', count: listWithOverrides.length, timestamp: Date.now() });
      channel.close();
    } catch (e) {}
  }, []);

  const fetchProducts = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const response = await api.get('/products');
      let fetchedList = [];
      if (response.data && Array.isArray(response.data.data)) {
        fetchedList = response.data.data;
      } else if (Array.isArray(response.data)) {
        fetchedList = response.data;
      }

      if (fetchedList.length > 0) {
        // Ensure products are sorted by newest first
        const sorted = [...fetchedList].sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });
        updateProductsStateAndCache(sorted);
      }
      setError(null);
      if (isManual) {
        showFeedback(`Catalog synced (${fetchedList.length} products total)`);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      if (!products || products.length === 0) {
        setError('Failed to fetch products from server. Showing cached catalog.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [products, updateProductsStateAndCache]);

  const fetchCategoriesAndSubCategories = useCallback(async () => {
    try {
      const [catRes, subRes] = await Promise.all([
        api.get('/categories'),
        api.get('/sub-categories')
      ]);
      if (catRes.data && Array.isArray(catRes.data.data) && catRes.data.data.length > 0) {
        setCategories(catRes.data.data);
        try {
          localStorage.setItem(CACHE_KEY_CATEGORIES, JSON.stringify(catRes.data.data));
        } catch (e) {}
      }
      if (subRes.data && Array.isArray(subRes.data.data)) {
        setAllSubCategories(subRes.data.data);
      }
    } catch (err) {
      console.error('Error fetching categories/subcategories:', err);
    }
  }, []);

  // Initial fetch and cross-tab sync listeners
  useEffect(() => {
    fetchProducts();
    fetchCategoriesAndSubCategories();

    // Cross-tab real-time sync channel
    let syncChannel;
    try {
      syncChannel = new BroadcastChannel('eagle_sync_channel');
      syncChannel.onmessage = (event) => {
        if (event.data?.type === 'PRODUCTS_UPDATED') {
          // Re-read from cache if available or re-fetch
          const cached = getCachedProducts();
          if (cached.length > 0) {
            setProducts(cached);
          }
        }
      };
    } catch (e) {}

    // Storage event for cross-window updates
    const handleStorageChange = (e) => {
      if (e.key === CACHE_KEY_PRODUCTS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
          }
        } catch (err) {}
      }
      if (e.key === CACHE_KEY_CATEGORIES && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCategories(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      if (syncChannel) syncChannel.close();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [fetchProducts, fetchCategoriesAndSubCategories]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: { ...formData[parent], [child]: value }
      });
    } else {
      setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
    }
  };

  const closeModal = useCallback(() => {
    if (mainImagePreview && mainImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(mainImagePreview);
    }
    pendingGalleryFiles.forEach(item => {
      if (item.preview && item.preview.startsWith('blob:')) {
        URL.revokeObjectURL(item.preview);
      }
    });
    setMainImageFile(null);
    setMainImagePreview('');
    setPendingGalleryFiles([]);
    setModalError(null);
    setUploadProgressText('');
    setShowModal(false);
    setEditingId(null);
    setFormData(initialFormState);
    setActiveTab('basic');
  }, [mainImagePreview, pendingGalleryFiles, initialFormState]);

  const openAddModal = () => {
    closeModal();
    setShowModal(true);
  };

  const handleEdit = (product) => {
    if (mainImagePreview && mainImagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(mainImagePreview);
    }
    pendingGalleryFiles.forEach(item => {
      if (item.preview && item.preview.startsWith('blob:')) {
        URL.revokeObjectURL(item.preview);
      }
    });
    setMainImageFile(null);
    setPendingGalleryFiles([]);
    setModalError(null);
    setUploadProgressText('');

    // Determine category ID accurately
    let catId = '';
    if (product.category) {
      if (typeof product.category === 'object' && product.category._id) {
        catId = product.category._id;
      } else if (typeof product.category === 'string') {
        catId = product.category;
      }
    }
    // Fallback: match by category name if ID not directly present
    if (!catId && product.category?.name) {
      const match = categories.find(c => c.name?.toLowerCase() === product.category.name.toLowerCase());
      if (match) catId = match._id;
    }

    // Determine subCategory ID accurately
    let subId = '';
    if (product.subCategory) {
      if (typeof product.subCategory === 'object' && product.subCategory._id) {
        subId = product.subCategory._id;
      } else if (typeof product.subCategory === 'string') {
        subId = product.subCategory;
      }
    }
    if (!subId && product.subCategory?.name) {
      const match = allSubCategories.find(s => s.name?.toLowerCase() === product.subCategory.name.toLowerCase());
      if (match) subId = match._id;
    }

    const initialMainImg = product.mainImage || '';
    setEditingId(product._id);
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      category: catId,
      subCategory: subId,
      status: product.status || 'Active',
      brand: product.brand || '',
      shortDescription: product.shortDescription || '',
      fullDescription: product.fullDescription || '',
      mainImage: initialMainImg,
      gallery: Array.isArray(product.gallery) ? [...product.gallery] : [],
      specifications: {
        size: product.specifications?.size || '',
        length: product.specifications?.length || '',
        diameter: product.specifications?.diameter || '',
        material: product.specifications?.material || '',
        finish: product.specifications?.finish || '',
        color: product.specifications?.color || '',
        weight: product.specifications?.weight || ''
      },
      seo: {
        metaTitle: product.seo?.metaTitle || '',
        metaDescription: product.seo?.metaDescription || '',
        metaKeywords: product.seo?.metaKeywords || ''
      },
      isFeatured: Boolean(product.isFeatured),
      isNewProduct: Boolean(product.isNewProduct)
    });
    setMainImagePreview(initialMainImg);
    setActiveTab('basic');
    setShowModal(true);

    // Fetch full details in background to ensure gallery/descriptions are fully populated if only preview was cached
    if (product._id) {
      api.get(`/products/${product._id}`).then(res => {
        const fullProd = res.data?.data;
        if (fullProd && fullProd._id === product._id) {
          setFormData(prev => ({
            ...prev,
            shortDescription: prev.shortDescription || fullProd.shortDescription || '',
            fullDescription: prev.fullDescription || fullProd.fullDescription || '',
            gallery: (prev.gallery && prev.gallery.length > 0) ? prev.gallery : (fullProd.gallery || []),
            mainImage: prev.mainImage || fullProd.mainImage || '',
            specifications: {
              size: prev.specifications?.size || fullProd.specifications?.size || '',
              length: prev.specifications?.length || fullProd.specifications?.length || '',
              diameter: prev.specifications?.diameter || fullProd.specifications?.diameter || '',
              material: prev.specifications?.material || fullProd.specifications?.material || '',
              finish: prev.specifications?.finish || fullProd.specifications?.finish || '',
              color: prev.specifications?.color || fullProd.specifications?.color || '',
              weight: prev.specifications?.weight || fullProd.specifications?.weight || ''
            },
            seo: {
              metaTitle: prev.seo?.metaTitle || fullProd.seo?.metaTitle || '',
              metaDescription: prev.seo?.metaDescription || fullProd.seo?.metaDescription || '',
              metaKeywords: prev.seo?.metaKeywords || fullProd.seo?.metaKeywords || ''
            }
          }));
          if (!mainImageFile && fullProd.mainImage) {
            setMainImagePreview(fullProd.mainImage);
          }
        }
      }).catch(() => {});
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product? This will permanently remove it from the catalog.')) {
      // 1. Immediate optimistic UI deletion
      const previousProducts = [...products];
      const updatedList = products.filter((p) => p._id !== id);
      try {
        const overrides = getOverridesMap();
        if (overrides[id]) {
          delete overrides[id];
          localStorage.setItem(CACHE_KEY_OVERRIDES, JSON.stringify(overrides));
        }
      } catch (e) {}
      updateProductsStateAndCache(updatedList);
      showFeedback('Product deleted successfully');

      try {
        await api.delete(`/products/${id}`);
        // Background refresh to confirm server state
        fetchProducts();
      } catch (err) {
        console.error('Error deleting product:', err);
        // Rollback on failure
        updateProductsStateAndCache(previousProducts);
        alert('Failed to delete product from server. Reverted change.');
      }
    }
  };

  const handleMainImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setModalError('Please select a valid image file (JPG, PNG, WEBP, or SVG).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setModalError('File size exceeds 15MB limit. Please select a smaller image.');
      return;
    }

    try {
      setUploadProgressText('Converting image to Base64 raw format...');
      const base64Url = await fileToBase64(file);
      setMainImageFile(null);
      setMainImagePreview(base64Url);
      setFormData(prev => ({ ...prev, mainImage: base64Url }));
      setModalError(null);
      setUploadProgressText('');
    } catch (err) {
      console.error('Error processing main image to base64:', err);
      setModalError('Failed to convert image to Base64 format.');
      setUploadProgressText('');
    }
  };

  const handleRemoveMainImage = () => {
    setMainImageFile(null);
    setMainImagePreview('');
    setFormData(prev => ({ ...prev, mainImage: '' }));
  };

  const handleGallerySelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setUploadProgressText(`Converting ${files.length} gallery image(s) to Base64 format...`);
      const base64Items = [];
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const b64 = await fileToBase64(file);
        if (b64) base64Items.push(b64);
      }
      setFormData(prev => ({
        ...prev,
        gallery: [...(prev.gallery || []), ...base64Items]
      }));
      setModalError(null);
      setUploadProgressText('');
    } catch (err) {
      console.error('Error converting gallery files to base64:', err);
      setModalError('Failed to process some gallery images to Base64.');
      setUploadProgressText('');
    }
    e.target.value = '';
  };

  const removeExistingGalleryImage = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      gallery: (prev.gallery || []).filter((_, index) => index !== indexToRemove)
    }));
  };

  const removePendingGalleryImage = (id) => {
    setPendingGalleryFiles(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.name.trim()) {
      setActiveTab('basic');
      setModalError('Product Name is required.');
      return;
    }
    if (!formData.category) {
      setActiveTab('basic');
      setModalError('Category is required.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const isEditing = Boolean(editingId);
      const targetId = editingId;
      setUploadProgressText(isEditing ? 'Saving product with Base64 images to database...' : 'Saving new product with Base64 images to database...');

      const payload = {
        ...formData,
        mainImage: formData.mainImage || '',
        gallery: Array.isArray(formData.gallery) ? formData.gallery : []
      };

      if (!payload.subCategory) {
        payload.subCategory = null;
      }
      if (!payload.sku || !payload.sku.trim()) {
        delete payload.sku;
      } else {
        payload.sku = payload.sku.trim();
      }

      // Category and subcategory objects for display
      const catId = payload.category?._id || payload.category;
      const foundCat = categories.find(c => c._id === catId);
      const populatedCat = foundCat ? { _id: foundCat._id, name: foundCat.name } : { _id: catId, name: '' };

      const subId = payload.subCategory?._id || payload.subCategory;
      const foundSub = allSubCategories.find(s => s._id === subId);
      const populatedSub = foundSub ? { _id: foundSub._id, name: foundSub.name } : (subId ? { _id: subId, name: '' } : null);

      if (isEditing) {
        const res = await api.put(`/products/${targetId}`, payload);
        const serverProduct = res.data?.data;
        if (!serverProduct) {
          throw new Error('Failed to update product: Server did not return saved product record.');
        }

        const finalProduct = {
          ...serverProduct,
          category: serverProduct.category?.name ? serverProduct.category : populatedCat,
          subCategory: serverProduct.subCategory?.name ? serverProduct.subCategory : populatedSub
        };

        saveProductOverride(finalProduct);
        setProducts(prev => {
          const next = prev.map(p => p._id === targetId ? finalProduct : p);
          updateProductsStateAndCache(next);
          return next;
        });

        showFeedback('Product and Base64 images updated successfully in database!');
        closeModal();
      } else {
        const res = await api.post('/products', payload);
        const savedProduct = res.data?.data;
        if (!savedProduct) {
          throw new Error('Failed to create product: Server did not return saved product record.');
        }

        const finalProduct = {
          ...savedProduct,
          category: savedProduct.category?.name ? savedProduct.category : populatedCat,
          subCategory: savedProduct.subCategory?.name ? savedProduct.subCategory : populatedSub
        };

        saveProductOverride(finalProduct);
        setProducts(prev => {
          const next = [finalProduct, ...prev.filter(p => p._id !== finalProduct._id)];
          updateProductsStateAndCache(next);
          return next;
        });

        const newProdCatId = finalProduct.category?._id || finalProduct.category;
        if (selectedCategory && selectedCategory !== newProdCatId) {
          setSelectedCategory(newProdCatId || '');
        }
        setSearchQuery('');
        setCurrentPage(1);
        showFeedback('New product added with Base64 images successfully!');
        closeModal();
      }
    } catch (err) {
      console.error('Error submitting product form:', err);
      const errMsg = err.response?.data?.message || err.message || 'Operation failed. Please try again.';
      setModalError(errMsg);
    } finally {
      setIsSubmitting(false);
      setUploadProgressText('');
    }
  };

  const getStockStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'bg-emerald-100 text-emerald-800';
      case 'Inactive': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Filtered products calculation
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch = !q || 
        (product.name && product.name.toLowerCase().includes(q)) ||
        (product.sku && product.sku.toLowerCase().includes(q)) ||
        (product.brand && product.brand.toLowerCase().includes(q)) ||
        (product.category?.name && product.category.name.toLowerCase().includes(q));
        
      let matchesCategory = true;
      if (selectedCategory) {
        const prodCatId = product.category?._id || (typeof product.category === 'string' ? product.category : '');
        const prodCatName = product.category?.name || '';
        matchesCategory = prodCatId === selectedCategory || prodCatName.toLowerCase() === selectedCategory.toLowerCase();
      }
        
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedbackMessage && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all duration-300 ${
          feedbackMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedbackMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
          <button 
            onClick={() => setFeedbackMessage(null)}
            className="ml-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your catalog ({products.length} total products in database)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchProducts(true)} 
            disabled={refreshing}
            className="flex items-center px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin text-[#0b2545]' : ''}`} />
            {refreshing ? 'Syncing...' : 'Sync Catalog'}
          </button>
          <button 
            onClick={openAddModal}
            className="bg-gradient-to-r from-[#0b2545] to-[#1a385f] hover:from-[#1a385f] hover:to-[#264b77] text-white px-5 py-2.5 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Product
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search products by name..." 
              className="w-full pl-10 pr-10 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0b2545] focus:border-transparent"
            />
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <select 
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0b2545]"
              >
                <option value="">All Categories ({products.length})</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>

            {(selectedCategory || searchQuery) && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
                title="Clear all filters"
              >
                <X className="w-3.5 h-3.5" />
                Clear Filter
              </button>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading && products.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0b2545] mb-2" />
              <span>Loading products catalog...</span>
            </div>
          ) : error && products.length === 0 ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : paginatedProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Box className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-700 mb-1">
                {searchQuery || selectedCategory ? 'No products match your search/filter.' : 'No products found.'}
              </p>
              <p className="text-xs text-slate-400 mb-4">
                {selectedCategory ? 'Try selecting a different category or clearing filters.' : 'Click "Add Product" above to create your first product.'}
              </p>
              {(searchQuery || selectedCategory) && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-[#0b2545] text-white rounded-lg text-xs font-semibold hover:bg-[#1a385f] transition-colors shadow-sm inline-flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  View All Products ({products.length})
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                  <th className="px-6 py-4 font-medium">Product Details</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedProducts.map((product) => (
                  <tr key={product._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {product.mainImage ? (
                          <img 
                            src={getImageUrl(product.mainImage)} 
                            alt={product.name} 
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/logo_new.png';
                            }}
                            className="w-12 h-12 rounded-lg object-cover border border-slate-200 mr-4 bg-slate-50" 
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center mr-4">
                            <Box className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-800">{product.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-800">{product.category?.name || '-'}</div>
                      <div className="text-xs text-slate-500 mt-1">{product.subCategory?.name || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStockStatusColor(product.status)}`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(product)} className="p-2 text-slate-400 hover:text-[#0b2545] hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(product._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {filteredProducts.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
            <div>
              Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredProducts.length)} of {filteredProducts.length} entries
              {filteredProducts.length !== products.length && ` (filtered from ${products.length} total)`}
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
                .map((page, index, array) => {
                  const showEllipsis = index > 0 && page - array[index - 1] > 1;
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && <span className="px-2 text-slate-400">...</span>}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-[#0b2545] text-white shadow-sm'
                            : 'border border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
              <button 
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl overflow-hidden shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 flex-shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
                {editingId && (
                  <p className="text-xs text-slate-500 mt-0.5">Editing: <span className="font-semibold text-slate-700">{formData.name || 'Untitled'}</span></p>
                )}
              </div>
              <button 
                onClick={closeModal} 
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-40 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="border-b border-slate-200 flex-shrink-0 px-6 pt-4 flex gap-6 text-sm font-medium">
              <button type="button" onClick={() => setActiveTab('basic')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'basic' ? 'border-[#0b2545] text-[#0b2545]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Basic Info</button>
              <button type="button" onClick={() => setActiveTab('images')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'images' ? 'border-[#0b2545] text-[#0b2545]' : 'border-transparent text-slate-500 hover:text-slate-700'} flex items-center gap-1.5`}>
                <ImageIcon className="w-4 h-4" />
                Images
                {((formData.gallery?.length || 0) + pendingGalleryFiles.length > 0) && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-slate-100 rounded-full font-semibold text-slate-600">
                    {(formData.gallery?.length || 0) + pendingGalleryFiles.length}
                  </span>
                )}
              </button>
              <button type="button" onClick={() => setActiveTab('specs')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'specs' ? 'border-[#0b2545] text-[#0b2545]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Specifications</button>
              <button type="button" onClick={() => setActiveTab('seo')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'seo' ? 'border-[#0b2545] text-[#0b2545]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>SEO</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              {modalError && (
                <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start justify-between shadow-sm">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500 mt-0.5" />
                    <div>
                      <div className="font-semibold text-red-800">Validation / Update Error</div>
                      <div className="text-xs text-red-600 mt-0.5">{modalError}</div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setModalError(null)} className="text-red-400 hover:text-red-600 ml-2">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {isSubmitting && (
                <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm flex items-center gap-3 shadow-sm animate-pulse">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#0b2545] flex-shrink-0" />
                  <div>
                    <div className="font-semibold">{uploadProgressText || 'Saving product...'}</div>
                    <div className="text-xs text-blue-600">Please wait while files upload to cloud storage and database updates.</div>
                  </div>
                </div>
              )}

              {activeTab === 'basic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                    <select required name="category" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value, subCategory: ''})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]">
                      <option value="" disabled>Select Category</option>
                      {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sub Category</label>
                    <select name="subCategory" value={formData.subCategory} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]">
                      <option value="">None / Select Sub Category</option>
                      {allSubCategories
                        .filter(sub => {
                          if (!formData.category) return true;
                          const subCatId = sub.category?._id || sub.category;
                          return subCatId === formData.category || !subCatId;
                        })
                        .map(sub => (
                          <option key={sub._id} value={sub._id}>{sub.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                    <input type="text" name="brand" value={formData.brand} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" placeholder="e.g. Eagle Engineering" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Item Code</label>
                    <input type="text" name="sku" value={formData.sku || ''} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" placeholder="e.g. EG-1002" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Short Description</label>
                    <textarea name="shortDescription" value={formData.shortDescription} onChange={handleInputChange} rows="2" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]"></textarea>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Description</label>
                    <textarea name="fullDescription" value={formData.fullDescription} onChange={handleInputChange} rows="4" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]"></textarea>
                  </div>
                  
                  <div className="md:col-span-2 flex items-center gap-6 p-4 bg-white rounded-lg border border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="isFeatured" checked={formData.isFeatured} onChange={handleInputChange} className="w-4 h-4 text-[#0b2545] rounded focus:ring-[#0b2545]" />
                      <span className="text-sm font-medium text-slate-700">Featured Product</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="isNewProduct" checked={formData.isNewProduct} onChange={handleInputChange} className="w-4 h-4 text-[#0b2545] rounded focus:ring-[#0b2545]" />
                      <span className="text-sm font-medium text-slate-700">New Product</span>
                    </label>
                    <div className="ml-auto flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Status:</label>
                      <select name="status" value={formData.status} onChange={handleInputChange} className="px-3 py-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545] text-sm">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'images' && (
                <div className="space-y-6">
                  {/* Main Product Image Section */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">Main Product Image</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Primary display image across catalog cards and hero showcases.</p>
                      </div>
                      {mainImageFile ? (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
                          ● Selected (Uploads on Save)
                        </span>
                      ) : formData.mainImage ? (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
                          ✔ Cloud Reference
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full">
                          No Image Set
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                      <div className="relative group">
                        {mainImagePreview || formData.mainImage ? (
                          <div className="relative w-36 h-36 rounded-xl border-2 border-slate-200 overflow-hidden bg-white flex items-center justify-center shadow-inner">
                            <img 
                              src={mainImagePreview || getImageUrl(formData.mainImage)} 
                              alt="Main Product Preview" 
                              className="max-w-full max-h-full object-contain p-2" 
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/logo_new.png';
                              }}
                            />
                            <button 
                              type="button" 
                              onClick={handleRemoveMainImage} 
                              className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 text-red-500 rounded-full p-1.5 shadow-md border border-slate-200 hover:border-red-300 transition-colors"
                              title="Remove image"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            {(mainImagePreview?.startsWith('data:') || formData.mainImage?.startsWith('data:')) && (
                              <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded shadow-sm">
                                Base64 Raw
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="w-36 h-36 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                            <Upload className="w-8 h-8 mb-2 text-slate-300" />
                            <span className="text-xs font-medium">No Image</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 w-full space-y-3">
                        <label className="block">
                          <span className="text-xs font-medium text-slate-700 block mb-1">Replace or Upload New Main Image</span>
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml" 
                            onChange={handleMainImageSelect} 
                            disabled={isSubmitting}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#0b2545] file:text-white hover:file:bg-[#1a385f] file:cursor-pointer cursor-pointer border border-slate-200 rounded-xl bg-slate-50/50 p-1" 
                          />
                        </label>
                        <p className="text-xs text-slate-500">
                          Selected image is automatically processed into compact, high-clarity <strong>Base64 raw format</strong> and stored directly in database.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Gallery Supporting Images Section */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">Gallery / Supporting Images</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Additional product angles and detail views stored in Base64 raw format.</p>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full">
                        {formData.gallery?.length || 0} image(s)
                      </span>
                    </div>

                    {/* Previews Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3.5 mb-4">
                      {/* Existing & Added Base64 Images */}
                      {formData.gallery && formData.gallery.map((img, index) => (
                        <div key={`gallery-${index}`} className="relative group bg-slate-50 rounded-xl border border-slate-200 overflow-hidden aspect-square flex items-center justify-center p-2">
                          <img 
                            src={getImageUrl(img)} 
                            alt={`Gallery ${index}`} 
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/logo_new.png';
                            }}
                          />
                          <button 
                            type="button" 
                            onClick={() => removeExistingGalleryImage(index)} 
                            className="absolute top-1.5 right-1.5 bg-white/95 text-red-500 rounded-full p-1 shadow border border-slate-200 opacity-90 hover:opacity-100 hover:bg-red-50 transition-opacity"
                            title="Remove image from product"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] font-medium bg-black/60 text-white rounded">
                            {img.startsWith('data:') ? 'Base64' : 'Saved'}
                          </span>
                        </div>
                      ))}

                      {/* Add Gallery Button Placeholder in grid */}
                      <label className="border-2 border-dashed border-slate-300 hover:border-[#0b2545] rounded-xl flex flex-col items-center justify-center aspect-square cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition-colors p-2 text-center group">
                        <Upload className="w-5 h-5 text-slate-400 group-hover:text-[#0b2545] mb-1" />
                        <span className="text-[11px] font-semibold text-slate-600 group-hover:text-[#0b2545] leading-tight">+ Add Photos</span>
                        <input 
                          type="file" 
                          multiple 
                          accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml" 
                          onChange={handleGallerySelect} 
                          disabled={isSubmitting}
                          className="hidden" 
                        />
                      </label>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span>Images are automatically processed to Base64 raw format upon selection.</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'specs' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Size</label>
                    <input type="text" name="specifications.size" value={formData.specifications.size} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Length</label>
                    <input type="text" name="specifications.length" value={formData.specifications.length} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Diameter</label>
                    <input type="text" name="specifications.diameter" value={formData.specifications.diameter} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Material</label>
                    <input type="text" name="specifications.material" value={formData.specifications.material} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Finish</label>
                    <input type="text" name="specifications.finish" value={formData.specifications.finish} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Color</label>
                    <input type="text" name="specifications.color" value={formData.specifications.color} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Weight</label>
                    <input type="text" name="specifications.weight" value={formData.specifications.weight} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
                  </div>
                </div>
              )}

              {activeTab === 'seo' && (
                <div className="space-y-4 bg-white p-6 rounded-lg border border-slate-200">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Meta Title</label>
                    <input type="text" name="seo.metaTitle" value={formData.seo.metaTitle} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
                    <p className="text-xs text-slate-500 mt-1">Recommended length: 50-60 characters</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Meta Description</label>
                    <textarea name="seo.metaDescription" value={formData.seo.metaDescription} onChange={handleInputChange} rows="3" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]"></textarea>
                    <p className="text-xs text-slate-500 mt-1">Recommended length: 150-160 characters</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Meta Keywords</label>
                    <input type="text" name="seo.metaKeywords" value={formData.seo.metaKeywords} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" placeholder="e.g. fasteners, screws, bolts (comma separated)" />
                  </div>
                </div>
              )}

              <div className="pt-6 flex items-center justify-between border-t border-slate-200/80 mt-6">
                <div className="text-xs text-slate-500">
                  {isSubmitting ? (
                    <span className="font-medium text-[#0b2545] flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      {uploadProgressText || 'Saving to database...'}
                    </span>
                  ) : (
                    <span>All changes persist directly to the database upon submission.</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={closeModal} 
                    disabled={isSubmitting}
                    className="px-6 py-2.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting} 
                    className="px-6 py-2.5 bg-[#0b2545] text-white rounded-xl font-medium hover:bg-[#1a385f] transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting && <RefreshCw className="w-4 h-4 animate-spin text-white" />}
                    <span>{isSubmitting ? (uploadProgressText || 'Saving...') : (editingId ? 'Update Product' : 'Save Product')}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
