import React from 'react';

interface BookmakerConfig {
  label: string;
  bg: string;
  color: string;
  dotBg: string;
  abbr: string;
}

const BOOKMAKERS: Record<string, BookmakerConfig> = {
  Tipsport: { label: 'Tipsport', bg: '#e8f4fd', color: '#0072bc', dotBg: '#0072bc', abbr: 'TS' },
  Fortuna:  { label: 'Fortuna',  bg: '#fff3e0', color: '#e65100', dotBg: '#e65100', abbr: 'FO' },
  SazkaBet: { label: 'SazkaBet', bg: '#fce4ec', color: '#c62828', dotBg: '#c62828', abbr: 'SB' },
  Betano:   { label: 'Betano',   bg: '#e8f5e9', color: '#2e7d32', dotBg: '#2e7d32', abbr: 'BA' },
  Ostatní:  { label: 'Ostatní',  bg: '#f3f4f6', color: '#4b5563', dotBg: '#9ca3af', abbr: '?'  },
};

interface Props {
  bookmaker: string | null | undefined;
  size?: 'sm' | 'md';
}

const BookmakerBadge: React.FC<Props> = ({ bookmaker, size = 'sm' }) => {
  if (!bookmaker) return null;
  const cfg = BOOKMAKERS[bookmaker] ?? {
    label: bookmaker,
    bg: '#f3f4f6',
    color: '#4b5563',
    dotBg: '#9ca3af',
    abbr: bookmaker.slice(0, 2).toUpperCase(),
  };

  const padding = size === 'md' ? '4px 10px 4px 6px' : '2px 8px 2px 4px';
  const fontSize = size === 'md' ? 12 : 11;
  const dotSize = size === 'md' ? 18 : 16;
  const dotFontSize = size === 'md' ? 9 : 8;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding, borderRadius: 999, background: cfg.bg,
      color: cfg.color, fontSize, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: dotSize, height: dotSize, borderRadius: '50%',
        background: cfg.dotBg, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: dotFontSize, fontWeight: 800, flexShrink: 0, lineHeight: 1,
      }}>
        {cfg.abbr}
      </span>
      {cfg.label}
    </span>
  );
};

export default BookmakerBadge;
