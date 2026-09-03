import React, { useEffect, useState } from 'react';
import { 
  Layers, 
  Search, 
  RefreshCw, 
  ShieldAlert, 
  MapPin, 
  Activity, 
  AlertTriangle, 
  FileText,
  X,
  ExternalLink,
  Tag
} from 'lucide-react';
import api from '../services/api';
import PatternsGrid from '../components/PatternsGrid';

export default function PatternsPage() {
  const [patterns, setPatterns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPattern, setSelectedPattern] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadPatterns() {
    setLoading(true);
    try {
      const data = await api.getGlobalPatterns(20);
      setPatterns(data.patterns || data || []);
    } catch (err) {
      console.error('Failed to load patterns:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPatterns();
  }, []);

  const filteredPatterns = patterns.filter((p) => {
    const q = searchQuery.toLowerCase();
    const title = (p.title || p.pattern || '').toLowerCase();
    const lsr = (p.primary_life_saving_rule || '').toLowerCase();
    const precursor = (p.primary_sif_precursor || '').toLowerCase();
    return title.includes(q) || lsr.includes(q) || precursor.includes(q);
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
              GLOBAL RECURRENCE ENGINE
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              106,878 Historical Incidents Clustered
            </span>
          </div>
          <h1 className="page-title">RECURRING SAFETY PATTERNS</h1>
          <p className="page-subtitle">
            Systemic safety failure modes discovered across historical reports without all-to-all quadratic comparison.
          </p>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '13px' }} />
          <input
            type="text"
            className="input-text"
            placeholder="Search patterns or rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '38px' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <RefreshCw size={32} color="#a855f7" className="spin-animation" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>Discovering global safety patterns...</p>
        </div>
      ) : (
        <PatternsGrid 
          patterns={filteredPatterns} 
          onSelectPattern={(p) => setSelectedPattern(p)} 
        />
      )}

      {/* Pattern Detail Modal */}
      {selectedPattern && (
        <div className="modal-overlay" onClick={() => setSelectedPattern(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'rgba(15, 23, 42, 0.95)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={22} color="#a855f7" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                  {selectedPattern.title || selectedPattern.pattern}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPattern(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Pattern Metrics Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Historical Occurrences</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>
                    {selectedPattern.occurrences || (selectedPattern.report_ids || []).length} Reports
                  </div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Recurrence Strength</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                    {Math.round((selectedPattern.strength || 0.75) * 100)}%
                  </div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Primary Life-Saving Rule</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#eab308', marginTop: '6px' }}>
                    {selectedPattern.primary_life_saving_rule || 'General Control'}
                  </div>
                </div>
              </div>

              {/* Multi-Dimensional Safety Details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                
                {/* Common Locations */}
                <div style={{ padding: '14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} color="#38bdf8" /> Common Locations / Regions
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {(selectedPattern.common_locations || []).join(', ') || 'Global Distribution'}
                  </div>
                </div>

                {/* Common Equipment */}
                <div style={{ padding: '14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Common Equipment Involved
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {(selectedPattern.common_equipment || []).join(', ') || 'Machinery & Process Components'}
                  </div>
                </div>

                {/* Common Failed Barriers */}
                <div style={{ padding: '14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} color="var(--risk-high)" /> Common Failed Barriers
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {(selectedPattern.common_failed_barriers || []).join('; ') || 'Inadequate isolation & barrier integrity'}
                  </div>
                </div>

                {/* Associated Activities */}
                <div style={{ padding: '14px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={14} color="#10b981" /> Associated Activities
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {(selectedPattern.associated_activities || []).join(', ') || 'Maintenance & Operations'}
                  </div>
                </div>

              </div>

              {/* Sample Associated Report IDs */}
              <div>
                <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Linked Historical Report IDs (FAISS Cluster)
                </h5>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(selectedPattern.report_ids || []).slice(0, 10).map((id) => (
                    <span 
                      key={id} 
                      style={{
                        padding: '4px 10px',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        color: '#38bdf8',
                      }}
                    >
                      {id}
                    </span>
                  ))}
                </div>
              </div>

            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(15, 23, 42, 0.95)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedPattern(null)}>
                Close Pattern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
