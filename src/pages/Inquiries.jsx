import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Search, Eye, Trash2, X } from 'lucide-react';

const Inquiries = () => {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedInquiry, setSelectedInquiry] = useState(null);

  const fetchInquiries = async () => {
    try {
      const response = await api.get('/inquiries');
      setInquiries(response.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this inquiry?')) {
      try {
        await api.delete(`/inquiries/${id}`);
        fetchInquiries();
      } catch (err) {
        console.error('Error deleting inquiry:', err);
        alert('Failed to delete inquiry');
      }
    }
  };

  const handleView = (inquiry) => {
    setSelectedInquiry(inquiry);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Inquiries</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <div className="relative w-64">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search inquiries..." 
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0b2545] focus:border-transparent"
            />
          </div>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading inquiries...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-sm">
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Subject</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inquiries.map((inquiry) => (
                  <tr key={inquiry._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">{inquiry.name}</td>
                    <td className="px-6 py-4 text-slate-500">{inquiry.email}</td>
                    <td className="px-6 py-4 text-slate-800">
                      <div className="flex items-center space-x-3">
                        {inquiry.productImage && (
                          <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg p-1 flex-shrink-0">
                            <img src={inquiry.productImage} alt="Product" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <span>{inquiry.subject}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        inquiry.status === 'New' ? 'bg-blue-100 text-blue-700' : 
                        inquiry.status === 'In Review' ? 'bg-amber-100 text-amber-700' : 
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {inquiry.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{new Date(inquiry.createdAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button onClick={() => handleView(inquiry)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(inquiry._id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {inquiries.length === 0 && (
                  <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No inquiries found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedInquiry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Inquiry Details</h3>
              <button onClick={() => setSelectedInquiry(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Name</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedInquiry.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Email</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedInquiry.email}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Phone</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedInquiry.phone}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Company</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedInquiry.company || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Date</p>
                  <p className="text-sm font-semibold text-slate-800">{new Date(selectedInquiry.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Status</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedInquiry.status}</p>
                </div>
              </div>
              
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500 font-medium mb-1">Subject</p>
                <p className="text-sm font-semibold text-slate-800">{selectedInquiry.subject}</p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500 font-medium mb-1">Message</p>
                <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                  {selectedInquiry.message}
                </div>
              </div>

              {selectedInquiry.productImage && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs text-slate-500 font-medium mb-2">Attached Product</p>
                  <img src={selectedInquiry.productImage} alt="Product" className="w-32 h-32 object-contain border border-slate-200 rounded-lg p-1" />
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-100 flex justify-end">
              <button onClick={() => setSelectedInquiry(null)} className="px-6 py-2 bg-[#0b2545] text-white rounded-lg font-medium hover:bg-[#1a385f] transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inquiries;
