import React, { useMemo } from 'react';
import {
  ALL_CLUBS,
  CLUB_TO_LEAGUE,
  ICONIC_CLUBS,
  LEAGUES_META,
  MODERN_LEAGUES,
  PLAYERS_POOL,
} from '../data/database';
import type { GameModeId } from '../types/game';
import { getModeDef } from '../utils/draftLogic';
import { ClubLogo } from './ClubBadge';

interface ClubSelectViewProps {
  mode: GameModeId;
  leagues: Set<string>;
  clubs: Set<string>;
  err: string;
  onToggleLeague: (lgId: string) => void;
  onToggleClub: (club: string) => void;
  onSelectPreset: (preset: 'all' | 'pl' | 'superlig' | 'iconic' | 'clear') => void;
  onBack: () => void;
  onStartDraft: () => void;
}

export const ClubSelectView: React.FC<ClubSelectViewProps> = ({
  mode,
  leagues,
  clubs,
  err,
  onToggleLeague,
  onToggleClub,
  onSelectPreset,
  onBack,
  onStartDraft,
}) => {
  const modeDef = getModeDef(mode);
  const isIconicMode = mode === 'iconic';

  const visibleModernClubs = useMemo(() => {
    return ALL_CLUBS.filter((c) => {
      const lg = CLUB_TO_LEAGUE[c] || 'Diğer Takımlar';
      if (lg === 'İkonik Takımlar') return false;
      return leagues.has(lg);
    });
  }, [leagues]);

  const clubPlayerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    PLAYERS_POOL.forEach((p) => {
      map[p.c] = (map[p.c] || 0) + 1;
    });
    return map;
  }, []);

  const poolCount = useMemo(() => {
    let pool = PLAYERS_POOL.filter((p) => leagues.has(p.lg));
    if (clubs.size > 0) {
      pool = pool.filter((p) => clubs.has(p.c));
    }
    return pool.length;
  }, [leagues, clubs]);

  return (
    <section aria-label="Lig ve Kulüp Havuzu Seçimi" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--pri-bright)]">
            {modeDef.name}
          </span>
          <h1 className="text-xl font-extrabold text-[var(--fg)]">
            Lig &amp; Kulüp Havuzu Seçimi
          </h1>
          <p className="text-xs text-[var(--muted)]">
            {modeDef.clubs === 'required'
              ? 'Kulüp Draftı için havuza en az 2 kulüp seçmelisin.'
              : 'İstediğin ligleri seç; dilersen alt bölümde yalnızca belirli kulüplere filtreleyebilirsin (boş bırakırsan seçili liglerin tamamı kullanılır).'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs">
            Havuzdaki Oyuncu:{' '}
            <strong className="font-mono-tab text-[var(--pri-bright)]">{poolCount}</strong>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3.5 py-2 text-xs font-semibold hover:bg-[var(--accent)]"
          >
            ← Mod Seçimine Dön
          </button>
          <button
            type="button"
            onClick={onStartDraft}
            className="rounded-lg border border-[var(--pri-bright)] bg-[var(--pri)] px-4 py-2 text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(34,197,94,0.65)] hover:bg-[#15803d]"
          >
            Draftı Başlat →
          </button>
        </div>
      </div>

      {err && (
        <p role="alert" className="rounded-xl border border-red-500/45 bg-red-950/45 px-4 py-2.5 text-xs font-medium text-red-200">
          {err}
        </p>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[var(--fg)]">Ligler</h2>
          <div className="flex flex-wrap gap-1.5">
            {!isIconicMode && (
              <>
                <button
                  type="button"
                  onClick={() => onSelectPreset('all')}
                  className="rounded border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--accent)]"
                >
                  Tüm Ligler
                </button>
                <button
                  type="button"
                  onClick={() => onSelectPreset('pl')}
                  className="rounded border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--accent)]"
                >
                  Premier Lig
                </button>
                <button
                  type="button"
                  onClick={() => onSelectPreset('superlig')}
                  className="rounded border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--accent)]"
                >
                  Süper Lig
                </button>
              </>
            )}
            {mode !== 'career' && (
              <button
                type="button"
                onClick={() => onSelectPreset('iconic')}
                className="rounded border border-amber-400/50 bg-amber-900/40 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-800/60"
              >
                İkonik Efsaneler (18)
              </button>
            )}
            <button
              type="button"
              onClick={() => onSelectPreset('clear')}
              className="rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)] hover:text-white"
            >
              Seçimi Temizle
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          {LEAGUES_META.filter((lg) => (mode === 'career' ? lg.id !== 'İkonik Takımlar' : true)).map(
            (lg) => {
              const active = leagues.has(lg.id);
              const clubsInLg = ALL_CLUBS.filter(
                (c) => (CLUB_TO_LEAGUE[c] || 'Diğer Takımlar') === lg.id
              );
              return (
                <button
                  key={lg.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggleLeague(lg.id)}
                  className={`flex flex-col rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-[var(--pri-bright)] bg-[#14201c] text-white'
                      : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:bg-[var(--raised)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-[var(--fg)]">{lg.name}</span>
                    {active && <span className="text-xs font-bold text-[var(--pri-bright)]">✓</span>}
                  </div>
                  <span className="mt-1 text-[11px] text-[var(--muted)]">
                    {lg.country} · {clubsInLg.length} Kulüp
                  </span>
                </button>
              );
            }
          )}
        </div>
      </div>

      {visibleModernClubs.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[var(--fg)]">
                Kulüp Filtresi ({visibleModernClubs.length} Kulüp)
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                Seçili Ligler: {MODERN_LEAGUES.filter((l) => leagues.has(l)).join(', ') || 'Yok'} ·{' '}
                {clubs.size > 0
                  ? `${clubs.size} özel kulüp seçili`
                  : 'Kulüp seçilmezse yukarıdaki liglerin tüm kulüpleri dahil edilir'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {visibleModernClubs.map((club) => {
              const picked = clubs.has(club);
              return (
                <button
                  key={club}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => onToggleClub(club)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                    picked
                      ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                      : 'border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:bg-[var(--raised)]'
                  }`}
                >
                  <ClubLogo club={club} size={18} />
                  <span>{club}</span>
                  <span className="text-[10px] opacity-75">({clubPlayerCounts[club] || 0})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode !== 'career' && leagues.has('İkonik Takımlar') && (
        <div className="rounded-2xl border border-amber-500/35 bg-[var(--surface)] p-4 shadow-lg">
          <h2 className="mb-2.5 text-sm font-bold text-amber-200">
            18 İkonik Efsane Kadro
          </h2>
          <div className="flex flex-wrap gap-2">
            {ICONIC_CLUBS.map((club) => {
              const picked = clubs.has(club);
              return (
                <button
                  key={club}
                  type="button"
                  aria-pressed={picked}
                  onClick={() => onToggleClub(club)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                    picked
                      ? 'border-amber-400 bg-amber-800/70 text-amber-50'
                      : 'border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:bg-[var(--raised)]'
                  }`}
                >
                  <ClubLogo club={club} size={18} />
                  <span>{club}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
