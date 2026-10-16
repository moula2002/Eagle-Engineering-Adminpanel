import React, { useState, useEffect, useMemo } from 'react';
import { 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { 
  Briefcase, 
  MessageSquare, 
  Layers, 
  FolderTree, 
  ArrowUpRight, 
  PieChart as PieIcon, 
  BarChart3, 
  RefreshCw,
  Plus,
  Inbox,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { initialCategories } from '../data/catalogSnapshot';

const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, borderClass, linkTo }) => (
  <Link 
    to={linkTo}
    className="bg-white p-5 lg:p-6 rounded-2xl shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 relative overflow-hidden group block"
  >
    <div className={`absolute top-0 left-0 w-1.5 h-full ${borderClass}`}></div>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-3xl font-extrabold text-slate-800 tracking-tight">{value}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-1.5">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${colorClass} transition-transform group-hover:scale-110 duration-200`}>
        <Icon className="w-6 h-6" />
      </div>
    </div>
    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500 group-hover:text-[#0b2545] font-medium transition-colors">
      <span>View details</span>
      <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
    </div>
  </Link>
);

// Curated modern executive palette
const PALETTE = [
  '#0b2545',
  '#0088cc',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#64748b'
];

const CustomChartTooltip = ({ active, payload, totalCount }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const count = data.count || payload[0].value;
    const percentage = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white px-3.5 py-2.5 rounded-xl shadow-xl text-xs border border-slate-700/60 z-50">
        <p className="font-semibold text-slate-100 text-sm mb-1">{data.name}</p>
        <p className="text-slate-300 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: payload[0].color || '#0088cc' }} />
          <span><strong className="text-white">{count}</strong> products ({percentage}%)</span>
        </p>
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [categoriesList, setCategoriesList] = useState(() => initialCategories || []);
  const [chartView, setChartView] = useState('donut'); // 'donut' or 'bar'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboardData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const [analyticsRes, catRes] = await Promise.allSettled([
        api.get('/analytics/summary'),
        api.get('/categories')
      ]);

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data?.data) {
        setData(analyticsRes.value.data.data);
      }
      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value.data?.data)) {
        setCategoriesList(catRes.value.data.data);
      }
      setError('');
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Category lookup map (handles raw MongoDB ID resolution)
  const categoryMap = useMemo(() => {
    const map = new Map();
    categoriesList.forEach((c) => {
      if (c && c._id) {
        map.set(String(c._id), c.name);
      }
    });
    return map;
  }, [categoriesList]);

  // Clean, resolved, and grouped chart data
  const chartData = useMemo(() => {
    if (!data?.productsByCategory || !Array.isArray(data.productsByCategory)) return [];

    // 1. Resolve readable category names
    const resolved = data.productsByCategory.map((item) => {
      const rawId = item._id ? String(item._id) : '';
      let catName = item.name;

      // If name is missing or looks like an ObjectId (24 hex characters), look up in categoryMap
      if (!catName || (typeof catName === 'string' && /^[0-9a-fA-F]{24}$/.test(catName))) {
        catName = categoryMap.get(rawId) || catName;
      }

      // If still looks like an ID, give it a clean fallback
      if (!catName || /^[0-9a-fA-F]{24}$/.test(catName)) {
        catName = 'Other Category';
      }

      return {
        _id: rawId,
        name: catName,
        count: Number(item.count) || 0
      };
    });

    // 2. Sort by count descending
    resolved.sort((a, b) => b.count - a.count);

    // 3. For the donut chart, show top 6 and group small categories into "Other Fasteners"
    if (resolved.length <= 7) {
      return resolved;
    }

    const top6 = resolved.slice(0, 6);
    const othersCount = resolved.slice(6).reduce((acc, curr) => acc + curr.count, 0);

    if (othersCount > 0) {
      top6.push({
        _id: 'others',
        name: 'Other Products',
        count: othersCount
      });
    }

    return top6;
  }, [data, categoryMap]);

  // Total products count for percentage calculation
  const totalProducts = data?.metrics?.totalProducts || 0;

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-[#0b2545] mb-3" />
        <p className="text-sm font-medium">Loading executive dashboard...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 text-red-600 rounded-2xl flex items-center justify-between">
        <p>{error}</p>
        <button 
          onClick={() => fetchDashboardData(true)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time catalog metrics and business operations overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchDashboardData(true)} 
            disabled={refreshing}
            className="flex items-center px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-sm font-medium text-slate-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin text-[#0b2545]' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <Link
            to="/products"
            className="bg-gradient-to-r from-[#0b2545] to-[#1a385f] hover:from-[#1a385f] hover:to-[#264b77] text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center text-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Manage Products
          </Link>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard 
          title="Total Products" 
          value={data?.metrics?.totalProducts ?? 0} 
          subtitle={`${data?.metrics?.inStockProducts ?? 0} active in catalog`}
          icon={Briefcase} 
          colorClass="bg-blue-50 text-[#0088cc]"
          borderClass="bg-[#0088cc]"
          linkTo="/products"
        />
        <StatCard 
          title="Categories" 
          value={data?.metrics?.totalCategories ?? 0} 
          subtitle="Primary product lines"
          icon={Layers} 
          colorClass="bg-emerald-50 text-emerald-600"
          borderClass="bg-emerald-500"
          linkTo="/categories"
        />
        <StatCard 
          title="Sub Categories" 
          value={data?.metrics?.totalSubCategories ?? 0} 
          subtitle="Specialized variations"
          icon={FolderTree} 
          colorClass="bg-purple-50 text-purple-600"
          borderClass="bg-purple-500"
          linkTo="/sub-categories"
        />
        <StatCard 
          title="Customer Inquiries" 
          value={data?.metrics?.totalInquiries ?? 0} 
          subtitle={`${data?.metrics?.newInquiries ?? 0} new waiting`}
          icon={MessageSquare} 
          colorClass="bg-amber-50 text-amber-600"
          borderClass="bg-amber-500"
          linkTo="/inquiries"
        />
      </div>

      {/* Main Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Products by Category Card (7 columns) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Products by Category</h2>
                <p className="text-xs text-slate-400 mt-0.5">Catalog distribution across product categories</p>
              </div>

              {/* View Switcher: Donut vs Bar */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setChartView('donut')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    chartView === 'donut' 
                      ? 'bg-white text-[#0b2545] shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Donut Chart View"
                >
                  <PieIcon className="w-3.5 h-3.5" />
                  <span>Donut</span>
                </button>
                <button
                  onClick={() => setChartView('bar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    chartView === 'bar' 
                      ? 'bg-white text-[#0b2545] shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Bar Chart View"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Ranked</span>
                </button>
              </div>
            </div>

            {/* Chart Area */}
            <div className="h-72 w-full flex items-center justify-center relative">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {chartView === 'donut' ? (
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={105}
                        paddingAngle={3}
                        isAnimationActive={true}
                      >
                        {chartData.map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={PALETTE[index % PALETTE.length]} 
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip totalCount={totalProducts} />} />
                    </PieChart>
                  ) : (
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" hide />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        width={130}
                        tick={{ fontSize: 11, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomChartTooltip totalCount={totalProducts} />} />
                      <Bar 
                        dataKey="count" 
                        radius={[0, 8, 8, 0]}
                        barSize={16}
                      >
                        {chartData.map((_, index) => (
                          <Cell 
                            key={`bar-${index}`} 
                            fill={PALETTE[index % PALETTE.length]} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-slate-400">
                  <Inbox className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No product category data available</p>
                </div>
              )}

              {/* Center Donut Label */}
              {chartView === 'donut' && chartData.length > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-extrabold text-slate-800">{totalProducts}</span>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Products</span>
                </div>
              )}
            </div>
          </div>

          {/* Clean Interactive Legend Grid */}
          {chartData.length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {chartData.map((item, index) => {
                const color = PALETTE[index % PALETTE.length];
                const pct = totalProducts > 0 ? ((item.count / totalProducts) * 100).toFixed(0) : 0;
                return (
                  <div key={item._id || index} className="flex items-center gap-2 text-xs">
                    <span 
                      className="w-2.5 h-2.5 rounded-full shrink-0" 
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-slate-600 truncate font-medium flex-1">{item.name}</span>
                    <span className="text-slate-400 font-bold shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Inquiries Card (5 columns) */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 tracking-tight">Recent Inquiries</h2>
              <p className="text-xs text-slate-400 mt-0.5">Direct messages received from website</p>
            </div>
            <Link 
              to="/inquiries"
              className="text-xs font-bold text-[#0088cc] hover:text-[#0b2545] transition-colors flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-0 flex-1 flex flex-col justify-center">
            {data?.recentInquiries && data.recentInquiries.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {data.recentInquiries.slice(0, 5).map((inquiry) => {
                  const statusColors = {
                    'New': 'bg-blue-50 text-blue-700 border-blue-200',
                    'In Review': 'bg-amber-50 text-amber-700 border-amber-200',
                    'Resolved': 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  };
                  const badgeClass = statusColors[inquiry.status] || 'bg-slate-100 text-slate-700 border-slate-200';

                  return (
                    <li key={inquiry._id} className="p-4 hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {inquiry.subject || inquiry.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            From: <span className="font-medium text-slate-700">{inquiry.name}</span> ({inquiry.email})
                          </p>
                          {inquiry.message && (
                            <p className="text-xs text-slate-400 mt-1 line-clamp-1 italic">
                              "{inquiry.message}"
                            </p>
                          )}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${badgeClass}`}>
                          {inquiry.status || 'New'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="p-8 text-center text-slate-400">
                <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-300">
                  <Inbox className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-slate-700">No Inquiries Yet</p>
                <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
                  Customer RFQs and inquiry submissions from the website will automatically stream here.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Live webhook connected
            </span>
            <Link to="/inquiries" className="font-semibold text-slate-700 hover:text-[#0b2545]">
              Manage inquiries →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
