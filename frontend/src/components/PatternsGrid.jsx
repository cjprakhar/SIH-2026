import React from 'react';
import { 
  Layers, 
  ShieldCheck, 
  MapPin, 
  AlertTriangle, 
  Activity,
  ArrowRight,
  TrendingUp,
  Cpu
} from 'lucide-react';

export default function PatternsGrid({ patterns = [], onSelectPattern }) {
  if (!patterns || patterns.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '36px' }}>
        <Layers size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
        <h4 style={{ color: 'var(--text-secondary)' }}>No Safety Patterns Loaded</h4>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
      {patterns.map((p) => {
        const strengthPct = Math.round((p.strength || p.average_strength || 0.75) * 100);
        const lsr = p.primary_life_saving_rule || (p.associated_life_saving_rules && p.associated_life_saving_rules[0]) || 'Operational Control';
        const occurrences = p.occurrences || (p.report_ids && p.report_ids.length) || 0;
        const locations = p.common_locations || [];
        const activities = p.associated_activities || [];
        const barriers = p.common_failed_barriers || [];

        return (
          <div
            key={p.pattern_id || p.title}
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              borderLeft: '4px solid #a855f7',
            }}
            onClick={() => onSelectPattern && onSelectPattern(p)}
          >
            <div>
              {/* Header Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                  <Layers size={12} /> {occurrences} Incidents Detected
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a855f7' }}>
                    {strengthPct}% Strength
                  </span>
                </div>
              </div>

              {/* Title */}
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '8px', lineHeight: 1.3 }}>
                {p.title || p.pattern}
              </h4>

              {/* Strength Progress Bar */}
              <div 
                style={{
                  width: '100%',
                  height: '5px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-full)',
                  margin: '10px 0 14px',
                  overflow: 'hidden',
                }}
              >
                <div 
                  style={{
                    width: `${strengthPct}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #a855f7 0%, #38bdf8 100%)',
                    borderRadius: 'var(--radius-full)',
                  }}
                />
              </div>

              {/* Life-Saving Rule */}
              <div style={{ marginBottom: '12px', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Life-Saving Rule: </span>
                <strong style={{ color: '#eab308' }}>{lsr}</strong>
              </div>

              {/* Common Dimensions Tags */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {locations.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={13} color="#38bdf8" />
                    <span>{locations.slice(0, 3).join(', ')}</span>
                  </div>
                )}
                {activities.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <Activity size={13} color="#a855f7" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activities[0]}
                    </span>
                  </div>
                )}
                {barriers.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <AlertTriangle size={13} color="var(--risk-high)" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-muted)' }}>
                      Failed Barrier: {barriers[0]}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Drilldown */}
            <div 
              style={{
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
                color: '#38bdf8',
                fontWeight: 600,
              }}
            >
              <span>View Pattern Intelligence</span>
              <ArrowRight size={14} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
