import React, { useState, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  RefreshCw, 
  ShieldAlert, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  FileText, 
  Database, 
  Tag, 
  ShieldCheck, 
  Zap, 
  Info, 
  FileCheck2, 
  Bookmark, 
  UploadCloud, 
  X, 
  HardHat, 
  CheckCircle, 
  ArrowRight,
  Target
} from 'lucide-react';
import api from '../services/api';
import ScoreGauge from '../components/ScoreGauge';
import EvidenceCard from '../components/EvidenceCard';
import SimilarReportsCard from '../components/SimilarReportsCard';
import ReportDetailModal from '../components/ReportDetailModal';

// REAL IOGP Incident Cases (Grounded in reports.json)
const REAL_IOGP_CASES = [
  {
    id: 'iogp-10kv-isolation',
    title: '⚡ 10KV Switchgear Isolation',
    type: 'REAL IOGP RECORD',
    provenance: 'Source: 2021sf.pdf | Page: 16 | ID: 2021sf-RU-&-CA-002',
    text: 'During maintenance works, an Electrical Technician received a fatal electrical shock whilst performing a 10KV isolation on the switchgear. An isolation verification procedure was not executed, and mechanical linkage nut was missing. High voltage rubber gloves were unrated.',
  },
  {
    id: 'iogp-casing-crane',
    title: '🏗️ Rig Casing Crane Lift',
    type: 'REAL IOGP RECORD',
    provenance: 'Source: 2021sf.pdf | Page: 13 | ID: 2021sf-NA-AM-OF-001',
    text: 'During the preparation for an offshore jack-up drilling rig move, a deep well casing was being raised by crane across the deck. The assistant driller was caught between the stopper handle and a fixed post due to crane operator blind spot. The lifting activity lacked a specific PTW.',
  },
  {
    id: 'iogp-swd-torch',
    title: '🔥 Fiberglass Torch Flash Fire',
    type: 'REAL IOGP RECORD',
    provenance: 'Source: 2020pfh.pdf | Page: 156 | ID: 2020pfh-NA-AM-ON-080',
    text: 'While nearing mechanical completion on a Saltwater Disposal (SWD) project, a contractor fiberglass crew used an open flame torch to heat and dry the fiberglass line near the tank, igniting residual hydrocarbon vapors without a task-specific JSA or gas test.',
  },
];

// Benchmark Scenarios (Representative Demonstrations)
const BENCHMARK_TEMPLATES = [
  {
    id: 'bench-energy-isolation',
    title: '⚡ Energy Isolation Failure',
    type: 'BENCHMARK SCENARIO (DEMO PRESET)',
    text: 'On 15 August 2026, during scheduled maintenance on a 480V electrical distribution panel at the process plant, a technician opened the panel cover to replace a circuit breaker without performing lockout-tagout. The panel remained energized while work proceeded with bare hands. An operator intervened with stop-work authority.',
  },
  {
    id: 'bench-height-scaffold',
    title: '🪜 Working at Height / Fall',
    type: 'BENCHMARK SCENARIO (DEMO PRESET)',
    text: 'During maintenance inspection at elevation on Platform B, a contractor stepped onto an unanchored scaffold plank 12 meters above ground level without attaching their safety harness lanyard to the static lifeline. The plank shifted, causing a near-miss fall. Work was immediately suspended.',
  },
  {
    id: 'bench-crane-rigging',
    title: '🪝 Crane Rigging / Dropped Load',
    type: 'BENCHMARK SCENARIO (DEMO PRESET)',
    text: 'During a crane lift of a 2.5-ton steel structural beam across the deck, one of the synthetic lifting slings severed due to contact with an unprotected sharp edge. The beam dropped 5 meters into the designated exclusion zone while personnel were standing nearby.',
  },
  {
    id: 'bench-hot-work-fire',
    title: '🔥 Hot Work / Flash Fire',
    type: 'BENCHMARK SCENARIO (DEMO PRESET)',
    text: 'A welding crew began torch cutting on a redundant drain pipe near the condensate separator unit without conducting a combustible gas test. Residual hydrocarbon vapors in the line ignited, producing a flash fire and triggering the unit deluge system.',
  },
  {
    id: 'bench-toxic-chemical',
    title: '☣️ Toxic Gas Release',
    type: 'BENCHMARK SCENARIO (DEMO PRESET)',
    text: 'While unbolting a flange on the hydrogen sulfide (H2S) stripper column piping, operators experienced an unexpected release of toxic sour gas due to an unisolated bypass valve. Fixed gas detectors alarmed at 25 ppm and personnel evacuated using emergency escape sets.',
  },
];

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileTypeDescription(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'txt': return 'Text Document (.txt)';
    case 'csv': return 'CSV Data Report (.csv)';
    case 'log': return 'System Log File (.log)';
    case 'md': return 'Markdown Report (.md)';
    default: return 'Safety Report (' + ext.toUpperCase() + ')';
  }
}

export default function AnalyzePage() {
  const [reportText, setReportText] = useState(REAL_IOGP_CASES[0].text);
  const [selectedCaseId, setSelectedCaseId] = useState(REAL_IOGP_CASES[0].id);
  const [selectedProvenance, setSelectedProvenance] = useState(REAL_IOGP_CASES[0].provenance);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileReadStatus, setFileReadStatus] = useState('idle'); // 'idle' | 'reading' | 'success' | 'error'
  const [fileError, setFileError] = useState(null);

  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSimilar, setSelectedSimilar] = useState(null);

  const fileInputRef = useRef(null);

  // File Upload Handlers
  function processSelectedFile(file) {
    if (!file) return;

    setFileError(null);
    setFileReadStatus('reading');

    const validExtensions = ['txt', 'csv', 'log', 'md', 'text'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(ext)) {
      setFileReadStatus('error');
      setFileError('Unable to read this file format. Please upload a supported text report format (TXT, CSV, LOG, MD).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      if (text && text.trim()) {
        setReportText(text);
        setUploadedFile({
          name: file.name,
          size: formatFileSize(file.size),
          type: getFileTypeDescription(file.name)
        });
        setFileReadStatus('success');
        setSelectedCaseId(null);
        setSelectedProvenance(`Uploaded File: ${file.name}`);
      } else {
        setFileReadStatus('error');
        setFileError('The selected file appears to be empty.');
      }
    };

    reader.onerror = () => {
      setFileReadStatus('error');
      setFileError('Unable to read this file. Please try another supported format.');
    };

    reader.readAsText(file);
  }

  function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      processSelectedFile(file);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) {
      processSelectedFile(file);
    }
  }

  function handleRemoveFile() {
    setUploadedFile(null);
    setFileReadStatus('idle');
    setFileError(null);
    setReportText('');
    setSelectedCaseId(null);
    setSelectedProvenance(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleAnalyze(customText) {
    const textToAnalyze = customText || reportText;
    if (!textToAnalyze || !textToAnalyze.trim()) {
      setError('Please provide report narrative text to analyze.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.analyzeReport(textToAnalyze.trim());
      setAnalysisResult(result);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err.message || 'Failed to analyze safety report.');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectCase(item) {
    setUploadedFile(null);
    setFileReadStatus('idle');
    setFileError(null);
    setSelectedCaseId(item.id);
    setSelectedProvenance(item.provenance || item.type || null);
    setReportText(item.text);
  }

  const hasRecurringPattern = analysisResult && (
    (analysisResult.recurring_patterns && analysisResult.recurring_patterns.length > 0) ||
    Boolean(analysisResult.risk_factors?.recurring_pattern)
  );

  const isRealLLM = analysisResult?.analysis_source === 'llm';

  return (
    <div>
      {/* 1. Header Banner */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-cyan" style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
            ANALYZE SINGLE
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Operations Intelligence Pipeline
          </span>
        </div>
        <h1 className="section-question" style={{ fontSize: '1.75rem', marginBottom: '4px' }}>
          Want to check one report?
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Upload or paste a safety report and we'll identify the warning signs, failed controls and priority for action.
        </p>
      </div>

      {/* Main Dual-Pane Layout */}
      <div className="analyze-dual-pane" style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 1.05fr) minmax(500px, 1.35fr)', gap: '24px', alignItems: 'start' }}>
        
        {/* ========================================================
            LEFT COLUMN: UPLOAD, PASTE & DEMO PRESETS INPUT
            ======================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* CARD 1: UPLOAD A SAFETY REPORT */}
          <div className="card">
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <UploadCloud size={18} color="var(--brand-blue)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  UPLOAD A SAFETY REPORT
                </h3>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Upload a safety incident, unsafe-act, unsafe-condition or near-miss report.
              </p>
            </div>

            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".txt,.csv,.log,.md,.text" 
              onChange={handleFileChange} 
            />

            {/* Drag & Drop Zone */}
            {!uploadedFile ? (
              <div 
                className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {fileReadStatus === 'reading' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '10px' }}>
                    <RefreshCw size={28} color="var(--brand-blue)" className="spin-animation" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Reading report...
                    </span>
                  </div>
                ) : (
                  <div>
                    <div style={{ 
                      width: '44px', 
                      height: '44px', 
                      borderRadius: 'var(--radius-md)', 
                      background: 'var(--risk-low-bg)', 
                      color: 'var(--brand-blue)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      margin: '0 auto 12px' 
                    }}>
                      <UploadCloud size={24} />
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {isDragging ? 'Drop your report here' : 'Drag & drop your file here'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
                      or browse from your device
                    </div>
                    <button 
                      type="button"
                      className="btn btn-secondary"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                      style={{ fontSize: '0.8rem', padding: '7px 18px' }}
                    >
                      <span>Choose File</span>
                    </button>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '14px', letterSpacing: '0.04em' }}>
                      TXT • CSV • LOG • MD
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Compact File Card When File Is Selected */
              <div className="uploaded-file-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: 'var(--radius-sm)', 
                    background: 'var(--risk-low-bg)', 
                    color: 'var(--brand-emerald)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <CheckCircle size={20} color="var(--brand-emerald)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{uploadedFile.name}</span>
                      <span className="badge badge-emerald" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>
                        Ready for analysis
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {uploadedFile.size} • {uploadedFile.type}
                    </div>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={handleRemoveFile}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--risk-critical)' }}
                  title="Remove uploaded file"
                >
                  <X size={14} />
                  <span>Remove</span>
                </button>
              </div>
            )}

            {fileError && (
              <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--risk-critical-bg)', border: '1px solid var(--risk-critical-border)', borderRadius: 'var(--radius-sm)', color: 'var(--risk-critical)', fontSize: '0.78rem' }}>
                {fileError}
              </div>
            )}
          </div>

          {/* DIVIDER: OR PASTE REPORT TEXT */}
          <div className="section-divider">
            OR PASTE REPORT TEXT
          </div>

          {/* CARD 2: PASTE THE REPORT */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-primary)' }}>
                  PASTE THE REPORT
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Already have the report text? Paste it here instead.
                </p>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                {reportText.length} chars
              </span>
            </div>

            {selectedProvenance && (
              <div 
                style={{
                  padding: '6px 10px',
                  background: 'var(--risk-low-bg)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  color: 'var(--brand-blue)',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'monospace',
                }}
              >
                <FileCheck2 size={13} color="var(--brand-blue)" />
                <span>{selectedProvenance}</span>
              </div>
            )}

            <textarea
              className="textarea-input"
              value={reportText}
              onChange={(e) => {
                setReportText(e.target.value);
                setSelectedCaseId(null);
                setSelectedProvenance(null);
              }}
              placeholder="Paste safety incident narrative, near-miss observations, or contractor safety report here..."
              style={{ minHeight: '180px', marginBottom: '14px' }}
            />

            {error && (
              <div 
                style={{
                  padding: '10px 14px',
                  background: 'var(--risk-critical-bg)',
                  border: '1px solid var(--risk-critical-border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--risk-critical)',
                  fontSize: '0.82rem',
                  marginBottom: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* ACTION BAR */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => handleAnalyze()}
                disabled={loading || !reportText.trim()}
                style={{ flex: 1, padding: '12px' }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="spin-animation" />
                    <span>Analyzing report...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>ANALYZE THIS REPORT</span>
                  </>
                )}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setReportText('');
                  setUploadedFile(null);
                  setFileReadStatus('idle');
                  setSelectedCaseId(null);
                  setSelectedProvenance(null);
                  setAnalysisResult(null);
                }}
                disabled={loading || !reportText}
                style={{ padding: '12px 16px' }}
                title="Clear text"
              >
                Clear
              </button>
            </div>
          </div>

          {/* DIVIDER: OR TRY A DEMO */}
          <div className="section-divider">
            OR TRY A DEMO
          </div>

          {/* CARD 3: DEMO PRESETS */}
          <div className="card">
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <Bookmark size={16} color="var(--brand-purple)" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
                  TRY A DEMO
                </h3>
              </div>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                Test with real IOGP incident records or benchmark scenarios.
              </p>
            </div>

            {/* Subsection A: Real IOGP Cases */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand-emerald)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCheck2 size={13} color="var(--brand-emerald)" /> Real IOGP Historical Records
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {REAL_IOGP_CASES.map((item) => {
                  const isSelected = selectedCaseId === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectCase(item)}
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        borderColor: isSelected ? 'var(--brand-emerald)' : undefined,
                        background: isSelected ? 'var(--risk-low-bg)' : undefined,
                        color: isSelected ? 'var(--brand-emerald)' : undefined,
                      }}
                    >
                      {item.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subsection B: Benchmark Templates */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                Benchmark Scenarios (Demo Presets)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {BENCHMARK_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedCaseId === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => handleSelectCase(tmpl)}
                      className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        borderColor: isSelected ? 'var(--brand-blue)' : undefined,
                      }}
                    >
                      {tmpl.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* ========================================================
            RIGHT COLUMN: SAFETY INTELLIGENCE RESULTS
            ======================================================== */}
        <div>
          {!analysisResult && !loading && (
            <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Sparkles size={40} color="var(--brand-blue)" style={{ margin: '0 auto 16px', opacity: 0.8 }} />
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1.15rem' }}>
                Ready for Safety Intelligence Analysis
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                Upload a report, paste incident text, or select an example above to trigger AI extraction, historical similarity matching, and recurrence scoring.
              </p>
              <button 
                className="btn btn-primary"
                onClick={() => handleAnalyze()}
                disabled={!reportText.trim()}
                style={{ fontSize: '0.85rem', padding: '10px 20px' }}
              >
                <span>ANALYZE THIS REPORT</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {loading && (
            <div className="card" style={{ textAlign: 'center', padding: '70px 20px' }}>
              <RefreshCw size={36} color="var(--brand-blue)" className="spin-animation" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ color: 'var(--text-primary)', fontSize: '1.15rem', marginBottom: '8px' }}>
                AI Analysis Running
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', maxWidth: '420px', margin: '0 auto', lineHeight: 1.5 }}>
                Extracting safety factors, matching historical incidents, and evaluating multi-dimensional recurrence...
              </p>
            </div>
          )}

          {analysisResult && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Telemetry Status Banner */}
              <div 
                style={{
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: isRealLLM ? 'var(--risk-low-bg)' : 'var(--risk-high-bg)',
                  border: `1px solid ${isRealLLM ? 'var(--border-subtle)' : 'var(--risk-high-border)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={16} color={isRealLLM ? 'var(--brand-blue)' : 'var(--risk-high)'} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isRealLLM ? 'var(--brand-blue)' : 'var(--risk-high)' }}>
                    {isRealLLM ? 'AI Analysis Complete' : 'Rule-Assisted Analysis'}
                  </span>
                </div>
                <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                  ID: {analysisResult.report_id || 'ANALYSIS-RESULT'}
                </span>
              </div>

              {/* 1. SAFETY PRIORITY SCORE GAUGE */}
              <ScoreGauge 
                score={analysisResult.risk_score}
                priority={analysisResult.risk_priority}
                riskFactors={analysisResult.risk_factors}
                showBreakdown={true}
              />

              {/* 2. QUESTION: WHAT DID WE FIND? */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={18} color="var(--brand-blue)" />
                    <h3 className="section-question" style={{ fontSize: '1.05rem' }}>
                      WHAT DID WE FIND?
                    </h3>
                  </div>
                  <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                    Safety Signals
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {/* Primary Life-Saving Rule */}
                  <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', fontWeight: 700 }}>
                      <Tag size={12} color="var(--risk-medium)" /> Life-Saving Rule
                    </div>
                    <div style={{ marginTop: '6px', fontWeight: 700, color: 'var(--risk-medium)', fontSize: '0.92rem' }}>
                      {(analysisResult.life_saving_rules || []).join(', ') || 'General Safety'}
                    </div>
                  </div>

                  {/* SIF Precursor Indicators */}
                  <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', fontWeight: 700 }}>
                      <Zap size={12} color="var(--risk-high)" /> SIF Precursor Signal
                    </div>
                    <div style={{ marginTop: '6px', fontWeight: 700, color: 'var(--risk-high)', fontSize: '0.92rem' }}>
                      {(analysisResult.sif_precursors || []).join(', ') || 'High Energy Exposure'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. QUESTION: WHY IS THIS DANGEROUS? */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <ShieldAlert size={18} color="var(--risk-critical)" />
                  <h3 className="section-question" style={{ fontSize: '1.05rem' }}>
                    WHY IS THIS DANGEROUS?
                  </h3>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {/* Hazards */}
                  <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      High Energy Hazards
                    </div>
                    <div style={{ marginTop: '6px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                      {(analysisResult.hazards || []).join(', ') || 'Uncontrolled energy release'}
                    </div>
                  </div>

                  {/* Exposed Personnel */}
                  <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Personnel In Line Of Fire
                    </div>
                    <div style={{ marginTop: '6px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                      {(analysisResult.exposure || []).join(', ') || 'Operations personnel in active zone'}
                    </div>
                  </div>

                  {/* Potential Consequences */}
                  <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Potential Harm / Severity
                    </div>
                    <div style={{ marginTop: '6px', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem' }}>
                      {(analysisResult.consequences || []).join(', ') || 'Serious injury or fatality potential'}
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. QUESTION: WHAT WENT WRONG? */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <AlertTriangle size={18} color="var(--risk-high)" />
                  <h3 className="section-question" style={{ fontSize: '1.05rem' }}>
                    WHAT WENT WRONG?
                  </h3>
                </div>

                <div style={{ padding: '14px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--risk-high)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '4px' }}>
                    Failed or Missing Safety Controls
                  </div>
                  <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {(analysisResult.barriers || []).join(', ') || 'Absence of verified positive barrier isolation or permit compliance.'}
                  </div>
                </div>
              </div>

              {/* 5. QUESTION: WHAT SHOULD WE DO FIRST? */}
              {analysisResult.recommended_action && (
                <div 
                  className="card"
                  style={{
                    background: 'var(--risk-low-bg)',
                    borderColor: 'rgba(34, 197, 94, 0.35)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <ShieldCheck size={18} color="var(--brand-emerald)" />
                    <h3 className="section-question" style={{ fontSize: '1.05rem', color: 'var(--brand-emerald)' }}>
                      WHAT SHOULD WE DO FIRST?
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                    {analysisResult.recommended_action}
                  </p>
                </div>
              )}

              {/* 6. QUESTION: HAVE WE SEEN SOMETHING LIKE THIS BEFORE? */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Database size={18} color="var(--brand-purple)" />
                    <h3 className="section-question" style={{ fontSize: '1.05rem' }}>
                      HAVE WE SEEN SOMETHING LIKE THIS BEFORE?
                    </h3>
                  </div>
                  <span className="badge badge-purple" style={{ fontSize: '0.68rem' }}>
                    FAISS 106k Semantic Match
                  </span>
                </div>

                {hasRecurringPattern && (
                  <div 
                    style={{
                      padding: '12px 16px',
                      background: 'var(--risk-low-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '14px',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--brand-purple)', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Recurring Pattern Detected
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                      {(analysisResult.recurring_patterns || []).join(' • ') || 'Repeated control failure convergence verified against historical dataset.'}
                    </div>
                  </div>
                )}

                <SimilarReportsCard 
                  similarReports={analysisResult.similar_reports || []} 
                  onSelectReport={(sim) => setSelectedSimilar(sim)}
                />
              </div>

              {/* 7. Grounded Evidence Quotes */}
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} color="var(--brand-blue)" />
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Extracted Text Evidence & Provenance
                    </h4>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Verbatim quotes from report narrative
                  </span>
                </div>
                <EvidenceCard evidenceList={analysisResult.evidence || []} />
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Report Inspection Modal (Preserved) */}
      {selectedSimilar && (
        <ReportDetailModal 
          report={selectedSimilar} 
          onClose={() => setSelectedSimilar(null)} 
        />
      )}
    </div>
  );
}
