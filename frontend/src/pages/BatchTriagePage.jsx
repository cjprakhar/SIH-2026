import React, { useState } from 'react';
import { 
  Files, 
  Sparkles, 
  Send, 
  RefreshCw, 
  ShieldAlert, 
  AlertTriangle, 
  Layers, 
  CheckCircle2, 
  Flame, 
  Zap, 
  HardHat, 
  ArrowRight, 
  FileText, 
  Plus, 
  Trash2, 
  Upload, 
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Activity,
  AlertOctagon,
  Eye,
  CheckCircle,
  FileCheck2,
  ShieldCheck,
  Cpu,
  Info,
  Compass,
  Repeat,
  HelpCircle,
  ListOrdered
} from 'lucide-react';
import api from '../services/api';
import ReportDetailModal from '../components/ReportDetailModal';

// REAL IOGP Benchmark Batch Cases (100% Real IOGP Incident Data)
const REAL_IOGP_DEMO_BATCH = [
  {
    filename: '2021sf-RU-&-CA-002 (10KV Switchgear)',
    source_type: 'real_iogp',
    provenance: 'Source: 2021sf.pdf | p. 16 | ID: 2021sf-RU-&-CA-002',
    text: 'During maintenance works, an Electrical Technician received a fatal electrical shock whilst performing a 10KV isolation on the switchgear. An isolation verification procedure was not executed, and mechanical linkage nut was missing. High voltage rubber gloves were unrated.'
  },
  {
    filename: '2021sf-NA-AM-OF-001 (Crane Rigging Casing)',
    source_type: 'real_iogp',
    provenance: 'Source: 2021sf.pdf | p. 13 | ID: 2021sf-NA-AM-OF-001',
    text: 'During preparation for an offshore jack-up drilling rig move, a deep well casing was being raised by crane across the deck. The assistant driller was caught between the stopper handle and a fixed post due to crane operator blind spot. The lifting activity lacked a specific PTW.'
  },
  {
    filename: '2020pfh-NA-AM-ON-080 (Fiberglass Flash Fire)',
    source_type: 'real_iogp',
    provenance: 'Source: 2020pfh.pdf | p. 156 | ID: 2020pfh-NA-AM-ON-080',
    text: 'While nearing mechanical completion on a Saltwater Disposal (SWD) project, a contractor fiberglass crew used an open flame torch to heat and dry the fiberglass line near the tank, igniting residual hydrocarbon vapors without a task-specific JSA or gas test.'
  },
  {
    filename: '2021sf-AF-OF-003 (Platform Scaffold Fall)',
    source_type: 'real_iogp',
    provenance: 'Source: 2021sf.pdf | p. 24 | ID: 2021sf-AF-OF-003',
    text: 'During piping inspection at elevation on an offshore platform, a rigger detached both harness lanyards while transitioning past a structural obstruction on the scaffold at 14m height. The worker lost balance and fell through an incomplete guardrail opening.'
  },
  {
    filename: '2020pfh-ME-ON-012 (H2S Sour Gas Release)',
    source_type: 'real_iogp',
    provenance: 'Source: 2020pfh.pdf | p. 45 | ID: 2020pfh-ME-ON-012',
    text: 'During scheduled valve overhaul on a production manifold, operators broke a flange without positive double block and bleed isolation. Trapped sour gas containing 500 ppm H2S escaped into the breathing zone before personal gas monitors alarmed.'
  }
];

// Mixed Operational 8-Report Batch (Real IOGP + Benchmark Scenarios)
const MIXED_8_REPORT_BATCH = [
  ...REAL_IOGP_DEMO_BATCH,
  {
    filename: 'Scenario: Electrical Distribution Panel LOTO',
    source_type: 'benchmark_demo',
    provenance: 'Benchmark Scenario (Demo Preset)',
    text: 'During maintenance on a 480V motor control center, an electrician began troubleshooting breaker wiring without applying physical lockout-tagout or testing for zero energy. An adjacent worker observed live terminals and invoked Stop Work Authority.'
  },
  {
    filename: 'Scenario: Confined Space Tank Entry',
    source_type: 'benchmark_demo',
    provenance: 'Benchmark Scenario (Demo Preset)',
    text: 'Two technicians entered a crude storage tank for sludge inspection without continuous oxygen monitoring or standby rescue personnel stationed at the manway. Oxygen level inside was measured at 17.8% after rescue.'
  },
  {
    filename: 'Scenario: Hot Work Welding Sparks',
    source_type: 'benchmark_demo',
    provenance: 'Benchmark Scenario (Demo Preset)',
    text: 'Welding on a pipe support adjacent to a crude separation vessel proceeded after gas test certificate had expired by 3 hours. Sparks fell onto residual oily condensate, igniting a localized fire.'
  }
];

export default function BatchTriagePage({ setActiveTab }) {
  // Input reports list
  const [reportsList, setReportsList] = useState(REAL_IOGP_DEMO_BATCH);
  const [rawPastedText, setRawPastedText] = useState('');
  const [inputMode, setInputMode] = useState('list'); // 'list' or 'paste'
  
  // Analysis state
  const [batchResult, setBatchResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  // Filter in priority queue
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Expanded technical details toggles for each report
  const [expandedTech, setExpandedTech] = useState({});

  function toggleTechExpand(reportId) {
    setExpandedTech(prev => ({
      ...prev,
      [reportId]: !prev[reportId]
    }));
  }

  // Load preset batch
  function handleLoadPreset(presetType) {
    if (presetType === '5_real_iogp') {
      setReportsList(REAL_IOGP_DEMO_BATCH);
    } else if (presetType === '8_mixed') {
      setReportsList(MIXED_8_REPORT_BATCH);
    }
    setBatchResult(null);
    setError(null);
  }

  // Add a blank report
  function handleAddReport() {
    setReportsList([
      ...reportsList,
      {
        filename: `Custom Report #${reportsList.length + 1}`,
        source_type: 'user_upload',
        provenance: 'Manual Input',
        text: ''
      }
    ]);
  }

  // Remove report
  function handleRemoveReport(index) {
    const updated = [...reportsList];
    updated.splice(index, 1);
    setReportsList(updated);
  }

  // Update report text
  function handleUpdateReportText(index, text) {
    const updated = [...reportsList];
    updated[index].text = text;
    setReportsList(updated);
  }

  // Update report filename
  function handleUpdateReportName(index, filename) {
    const updated = [...reportsList];
    updated[index].filename = filename;
    setReportsList(updated);
  }

  // Parse pasted reports separated by ---
  function handleParsePastedText() {
    if (!rawPastedText.trim()) return;
    const parts = rawPastedText.split(/\n\s*---\s*\n/).filter(p => p.trim());
    if (parts.length === 0) {
      parts.push(rawPastedText.trim());
    }
    const parsed = parts.map((chunk, idx) => ({
      filename: `Pasted Record #${idx + 1}`,
      source_type: 'user_upload',
      provenance: 'Pasted Text Stream',
      text: chunk.trim()
    }));
    setReportsList(parsed);
    setInputMode('list');
    setRawPastedText('');
  }

  // Handle multi-file upload
  function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    const readPromises = files.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            filename: file.name,
            source_type: 'user_upload',
            provenance: `File: ${file.name}`,
            text: event.target.result
          });
        };
        reader.onerror = () => {
          resolve(null);
        };
        reader.readAsText(file);
      });
    });

    Promise.all(readPromises).then((results) => {
      const valid = results.filter(r => r && r.text.trim());
      if (valid.length > 0) {
        setReportsList(valid);
        setBatchResult(null);
      }
    });
  }

  // Execute Batch Analysis
  async function handleRunBatch() {
    const validReports = reportsList.filter(r => r.text && r.text.trim());
    if (validReports.length === 0) {
      setError('Please provide at least one valid report narrative.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = validReports.map(r => ({
        text: r.text.trim(),
        filename: r.filename || 'report',
        source_type: r.source_type || 'user_upload'
      }));

      const response = await api.analyzeBatch(payload);
      setBatchResult(response);
    } catch (err) {
      console.error('Batch triage error:', err);
      setError(err.message || 'Failed to complete batch safety triage.');
    } finally {
      setLoading(false);
    }
  }

  const summary = batchResult?.summary;
  const rankedResults = batchResult?.ranked_results || [];
  const crossInsights = batchResult?.cross_report_insights;
  const actionPriorities = batchResult?.action_priorities || [];
  const batchFindings = summary?.batch_findings || [];

  const filteredRanked = rankedResults.filter(r => {
    if (priorityFilter === 'all') return true;
    return r.risk_priority?.toLowerCase() === priorityFilter.toLowerCase();
  });

  return (
    <div>
      {/* Header Banner */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
              SAFETY DECISION SUPPORT
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Operational Precursor Prioritization & Action Guidance
            </span>
          </div>
          <h1 className="page-title">WHERE SHOULD WE ACT FIRST?</h1>
          <p className="page-subtitle">
            Give us the safety reports. We’ll identify the warning signs, explain the risk, and show what to fix first.
          </p>
        </div>

        {/* Demo Preset Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => handleLoadPreset('5_real_iogp')}
            disabled={loading}
            style={{ fontSize: '0.78rem', padding: '8px 12px' }}
          >
            <ShieldCheck size={14} color="#10b981" />
            <span>Load 5 Real IOGP Reports</span>
          </button>

          <button 
            className="btn btn-secondary"
            onClick={() => handleLoadPreset('8_mixed')}
            disabled={loading}
            style={{ fontSize: '0.78rem', padding: '8px 12px' }}
          >
            <Layers size={14} color="#38bdf8" />
            <span>Load 8 Mixed Incident Batch</span>
          </button>
        </div>
      </div>

      {/* Input Batch Section */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Files size={18} color="#38bdf8" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>
              UPLOAD SAFETY REPORTS ({reportsList.length})
            </h3>
            <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>
              Max 20 Per Batch
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Multi-file upload */}
            <label className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '6px 12px', cursor: 'pointer', margin: 0 }}>
              <Upload size={14} />
              <span>UPLOAD REPORTS</span>
              <input 
                type="file" 
                multiple 
                accept=".txt,.csv" 
                onChange={handleFileUpload} 
                style={{ display: 'none' }} 
              />
            </label>

            {/* Toggle Paste mode */}
            <button 
              className="btn btn-secondary"
              onClick={() => setInputMode(inputMode === 'list' ? 'paste' : 'list')}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              <FileText size={14} />
              <span>{inputMode === 'list' ? 'Paste Multi-Text (---)' : 'Switch to Card View'}</span>
            </button>

            {/* Add Report Card */}
            {inputMode === 'list' && (
              <button 
                className="btn btn-secondary"
                onClick={handleAddReport}
                disabled={reportsList.length >= 20}
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              >
                <Plus size={14} />
                <span>Add Report</span>
              </button>
            )}

            {/* Clear all */}
            <button 
              className="btn btn-secondary"
              onClick={() => { setReportsList([]); setBatchResult(null); }}
              style={{ fontSize: '0.78rem', padding: '6px 10px', color: 'var(--text-muted)' }}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Paste Multi-Text Mode */}
        {inputMode === 'paste' ? (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Paste multiple safety reports below. Separate each incident narrative with three dashes (<code>---</code>) on a new line.
            </p>
            <textarea
              className="textarea-input"
              rows={8}
              placeholder="Paste Report 1 narrative...&#10;---&#10;Paste Report 2 narrative...&#10;---&#10;Paste Report 3 narrative..."
              value={rawPastedText}
              onChange={(e) => setRawPastedText(e.target.value)}
            />
            <button 
              className="btn btn-primary"
              onClick={handleParsePastedText}
              style={{ marginTop: '10px', fontSize: '0.82rem' }}
            >
              Parse Into {rawPastedText.split(/\n\s*---\s*\n/).filter(p => p.trim()).length || 1} Reports
            </button>
          </div>
        ) : (
          /* Card View Mode */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
            {reportsList.map((rep, idx) => (
              <div 
                key={idx}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(10, 14, 23, 0.65)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.8rem', color: '#38bdf8' }}>
                      #{idx + 1}
                    </span>
                    <input 
                      type="text"
                      className="input-text"
                      value={rep.filename}
                      onChange={(e) => handleUpdateReportName(idx, e.target.value)}
                      placeholder="Report identifier / title"
                      style={{ padding: '4px 8px', fontSize: '0.8rem', width: '280px' }}
                    />
                    <span 
                      className={`badge ${rep.source_type === 'real_iogp' ? 'badge-emerald' : 'badge-cyan'}`}
                      style={{ fontSize: '0.62rem' }}
                    >
                      {rep.source_type === 'real_iogp' ? 'REAL IOGP RECORD' : (rep.provenance || 'User Input')}
                    </span>
                  </div>

                  <button 
                    onClick={() => handleRemoveReport(idx)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                    title="Remove report"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <textarea
                  className="textarea-input"
                  rows={2}
                  value={rep.text}
                  onChange={(e) => handleUpdateReportText(idx, e.target.value)}
                  placeholder="Enter or edit safety report narrative..."
                  style={{ fontSize: '0.82rem', padding: '8px 10px' }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Action Button */}
        <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Total payload: <strong>{reportsList.filter(r => r.text.trim()).length}</strong> ready for pipeline analysis
          </div>

          <button 
            className="btn btn-primary"
            onClick={handleRunBatch}
            disabled={loading || reportsList.filter(r => r.text.trim()).length === 0}
            style={{ fontSize: '0.9rem', padding: '10px 24px' }}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="spin-animation" />
                <span>Running Safety Triage & Recurrence Analysis...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>ANALYZE & PRIORITIZE ALL ({reportsList.filter(r => r.text.trim()).length})</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--risk-critical-border)', borderRadius: 'var(--radius-sm)', color: '#ef4444', fontSize: '0.85rem' }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: '6px' }} />
            {error}
          </div>
        )}
      </div>

      {/* BATCH RESULTS SECTION */}
      {batchResult && (
        <div className="result-reveal">
          
          {/* 1. HUMAN-READABLE KPI SUMMARY CARDS */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Activity size={18} color="#38bdf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, textTransform: 'uppercase' }}>
                WHAT DID WE FIND?
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
              {/* Immediate Attention */}
              <div 
                className="card" 
                style={{ 
                  padding: '16px',
                  background: summary?.critical_count > 0 ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card)',
                  borderColor: summary?.critical_count > 0 ? 'var(--risk-critical-border)' : 'var(--border-subtle)',
                  boxShadow: summary?.critical_count > 0 ? '0 0 16px -2px rgba(239, 68, 68, 0.3)' : 'none'
                }}
              >
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--risk-critical)', fontWeight: 800 }}>
                  IMMEDIATE ATTENTION
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--risk-critical)', marginTop: '4px' }}>
                  {summary?.critical_count} {summary?.critical_count === 1 ? 'report' : 'reports'}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.35 }}>
                  Reports that need an immediate safety review.
                </div>
              </div>

              {/* High Risk */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#f97316', fontWeight: 800 }}>
                  HIGH RISK
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f97316', marginTop: '4px' }}>
                  {summary?.high_count} {summary?.high_count === 1 ? 'report' : 'reports'}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.35 }}>
                  Reports where safety controls should be checked before work continues.
                </div>
              </div>

              {/* SIF Precursor Signals */}
              <div className="card" style={{ padding: '16px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#38bdf8', fontWeight: 800 }}>
                  SIF PRECURSOR SIGNALS
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                  {summary?.sif_signal_count} detected
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.35 }}>
                  Warning signs that could lead to a serious incident.
                </div>
              </div>

              {/* Repeated Safety Problems */}
              <div 
                className="card" 
                style={{ 
                  padding: '16px',
                  background: summary?.recurring_pattern_count > 0 ? 'rgba(168, 85, 247, 0.12)' : 'var(--bg-card)',
                  borderColor: summary?.recurring_pattern_count > 0 ? 'rgba(168, 85, 247, 0.4)' : 'var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#a855f7', fontWeight: 800 }}>
                  REPEATED SAFETY PROBLEMS
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>
                  {summary?.recurring_pattern_count} {summary?.recurring_pattern_count === 1 ? 'pattern' : 'patterns'}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.35 }}>
                  The same safety weakness appears in more than one report.
                </div>
              </div>
            </div>
          </div>

          {/* 2. WHAT THE SYSTEM FOUND (TOP-LEVEL PLAIN-ENGLISH FINDINGS) */}
          <div 
            className="card" 
            style={{ 
              marginBottom: '28px',
              padding: '20px 24px',
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(10, 14, 23, 0.85) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Compass size={20} color="#38bdf8" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.02em', color: '#f8fafc' }}>
                THE BIGGEST PROBLEMS IN THIS BATCH
              </h3>
            </div>
            
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Plain-English summary of operational risks identified across all {summary?.analyzed_count} analyzed safety narratives:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {batchFindings.length > 0 ? (
                batchFindings.map((finding, idx) => (
                  <div 
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '10px 14px',
                      background: 'rgba(56, 189, 248, 0.05)',
                      border: '1px solid rgba(56, 189, 248, 0.15)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <span 
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        background: '#38bdf8',
                        color: '#080c14',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        flexShrink: 0,
                        marginTop: '1px'
                      }}
                    >
                      {idx + 1}
                    </span>
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.45, fontWeight: 500 }}>
                      {finding}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  All safety narratives processed with deterministic scoring and taxonomy validation.
                </div>
              )}
            </div>
          </div>

          {/* 3. WHERE SHOULD WE ACT FIRST? (PROMINENT ACTION DIRECTIVES) */}
          <div 
            className="card" 
            style={{ 
              marginBottom: '28px',
              padding: '20px 24px',
              background: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: 'var(--radius-lg)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <CheckCircle2 size={20} color="#10b981" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>
                WHAT SHOULD WE FIX FIRST?
              </h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Actionable operational directives derived directly from detected failed barriers and recurring patterns:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {actionPriorities.slice(0, 3).map((act, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '12px 16px',
                    background: idx === 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.65)',
                    border: `1px solid ${idx === 0 ? 'rgba(16, 185, 129, 0.45)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}
                >
                  <span 
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: idx === 0 ? '#10b981' : 'rgba(56, 189, 248, 0.2)',
                      color: idx === 0 ? '#ffffff' : '#38bdf8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      flexShrink: 0
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {act.action}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Basis: {act.basis.replace('_', ' ').toUpperCase()} • Observed across {act.frequency}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. REDESIGNED PRIORITY QUEUE (PLAIN-ENGLISH AS PRIMARY LAYER) */}
          <div style={{ marginBottom: '32px' }}>
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={20} color="#ef4444" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                    WHICH REPORTS NEED ATTENTION FIRST?
                  </h3>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Ranked by Safety Priority Score. This is an operational triage weight, not a probability of injury or fatality.
                </p>
              </div>

              {/* Priority Filter Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {['all', 'critical', 'high', 'medium', 'low'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setPriorityFilter(filter)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      cursor: 'pointer',
                      background: priorityFilter === filter ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                      borderColor: priorityFilter === filter ? '#38bdf8' : 'var(--border-subtle)',
                      color: priorityFilter === filter ? '#38bdf8' : 'var(--text-muted)'
                    }}
                  >
                    {filter === 'all' ? 'All Reports' : filter === 'critical' ? 'Immediate Attention' : filter === 'high' ? 'High Risk' : filter}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Human-Readable Report Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredRanked.map((rep) => {
                const isCrit = rep.risk_priority === 'Critical';
                const isHigh = rep.risk_priority === 'High';
                const score = rep.risk_score;
                const rf = rep.risk_factors || {};
                const isExpanded = Boolean(expandedTech[rep.report_id]);

                return (
                  <div 
                    key={rep.report_id}
                    className="card"
                    style={{
                      padding: '20px 24px',
                      borderLeft: `4px solid ${isCrit ? '#ef4444' : isHigh ? '#f97316' : '#eab308'}`,
                      background: isCrit ? 'linear-gradient(180deg, rgba(239, 68, 68, 0.05) 0%, var(--bg-card) 100%)' : 'var(--bg-card)'
                    }}
                  >
                    {/* Top Row: Rank, Priority Badge, Score & What This Means */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span 
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            background: rep.priority_rank === 1 ? '#ef4444' : rep.priority_rank <= 3 ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                            color: rep.priority_rank === 1 ? '#ffffff' : '#38bdf8',
                            border: rep.priority_rank === 1 ? 'none' : '1px solid var(--border-subtle)'
                          }}
                        >
                          #{rep.priority_rank}
                        </span>

                        <span className={`badge badge-${rep.risk_priority?.toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                          {isCrit ? 'IMMEDIATE ATTENTION' : isHigh ? 'HIGH RISK' : `${rep.risk_priority} PRIORITY`}
                        </span>

                        <span 
                          className={`badge ${rep._batch_source_type === 'real_iogp' ? 'badge-emerald' : 'badge-cyan'}`}
                          style={{ fontSize: '0.65rem' }}
                        >
                          {rep._batch_source_type === 'real_iogp' ? 'REAL IOGP RECORD' : rep._batch_source_type}
                        </span>

                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          ID: {rep.report_id}
                        </span>
                      </div>

                      {/* Score indicator with human explanation */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isCrit ? '#ef4444' : isHigh ? '#f97316' : '#eab308', lineHeight: 1 }}>
                            {score} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 100</span>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Safety Priority Score
                          </div>
                        </div>

                        <button 
                          className="btn btn-primary"
                          onClick={() => setSelectedReport(rep)}
                          style={{ fontSize: '0.78rem', padding: '7px 14px' }}
                        >
                          <Eye size={14} />
                          <span>SEE WHY</span>
                        </button>
                      </div>
                    </div>

                    {/* What This Means Note */}
                    <div 
                      style={{
                        padding: '8px 12px',
                        background: isCrit ? 'rgba(239, 68, 68, 0.08)' : 'rgba(15, 23, 42, 0.5)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        color: isCrit ? '#fca5a5' : 'var(--text-secondary)',
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Info size={14} color={isCrit ? '#ef4444' : '#38bdf8'} />
                      <span>
                        <strong>What this score means:</strong> {isCrit 
                          ? 'This report contains multiple severe precursor signals (barrier failure + direct energy exposure) and requires first priority review.'
                          : isHigh 
                          ? 'High precursor risk detected; safety controls and barriers must be verified prior to continuation.'
                          : 'Moderate precursor conditions observed with standard procedural controls.'}
                      </span>
                    </div>

                    {/* Primary Plain-English Information Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                      
                      {/* What Happened */}
                      <div style={{ padding: '12px 14px', background: 'rgba(10, 14, 23, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
                          What Happened
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                          {rep.plain_english_what_happened || rep.narrative || 'Incident telemetry recorded.'}
                        </div>
                      </div>

                      {/* Why is it Dangerous? */}
                      <div style={{ padding: '12px 14px', background: 'rgba(10, 14, 23, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#f97316', fontWeight: 700, marginBottom: '4px' }}>
                          Why Is It Dangerous?
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                          {rep.plain_english_why_dangerous || 'Hazard exposure with potential for barrier bypass.'}
                        </div>
                      </div>

                      {/* What Went Wrong / Failed Barrier */}
                      <div style={{ padding: '12px 14px', background: 'rgba(10, 14, 23, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#ef4444', fontWeight: 700, marginBottom: '4px' }}>
                          What Went Wrong / Failed Control
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
                          {rep.plain_english_what_went_wrong || ((rep.barriers && rep.barriers[0]) ? `Missing or unverified barrier: ${rep.barriers[0]}` : 'Safety control barrier unverified.')}
                        </div>
                      </div>

                    </div>

                    {/* Recommended First Action & Why Prioritized Callouts */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                      
                      {/* Recommended First Action */}
                      <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#10b981', fontWeight: 800, marginBottom: '3px' }}>
                          WHAT SHOULD WE DO?
                        </div>
                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.4 }}>
                          {rep.recommended_action || 'Halt work and verify control barriers before proceeding.'}
                        </div>
                      </div>

                      {/* Why This Was Prioritized */}
                      <div style={{ padding: '12px 16px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#38bdf8', fontWeight: 800, marginBottom: '3px' }}>
                          WHY THIS NEEDS ATTENTION FIRST
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          {rep.plain_english_why_prioritized || `Ranked as ${rep.risk_priority} priority based on active barrier failure criteria.`}
                        </div>
                      </div>

                    </div>

                    {/* Collapsible Technical Analysis Toggle */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                      <button
                        onClick={() => toggleTechExpand(rep.report_id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#38bdf8',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 0'
                        }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{isExpanded ? 'Hide how the system reached this result' : 'How did the system reach this result?'}</span>
                      </button>

                      {/* Expanded Technical Details Drawer */}
                      {isExpanded && (
                        <div style={{ marginTop: '12px', padding: '14px', background: 'rgba(10, 14, 23, 0.85)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                          
                          {/* Scoring Weights */}
                          <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            Deterministic Scoring Factors (+Points)
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px', marginBottom: '12px' }}>
                            <div style={{ fontSize: '0.78rem', color: rf.critical_control_failure ? '#ef4444' : 'var(--text-muted)' }}>
                              {rf.critical_control_failure ? '✓ +25 Critical Control Failure' : '— Critical Control Failure (0)'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: rf.direct_human_exposure ? '#f97316' : 'var(--text-muted)' }}>
                              {rf.direct_human_exposure ? '✓ +20 Direct Human Exposure' : '— Direct Human Exposure (0)'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: rf.high_energy_hazard ? '#eab308' : 'var(--text-muted)' }}>
                              {rf.high_energy_hazard ? '✓ +20 High Energy Hazard' : '— High Energy Hazard (0)'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: rf.serious_or_fatal_consequence ? '#ef4444' : 'var(--text-muted)' }}>
                              {rf.serious_or_fatal_consequence ? '✓ +15 Serious/Fatal Consequence' : '— Serious Consequence (0)'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: rf.life_saving_rule_violation ? '#38bdf8' : 'var(--text-muted)' }}>
                              {rf.life_saving_rule_violation ? '✓ +10 Life-Saving Rule Violation' : '— LSR Violation (0)'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: rf.recurring_pattern ? '#a855f7' : 'var(--text-muted)' }}>
                              {rf.recurring_pattern ? '✓ +10 Recurring Historical Pattern' : '— Recurring Pattern (0)'}
                            </div>
                          </div>

                          {/* Telemetry Tags */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                            {(rep.life_saving_rules || []).map((lsr, i) => (
                              <span key={i} className="badge badge-medium" style={{ fontSize: '0.68rem' }}>
                                LSR: {lsr}
                              </span>
                            ))}
                            {(rep.sif_precursors || []).map((prec, i) => (
                              <span key={i} className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>
                                Precursor: {prec}
                              </span>
                            ))}
                            <span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>
                              Engine: {rep.analysis_source === 'llm' ? 'AI Engine' : 'Rule-Assisted Analysis'}
                            </span>
                          </div>

                          {/* Evidence Quotes */}
                          {rep.evidence && rep.evidence.length > 0 && (
                            <div>
                              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
                                Grounded Evidence Excerpts
                              </div>
                              <ul style={{ paddingLeft: '18px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                {rep.evidence.slice(0, 3).map((ev, i) => (
                                  <li key={i} style={{ marginBottom: '2px' }}>"{ev}"</li>
                                ))}
                              </ul>
                            </div>
                          )}

                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

          {/* 5. REPEATED SAFETY PROBLEMS (PLAIN-ENGLISH CROSS-REPORT CLUSTERING) */}
          <div className="card" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Repeat size={18} color="#a855f7" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, textTransform: 'uppercase' }}>
                IS THE SAME PROBLEM HAPPENING AGAIN?
              </h3>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              When the same control weakness appears in multiple reports, it indicates a broader process, equipment, or supervision pattern across operations.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
              
              {/* Repeated Life-Saving Rules */}
              <div style={{ padding: '14px', background: 'rgba(10, 14, 23, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#eab308', fontWeight: 800, marginBottom: '8px' }}>
                  🔁 REPEATED SAFETY CONTROLS
                </div>
                {(crossInsights?.repeated_life_saving_rules || []).length > 0 ? (
                  crossInsights.repeated_life_saving_rules.map((item, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(234, 179, 8, 0.08)',
                        border: '1px solid rgba(234, 179, 8, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>{item.name}</strong>
                        <span style={{ fontSize: '0.78rem', color: '#eab308', fontWeight: 800 }}>
                          {item.count} of {item.out_of} reports ({item.percentage}%)
                        </span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Incomplete procedure or verification observed in multiple independent tasks.
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No single Life-Saving Rule repeated across 2+ reports.</div>
                )}
              </div>

              {/* Repeated Failed Barriers */}
              <div style={{ padding: '14px', background: 'rgba(10, 14, 23, 0.6)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: '#ef4444', fontWeight: 800, marginBottom: '8px' }}>
                  ⚠️ REPEATED CONTROL FAILURES
                </div>
                {(crossInsights?.repeated_barriers || []).length > 0 ? (
                  crossInsights.repeated_barriers.map((item, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.84rem', color: 'var(--text-primary)', fontWeight: 600 }}>{item.name}</span>
                        <span style={{ fontSize: '0.76rem', color: '#ef4444', fontWeight: 800 }}>
                          {item.count} reports
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Unique barrier breakdown in each incident.</div>
                )}
              </div>

            </div>
          </div>

        </div>
      )}

      {/* Report Drill-Down Modal (Reuse existing ReportDetailModal with reordered plain-English flow) */}
      {selectedReport && (
        <ReportDetailModal 
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onSelectSimilar={(simRep) => setSelectedReport(simRep)}
        />
      )}
    </div>
  );
}
