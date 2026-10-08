import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  Bell, 
  Search,
  Menu,
  Briefcase,
  Box,
  Layers,
  FolderTree,
  MessageSquare,
  LogOut
} from 'lucide-react';
import { useState } from 'react';

import Dashboard from './pages/Dashboard';
import Category from './pages/Category';
import SubCategory from './pages/SubCategory';
import Products from './pages/Products';
import Inquiries from './pages/Inquiries';

import AdminLogin from './pages/AdminLogin';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Categories', path: '/categories', icon: Layers },
    { name: 'Sub Categories', path: '/sub-categories', icon: FolderTree },
    { name: 'Products', path: '/products', icon: Box },
    { name: 'Inquiries', path: '/inquiries', icon: MessageSquare },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-0 flex flex-col`}>
      <div className="flex items-center justify-center h-20 border-b border-slate-100 bg-white px-2">
        <img src="/logo_new.png" alt="Eagle Engineering Logo" className="h-14 w-auto object-contain drop-shadow-sm hover:scale-105 transition-transform" />
      </div>
      <nav className="mt-6 px-4 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            onClick={() => setIsOpen(false)}
            className={`flex items-center px-4 py-3 mb-2 rounded-lg transition-all duration-200 ${
              location.pathname === item.path
                ? 'bg-gradient-to-r from-[#0b2545] to-[#1a385f] text-white shadow-md transform scale-[1.02]'
                : 'text-slate-500 hover:bg-slate-50 hover:text-[#0b2545] hover:scale-[1.01]'
            }`}
          >
            <item.icon className="w-5 h-5 mr-3" />
            <span className="font-medium">{item.name}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <button 
          onClick={() => {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            navigate('/login');
          }}
          className="flex w-full items-center px-4 py-3 rounded-lg transition-colors text-red-600 hover:bg-red-50 font-medium"
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );
};

const Header = ({ setIsOpen }) => {
  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-6 shadow-sm sticky top-0 z-40 transition-all">
      <div className="flex items-center">
        <button 
          onClick={() => setIsOpen(true)}
          className="md:hidden text-slate-500 hover:text-slate-700 mr-4"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="relative hidden md:block">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0b2545] focus:border-transparent w-64"
          />
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors rounded-full hover:bg-slate-100">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold cursor-pointer ring-2 ring-white shadow-md">
          A
        </div>
      </div>
    </header>
  );
};

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('adminToken');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const AppContent = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header setIsOpen={setIsSidebarOpen} />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 lg:p-6">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute><Category /></ProtectedRoute>} />
            <Route path="/sub-categories" element={<ProtectedRoute><SubCategory /></ProtectedRoute>} />
            <Route path="/inquiries" element={<ProtectedRoute><Inquiries /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><div className="p-6 bg-white rounded-xl shadow-sm"><h2 className="text-2xl font-bold mb-4">Settings</h2><p className="text-slate-600">Configuration options will go here.</p></div></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
