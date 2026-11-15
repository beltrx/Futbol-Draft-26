import React, { useMemo, useState } from 'react';
import { FORMATIONS } from '../data/database';
import { isPeerReadyForPhase } from '../services/onlineNet';
import type {
  DraftState,
  FormationName,
  LeagueState,
  NetStateSnapshot,
} from '../types/game';
import {
  buildPitchRowsForTeam,
  isPlayerSuspendedInCareer,
  isPlayerUnavailableInCareer,
} from '../utils/lineupLogic';
import {
  ClubLogo,
  LeagueLogo,
  OnlineReadyBadges,
  PosBadge,
  TeamIdentityBadge,
} from './ClubBadge';

interface LineupViewProps {
  draft: DraftState;
  league: LeagueState | null;
  careerLeague?: string;
  net: NetStateSnapshot;
  swapError: string;
  onSelectFormation: (teamIdx: number, formation: FormationName) => void;
  onAutoLineup: (teamIdx: number) => void;
  onSwapPlayers: (teamIdx: number, id1: number, id2: number) => void;
  onChangeCareerLeague?: (leagueName: string) => void;
  onProceed: () => void;
  onEditIdentity: () => void;
}

const FORMATION_NAMES: FormationName[] = ['4-3-3', '4-2-3-1', '4-4-2', '3-5-2'];

export const LineupView: React.FC<LineupViewProps> = ({
  draft,
  league,
  careerLeague = 'Premier Lig',
  net,
  swapError,
  onSelectFormation,
  onAutoLineup,
  onSwapPlayers,
  onChangeCareerLeague,
  onProceed,
  onEditIdentity,
}) => {
  const isCareer = !!draft.m.career;
  const activeLeagueName = league?.leagueName || careerLeague || 'Premier Lig';
  const isGuest = net.connected && net.role === 'guest';
  const selectableTeams = useMemo(() => {
    if (net.connected) return [net.myTeamIdx];
    if (isCareer) {
      const humans = draft.teams.map((t, idx) => (t.isHuman ? idx : -1)).filter((i) => i >= 0);
      return humans.length ? humans : [0];
    }
    return draft.teams.map((_, idx) => idx);
  }, [isCareer, net.connected, net.myTeamIdx, draft.teams]);

  const [activeTeamIdx, setActiveTeamIdx] = useState<number>(selectableTeams[0] ?? 0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);

  const safeIdx = selectableTeams.includes(activeTeamIdx)
    ? activeTeamIdx
    : selectableTeams[0] ?? 0;
  const team = draft.teams[safeIdx];

  if (!team) return null;

  const pitchRows = buildPitchRowsForTeam(team, league, isCareer);

  const handlePlayerClick = (playerId: number) => {
    if (!team.isHuman && !isCareer) return;
    if (selectedPlayerId === null) {
      setSelectedPlayerId(playerId);
      return;
    }
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
      return;
    }
    onSwapPlayers(safeIdx, selectedPlayerId, playerId);
    setSelectedPlayerId(null);
  };

  const myReady = isPeerReadyForPhase(net, 'lineup', net.myTeamIdx);

  return (
    <section aria-label="Kadro Dizilişi ve İlk 11" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <TeamIdentityBadge team={team} size={42} />
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--pri-bright)]">
              TAKTİK TAHTASI · 11 ASİL + 3 YEDEK
            </span>
            <h1 className="text-xl font-extrabold text-[var(--fg)]">{team.name}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCareer && !league && onChangeCareerLeague && (
            <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
              {(['Premier Lig', 'Bundesliga'] as const).map((lgName) => {
                const selected = activeLeagueName === lgName;
                return (
                  <button
                    key={lgName}
                    type="button"
                    disabled={isGuest}
                    onClick={() => onChangeCareerLeague(lgName)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      selected
                        ? 'bg-[var(--pri)] text-white'
                        : 'text-[var(--muted)] hover:text-white'
                    }`}
                  >
                    <LeagueLogo league={lgName} size={15} />
                    <span>{lgName}</span>
                  </button>
                );
              })}
            </div>
          )}
          {net.connected && !league && <OnlineReadyBadges net={net} phase="lineup" />}
          {!net.connected && (
            <button
              type="button"
              onClick={onEditIdentity}
              className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-xs font-semibold hover:bg-[var(--accent)]"
            >
              ← Takım Kimliği
            </button>
          )}
          <button
            type="button"
            onClick={onProceed}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-4 py-2 text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(34,197,94,0.6)] hover:bg-[#15803d]"
          >
            {isCareer && <LeagueLogo league={activeLeagueName} size={16} />}
            <span>
              {isCareer
                ? league
                  ? `Kaydet & ${activeLeagueName} Merkezine Dön →`
                  : net.connected
                  ? myReady
                    ? 'Hazır ✓ (Diğer Oyuncu Bekleniyor...)'
                    : `Hazır Ol & ${activeLeagueName}'e Katıl →`
                  : `${activeLeagueName}'e Katıl →`
                : net.connected
                ? myReady
                  ? 'Hazır ✓ (Diğer Oyuncu Bekleniyor...)'
                  : 'Hazır Ol & Maça Geç →'
                : 'Turnuva & Maça Geç →'}
            </span>
          </button>
        </div>
      </div>

      {selectableTeams.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {selectableTeams.map((idx) => (
            <button
              key={idx}
              type="button"
              aria-pressed={safeIdx === idx}
              onClick={() => {
                setActiveTeamIdx(idx);
                setSelectedPlayerId(null);
              }}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                safeIdx === idx
                  ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                  : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white'
              }`}
            >
              <TeamIdentityBadge team={draft.teams[idx]} size={18} />
              <span>{draft.teams[idx].name}</span>
            </button>
          ))}
        </div>
      )}

      {swapError && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/45 bg-red-950/45 px-4 py-2.5 text-xs font-semibold text-red-200"
        >
          {swapError}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-[var(--muted)]">Diziliş:</span>
          {FORMATION_NAMES.map((fn) => {
            const active = (team.formation || '4-3-3') === fn;
            return (
              <button
                key={fn}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  onSelectFormation(safeIdx, fn);
                  setSelectedPlayerId(null);
                }}
                className={`rounded-lg border px-3 py-1 font-mono-tab text-xs font-bold ${
                  active
                    ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-white'
                }`}
              >
                {fn}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--muted)]">
            Yer değiştirmek için iki oyuncuya sırayla tıkla (mevki dışı uyum cezası uygulanır).
          </span>
          <button
            type="button"
            onClick={() => {
              onAutoLineup(safeIdx);
              setSelectedPlayerId(null);
            }}
            className="rounded-lg border border-amber-400/50 bg-amber-900/40 px-3 py-1 text-xs font-bold text-amber-100 hover:bg-amber-800/60"
          >
            Otomatik En İyi 11
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <div className="pitch-surface mx-auto max-w-[460px]" data-testid="lineup-pitch">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-[27%] bottom-0 h-[13%] rounded-t-sm border-2 border-b-0 border-[var(--line)]"
            />
            {pitchRows.map((row) => (
              <div
                key={row.label}
                data-pitch-row={row.pos}
                className="relative z-10 flex flex-col items-center gap-1"
              >
                <span className="rounded bg-black/45 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200/80">
                  {row.label} ({FORMATIONS[team.formation || '4-3-3'].quota[row.pos]} {row.pos})
                </span>
                <div className="flex w-full flex-wrap items-center justify-around gap-1 px-0.5 sm:gap-1.5 sm:px-1">
                  {row.players.map((p) => {
                    const outOfPos = p.pos !== row.pos;
                    const suspended = isPlayerSuspendedInCareer(p.id, league, isCareer);
                    const injured =
                      !suspended && isPlayerUnavailableInCareer(p.id, league, isCareer);
                    const isSelected = selectedPlayerId === p.id;
                    const wLeft = league?.injuries?.[p.id] || 0;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        title={`${p.n} · ${p.c}`}
                        onClick={() => handlePlayerClick(p.id)}
                        className={`flex min-w-[66px] max-w-[104px] flex-1 basis-0 flex-col items-center rounded-lg border px-1 py-1.5 text-center transition sm:min-w-[78px] sm:flex-none sm:basis-auto sm:px-1.5 ${
                          isSelected
                            ? 'scale-105 border-amber-300 bg-amber-900/85 ring-2 ring-amber-400/70'
                            : suspended || injured
                            ? 'border-red-500 bg-red-950/85'
                            : outOfPos
                            ? 'border-amber-400/70 bg-[#1c2312]/90'
                            : 'border-emerald-400/45 bg-[#081512]/90 hover:border-emerald-300'
                        }`}
                      >
                        <span className="w-full truncate text-[10px] font-bold text-emerald-50">
                          {p.n}
                        </span>
                        <div className="mt-0.5 flex items-center justify-center gap-1">
                          <ClubLogo club={p.c} size={14} />
                          <span className="text-[9px] font-semibold text-emerald-200/80">{p.pos}</span>
                          {outOfPos && (
                            <span className="text-[8px] font-bold text-amber-300">Uyumsuz</span>
                          )}
                        </div>
                        {suspended && (
                          <span className="mt-0.5 rounded bg-red-600 px-1 text-[8px] font-extrabold text-white">
                            CEZALI ({wLeft}M)
                          </span>
                        )}
                        {injured && (
                          <span className="mt-0.5 rounded bg-rose-700 px-1 text-[8px] font-extrabold text-white">
                            SAKAT ({wLeft}H)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
            <h2 className="mb-2.5 text-sm font-bold text-[var(--fg)]">
              Yedek Kulübesi ({(team.bench || []).length})
            </h2>
            <div className="space-y-1.5">
              {(team.bench || []).map((p) => {
                const suspended = isPlayerSuspendedInCareer(p.id, league, isCareer);
                const injured =
                  !suspended && isPlayerUnavailableInCareer(p.id, league, isCareer);
                const isSelected = selectedPlayerId === p.id;
                const wLeft = league?.injuries?.[p.id] || 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePlayerClick(p.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${
                      isSelected
                        ? 'border-amber-300 bg-amber-950/60 ring-1 ring-amber-400'
                        : suspended || injured
                        ? 'border-red-500/50 bg-red-950/35'
                        : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--raised)]'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <PosBadge pos={p.pos} />
                      <span className="truncate font-semibold text-[var(--fg)]">{p.n}</span>
                      {suspended && (
                        <span className="shrink-0 rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Cezalı ({wLeft}M · Oynayamaz)
                        </span>
                      )}
                      {injured && (
                        <span className="shrink-0 rounded bg-rose-700/90 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Sakat ({wLeft}H · Oynayamaz)
                        </span>
                      )}
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] text-[var(--muted)]">
                      <ClubLogo club={p.c} size={15} />
                      <span>{p.c}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
            <h2 className="mb-2.5 text-sm font-bold text-[var(--fg)]">
              İlk 11 Listesi ({(team.starters || []).length})
            </h2>
            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {pitchRows.flatMap((row) =>
                row.players.map((p) => {
                  const outOfPos = p.pos !== row.pos;
                  const isSelected = selectedPlayerId === p.id;
                  return (
                    <button
                      key={`${row.label}_${p.id}`}
                      type="button"
                      onClick={() => handlePlayerClick(p.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs ${
                        isSelected
                          ? 'border-amber-300 bg-amber-950/60'
                          : 'border-[var(--border)] bg-[var(--card)] hover:bg-[var(--raised)]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="w-8 shrink-0 font-mono text-[10px] font-bold text-[var(--muted)]">
                          {row.pos}
                        </span>
                        <PosBadge pos={p.pos} />
                        <span className="truncate font-semibold text-[var(--fg)]">{p.n}</span>
                        {outOfPos && (
                          <span className="shrink-0 text-[10px] font-bold text-amber-300">
                            Mevki Dışı
                          </span>
                        )}
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] text-[var(--muted)]">
                        <ClubLogo club={p.c} size={15} />
                        <span>{p.c}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
