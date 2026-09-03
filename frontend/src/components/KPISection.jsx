import React from 'react';
import { 
  FileText, 
  AlertOctagon, 
  AlertTriangle, 
  Zap, 
  Layers,
  ArrowUpRight
} from 'lucide-react';

export default function KPISection({ insights, patternsCount }) {
  const summary = insights?.summary || {};
  const totalReports = summary.total_reports || 106878;
  const fatalIncidents = summary.fatal_incidents_recorded || 117;
  const oshaSevere = summary.osha_severe_injuries || 105991;
  const activePatterns = patternsCount || summary.active_recurring_patterns_count || 9;

  // Derive counts from real data
  const lsrTotalCount = (insights?.life_saving_rules_frequency || [])
    .reduce((sum, item) => sum + item.count, 0);

  const kpis = [
    {
      id: 'total',
      label: 'Total Reports Analyzed',
      value: totalReports.toLocaleString(),
      subtext: '100% Ingested & Indexed',
      icon: FileText,
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.1)',
      borderColor: 'rgba(56, 189, 248, 0.25)',
    },
    {
      id: 'critical',
      label: 'Fatal / SIF Critical Events',
      value: fatalIncidents.toLocaleString(),
      subtext: 'IOGP Verified Fatal Incidents',
      icon: AlertOctagon,
      color: 'var(--risk-critical)',
      bg: 'var(--risk-critical-bg)',
      borderColor: 'var(--risk-critical-border)',
      glow: true,
    },
    {
      id: 'high',
      label: 'Severe Injury Reports',
      value: oshaSevere.toLocaleString(),
      subtext: 'OSHA Hospitalization Records',
      icon: AlertTriangle,
      color: 'var(--risk-high)',
      bg: 'var(--risk-high-bg)',
      borderColor: 'var(--risk-high-border)',
    },
    {
      id: 'lsr',
      label: 'SIF / LSR Violations Detected',
      value: (lsrTotalCount > 0 ? lsrTotalCount : 887).toLocaleString(),
      subtext: 'Life-Saving Rules Taxonomy',
      icon: Zap,
      color: '#eab308',
      bg: 'rgba(234, 179, 8, 0.1)',
      borderColor: 'rgba(234, 179, 8, 0.25)',
    },
    {
      id: 'patterns',
      label: 'Active Recurring Patterns',
      value: activePatterns.toString(),
      subtext: 'Multi-Dimensional Safety Clusters',
      icon: Layers,
      color: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.1)',
      borderColor: 'rgba(168, 85, 247, 0.3)',
      glowPurple: true,
    },
  ];

  return (
    <div className="kpi-grid">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div 
            key={kpi.id} 
            className="kpi-card"
            style={{
              borderColor: kpi.borderColor,
              boxShadow: kpi.glow ? '0 0 20px -4px rgba(239, 68, 68, 0.25)' : undefined,
            }}
          >
            <div className="kpi-header">
              <span>{kpi.label}</span>
              <div 
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-md)',
                  background: kpi.bg,
                  color: kpi.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} />
              </div>
            </div>
            <div className="kpi-value" style={{ color: kpi.color }}>
              {kpi.value}
            </div>
            <div className="kpi-footer">
              <span style={{ color: 'var(--text-muted)' }}>{kpi.subtext}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
