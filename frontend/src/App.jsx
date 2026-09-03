import React, { useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import BatchTriagePage from './pages/BatchTriagePage';
import AnalyzePage from './pages/AnalyzePage';
import PatternsPage from './pages/PatternsPage';
import ReportsPage from './pages/ReportsPage';
import InsightsPage from './pages/InsightsPage';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('sif-theme') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('sif-theme', theme);
  }, [theme]);

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} setTheme={setTheme} />

      {/* Main Page Router */}
      <main className="main-content">
        {activeTab === 'dashboard' && <DashboardPage setActiveTab={setActiveTab} />}
        {activeTab === 'batch' && <BatchTriagePage setActiveTab={setActiveTab} />}
        {activeTab === 'analyze' && <AnalyzePage />}
        {activeTab === 'patterns' && <PatternsPage />}
        {activeTab === 'reports' && <ReportsPage />}
        {activeTab === 'insights' && <InsightsPage />}
      </main>

      {/* Footer */}
      <footer 
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '24px',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          background: 'var(--footer-bg)',
        }}
      >
        <div style={{ maxWidth: '1540px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <strong>SIF INTELLIGENCE PLATFORM</strong> • Serious Injury & Fatality Precursor Intelligence Engine
          </div>
          <div>
            Grounded in IOGP Life-Saving Rules Taxonomy & 106,878 Historical Incident Telemetry Records
          </div>
        </div>
      </footer>
    </div>
  );
}
