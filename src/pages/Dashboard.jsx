import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Briefcase, MessageSquare, Layers, CheckCircle } from 'lucide-react';
import api from '../api/axios';

const StatCard = ({ title, value, icon: Icon, colorClass, borderClass }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 relative overflow-hidden group">
    <div className={`absolute top-0 left-0 w-1 h-full ${borderClass}`}></div>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1 transition-colors">{title}</p>
        <h3 className="text-3xl font-bold text-slate-800 tracking-tight">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </div>
);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('/analytics/summary');
        setData(response.data.data);
      } catch (err) {
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) return <div className="flex justify-center items-center h-full text-slate-500">Loading Dashboard...</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Products" 
          value={data.metrics.totalProducts} 
          icon={Briefcase} 
          colorClass="bg-blue-50 text-blue-600"
          borderClass="bg-blue-500"
        />
        <StatCard 
          title="Total Categories" 
          value={data.metrics.totalCategories} 
          icon={Layers} 
          colorClass="bg-emerald-50 text-emerald-600"
          borderClass="bg-emerald-500"
        />
        <StatCard 
          title="Total Inquiries" 
          value={data.metrics.totalInquiries} 
          icon={MessageSquare} 
          colorClass="bg-amber-50 text-amber-600"
          borderClass="bg-amber-500"
        />
        <StatCard 
          title="Sub Categories" 
          value={data.metrics.totalSubCategories} 
          icon={Layers} 
          colorClass="bg-purple-50 text-purple-600"
          borderClass="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Products by Category</h2>
          <div className="h-80 w-full flex justify-center items-center">
            {data.productsByCategory && data.productsByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.productsByCategory}
                    dataKey="count"
                    nameKey="_id"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ _id, percent }) => `${_id} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.productsByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400">No product data available.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800">Recent Inquiries</h2>
          </div>
          <div className="p-0">
            {data.recentInquiries && data.recentInquiries.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {data.recentInquiries.map((inquiry) => (
                  <li key={inquiry._id} className="px-4 md:px-6 py-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{inquiry.subject}</p>
                      <p className="text-xs text-slate-500 mt-1">From: {inquiry.name} ({inquiry.email})</p>
                    </div>
                    <div className="self-start sm:self-auto">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        inquiry.status === 'New' ? 'bg-blue-100 text-blue-700' : 
                        inquiry.status === 'In Review' ? 'bg-amber-100 text-amber-700' : 
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {inquiry.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-6 text-center text-slate-500">No recent inquiries found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
