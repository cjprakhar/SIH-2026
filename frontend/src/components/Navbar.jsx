import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  LayoutDashboard, 
  FileSearch, 
  Files,
  Layers, 
  FileText, 
  BarChart3, 
  Database,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Sun,
  Moon
} from 'lucide-react';
import api from '../services/api';

export default function Navbar({ activeTab, setActiveTab, theme, setTheme }) {
  const [indexStatus, setIndexStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      try {
        const data = await api.getIndexStatus();
        setIndexStatus(data);
      } catch (err) {
        console.warn('Could not fetch index status:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'analyze', label: 'Analyze Single', icon: FileSearch },
    { id: 'batch', label: 'Batch Triage', icon: Files },
    { id: 'patterns', label: 'Safety Patterns', icon: Layers },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'insights', label: 'Insights', icon: BarChart3 },
  ];

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="nav-brand" onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="brand-icon">
            <ShieldAlert size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brand-title">SIF Intelligence</span>
              <span className="brand-tag">v1.0 AI CORE</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Operational Safety Intelligence Platform
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="nav-links">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* System / FAISS Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {indexStatus && (
            <div 
              className="index-status-pill"
              title={`Historical similarity index: ${indexStatus.total_records?.toLocaleString()} records`}
            >
              <Database size={14} color="var(--brand-blue)" />
              <span>
                Index: <strong style={{ color: 'var(--brand-blue)' }}>{indexStatus.total_records?.toLocaleString()}</strong> records
              </span>
              <span 
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: indexStatus.is_built ? '#22c55e' : '#ef4444',
                  boxShadow: indexStatus.is_built ? '0 0 6px rgba(34, 197, 94, 0.4)' : '0 0 6px rgba(239, 68, 68, 0.4)',
                }}
              />
            </div>
          )}
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'day' : 'night'} mode`}
            title={`Switch to ${theme === 'dark' ? 'day' : 'night'} mode`}
          >
            {theme === 'dark' ? <Sun size={15} color="#eab308" /> : <Moon size={15} color="#6366f1" />}
            <span>{theme === 'dark' ? 'Day mode' : 'Night mode'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
