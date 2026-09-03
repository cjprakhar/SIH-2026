import React from 'react';
import { Quote, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function EvidenceCard({ evidenceList = [] }) {
  if (!evidenceList || evidenceList.length === 0) {
    return (
      <div 
        style={{
          padding: '16px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          textAlign: 'center',
        }}
      >
        No explicit evidence quotes detected.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {evidenceList.map((item, idx) => {
        let signalTitle = 'Detected Safety Signal';
        let evidenceQuote = item;

        // Check if formatted like "Signal: Quote" or object
        if (typeof item === 'object' && item !== null) {
          signalTitle = item.signal || 'Detected Precursor';
          evidenceQuote = item.evidence || item.quote || JSON.stringify(item);
        } else if (typeof item === 'string' && item.includes(':')) {
          const parts = item.split(':');
          signalTitle = parts[0].trim();
          evidenceQuote = parts.slice(1).join(':').trim();
        }

        return (
          <div
            key={idx}
            style={{
              padding: '12px 16px',
              background: 'rgba(15, 23, 42, 0.75)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderLeft: '4px solid #38bdf8',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <CheckCircle2 size={15} color="#38bdf8" />
              <strong style={{ fontSize: '0.85rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {signalTitle}
              </strong>
            </div>

            <div 
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontStyle: 'italic',
                lineHeight: 1.5,
                background: 'rgba(0, 0, 0, 0.25)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <Quote size={14} color="#94a3b8" style={{ transform: 'rotate(180deg)', flexShrink: 0, marginTop: '2px' }} />
              <span>"{evidenceQuote}"</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
