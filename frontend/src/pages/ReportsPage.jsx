import React, { useEffect, useState } from 'react';
import { 
  FileText, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  Tag, 
  MapPin, 
  Calendar, 
  AlertOctagon,
  ShieldAlert,
  Database
} from 'lucide-react';
import api from '../services/api';
import ReportDetailModal from '../components/ReportDetailModal';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(25);
  const [sourceType, setSourceType] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadReports() {
    setLoading(true);
    try {
      const data = await api.getReports(limit, offset, sourceType || null);
      setReports(data.reports || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, [offset, limit, sourceType]);

  const filteredReports = reports.filter((r) => {
    // Year filter
    if (yearFilter) {
      const reportYear = String(r.year || (r.date && r.date.slice(0, 4)) || '');
      if (reportYear !== yearFilter) return false;
    }

    // Search keyword
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const id = (r.report_id || '').toLowerCase();
    const narrative = (r.narrative || '').toLowerCase();
    const activity = (r.activity || '').toLowerCase();
    const country = (r.country || '').toLowerCase();
    const lsr = ((r.life_saving_rules || []).join(' ')).toLowerCase();
    return id.includes(q) || narrative.includes(q) || activity.includes(q) || country.includes(q) || lsr.includes(q);
  });

  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  const yearsList = ['2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016', '2015'];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
              HISTORICAL TELEMETRY EXPLORER
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {total.toLocaleString()} Total Indexed Records
            </span>
          </div>
          <h1 className="page-title">SAFETY REPORTS EXPLORER</h1>
          <p className="page-subtitle">
            Search, filter, and inspect normalized incident reports across OSHA and IOGP databases.
          </p>
        </div>

        {/* Filter Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Source Filter */}
          <select
            className="select-input"
            value={sourceType}
            onChange={(e) => {
              setSourceType(e.target.value);
              setOffset(0);
            }}
            style={{ width: '200px', padding: '9px 12px' }}
          >
            <option value="">All Sources (106,878)</option>
            <option value="pdf_fatal">IOGP Fatal Incidents (117)</option>
            <option value="pdf_hipot">IOGP High Potential (358)</option>
            <option value="pdf_pse">IOGP Process Safety (412)</option>
            <option value="csv_osha">OSHA Severe Injuries (105k)</option>
          </select>

          {/* Year Filter */}
          <select
            className="select-input"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            style={{ width: '130px', padding: '9px 12px' }}
          >
            <option value="">All Years</option>
            {yearsList.map((yr) => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>

          {/* Search Box */}
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input
              type="text"
              className="input-text"
              placeholder="Filter current view..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '34px', padding: '9px 12px 9px 34px' }}
            />
          </div>
        </div>
      </div>

      {/* Reports Table Card */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <RefreshCw size={32} color="#38bdf8" className="spin-animation" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading historical records...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Report ID</th>
                  <th style={{ width: '110px' }}>Date</th>
                  <th style={{ width: '130px' }}>Location</th>
                  <th>Activity / Failure Mechanism</th>
                  <th style={{ width: '190px' }}>Life-Saving Rules</th>
                  <th style={{ width: '120px' }}>Provenance</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((r) => {
                  const isFatal = r.source_type === 'pdf_fatal';
                  const primaryLSR = (r.life_saving_rules && r.life_saving_rules.length > 0) ? r.life_saving_rules[0] : null;

                  return (
                    <tr key={r.report_id} onClick={() => setSelectedReport(r)}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isFatal && <AlertOctagon size={14} color="var(--risk-critical)" title="Fatal Incident" />}
                          <span>{r.report_id}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {r.date || r.year || '—'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {r.country || r.region || '—'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px', fontSize: '0.85rem' }}>
                          {r.activity || r.cause || 'Incident Telemetry'}
                        </div>
                        {r.narrative && (
                          <div 
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: '480px',
                            }}
                          >
                            {r.narrative}
                          </div>
                        )}
                      </td>
                      <td>
                        {primaryLSR ? (
                          <span className="badge badge-medium" style={{ fontSize: '0.68rem' }}>
                            {primaryLSR}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {r.source_type && (
                            <span className="badge badge-cyan" style={{ fontSize: '0.62rem', alignSelf: 'flex-start' }}>
                              {r.source_type.replace('pdf_', '').replace('csv_', '').toUpperCase()}
                            </span>
                          )}
                          {r.source_file && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {r.source_file}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(15, 23, 42, 0.6)',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing <strong>{offset + 1}</strong> to <strong>{Math.min(offset + limit, total)}</strong> of <strong>{total.toLocaleString()}</strong> records
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0 || loading}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0 8px' }}>
              Page {currentPage} of {totalPages.toLocaleString()}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total || loading}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Report Inspection Modal */}
      {selectedReport && (
        <ReportDetailModal 
          report={selectedReport} 
          onClose={() => setSelectedReport(null)} 
        />
      )}
    </div>
  );
}
