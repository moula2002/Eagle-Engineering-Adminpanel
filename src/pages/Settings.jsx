import React, { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, Printer, Building2, Save, Loader2, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';

export const Settings = () => {
  const [formData, setFormData] = useState({
    companyName: 'Eagle Engineering',
    email: 'info@eagleeng.in',
    phone: '+91 96321 44367',
    fax: '+91 80-7966 7629',
    officePhone: '+91 80-7966 7629',
    address: 'No. 22, First Floor, Kothnoor Dinne, JP Nagar 8th Phase, Kalena Agrahara, Kothnur, Bengaluru, Karnataka - 560076',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      if (res.data && res.data.data) {
        const d = res.data.data;
        setFormData((prev) => ({
          companyName: d.companyName || prev.companyName,
          email: d.email || prev.email,
          phone: d.phone || prev.phone,
          fax: d.fax || prev.fax,
          officePhone: d.officePhone || prev.officePhone,
          address: d.address || prev.address,
        }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage({ type: '', text: '' });
      const res = await api.put('/settings', formData);
      if (res.data && res.data.success) {
        setMessage({ type: 'success', text: 'Contact details and Office Number saved successfully!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 4000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0b2545]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">General & Contact Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage contact numbers, email, and address shown dynamically on the public website.
        </p>
      </div>

      {message.text && (
        <div
          className={"p-4 rounded-xl flex items-center gap-3 text-sm font-medium " + (message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200')}
        >
          {message.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-red-600" />
            <span>Contact Details & Phone Numbers</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            These values update the Contact Us page dynamically in real time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>Phone Number</span>
            </label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+91 96321 44367"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0b2545] text-sm text-slate-800"
            />
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="info@eagleeng.in"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0b2545] text-sm text-slate-800"
            />
          </div>

          {/* Fax Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Printer className="w-4 h-4 text-slate-400" />
              <span>Fax Number</span>
            </label>
            <input
              type="text"
              name="fax"
              value={formData.fax}
              onChange={handleChange}
              placeholder="+91 80-7966 7629"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0b2545] text-sm text-slate-800"
            />
          </div>

          {/* Office Number (Immediately after Fax Number) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>Office Number</span>
            </label>
            <input
              type="text"
              name="officePhone"
              value={formData.officePhone}
              onChange={handleChange}
              placeholder="+91 80-7966 7629"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0b2545] text-sm text-slate-800"
            />
          </div>

          {/* Company Name */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Company Name
            </label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="Eagle Engineering"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0b2545] text-sm text-slate-800"
            />
          </div>

          {/* Full Address */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>Full Address</span>
            </label>
            <textarea
              rows={3}
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="No. 22, First Floor, Kothnoor Dinne, JP Nagar 8th Phase, Kalena Agrahara, Kothnur, Bengaluru, Karnataka - 560076"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0b2545] text-sm text-slate-800"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0b2545] to-[#1a385f] hover:from-[#133863] hover:to-[#22487a] text-white text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;
