import React, { useMemo, useState } from 'react';
import {
  ALL_CLUBS,
  ALL_LEAGUES,
  CLUB_TO_LEAGUE,
  CUSTOM_SHAPES,
} from '../data/database';
import type { DraftState, IdentityShape, NetStateSnapshot } from '../types/game';
import { ClubLogo, PosBadge, TeamIdentityBadge } from './ClubBadge';

interface IdentityViewProps {
  draft: DraftState;
  net: NetStateSnapshot;
  onUpdateIdentity: (
    teamIdx: number,
    patch: {
      name?: string;
      type?: 'custom' | 'club';
      shape?: IdentityShape;
      c1?: string;
      c2?: string;
      club?: string;
    }
  ) => void;
  onConfirmIdentity: (teamIdx: number) => void;
}

const COLOR_PRESETS: [string, string][] = [
  ['#166534', '#eab308'],
  ['#1e3a8a', '#38bdf8'],
  ['#991b1b', '#fde047'],
  ['#111827', '#22c55e'],
  ['#4c1d95', '#f472b6'],
  ['#ffffff', '#dc2626'],
];

export const IdentityView: React.FC<IdentityViewProps> = ({
  draft,
  net,
  onUpdateIdentity,
  onConfirmIdentity,
}) => {
  const humanIndices = useMemo(
    () =>
      draft.teams
        .map((t, idx) => (t.isHuman && (!net.connected || idx === net.myTeamIdx) ? idx : -1))
        .filter((idx) => idx >= 0),
    [draft.teams, net.connected, net.myTeamIdx]
  );

  const [selectedTeamIdx, setSelectedTeamIdx] = useState<number>(humanIndices[0] ?? 0);
  const [lgFilter, setLgFilter] = useState<string>('');

  const safeIdx = humanIndices.includes(selectedTeamIdx)
    ? selectedTeamIdx
    : humanIndices[0] ?? 0;
  const team = draft.teams[safeIdx];

  const clubsFiltered = useMemo(() => {
    if (!lgFilter) return ALL_CLUBS;
    return ALL_CLUBS.filter((c) => (CLUB_TO_LEAGUE[c] || 'Diğer Takımlar') === lgFilter);
  }, [lgFilter]);

  if (!team) return null;

  return (
    <section aria-label="Takım Kimliği ve Logo Tasarımı" className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <TeamIdentityBadge team={team} size={56} />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--pri-bright)]">
                ADIM 3 · TAKIM KİMLİĞİ &amp; ARMA
              </span>
              <h1 className="text-xl font-extrabold text-[var(--fg)]">
                Kulüp İsmini ve Logonu Belirle
              </h1>
              <p className="text-xs text-[var(--muted)]">
                Özel arma tasarla veya 77 gerçek kulüp logosundan birini seçip diziliş tahtasına geç.
              </p>
            </div>
          </div>

          {humanIndices.length > 1 && (
            <div className="flex gap-2">
              {humanIndices.map((idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-pressed={safeIdx === idx}
                  onClick={() => setSelectedTeamIdx(idx)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                    safeIdx === idx
                      ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                      : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)]'
                  }`}
                >
                  {draft.teams[idx].name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <div>
            <label
              htmlFor="identity-team-name"
              className="mb-1.5 block text-xs font-bold text-[var(--muted)]"
            >
              Kulüp Adı
            </label>
            <input
              id="identity-team-name"
              type="text"
              value={team.name}
              onChange={(e) => onUpdateIdentity(safeIdx, { name: e.target.value })}
              maxLength={28}
              placeholder="Kulüp adını yaz..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm font-semibold text-[var(--fg)] focus:border-[var(--pri-bright)] focus:outline-none"
            />
          </div>

          <div>
            <span className="mb-2 block text-xs font-bold text-[var(--muted)]">Logo Tipi</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={team.customIdentity.type === 'custom'}
                onClick={() => onUpdateIdentity(safeIdx, { type: 'custom' })}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  team.customIdentity.type === 'custom'
                    ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                    : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white'
                }`}
              >
                Özel Arma Tasarla
              </button>
              <button
                type="button"
                aria-pressed={team.customIdentity.type === 'club'}
                onClick={() => onUpdateIdentity(safeIdx, { type: 'club' })}
                className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  team.customIdentity.type === 'club'
                    ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                    : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white'
                }`}
              >
                Hazır Kulüp Logosu Seç
              </button>
            </div>
          </div>

          {team.customIdentity.type === 'custom' ? (
            <div className="space-y-4">
              <div>
                <span className="mb-2 block text-xs font-bold text-[var(--muted)]">
                  Arma Şekli
                </span>
                <div className="flex flex-wrap gap-2">
                  {CUSTOM_SHAPES.map((sh) => (
                    <button
                      key={sh.id}
                      type="button"
                      aria-pressed={team.customIdentity.shape === sh.id}
                      onClick={() => onUpdateIdentity(safeIdx, { shape: sh.id })}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                        team.customIdentity.shape === sh.id
                          ? 'border-[var(--pri-bright)] bg-[var(--accent)] text-white'
                          : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)]'
                      }`}
                    >
                      {sh.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="identity-c1"
                    className="mb-1 block text-xs font-semibold text-[var(--muted)]"
                  >
                    Ana Renk
                  </label>
                  <input
                    id="identity-c1"
                    type="color"
                    value={team.customIdentity.c1}
                    onChange={(e) => onUpdateIdentity(safeIdx, { c1: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--card)] p-1"
                  />
                </div>
                <div>
                  <label
                    htmlFor="identity-c2"
                    className="mb-1 block text-xs font-semibold text-[var(--muted)]"
                  >
                    İkincil Renk
                  </label>
                  <input
                    id="identity-c2"
                    type="color"
                    value={team.customIdentity.c2}
                    onChange={(e) => onUpdateIdentity(safeIdx, { c2: e.target.value })}
                    className="h-10 w-full cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--card)] p-1"
                  />
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
                  Hazır Renk Kombinasyonları
                </span>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map(([c1, c2]) => (
                    <button
                      key={`${c1}_${c2}`}
                      type="button"
                      aria-label={`Renk paleti ${c1} ve ${c2}`}
                      onClick={() => onUpdateIdentity(safeIdx, { c1, c2 })}
                      className="flex h-8 w-12 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)]"
                    >
                      <span className="h-full w-1/2" style={{ backgroundColor: c1 }} />
                      <span className="h-full w-1/2" style={{ backgroundColor: c2 }} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="identity-lg-filter"
                  className="mb-1 block text-xs font-semibold text-[var(--muted)]"
                >
                  Lig Filtresi
                </label>
                <select
                  id="identity-lg-filter"
                  value={lgFilter}
                  onChange={(e) => setLgFilter(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--fg)]"
                >
                  <option value="">Tüm Kulüpler</option>
                  {ALL_LEAGUES.map((lg) => (
                    <option key={lg} value={lg}>
                      {lg}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5">
                {clubsFiltered.map((club) => {
                  const active = team.customIdentity.club === club;
                  return (
                    <button
                      key={club}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onUpdateIdentity(safeIdx, { club })}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                        active
                          ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[var(--raised)]'
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
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <div>
            <h2 className="mb-2 text-sm font-bold text-[var(--fg)]">
              Kadro Özeti ({team.picks.length} Oyuncu)
            </h2>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {team.picks.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <PosBadge pos={p.pos} />
                    <span className="truncate font-semibold text-[var(--fg)]">{p.n}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ClubLogo club={p.c} size={16} />
                    <span className="text-[11px] text-[var(--muted)]">{p.c}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => onConfirmIdentity(safeIdx)}
              className="w-full rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-4 py-3 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(34,197,94,0.65)] transition hover:bg-[#15803d]"
            >
              Takım Kimliğini Onayla &amp; Dizilişe Geç →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
