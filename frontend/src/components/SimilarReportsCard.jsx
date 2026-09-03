import React from 'react';
import { Database, Calendar, MapPin, Tag, ChevronRight } from 'lucide-react';

export default function SimilarReportsCard({ similarReports = [], onSelectReport }) {
  if (!similarReports || similarReports.length === 0) {
    return (
      <div 
        style={{
          padding: '20px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
        }}
      >
        No similar historical reports matched above the similarity threshold.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {similarReports.map((item, idx) => {
        // Handle both string format "REP-ID (date - country - similarity: 0.55)" or full object
        let reportId = item.report_id || `Match #${idx + 1}`;
        let score = item.similarity_score !== undefined ? item.similarity_score : 0.45;
        let date = item.date;
        let location = item.country || item.region;
        let narrative = item.narrative;
        let lsrs = item.life_saving_rules || [];
        let cause = item.cause;

        if (typeof item === 'string') {
          reportId = item.split(' ')[0];
          narrative = item;
        }

        const scorePct = Math.round(score * 100);

        return (
          <div
            key={reportId + idx}
            onClick={() => onSelectReport && onSelectReport(typeof item === 'object' ? item : { report_id: reportId })}
            style={{
              padding: '12px 16px',
              background: 'rgba(15, 23, 42, 0.75)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              cursor: onSelectReport ? 'pointer' : 'default',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              if (onSelectReport) {
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.95)';
              }
            }}
            onMouseLeave={(e) => {
              if (onSelectReport) {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8', fontSize: '0.85rem' }}>
                  {reportId}
                </span>
                {item.source_type && (
                  <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                    {item.source_type.toUpperCase()}
                  </span>
                )}
              </div>
              <span className="badge badge-purple" style={{ fontSize: '0.7rem' }}>
                {scorePct}% Cosine Similarity
              </span>
            </div>

            {narrative && (
              <p 
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.4,
                  marginBottom: '8px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {narrative}
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {date && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> {date}
                </span>
              )}
              {location && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={12} /> {location}
                </span>
              )}
              {lsrs.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#eab308' }}>
                  <Tag size={12} /> {lsrs.join(', ')}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
