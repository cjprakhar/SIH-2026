import React from 'react';
import { 
  AlertOctagon, 
  ExternalLink, 
  Calendar, 
  MapPin, 
  Tag, 
  ShieldAlert,
  ChevronRight
} from 'lucide-react';

export default function CriticalAttention({ reports = [], onSelectReport }) {
  if (!reports || reports.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <ShieldAlert size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
        <h4 style={{ color: 'var(--text-secondary)' }}>No Critical Safety Alerts Found</h4>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          All operational safety controls are currently within safe thresholds.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div 
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: 'var(--risk-critical)',
              boxShadow: '0 0 10px var(--risk-critical)',
            }}
          />
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
            CRITICAL SAFETY ATTENTION
          </h3>
          <span className="badge badge-critical" style={{ fontSize: '0.7rem' }}>
            Immediate Triage
          </span>
        </div>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Showing top {reports.length} prioritized incidents
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {reports.map((report) => {
          const isFatal = report.source_type === 'pdf_fatal';
          const primaryLSR = (report.life_saving_rules && report.life_saving_rules[0]) || 'General Process Safety';
          const primaryPrecursor = report.cause || report.activity || 'High Energy Hazard';
          const score = isFatal ? 95 : 85;
          const priority = 'Critical';

          return (
            <div
              key={report.report_id}
              onClick={() => onSelectReport(report)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 18px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid var(--risk-critical-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                e.currentTarget.style.borderColor = 'var(--risk-critical)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.7)';
                e.currentTarget.style.borderColor = 'var(--risk-critical-border)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {/* Left Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1 }}>
                {/* Score Circle */}
                <div 
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '52px',
                    height: '52px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--risk-critical-bg)',
                    border: '1px solid var(--risk-critical-border)',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--risk-critical)', lineHeight: 1 }}>
                    {score}
                  </span>
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--risk-critical)', textTransform: 'uppercase' }}>
                    Score
                  </span>
                </div>

                {/* Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8', fontSize: '0.9rem' }}>
                      {report.report_id}
                    </span>
                    <span className="badge badge-critical" style={{ fontSize: '0.65rem' }}>
                      {priority}
                    </span>
                    {report.source_type && (
                      <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                        {report.source_type.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
                    {primaryPrecursor}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {report.date && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} /> {report.date}
                      </span>
                    )}
                    {(report.country || report.region) && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MapPin size={13} /> {report.country || report.region}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#eab308' }}>
                      <Tag size={13} /> {primaryLSR}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right CTA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8' }}>Inspect</span>
                <ChevronRight size={18} color="#38bdf8" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
