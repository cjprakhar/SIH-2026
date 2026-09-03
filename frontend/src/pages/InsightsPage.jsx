import React, { useEffect, useState } from 'react';
import { 
  BarChart3, 
  RefreshCw, 
  Globe, 
  ShieldAlert, 
  Activity, 
  PieChart,
  Tag,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import AnalyticsCharts from '../components/AnalyticsCharts';

export default function InsightsPage() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadInsights(refresh = false) {
    setLoading(true);
    try {
      const data = await api.getInsights(refresh);
      setInsights(data);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInsights();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <RefreshCw size={36} color="#38bdf8" className="spin-animation" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: 'var(--text-primary)' }}>Computing Safety Intelligence Analytics...</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '6px' }}>
          Aggregating telemetry across 106,878 historical incident records...
        </p>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: 'var(--text-muted)' }}>Could not load safety intelligence analytics.</p>
      </div>
    );
  }

  const topCauses = insights.top_causes || [];
  const geoDist = insights.geographic_distribution || {};
  const topCountries = geoDist.top_countries || [];
  const topRegions = geoDist.top_regions_states || [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
              DATA TELEMETRY INTELLIGENCE
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              106,878 Indexed Reports Analyzed
            </span>
          </div>
          <h1 className="page-title">SAFETY INSIGHTS & ANALYTICS</h1>
          <p className="page-subtitle">
            Systemic macro-level intelligence aggregated from historical industrial safety telemetry.
          </p>
        </div>

        <button 
          className="btn btn-secondary"
          onClick={() => loadInsights(true)}
          style={{ fontSize: '0.8rem', padding: '8px 14px' }}
        >
          <RefreshCw size={14} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Core Charts */}
      <AnalyticsCharts insights={insights} />

      {/* Secondary Analytics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px' }}>
        
        {/* Top Incident Causes */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <AlertTriangle size={18} color="var(--risk-high)" />
            <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Top Incident Causes & Mechanisms</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topCauses.slice(0, 8).map((c, i) => (
              <div 
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.82rem',
                }}
              >
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {c.cause}
                </span>
                <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>
                  {c.count.toLocaleString()} cases
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Distribution Hotspots */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Globe size={18} color="#38bdf8" />
            <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Geographic Hotspots Distribution</h4>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            
            {/* Countries */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Top Countries
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topCountries.slice(0, 6).map((item, idx) => (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      padding: '6px 10px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span style={{ color: 'var(--text-primary)' }}>{item.country}</span>
                    <strong style={{ color: '#38bdf8' }}>{item.count.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Regions / States */}
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                Top Operating Regions
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topRegions.slice(0, 6).map((item, idx) => (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                      padding: '6px 10px',
                      background: 'rgba(15, 23, 42, 0.4)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <span style={{ color: 'var(--text-primary)' }}>{item.region}</span>
                    <strong style={{ color: '#a855f7' }}>{item.count.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
