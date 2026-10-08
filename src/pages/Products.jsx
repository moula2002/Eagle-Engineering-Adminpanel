import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreVertical, Edit2, Trash2, Box, X, Upload } from 'lucide-react';
import api from '../api/axios';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [allSubCategories, setAllSubCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http') || imagePath.startsWith('data:')) return imagePath;
    const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'https://eagle-engineering-server.onrender.com';
    return `${baseUrl}${imagePath}`;
  };

  useEffect(() => {
    fetchProducts();
    fetchCategoriesAndSubCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.data);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to fetch products.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesAndSubCategories = async () => {
    try {
      const [catRes, subRes] = await Promise.all([
        api.get('/categories'),
        api.get('/sub-categories')
      ]);
      setCategories(catRes.data.data);
      setAllSubCategories(subRes.data.data);
    } catch (error) {
      console.error('Error fetching categories/subcategories:', error);
    }
  };

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
      category: product.category?._id || '',
      subCategory: product.subCategory?._id || '',
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
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await api.delete(`/products/${id}`);
        fetchProducts();
      } catch (err) {
        console.error('Error deleting product:', err);
        alert('Failed to delete product');
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
      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormState);
      setActiveTab('basic');
      fetchProducts();
    } catch (err) {
      console.error('Error adding product:', err);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Products Management</h1>
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search products..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0b2545] focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <Filter className="w-4 h-4 mr-2" />
              Filter by Category
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading products...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No products found.</div>
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
                {products.map((product) => (
                  <tr key={product._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {product.mainImage ? (
                          <img src={getImageUrl(product.mainImage)} alt={product.name} className="w-12 h-12 rounded-lg object-cover border border-slate-200 mr-4" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center mr-4">
                            <Box className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-800">{product.name}</div>
                          <div className="text-xs text-slate-500 mt-1">SKU: {product.sku || `EG-${product._id.substring(0, 5)}`}</div>
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
                        <button onClick={() => handleEdit(product)} className="p-2 text-slate-400 hover:text-[#0b2545] hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(product._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
        
        {!loading && products.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <div>Showing 1 to {products.length} of {products.length} entries</div>
            <div className="flex gap-1">
              <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Prev</button>
              <button className="px-3 py-1 border border-slate-200 rounded bg-[#0b2545] text-white font-medium">1</button>
              <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50" disabled>Next</button>
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
                      <option value="" disabled>Select Sub Category</option>
                      {allSubCategories.filter(sub => !formData.category || (sub.category && sub.category._id === formData.category)).map(sub => (
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
