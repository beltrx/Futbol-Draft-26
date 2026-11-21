import React from 'react';
import { CLUB_CRESTS, CUSTOM_CLUB_LOGOS, LEAGUE_LOGOS, MEDIA_LOGOS } from '../data/logos';
import { LEAGUES_META } from '../data/database';
import { isPeerReadyForPhase } from '../services/onlineNet';
import type { NetStateSnapshot, Position, Team } from '../types/game';


interface ClubLogoProps {
  club: string;
  size?: number;
  className?: string;
}

export const ClubLogo: React.FC<ClubLogoProps> = ({ club, size = 20, className = '' }) => {
  const customUri = CUSTOM_CLUB_LOGOS[club];
  if (customUri) {
    const resolvedSrc =
      customUri.startsWith('/') && !customUri.startsWith('//')
        ? `.${customUri}`
        : customUri;
    const isFlag = customUri.includes('/assets/flags/');
    return (
      <img
        src={resolvedSrc}
        alt={club}
        width={isFlag ? Math.round(size * 1.2) : size}
        height={isFlag ? Math.round(size * 0.8) : size}
        onError={(e) => {
          const img = e.currentTarget;
          if (customUri.startsWith('/') && !img.dataset.fallbackTried) {
            img.dataset.fallbackTried = '1';
            img.src = `./public${customUri}`;
          }
        }}
        className={`inline-block shrink-0 ${
          isFlag
            ? 'rounded-[2px] object-cover ring-1 ring-white/20 shadow-sm'
            : 'object-contain drop-shadow-sm'
        } ${className}`}
        style={
          isFlag
            ? { width: Math.round(size * 1.2), height: Math.round(size * 0.8) }
            : { width: size, height: size }
        }
      />
    );
  }

  const cr = CLUB_CRESTS[club] || {
    c1: '#15803d',
    c2: '#0f172a',
    acc: '#eab308',
    code: club.slice(0, 3).toUpperCase(),
    pat: 'shield' as const,
  };
  const lightTop =
    cr.c1 === '#FFFFFF' ||
    cr.c1 === '#FDE100' ||
    cr.c1 === '#FFCD00' ||
    cr.c1 === '#FFE667';
  const txtCol = lightTop ? '#0b1318' : '#FFFFFF';

  if (cr.pat === 'circle') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        aria-hidden="true"
        className={`inline-block shrink-0 drop-shadow-sm ${className}`}
      >
        <circle cx="14" cy="14" r="13" fill={cr.c1} stroke={cr.c2} strokeWidth="2.2" />
        <circle cx="14" cy="14" r="9.5" fill={cr.c2} opacity="0.22" />
        <circle cx="14" cy="14" r="13" fill="none" stroke={cr.acc} strokeWidth="0.9" opacity="0.8" />
        <text
          x="14"
          y="17.5"
          textAnchor="middle"
          fill={txtCol}
          fontFamily="Outfit, sans-serif"
          fontWeight="800"
          fontSize="8.2"
        >
          {cr.code}
        </text>
      </svg>
    );
  }

  if (cr.pat === 'stripes') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        aria-hidden="true"
        className={`inline-block shrink-0 drop-shadow-sm ${className}`}
      >
        <path
          d="M4,3 H24 V15 C24,21.5 14,26 14,26 C14,26 4,21.5 4,15 Z"
          fill={cr.c1}
          stroke={cr.acc}
          strokeWidth="1.6"
        />
        <path d="M9.5,3.5 V22.5 M14,3.5 V25 M18.5,3.5 V22.5" stroke={cr.c2} strokeWidth="2.7" />
        <rect x="4" y="10" width="20" height="8.5" fill="rgba(0,0,0,0.65)" />
        <text
          x="14"
          y="16.5"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="Outfit, sans-serif"
          fontWeight="800"
          fontSize="7.8"
        >
          {cr.code}
        </text>
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      aria-hidden="true"
      className={`inline-block shrink-0 drop-shadow-sm ${className}`}
    >
      <path
        d="M4,3 H24 V15 C24,21.5 14,26 14,26 C14,26 4,21.5 4,15 Z"
        fill={cr.c1}
        stroke={cr.c2}
        strokeWidth="1.8"
      />
      <path d="M14,4 H23 V15 C23,20 14,24.5 14,24.5 Z" fill={cr.c2} opacity="0.28" />
      <path d="M4,3 H24 V15 C24,21.5 14,26 14,26 C14,26 4,21.5 4,15 Z" fill="none" stroke={cr.acc} strokeWidth="1" />
      <text
        x="14"
        y="17.2"
        textAnchor="middle"
        fill={txtCol}
        fontFamily="Outfit, sans-serif"
        fontWeight="800"
        fontSize="8.2"
      >
        {cr.code}
      </text>
    </svg>
  );
};

interface TeamIdentityBadgeProps {
  team?: Team | null;
  size?: number;
  className?: string;
}

export const TeamIdentityBadge: React.FC<TeamIdentityBadgeProps> = ({
  team,
  size = 24,
  className = '',
}) => {
  if (!team || !team.customIdentity) {
    return <ClubLogo club="Manchester City" size={size} className={className} />;
  }
  const cid = team.customIdentity;
  if (cid.type === 'club' && cid.club) {
    return <ClubLogo club={cid.club} size={size} className={className} />;
  }
  const c1 = cid.c1 || '#166534';
  const c2 = cid.c2 || '#eab308';
  const sh = cid.shape || 'shield';
  const abbr =
    (team.name || 'FC')
      .replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'FC';
  const txtCol =
    c1.toLowerCase() === '#ffffff' ||
    c1.toLowerCase() === '#fde100' ||
    c1.toLowerCase() === '#eab308'
      ? '#07120d'
      : '#ffffff';

  if (sh === 'circle') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <circle cx="16" cy="16" r="15" fill={c1} stroke={c2} strokeWidth="2.2" />
        <circle cx="16" cy="16" r="10.5" fill={c2} opacity="0.28" />
        <text x="16" y="19.5" textAnchor="middle" fill={txtCol} fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="9.5">
          {abbr}
        </text>
      </svg>
    );
  }
  if (sh === 'stripes') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path d="M5,4 H27 V17 C27,24 16,29 16,29 C16,29 5,24 5,17 Z" fill={c1} stroke={c2} strokeWidth="2" />
        <path d="M11,5 V25 M16,5 V27 M21,5 V25" stroke={c2} strokeWidth="3.2" />
        <rect x="5" y="11" width="22" height="9" fill="rgba(0,0,0,0.68)" />
        <text x="16" y="18.2" textAnchor="middle" fill="#FFFFFF" fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="9">
          {abbr}
        </text>
      </svg>
    );
  }
  if (sh === 'diamond') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <polygon points="16,2 30,16 16,30 2,16" fill={c1} stroke={c2} strokeWidth="2.2" />
        <polygon points="16,6 26,16 16,26 6,16" fill={c2} opacity="0.25" />
        <text x="16" y="19.2" textAnchor="middle" fill={txtCol} fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="8.8">
          {abbr}
        </text>
      </svg>
    );
  }
  if (sh === 'star') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
        <path d="M5,6 H27 V18 C27,24.5 16,29.5 16,29.5 C16,29.5 5,24.5 5,18 Z" fill={c1} stroke={c2} strokeWidth="2" />
        <polygon points="16,1.2 17.5,4.2 20.8,4.5 18.2,6.6 19,9.8 16,8 13,9.8 13.8,6.6 11.2,4.5 14.5,4.2" fill={c2} />
        <text x="16" y="20.5" textAnchor="middle" fill={txtCol} fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="9">
          {abbr}
        </text>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`inline-block shrink-0 ${className}`}>
      <path d="M5,4 H27 V17 C27,24 16,29 16,29 C16,29 5,24 5,17 Z" fill={c1} stroke={c2} strokeWidth="2.2" />
      <path d="M16,5 H26 V17 C26,22.5 16,27.5 16,27.5 Z" fill={c2} opacity="0.32" />
      <text x="16" y="19.2" textAnchor="middle" fill={txtCol} fontFamily="Outfit, sans-serif" fontWeight="800" fontSize="9.2">
        {abbr}
      </text>
    </svg>
  );
};

export const MediaLogoBadge: React.FC<{ source: string; clubLogoName?: string }> = ({
  source,
  clubLogoName,
}) => {
  if (clubLogoName) {
    return <ClubLogo club={clubLogoName} size={40} />;
  }
  const s = (source || '').toLowerCase();
  let key: string | null = null;
  if (s.includes('sky sports')) key = 'Sky Sports';
  else if (s.includes('guardian')) key = 'The Guardian';
  else if (s.includes('marca')) key = 'Marca';

  if (key && MEDIA_LOGOS[key]) {
    return (
      <div className="inline-flex h-11 min-w-[76px] shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white px-2.5 py-1 shadow-sm">
        <img src={MEDIA_LOGOS[key]} alt={key} className="max-h-8 max-w-[96px] object-contain" />
      </div>
    );
  }

  return (
    <div className="inline-flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--raised)] px-2.5 text-sm font-extrabold text-[var(--pri-bright)]">
      {source.slice(0, 3).toUpperCase()}
    </div>
  );
};

const POS_LABELS: Record<Position, string> = {
  GK: 'KL',
  DEF: 'DF',
  MID: 'OS',
  FWD: 'FV',
};

const POS_CLASSES: Record<Position, string> = {
  GK: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
  DEF: 'bg-sky-500/20 text-sky-300 border-sky-400/40',
  MID: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
  FWD: 'bg-rose-500/20 text-rose-300 border-rose-400/40',
};

export const PosBadge: React.FC<{ pos: Position }> = ({ pos }) => (
  <span
    className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[11px] font-bold tracking-wide ${POS_CLASSES[pos]}`}
  >
    {POS_LABELS[pos]}
  </span>
);

export const OnlineReadyBadges: React.FC<{
  net: NetStateSnapshot;
  phase: string;
}> = ({ net, phase }) => {
  if (!net.connected) return null;
  const myReady = isPeerReadyForPhase(net, phase, net.myTeamIdx);
  const oppReady = isPeerReadyForPhase(net, phase, 1 - net.myTeamIdx);
  const peerLabel = net.peerName || (net.role === 'host' ? '2. Oyuncu' : '1. Oyuncu');

  return (
    <div
      data-testid="online-ready-badges"
      className="inline-flex flex-wrap items-center gap-1.5 text-[11px] font-bold"
    >
      <span
        className={`rounded-lg border px-2.5 py-1 ${
          myReady
            ? 'border-emerald-400/60 bg-emerald-950/70 text-emerald-200'
            : 'border-amber-500/40 bg-amber-950/40 text-amber-200'
        }`}
      >
        Sen: {myReady ? 'Hazır ✓' : 'Hazır Değil'}
      </span>
      <span
        className={`rounded-lg border px-2.5 py-1 ${
          oppReady
            ? 'border-emerald-400/60 bg-emerald-950/70 text-emerald-200'
            : 'border-amber-500/40 bg-amber-950/40 text-amber-200'
        }`}
      >
        {peerLabel}: {oppReady ? 'Hazır ✓' : 'Bekleniyor...'}
      </span>
    </div>
  );
};

export const LeagueLogo: React.FC<{
  league: string;
  size?: number;
  className?: string;
}> = ({ league, size = 24, className = '' }) => {
  const logoSrc = LEAGUE_LOGOS[league];
  const m = LEAGUES_META.find((l) => l.id === league);
  if (logoSrc) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md bg-white p-0.5 shadow-sm shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={logoSrc}
          alt={league}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-[var(--raised)] border border-[var(--border)] text-[10px] font-extrabold text-[var(--pri-bright)] shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {(m?.name || league || 'LG').slice(0, 2).toUpperCase()}
    </span>
  );
};


