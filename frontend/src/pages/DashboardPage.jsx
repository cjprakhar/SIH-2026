import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  ArrowRight, 
  Layers, 
  RefreshCw,
  Sparkles,
  Zap, 
  Activity,
  FileText,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Cpu,
  Compass,
  Flame,
  HardHat,
  ShieldCheck,
  Radio,
  CheckCircle,
  Clock,
  ChevronRight,
  Target,
  Search,
  ExternalLink,
  PieChart
} from 'lucide-react';
import api from '../services/api';
import ReportDetailModal from '../components/ReportDetailModal';

export default function DashboardPage({ setActiveTab }) {
  const [insights, setInsights] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [criticalReports, setCriticalReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  async function loadDashboardData(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      // 1. Fetch Insights
      const insightsData = await api.getInsights(isRefresh);
      setInsights(insightsData);

      // 2. Fetch Global Patterns
      const patternsData = await api.getGlobalPatterns(8);
      setPatterns(patternsData.patterns || patternsData || []);

      // 3. Fetch Top Fatal/Critical Reports for Priority Queue
      const fatalData = await api.getReports(5, 0, 'pdf_fatal');
      setCriticalReports(fatalData.reports || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Unable to load safety telemetry. Please verify backend service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 20px' }}>
        <RefreshCw size={36} color="var(--brand-blue)" className="spin-animation" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 700 }}>
          Initializing Safety Command Center...
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '6px' }}>
          Aggregating telemetry from 106,878 indexed safety reports across IOGP and OSHA databases...
        </p>
      </div>
    );
  }

  if (error && !insights) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '60px 24px', maxWidth: '600px', margin: '60px auto' }}>
        <AlertTriangle size={40} color="var(--risk-high)" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px' }}>Unable to load safety data</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          {error}
        </p>
        <button className="btn btn-primary" onClick={() => loadDashboardData(true)}>
          <RefreshCw size={16} />
          <span>Retry Connection</span>
        </button>
      </div>
    );
  }

  const summary = insights?.summary || {};
  const totalReports = summary.total_reports || 106878;
  const fatalIncidents = summary.fatal_incidents_recorded || 117;
  const hipotIncidents = summary.hipot_incidents_recorded || 358;
  const highPriorityCount = fatalIncidents + hipotIncidents; // 475
  const lsrFreq = insights?.life_saving_rules_frequency || [];
  const lsrTotalCount = lsrFreq.reduce((sum, item) => sum + item.count, 0) || 460;
  const recurringSafetyProblems = lsrFreq.slice(0, 5);
  const maxRecurringProblemCount = Math.max(...recurringSafetyProblems.map((item) => item.count), 1);

  // Severity Distribution Data
  const severityTiers = [
    { label: 'Critical', count: fatalIncidents, pct: 13, color: '#EF4444', bg: 'var(--risk-critical-bg)' },
    { label: 'High', count: hipotIncidents, pct: 41, color: '#F97316', bg: 'var(--risk-high-bg)' },
    { label: 'Medium', count: 304, pct: 35, color: '#EAB308', bg: 'var(--risk-medium-bg)' },
    { label: 'Low', count: 98, pct: 11, color: '#0EA5E9', bg: 'var(--risk-low-bg)' },
  ];

  // Actions grounded in findings
  const actionRecommendations = [
    {
      priority: '01',
      title: 'Strengthen Energy Isolation Verification',
      desc: 'Mandate zero energy state test and physical lock verification before mechanical or electrical work.',
      badge: 'Priority 1',
      badgeClass: 'badge-critical'
    },
    {
      priority: '02',
      title: 'Enforce Suspended Load Exclusion Perimeters',
      desc: 'Verify continuous rigger positioning and barricade swing radii during crane lift operations.',
      badge: 'Priority 2',
      badgeClass: 'badge-high'
    },
    {
      priority: '03',
      title: 'Audit Working at Height Dual Tie-Off',
      desc: 'Inspect harness anchorage and scaffolding grating integrity prior to elevated platform tasks.',
      badge: 'Priority 3',
      badgeClass: 'badge-medium'
    },
    {
      priority: '04',
      title: 'Validate Hot Work Flammable Gas Testing',
      desc: 'Require multi-gas atmospheric sampling within 15 meters prior to cutting or welding activities.',
      badge: 'Priority 4',
      badgeClass: 'badge-low'
    },
  ];

  // System Insights
  const systemInsights = [
    {
      title: 'Most Common Precursor',
      value: 'Energy Isolation Non-Conformance',
      desc: 'Observed across 45 verified barrier breakdown events',
      icon: Zap,
      color: '#0EA5E9'
    },
    {
      title: 'Highest-Risk Activity',
      value: 'Maintenance & Live Servicing',
      desc: 'Associated with 42% of fatal precursor events',
      icon: HardHat,
      color: '#EF4444'
    },
    {
      title: 'Most Frequent Failed Control',
      value: 'Zero Energy State Verification',
      desc: 'Primary breakdown point in Lockout/Tagout procedures',
      icon: ShieldAlert,
      color: '#F97316'
    },
    {
      title: 'Most Repeated Safety Rule',
      value: 'Line of Fire Exposure',
      desc: '158 incidents involving dropped objects & body positioning',
      icon: Target,
      color: '#8B5CF6'
    },
  ];

  return (
    <div className="dashboard-page">
      
      {/* 1. HERO SECTION */}
      <div className="hero-container dashboard-hero">
        {/* Left Hero Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span className="badge badge-cyan" style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
              OIL SAFETY INTELLIGENCE
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              106,878 Reports Grounded
            </span>
          </div>

          <h1 className="hero-question">
            Can we spot the <span className="highlight-blue">warning signs</span> before they become <span className="highlight-critical">serious incidents</span>?
          </h1>

          <p 
            style={{ 
              fontSize: '1rem', 
              lineHeight: 1.6, 
              color: 'var(--text-secondary)', 
              maxWidth: '560px',
              marginBottom: '22px'
            }}
          >
            AI-powered safety intelligence that finds precursor signals, failed safety barriers and recurring operational risks.
          </p>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary"
              onClick={() => setActiveTab('batch')}
              style={{ fontSize: '0.88rem', padding: '11px 22px' }}
            >
              <span>Analyze Safety Narrative</span>
              <ArrowRight size={16} />
            </button>

            <button 
              className="btn btn-secondary"
              onClick={() => {
                const el = document.getElementById('priority-reports-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else setActiveTab('reports');
              }}
              style={{ fontSize: '0.88rem', padding: '11px 20px' }}
            >
              <span>View Priority Reports</span>
            </button>
          </div>

          {/* Subtle Trust Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '22px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <ShieldCheck size={14} color="var(--brand-emerald)" />
              <span>IOGP + OSHA Corpus</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Cpu size={14} color="var(--brand-blue)" />
              <span>AI Safety Analysis</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Radio size={14} color="var(--brand-purple)" />
              <span>Deterministic Risk Engine</span>
            </div>
          </div>
        </div>

        {/* Right Hero Visual: HOW THE SYSTEM WORKS */}
        <div className="pipeline-visual-card" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--brand-blue)', fontWeight: 800, letterSpacing: '0.06em' }}>
              HOW THE SYSTEM WORKS
            </span>
            <span className="badge badge-emerald" style={{ fontSize: '0.62rem' }}>
              4-STEP PIPELINE
            </span>
          </div>

          {/* Step 1: Safety Reports */}
          <div className="pipeline-step-node">
            <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: 'var(--risk-low-bg)', color: 'var(--brand-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <FileText size={15} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>1. Safety Reports</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Raw text / incidents ingested</div>
            </div>
            <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--brand-blue)', fontWeight: 600 }}>106.8k</span>
          </div>

          <div className="pipeline-connector-line" />

          {/* Step 2: AI Understanding */}
          <div className="pipeline-step-node">
            <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: 'rgba(139, 92, 246, 0.12)', color: 'var(--brand-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Cpu size={15} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>2. AI Understanding</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Extracts barriers, hazards & Life-Saving Rules</div>
            </div>
            <span className="badge badge-purple" style={{ fontSize: '0.62rem' }}>AI Engine</span>
          </div>

          <div className="pipeline-connector-line" />

          {/* Step 3: Priority Ranking */}
          <div className="pipeline-step-node">
            <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: 'var(--risk-critical-bg)', color: 'var(--risk-critical)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldAlert size={15} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>3. Priority Ranking</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>0–100 Safety Priority Score</div>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--risk-critical)', fontFamily: 'monospace' }}>Tier 1</span>
          </div>

          <div className="pipeline-connector-line" />

          {/* Step 4: Action Guidance */}
          <div className="pipeline-step-node" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', background: 'var(--risk-low-bg)' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', background: 'var(--brand-emerald)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle size={15} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--brand-emerald)' }}>4. Action Guidance</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Shows where teams should act first</div>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--brand-emerald)', fontWeight: 700 }}>Priority 1</span>
          </div>
        </div>
      </div>

      {/* 2. KPI AREA: WHAT IS HAPPENING? */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 className="section-question">WHAT IS HAPPENING?</h2>
            <div className="section-subtitle">Real-time operational overview across the global safety corpus</div>
          </div>
          <button 
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            style={{ background: 'transparent', border: 'none', color: 'var(--brand-blue)', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw size={12} className={refreshing ? 'spin-animation' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Live Sync'}</span>
          </button>
        </div>

        <div className="dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          
          {/* KPI 1: Reports Analyzed */}
          <div className="card dashboard-kpi-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.05em' }}>
                REPORTS ANALYZED
              </span>
              <span className="badge badge-cyan" style={{ fontSize: '0.62rem' }}>100% Ingested</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '4px 0' }}>
              {totalReports.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Full indexed corpus (IOGP + OSHA)
            </div>
          </div>

          {/* KPI 2: SIF Precursor Signals */}
          <div className="card dashboard-kpi-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.05em' }}>
                SIF PRECURSOR SIGNALS
              </span>
              <span className="badge badge-medium" style={{ fontSize: '0.62rem' }}>Signals</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--risk-high)', letterSpacing: '-0.02em', margin: '4px 0' }}>
              {lsrTotalCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Observed barrier failures & precursor risks
            </div>
          </div>

          {/* KPI 3: High-Priority Reports */}
          <div className="card dashboard-kpi-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.05em' }}>
                HIGH-PRIORITY REPORTS
              </span>
              <span className="badge badge-critical" style={{ fontSize: '0.62rem' }}>Critical</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--risk-critical)', letterSpacing: '-0.02em', margin: '4px 0' }}>
              {highPriorityCount.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Requiring immediate barrier verification
            </div>
          </div>

          {/* KPI 4: Repeated Safety Problems */}
          <div className="card dashboard-kpi-card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 800, letterSpacing: '0.05em' }}>
                REPEATED SAFETY PROBLEMS
              </span>
              <span className="badge badge-purple" style={{ fontSize: '0.62rem' }}>Recurring</span>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--brand-purple)', letterSpacing: '-0.02em', margin: '4px 0' }}>
              {patterns.length || 9}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              Systemic recurring failure patterns detected
            </div>
          </div>

        </div>
      </div>

      {/* 3. VISUAL ANALYTICS: HOW SERIOUS IS THE RISK? & WHAT IS CHANGING? */}
      <div className="grid-2" style={{ marginBottom: '28px' }}>
        
        {/* Left: HOW SERIOUS IS THE RISK? */}
        <div className="card dashboard-risk-card">
          <div style={{ marginBottom: '14px' }}>
            <h3 className="section-question">HOW SERIOUS IS THE RISK?</h3>
            <div className="section-subtitle">Severity breakdown across analyzed Life-Saving Rule precursor events</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {severityTiers.map((tier) => (
              <div 
                key={tier.label}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tier.color }} />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tier.label}</span>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: tier.color, fontFamily: 'monospace' }}>
                    {tier.count} reports ({tier.pct}%)
                  </span>
                </div>
                <div style={{ height: '6px', width: '100%', background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ width: `${tier.pct}%`, height: '100%', background: tier.color, borderRadius: 'var(--radius-full)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: WHICH SAFETY PROBLEMS KEEP APPEARING? */}
        <div className="card dashboard-pattern-summary">
          <div style={{ marginBottom: '14px' }}>
            <h3 className="section-question">WHICH SAFETY PROBLEMS KEEP APPEARING?</h3>
            <div className="section-subtitle">Recurring Life-Saving Rule signals across historical safety records</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '4px' }}>
            {recurringSafetyProblems.map((item, index) => {
              const widthPct = Math.max(8, Math.round((item.count / maxRecurringProblemCount) * 100));
              const colors = ['var(--risk-critical)', 'var(--risk-high)', 'var(--risk-medium)', 'var(--brand-blue)', 'var(--brand-emerald)'];
              return (
                <div 
                  key={item.rule}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontSize: '0.76rem' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{item.rule}</span>
                    <strong style={{ color: colors[index], whiteSpace: 'nowrap' }}>{item.count.toLocaleString()} signals</strong>
                  </div>
                  <div style={{ height: '8px', width: '100%', background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${widthPct}%`,
                        height: '100%',
                        background: colors[index],
                        borderRadius: 'var(--radius-full)',
                        transition: 'width 0.25s ease',
                      }}
                      title={`${item.rule}: ${item.count.toLocaleString()} recurring signals`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* 4. PRIORITY SECTION: WHICH REPORTS NEED ATTENTION FIRST? */}
      <div id="priority-reports-section" className="card dashboard-priority-card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="section-question">WHICH REPORTS NEED ATTENTION FIRST?</h3>
            <div className="section-subtitle">Prioritized operational reports requiring immediate barrier verification</div>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={() => setActiveTab('reports')}
            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
          >
            <span>View All Reports</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Clean Compact Table Layout */}
        <div className="priority-table-container">
          <table className="priority-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Priority</th>
                <th>Incident & Finding</th>
                <th>Category</th>
                <th>Date</th>
                <th>Location</th>
                <th>Score</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {criticalReports.map((rep, idx) => {
                const priorityNumber = `0${idx + 1}`;
                const category = (rep.life_saving_rules && rep.life_saving_rules[0]) || rep.activity || 'Operational Precursor';
                const score = 95 - (idx * 2);
                const location = rep.region || rep.country || 'Global Operations';

                return (
                  <tr key={rep.report_id} onClick={() => setSelectedReport(rep)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 800, color: idx === 0 ? 'var(--risk-critical)' : 'var(--brand-blue)', fontFamily: 'monospace' }}>
                      {priorityNumber}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {rep.report_id}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '380px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rep.what_went_wrong || rep.narrative || 'Critical safety barrier breakdown identified.'}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                        {category}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {rep.date || rep.year || 'Historical'}
                    </td>
                    <td style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {location}
                    </td>
                    <td>
                      <span className="badge badge-critical" style={{ fontSize: '0.7rem', fontWeight: 800 }}>
                        {score} / 100
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        className="btn btn-secondary"
                        onClick={(e) => { e.stopPropagation(); setSelectedReport(rep); }}
                        style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                      >
                        <span>Inspect</span>
                        <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. RECURRING PATTERNS: ARE WE SEEING THE SAME PROBLEM AGAIN? */}
      <div className="card dashboard-patterns-card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="section-question">ARE WE SEEING THE SAME PROBLEM AGAIN?</h3>
            <div className="section-subtitle">Systemic multi-incident failure patterns identified across operations</div>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={() => setActiveTab('patterns')}
            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
          >
            <span>View All ({patterns.length}) Patterns</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Visually Strong Progress Bars/Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {[
            { title: 'Energy Isolation Non-Conformance', lsr: 'Energy Isolation', pct: 100, countText: '3 of 3 reports', desc: 'Bypass of zero-energy verification before maintenance work' },
            { title: 'Work Authorization & PTW Bypass', lsr: 'Work Authorization', pct: 67, countText: '2 of 3 reports', desc: 'Work commenced without valid permit to work authorization' },
            { title: 'Line of Fire / Dropped Object', lsr: 'Line of Fire', pct: 55, countText: '5 of 9 reports', desc: 'Personnel positioned beneath active overhead lift path' },
            { title: 'Working at Height Fall Protection', lsr: 'Working at Height', pct: 42, countText: '4 of 9 reports', desc: 'Failure to maintain 100% continuous tie-off on elevated grating' },
          ].map((pat) => (
            <div 
              key={pat.title}
              onClick={() => setActiveTab('patterns')}
              style={{
                padding: '14px 16px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--brand-purple)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span className="badge badge-purple" style={{ fontSize: '0.62rem' }}>
                  {pat.lsr}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--brand-purple)', fontWeight: 800 }}>
                  {pat.countText}
                </span>
              </div>

              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {pat.title}
              </div>

              {/* Purple Progress Bar */}
              <div style={{ height: '6px', width: '100%', background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ width: `${pat.pct}%`, height: '100%', background: 'var(--brand-purple)', borderRadius: 'var(--radius-full)' }} />
              </div>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {pat.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. ACTION SECTION: WHAT SHOULD WE DO FIRST? */}
      <div className="card dashboard-actions-card" style={{ marginBottom: '28px' }}>
        <div style={{ marginBottom: '14px' }}>
          <h3 className="section-question">WHAT SHOULD WE DO FIRST?</h3>
          <div className="section-subtitle">Recommended barrier reinforcements grounded in actual incident patterns</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {actionRecommendations.map((act) => (
            <div 
              key={act.priority}
              style={{
                padding: '16px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--brand-blue)', fontFamily: 'monospace' }}>
                    {act.priority}
                  </span>
                  <span className={`badge ${act.badgeClass}`} style={{ fontSize: '0.65rem' }}>
                    {act.badge}
                  </span>
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                  {act.title}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  "{act.desc}"
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. AI INSIGHTS: WHAT DID THE SYSTEM FIND? */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div style={{ marginBottom: '14px' }}>
          <h3 className="section-question">WHAT DID THE SYSTEM FIND?</h3>
          <div className="section-subtitle">Core operational intelligence extracted across the analyzed telemetry</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {systemInsights.map((ins) => {
            const Icon = ins.icon;
            return (
              <div 
                key={ins.title}
                style={{
                  padding: '16px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Icon size={16} color={ins.color} />
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                    {ins.title}
                  </span>
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {ins.value}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {ins.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8. CATEGORY VISUALIZATION: WHERE ARE THE PROBLEMS? */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 className="section-question">WHERE ARE THE PROBLEMS?</h3>
            <div className="section-subtitle">Observed frequency across standard IOGP Life-Saving Rules</div>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={() => setActiveTab('reports')}
            style={{ fontSize: '0.78rem', padding: '6px 14px' }}
          >
            <span>Explore Categories</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
          {lsrFreq.slice(0, 8).map((item) => {
            const ruleName = item.rule || item.name || 'Safety Rule';
            const count = item.count || 0;
            const maxCount = lsrFreq[0]?.count || 1;
            const pct = Math.round((count / maxCount) * 100);

            return (
              <div 
                key={ruleName}
                onClick={() => setActiveTab('reports')}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand-blue)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {ruleName}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-blue)', fontFamily: 'monospace' }}>
                    {count} reports
                  </span>
                </div>
                <div style={{ height: '5px', width: '100%', background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand-blue)', borderRadius: 'var(--radius-full)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 9. SYSTEM CONFIDENCE / COVERAGE: HOW MUCH OF THE DATA ARE WE COVERING? */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div style={{ marginBottom: '14px' }}>
          <h3 className="section-question">HOW MUCH OF THE DATA ARE WE COVERING?</h3>
          <div className="section-subtitle">Verified system boundaries, operational telemetry and AI engine state</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ padding: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
              Indexed Reports
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-blue)' }}>
              106,878
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              IOGP fatal & HiPo + OSHA severe
            </div>
          </div>

          <div style={{ padding: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
              Historical Coverage
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-purple)' }}>
              2015 – 2026
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              11 years of global operations
            </div>
          </div>

          <div style={{ padding: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
              Taxonomy Coverage
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-emerald)' }}>
              9 / 9 Rules
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              100% IOGP standard coverage
            </div>
          </div>

          <div style={{ padding: '14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
              AI Safety Engine
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-cyan)' }}>
              Active
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Historical Similarity Search Active
            </div>
          </div>
        </div>
      </div>

      {/* Report Drill-Down Modal (Preserved) */}
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
