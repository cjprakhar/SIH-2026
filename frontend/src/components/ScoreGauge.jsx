import React from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Info, Zap } from 'lucide-react';

export default function ScoreGauge({ 
  score = 0, 
  priority = 'Low', 
  riskFactors = {},
  showBreakdown = true,
  size = 'large'
}) {
  const clampedScore = Math.max(0, Math.min(100, score));

  // Determine colors based on priority
  let color = 'var(--risk-low)';
  let bg = 'var(--risk-low-bg)';
  let border = 'var(--risk-low-border)';
  if (clampedScore >= 80 || priority === 'Critical') {
    color = 'var(--risk-critical)';
    bg = 'var(--risk-critical-bg)';
    border = 'var(--risk-critical-border)';
  } else if (clampedScore >= 60 || priority === 'High') {
    color = 'var(--risk-high)';
    bg = 'var(--risk-high-bg)';
    border = 'var(--risk-high-border)';
  } else if (clampedScore >= 35 || priority === 'Medium') {
    color = 'var(--risk-medium)';
    bg = 'var(--risk-medium-bg)';
    border = 'var(--risk-medium-border)';
  }

  // Precursor weight definitions matching risk_engine.py
  const factorDefs = [
    { key: 'critical_control_failure', label: 'Critical Control Failure / Missing Barrier', weight: 25 },
    { key: 'direct_human_exposure', label: 'Direct Human Exposure to Line of Fire', weight: 20 },
    { key: 'high_energy_hazard', label: 'High Energy Hazard Present (Voltage/Height/Pressure)', weight: 20 },
    { key: 'serious_or_fatal_consequence', label: 'Potential / Realized Serious or Fatal Outcome', weight: 15 },
    { key: 'life_saving_rule_violation', label: 'Life-Saving Rule Non-Conformance / Violation', weight: 10 },
    { key: 'recurring_pattern', label: 'Historical Recurrence of Similar Precursor', weight: 10 },
  ];

  const circumference = 2 * Math.PI * 42; // radius 42
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div 
      style={{
        background: 'rgba(15, 23, 42, 0.85)',
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        boxShadow: clampedScore >= 80 ? '0 0 24px -4px rgba(239, 68, 68, 0.25)' : 'var(--shadow-md)',
      }}
    >
      {/* Gauge Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
              SAFETY PRIORITY SCORE
            </span>
            <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
              Deterministic Engine
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Calibrated operational triage priority (0–100)
          </div>
        </div>

        <span className={`badge badge-${priority.toLowerCase()}`} style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
          {priority} Priority
        </span>
      </div>

      {/* Main Score Visual */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', margin: '14px 0' }}>
        {/* Circular Radial Gauge */}
        <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
          <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background Track */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="8"
            />
            {/* Active Progress Circle */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="transparent"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
            />
          </svg>
          <div 
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '1.65rem', fontWeight: 800, color, lineHeight: 1 }}>
              {clampedScore}
            </span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              / 100
            </span>
          </div>
        </div>

        {/* Priority Tier Description */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {priority === 'Critical' && 'Tier 1: Immediate Critical Stand-Down'}
            {priority === 'High' && 'Tier 2: High Operational Precursor'}
            {priority === 'Medium' && 'Tier 3: Moderate Precursor Triage'}
            {priority === 'Low' && 'Tier 4: Standard Observation'}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {priority === 'Critical' && 'High-energy exposure combined with control barrier failure requires immediate operational halt and verification.'}
            {priority === 'High' && 'Significant precursor risk detected. Re-verify Life-Saving Rules and control barriers before continuation.'}
            {priority === 'Medium' && 'Safety safeguards triggered. Review task risk assessment and brief operational crew.'}
            {priority === 'Low' && 'Standard procedural controls active with low energy exposure.'}
          </p>
        </div>
      </div>

      {/* Factor Breakdown Accordion / List */}
      {showBreakdown && (
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Deterministic Risk Factors Sum</span>
            <span style={{ color: '#38bdf8' }}>{clampedScore} Total Points</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
            {factorDefs.map((f) => {
              const active = Boolean(riskFactors[f.key]);
              return (
                <div 
                  key={f.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: active ? 'rgba(15, 23, 42, 0.75)' : 'rgba(15, 23, 42, 0.3)',
                    border: `1px solid ${active ? 'var(--border-medium)' : 'var(--border-subtle)'}`,
                    opacity: active ? 1 : 0.5,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span 
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: active ? '#10b981' : '#64748b',
                        boxShadow: active ? '0 0 6px #10b981' : 'none',
                      }}
                    />
                    <span style={{ fontSize: '0.78rem', color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: active ? 600 : 400 }}>
                      {f.label}
                    </span>
                  </div>
                  <strong style={{ fontSize: '0.8rem', color: active ? '#38bdf8' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {active ? `+${f.weight}` : '0'}
                  </strong>
                </div>
              );
            })}
          </div>

          <div 
            style={{
              marginTop: '12px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Info size={12} color="#94a3b8" />
            <span>Score represents an operational triage Safety Priority Score and does <strong>NOT</strong> calculate probability of injury or fatality.</span>
          </div>
        </div>
      )}
    </div>
  );
}
