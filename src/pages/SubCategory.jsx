import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreVertical, Edit2, Trash2, FolderTree, X } from 'lucide-react';
import api from '../api/axios';

const SubCategory = () => {
  const [subCategories, setSubCategories] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: '', image: '', description: '', status: 'Active' });
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const getImageUrl = (imagePath) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http') || imagePath.startsWith('data:') || imagePath.startsWith('/products')) return imagePath;
    const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'https://eagle-engineering-server-dzor.onrender.com';
    return `${baseUrl}${imagePath}`;
  };

  useEffect(() => {
    fetchSubCategories();
    fetchCategories();
  }, []);

  const fetchSubCategories = async () => {
    try {
      const response = await api.get('/sub-categories');
      setSubCategories(response.data.data);
    } catch (error) {
      console.error('Error fetching sub categories:', error);
      setError('Failed to fetch sub categories.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEdit = (sub) => {
    setEditingId(sub._id);
    setFormData({
      name: sub.name,
      category: sub.category?._id || '',
      image: sub.image || '',
      description: sub.description || '',
      status: sub.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this sub category?')) {
      try {
        await api.delete(`/sub-categories/${id}`);
        fetchSubCategories();
      } catch (err) {
        console.error('Error deleting sub category:', err);
        alert('Failed to delete sub category');
      }
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      setUploadingImage(true);
      const res = await api.post('/upload', uploadData);
      setFormData({ ...formData, image: res.data.url });
    } catch (err) {
      console.error('Upload error:', err);
      alert('Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/sub-categories/${editingId}`, formData);
      } else {
        await api.post('/sub-categories', formData);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ name: '', category: '', image: '', description: '', status: 'Active' });
      fetchSubCategories();
    } catch (err) {
      console.error('Error adding sub category:', err);
      alert(err.response?.data?.message || 'Failed to add sub category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sub Categories</h1>
        <button 
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', category: '', image: '', description: '', status: 'Active' });
            setShowModal(true);
          }}
          className="bg-[#0b2545] hover:bg-[#1a385f] text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Sub Category
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search sub categories..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0b2545] focus:border-transparent"
            />
          </div>
          <button className="flex items-center px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>
        
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading sub categories...</div>
          ) : error ? (
            <div className="p-8 text-center text-red-500">{error}</div>
          ) : subCategories.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No sub categories found.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-100">
                  <th className="px-6 py-4 font-medium">Sub Category Name</th>
                  <th className="px-6 py-4 font-medium">Parent Category</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subCategories.map((sub) => (
                  <tr key={sub._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {sub.image ? (
                          <img src={getImageUrl(sub.image)} alt={sub.name} className="w-10 h-10 rounded-lg object-cover mr-3 border border-slate-200" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center mr-3">
                            <FolderTree className="w-5 h-5 text-indigo-600" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-800">{sub.name}</div>
                          <div className="text-xs text-slate-500 mt-1 truncate max-w-[120px]">{sub.description || `ID: ${sub._id.substring(0, 8)}`}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {sub.category ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800">
                          {sub.category.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${sub.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(sub)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(sub._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
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
        
        {!loading && subCategories.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <div>Showing 1 to {subCategories.length} of {subCategories.length} entries</div>
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
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Sub Category' : 'Add New Sub Category'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sub Category Image</label>
                {formData.image && (
                  <img src={getImageUrl(formData.image)} alt="Preview" className="w-24 h-24 object-cover rounded-lg mb-2 border border-slate-200" />
                )}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-[#0b2545] hover:file:bg-blue-100" />
                {uploadingImage && <p className="text-xs text-blue-600 mt-1">Uploading...</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sub Category Name *</label>
                <input required type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b2545]" placeholder="e.g. Screws" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b2545]" rows="3" placeholder="Brief description..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Category *</label>
                <select required name="category" value={formData.category} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b2545]">
                  <option value="" disabled>Select Parent Category</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b2545]">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-[#0b2545] text-white rounded-lg font-medium hover:bg-[#1a385f] transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : (editingId ? 'Update Sub Category' : 'Save Sub Category')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubCategory;
