import React, { useState } from 'react';
import { 
  X, 
  ShieldAlert, 
  FileText, 
  Layers, 
  MapPin, 
  Calendar, 
  Tag, 
  AlertTriangle, 
  Cpu, 
  Users, 
  CheckCircle,
  ExternalLink,
  Zap,
  ShieldCheck,
  FileCheck,
  FileCheck2,
  Database
} from 'lucide-react';
import ScoreGauge from './ScoreGauge';
import EvidenceCard from './EvidenceCard';
import SimilarReportsCard from './SimilarReportsCard';

export default function ReportDetailModal({ report, onClose, onSelectSimilar }) {
  if (!report) return null;

  const [activeTab, setActiveTab] = useState('overview');

  const isFatal = report.source_type === 'pdf_fatal';
  const score = report.risk_score !== undefined ? report.risk_score : (isFatal ? 95 : 80);
  const priority = report.risk_priority || (score >= 80 ? 'Critical' : score >= 60 ? 'High' : 'Medium');

  const riskFactors = report.risk_factors || {
    critical_control_failure: true,
    direct_human_exposure: true,
    high_energy_hazard: true,
    serious_or_fatal_consequence: isFatal,
    life_saving_rule_violation: (report.life_saving_rules && report.life_saving_rules.length > 0),
    recurring_pattern: (report.recurring_patterns && report.recurring_patterns.length > 0) || isFatal,
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                background: priority === 'Critical' ? 'var(--risk-critical-bg)' : 'var(--risk-high-bg)',
                border: `1px solid ${priority === 'Critical' ? 'var(--risk-critical-border)' : 'var(--risk-high-border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldAlert size={20} color={priority === 'Critical' ? 'var(--risk-critical)' : 'var(--risk-high)'} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.1rem', color: '#38bdf8' }}>
                  {report.report_id}
                </span>
                <span className={`badge badge-${priority.toLowerCase()}`}>
                  {priority} Priority
                </span>
                {report.source_type && (
                  <span className={`badge ${report.source_type === 'pdf_fatal' || report.source_type?.startsWith('pdf_') ? 'badge-cyan' : 'badge-medium'}`}>
                    {report.source_type === 'pdf_fatal' ? 'REAL IOGP RECORD' 
                      : report.source_type === 'pdf_hipot' ? 'REAL IOGP HiPOT'
                      : report.source_type === 'pdf_pse' ? 'REAL IOGP PSE'
                      : report.source_type?.startsWith('pdf_') ? 'REAL IOGP'
                      : report.source_type?.startsWith('csv_') ? 'OSHA DATABASE'
                      : report.source_type.toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {report.date || report.year || 'Date Unspecified'} • {report.country || report.region || 'Location Unspecified'}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div 
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(10, 14, 23, 0.6)',
          }}
        >
          {[
            { id: 'overview', label: 'Plain-English Incident Overview' },
            { id: 'risk', label: 'Safety Priority Score & Factors' },
            { id: 'evidence', label: `Evidence Quotes (${(report.evidence || []).length})` },
            { id: 'recurrence', label: 'Recurrence & Similar Reports' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '7px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === tab.id ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: activeTab === tab.id ? '#38bdf8' : 'var(--text-secondary)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* 1. What Happened? */}
              <div 
                style={{
                  padding: '16px 20px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <h5 style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: '#38bdf8', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.04em' }}>
                  1. What Happened
                </h5>
                <div style={{ fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {report.plain_english_what_happened || report.narrative || report.what_went_wrong || 'No incident narrative recorded.'}
                </div>
              </div>

              {/* 2. Why is it Dangerous? & 3. What Went Wrong? Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                
                {/* Why is it Dangerous? */}
                <div style={{ padding: '14px 18px', background: 'rgba(249, 115, 22, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
                  <h5 style={{ fontSize: '0.76rem', textTransform: 'uppercase', color: '#f97316', marginBottom: '4px', fontWeight: 800 }}>
                    2. Why Is It Dangerous?
                  </h5>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {report.plain_english_why_dangerous || 'Hazard exposure with high energy and direct personnel line-of-fire risk.'}
                  </div>
                </div>

                {/* What Went Wrong / Failed Barrier */}
                <div style={{ padding: '14px 18px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <h5 style={{ fontSize: '0.76rem', textTransform: 'uppercase', color: '#ef4444', marginBottom: '4px', fontWeight: 800 }}>
                    3. What Went Wrong / Failed Control
                  </h5>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {report.plain_english_what_went_wrong || report.what_went_wrong || ((report.barriers && report.barriers[0]) ? `Missing or unverified barrier: ${report.barriers[0]}` : 'Safety barrier verification was skipped or failed.')}
                  </div>
                </div>

              </div>

              {/* 4. Recommended First Action & 5. Why Prioritized */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                
                {/* Recommended First Action */}
                <div style={{ padding: '14px 18px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
                  <h5 style={{ fontSize: '0.76rem', textTransform: 'uppercase', color: '#10b981', marginBottom: '4px', fontWeight: 800 }}>
                    4. Recommended First Action
                  </h5>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>
                    {report.recommended_action || 'Immediately halt the task, verify isolation barriers, and conduct pre-job safety brief.'}
                  </div>
                </div>

                {/* Why Prioritized */}
                <div style={{ padding: '14px 18px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  <h5 style={{ fontSize: '0.76rem', textTransform: 'uppercase', color: '#38bdf8', marginBottom: '4px', fontWeight: 800 }}>
                    5. Why Prioritized
                  </h5>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {report.plain_english_why_prioritized || `Ranked as ${priority} Priority (${score}/100) based on deterministic precursor control failure criteria.`}
                  </div>
                </div>

              </div>

              {/* 6. Structured Operational Telemetry Grid */}
              <div>
                <h5 style={{ fontSize: '0.76rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 700 }}>
                  Operational Telemetry & Classification
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  <div style={{ padding: '10px 12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Life-Saving Rules</span>
                    <div style={{ marginTop: '3px', fontWeight: 700, color: '#eab308', fontSize: '0.85rem' }}>
                      {(report.life_saving_rules || []).join(', ') || 'General Operational Safety'}
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Activity</span>
                    <div style={{ marginTop: '3px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {report.activity || 'General Operations'}
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Equipment Involved</span>
                    <div style={{ marginTop: '3px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                      {(report.equipment || []).join(', ') || 'Unspecified'}
                    </div>
                  </div>

                  <div style={{ padding: '10px 12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Location / Site</span>
                    <div style={{ marginTop: '3px', fontWeight: 600, color: '#38bdf8', fontSize: '0.85rem' }}>
                      {report.location || report.country || report.region || 'Operational Facility'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 7. Dataset Provenance Block */}
              <div
                style={{
                  padding: '12px 16px',
                  background: report.source_type?.startsWith('pdf_') ? 'rgba(16, 185, 129, 0.06)' : 'rgba(56, 189, 248, 0.06)',
                  border: `1px solid ${report.source_type?.startsWith('pdf_') ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.2)'}`,
                  borderRadius: 'var(--radius-md)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '10px',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Data Source</div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: report.source_type?.startsWith('pdf_') ? '#10b981' : '#38bdf8', marginTop: '2px' }}>
                    {report.source_type === 'pdf_fatal' ? 'IOGP (Fatal)'
                      : report.source_type === 'pdf_hipot' ? 'IOGP (HiPOT)'
                      : report.source_type === 'pdf_pse' ? 'IOGP (Process Safety)'
                      : report.source_type?.startsWith('pdf_') ? 'IOGP Database'
                      : report.source_type?.startsWith('csv_') ? 'OSHA Database'
                      : report.source_type || 'User Submission'}
                  </div>
                </div>
                {report.source_file && (
                  <div>
                    <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Publication Document</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px' }}>{report.source_file}</div>
                  </div>
                )}
                {report.source_page && (
                  <div>
                    <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Source Page</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>p. {report.source_page}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>Report ID</div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>{report.report_id}</div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: RISK BREAKDOWN */}
          {activeTab === 'risk' && (
            <div>
              <ScoreGauge 
                score={score}
                priority={priority}
                riskFactors={riskFactors}
                showBreakdown={true}
              />
            </div>
          )}

          {/* TAB 3: EVIDENCE */}
          {activeTab === 'evidence' && (
            <div>
              <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                Attributed Grounded Evidence Quotes
              </h5>
              <EvidenceCard evidenceList={report.evidence || []} />
            </div>
          )}

          {/* TAB 4: RECURRENCE & SIMILAR */}
          {activeTab === 'recurrence' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Recurrence Banner */}
              {report.recurring_patterns && report.recurring_patterns.length > 0 ? (
                <div 
                  className="pulse-recurring"
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(168, 85, 247, 0.12)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid rgba(168, 85, 247, 0.35)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Layers size={18} color="#a855f7" />
                    <strong style={{ fontSize: '0.9rem', color: '#a855f7', textTransform: 'uppercase' }}>
                      Recurring Safety Pattern Detected
                    </strong>
                  </div>
                  <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {report.recurring_patterns.map((p, idx) => (
                      <li key={idx} style={{ marginTop: '4px' }}>{p}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div style={{ padding: '14px 18px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  No standalone recurring pattern active for this report.
                </div>
              )}

              {/* Similar Reports */}
              <div>
                <h5 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Similar Historical Reports (FAISS Vector Similarity)
                </h5>
                <SimilarReportsCard 
                  similarReports={report.similar_reports || []} 
                  onSelectReport={onSelectSimilar}
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div 
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button className="btn btn-secondary" onClick={onClose}>
            Close Report
          </button>
        </div>

      </div>
    </div>
  );
}
