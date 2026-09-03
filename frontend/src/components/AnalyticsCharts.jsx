import React from 'react';
import { BarChart3, TrendingUp, PieChart, Shield, Activity } from 'lucide-react';

export default function AnalyticsCharts({ insights }) {
  if (!insights) {
    return (
      <div className="card" style={{ padding: '30px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading analytics charts...</p>
      </div>
    );
  }

  const reportsByYear = insights.reports_by_year || {};
  const lsrFreq = insights.life_saving_rules_frequency || [];
  const sourceBreakdown = insights.reports_by_source_type || {};
  const topActivities = insights.top_activities || [];

  // Filter valid years (2015-2026)
  const validYears = Object.entries(reportsByYear)
    .filter(([yr]) => parseInt(yr) >= 2015 && parseInt(yr) <= 2026)
    .sort(([a], [b]) => parseInt(a) - parseInt(b));

  const maxYearCount = Math.max(...validYears.map(([_, count]) => count), 1);
  const maxLsrCount = Math.max(...lsrFreq.map((item) => item.count), 1);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '20px', marginBottom: '28px' }}>
      
      {/* 1. Reports by Year Timeline */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="#38bdf8" />
            <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Reports by Year (2015 – 2026)</h4>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Historical Timeline</span>
        </div>

        {/* Bar Chart */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', height: '180px', paddingTop: '20px' }}>
          {validYears.map(([year, count]) => {
            const heightPct = Math.max(6, Math.round((count / maxYearCount) * 100));
            return (
              <div 
                key={year}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  height: '100%',
                  justifyContent: 'flex-end',
                }}
              >
                <div 
                  style={{
                    fontSize: '0.65rem',
                    color: '#94a3b8',
                    marginBottom: '4px',
                    fontWeight: 600,
                  }}
                >
                  {count > 1000 ? `${(count / 1000).toFixed(1)}k` : count}
                </div>
                <div 
                  style={{
                    width: '100%',
                    height: `${heightPct}%`,
                    background: 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)',
                    borderRadius: '4px 4px 0 0',
                    transition: 'all var(--transition-normal)',
                  }}
                  title={`${year}: ${count.toLocaleString()} reports`}
                />
                <div 
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    marginTop: '8px',
                    fontWeight: 600,
                  }}
                >
                  {year.slice(2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Life-Saving Rules Frequency */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="#eab308" />
            <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Life-Saving Rules Distribution</h4>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IOGP Precursors</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {lsrFreq.slice(0, 5).map((item) => {
            const barPct = Math.max(5, Math.round((item.count / maxLsrCount) * 100));
            return (
              <div key={item.rule}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.rule}</span>
                  <strong style={{ color: '#eab308' }}>{item.count} events</strong>
                </div>
                <div 
                  style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                  }}
                >
                  <div 
                    style={{
                      width: `${barPct}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #eab308 0%, #f97316 100%)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Source Breakdown */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={18} color="#a855f7" />
            <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Dataset Sources Distribution</h4>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>106,878 Records</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>OSHA Severe Injuries</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
              {(sourceBreakdown.csv_osha || 105991).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>99.2% of dataset</div>
          </div>

          <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IOGP Process Safety Events</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>
              {(sourceBreakdown.pdf_pse || 412).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Tier 1 & 2 PSE Reports</div>
          </div>

          <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>IOGP High Potential (HiPo)</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#eab308', marginTop: '4px' }}>
              {(sourceBreakdown.pdf_hipot || 358).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Near-Miss Precursors</div>
          </div>

          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid var(--risk-critical-border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--risk-critical)' }}>IOGP Fatal Incidents</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--risk-critical)', marginTop: '4px' }}>
              {(sourceBreakdown.pdf_fatal || 117).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--risk-critical)' }}>Deep Investigation PDFs</div>
          </div>
        </div>
      </div>

      {/* 4. Top Operational Activities */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="#10b981" />
            <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Top Incident Activities</h4>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Frequency</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {topActivities.slice(0, 5).map((act, i) => (
            <div 
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'rgba(15, 23, 42, 0.5)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
              }}
            >
              <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                {act.activity}
              </span>
              <span className="badge badge-emerald" style={{ fontSize: '0.65rem' }}>
                {act.count.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
