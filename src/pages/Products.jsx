import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, MoreVertical, Edit2, Trash2, Box, X, Upload, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { initialProducts, initialCategories } from '../data/catalogSnapshot';

const CACHE_KEY_PRODUCTS = 'eagle_admin_products';
const CACHE_KEY_CATEGORIES = 'eagle_admin_categories';

// Helper to load cached products safely with snapshot fallback
const getCachedProducts = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY_PRODUCTS);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse cached admin products', e);
  }
  return Array.isArray(initialProducts) ? initialProducts : [];
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
    name: '', sku: '', category: '', subCategory: '', status: 'Active',
    brand: '', shortDescription: '', fullDescription: '',
    mainImage: '', gallery: [],
    specifications: { size: '', length: '', diameter: '', material: '', finish: '', color: '', weight: '' },
    seo: { metaTitle: '', metaDescription: '', metaKeywords: '' },
    isFeatured: false, isNewProduct: false
  };
  
  const [formData, setFormData] = useState(initialFormState);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const showFeedback = (text, type = 'success') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http') || imagePath.startsWith('data:') || imagePath.startsWith('/products')) return imagePath;
    const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'https://eagle-engineering-server.onrender.com';
    return `${baseUrl}${imagePath}`;
  };

  // Helper to commit products state to memory, localStorage cache, and broadcast channel
  const updateProductsStateAndCache = useCallback((newList) => {
    setProducts(newList);
    try {
      localStorage.setItem(CACHE_KEY_PRODUCTS, JSON.stringify(newList));
    } catch (e) {
      console.warn('Failed to cache products to localStorage', e);
    }

    try {
      const channel = new BroadcastChannel('eagle_sync_channel');
      channel.postMessage({ type: 'PRODUCTS_UPDATED', count: newList.length, timestamp: Date.now() });
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

  const handleEdit = (product) => {
    setEditingId(product._id);
    setFormData({
      name: product.name || '',
      sku: product.sku || '',
      category: product.category?._id || (typeof product.category === 'string' ? product.category : ''),
      subCategory: product.subCategory?._id || (typeof product.subCategory === 'string' ? product.subCategory : ''),
      status: product.status || 'Active',
      brand: product.brand || '',
      shortDescription: product.shortDescription || '',
      fullDescription: product.fullDescription || '',
      mainImage: product.mainImage || '',
      gallery: product.gallery || [],
      specifications: product.specifications || initialFormState.specifications,
      seo: product.seo || initialFormState.seo,
      isFeatured: product.isFeatured || false,
      isNewProduct: product.isNewProduct || false
    });
    setActiveTab('basic');
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product? This will permanently remove it from the catalog.')) {
      // 1. Immediate optimistic UI deletion
      const previousProducts = [...products];
      const updatedList = products.filter((p) => p._id !== id);
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

  const handleImageUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      setUploadingImage(true);
      const res = await api.post('/upload', uploadData);
      
      if (fieldName === 'gallery') {
        setFormData({ ...formData, gallery: [...formData.gallery, res.data.url] });
      } else {
        setFormData({ ...formData, [fieldName]: res.data.url });
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeGalleryImage = (indexToRemove) => {
    setFormData({
      ...formData,
      gallery: formData.gallery.filter((_, index) => index !== indexToRemove)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Clean up empty strings for ObjectId fields
    const payload = { ...formData };
    if (!payload.subCategory) {
      payload.subCategory = null;
    }

    try {
      let savedProduct;
      if (editingId) {
        const res = await api.put(`/products/${editingId}`, payload);
        savedProduct = res.data?.data;
        
        // Ensure category and subcategory info is fully populated
        if (savedProduct) {
          if (typeof savedProduct.category === 'string' || !savedProduct.category?.name) {
            const catId = savedProduct.category?._id || savedProduct.category;
            const foundCat = categories.find(c => c._id === catId);
            savedProduct.category = foundCat ? { _id: foundCat._id, name: foundCat.name } : { _id: catId, name: '' };
          }
          if (savedProduct.subCategory && (typeof savedProduct.subCategory === 'string' || !savedProduct.subCategory?.name)) {
            const subId = savedProduct.subCategory?._id || savedProduct.subCategory;
            const foundSub = allSubCategories.find(s => s._id === subId);
            savedProduct.subCategory = foundSub ? { _id: foundSub._id, name: foundSub.name } : { _id: subId, name: '' };
          }

          const updatedList = products.map(p => p._id === editingId ? { ...p, ...savedProduct } : p);
          updateProductsStateAndCache(updatedList);
          showFeedback('Product updated successfully!');
        }
      } else {
        const res = await api.post('/products', payload);
        savedProduct = res.data?.data;

        if (savedProduct) {
          if (typeof savedProduct.category === 'string' || !savedProduct.category?.name) {
            const catId = savedProduct.category?._id || savedProduct.category;
            const foundCat = categories.find(c => c._id === catId);
            savedProduct.category = foundCat ? { _id: foundCat._id, name: foundCat.name } : { _id: catId, name: '' };
          }
          if (savedProduct.subCategory && (typeof savedProduct.subCategory === 'string' || !savedProduct.subCategory?.name)) {
            const subId = savedProduct.subCategory?._id || savedProduct.subCategory;
            const foundSub = allSubCategories.find(s => s._id === subId);
            savedProduct.subCategory = foundSub ? { _id: foundSub._id, name: foundSub.name } : { _id: subId, name: '' };
          }

          // Prepend new product immediately to the top of the list
          const updatedList = [savedProduct, ...products.filter(p => p._id !== savedProduct._id)];
          updateProductsStateAndCache(updatedList);

          // If the user had filtered by a different category or had a search active, reset so the new product is visible
          const newProdCatId = savedProduct.category?._id || savedProduct.category;
          if (selectedCategory && selectedCategory !== newProdCatId) {
            setSelectedCategory(newProdCatId || '');
          }
          setSearchQuery('');
          setCurrentPage(1);

          showFeedback('New product added to catalog successfully!');
        }
      }

      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormState);
      setActiveTab('basic');

      // Seamless background revalidation to guarantee server persistence
      fetchProducts();
    } catch (err) {
      console.error('Error saving product:', err);
      alert(err.response?.data?.message || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
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
            onClick={() => {
              setEditingId(null);
              setFormData(initialFormState);
              setActiveTab('basic');
              setShowModal(true);
            }}
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
              placeholder="Search products by name, SKU..." 
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
                          <div className="text-xs text-slate-500 mt-1">SKU: {product.sku || `EG-${String(product._id).substring(0, 5)}`}</div>
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
              <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Product' : 'Add New Product'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="border-b border-slate-200 flex-shrink-0 px-6 pt-4 flex gap-6 text-sm font-medium">
              <button type="button" onClick={() => setActiveTab('basic')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'basic' ? 'border-[#0b2545] text-[#0b2545]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Basic Info</button>
              <button type="button" onClick={() => setActiveTab('images')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'images' ? 'border-[#0b2545] text-[#0b2545]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Images</button>
              <button type="button" onClick={() => setActiveTab('specs')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'specs' ? 'border-[#0b2545] text-[#0b2545]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Specifications</button>
              <button type="button" onClick={() => setActiveTab('seo')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'seo' ? 'border-[#0b2545] text-[#0b2545]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>SEO</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
              {activeTab === 'basic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                    <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">SKU / Product Code</label>
                    <input type="text" name="sku" value={formData.sku} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
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
                      <option value="">Select Sub Category</option>
                      {allSubCategories.filter(sub => !formData.category || (sub.category && (sub.category._id === formData.category || sub.category === formData.category))).map(sub => (
                        <option key={sub._id} value={sub._id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Brand</label>
                    <input type="text" name="brand" value={formData.brand} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0b2545]" />
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
                  <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <h4 className="text-sm font-bold text-slate-800 mb-4">Main Product Image</h4>
                    <div className="flex items-start gap-4">
                      {formData.mainImage ? (
                        <div className="relative">
                          <img src={getImageUrl(formData.mainImage)} alt="Main" className="w-32 h-32 object-cover rounded-lg border border-slate-200" />
                          <button type="button" onClick={() => setFormData({...formData, mainImage: ''})} className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full p-1 shadow-md hover:bg-red-50"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="w-32 h-32 rounded-lg bg-slate-50 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                          <Upload className="w-6 h-6 mb-2" />
                          <span className="text-xs">No image</span>
                        </div>
                      )}
                      <div className="flex-1">
                        <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'mainImage')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-[#0b2545] hover:file:bg-blue-100" />
                        <p className="mt-2 text-xs text-slate-500">Upload the primary image for the product. Recommended size: 800x800px.</p>
                        {uploadingImage && <p className="text-xs text-blue-600 mt-1">Uploading...</p>}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg border border-slate-200">
                    <h4 className="text-sm font-bold text-slate-800 mb-4">Gallery Images</h4>
                    <div className="flex flex-wrap gap-4 mb-4">
                      {formData.gallery.map((img, index) => (
                        <div key={index} className="relative">
                          <img src={getImageUrl(img)} alt={`Gallery ${index}`} className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                          <button type="button" onClick={() => removeGalleryImage(index)} className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full p-1 shadow-md hover:bg-red-50"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2">
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'gallery')} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-[#0b2545] hover:file:bg-blue-100" />
                      <p className="mt-2 text-xs text-slate-500">Add multiple supporting images. You can upload them one by one.</p>
                      {uploadingImage && <p className="text-xs text-blue-600 mt-1">Uploading...</p>}
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

              <div className="pt-6 flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg font-medium transition-colors shadow-sm">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-[#0b2545] text-white rounded-lg font-medium hover:bg-[#1a385f] transition-colors shadow-sm disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : (editingId ? 'Update Product' : 'Save Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
