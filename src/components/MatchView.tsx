import React from 'react';
import { isPeerReadyForPhase } from '../services/onlineNet';
import type {
  DraftState,
  LeagueState,
  MatchState,
  NetStateSnapshot,
  TournamentState,
} from '../types/game';
import { getActiveTournamentMatch } from '../utils/matchEngine';
import { OnlineReadyBadges, TeamIdentityBadge } from './ClubBadge';

interface MatchViewProps {
  draft: DraftState;
  match: MatchState;
  tournament: TournamentState | null;
  league: LeagueState | null;
  net: NetStateSnapshot;
  onToggleKickoff: () => void;
  onSetSpeed: (speed: 1 | 2 | 4) => void;
  onFinishInstantly: () => void;
  onStartNextTournamentMatch: (a: number, b: number, id: string) => void;
  onBackAfterMatch: () => void;
}

export const MatchView: React.FC<MatchViewProps> = ({
  draft,
  match,
  tournament,
  league,
  net,
  onToggleKickoff,
  onSetSpeed,
  onFinishInstantly,
  onStartNextTournamentMatch,
  onBackAfterMatch,
}) => {
  const isCareer = !!draft.m.career;
  const teamA = draft.teams[match.a];
  const teamB = draft.teams[match.b];
  const finished = match.run === 0 && match.min >= match.plan.maxMin;
  const activeTourneyMatch = !isCareer ? getActiveTournamentMatch(tournament) : null;

  const matchKey = `${match.a}_${match.b}_${match.tourneyMatchId || 'career'}`;
  const kickoffPhase = `match_kickoff_${matchKey}`;
  const instantPhase = `match_instant_${matchKey}`;
  const donePhase = `match_done_${matchKey}`;

  const myKickoffReady = isPeerReadyForPhase(net, kickoffPhase, net.myTeamIdx);
  const myInstantReady = isPeerReadyForPhase(net, instantPhase, net.myTeamIdx);
  const myDoneReady = isPeerReadyForPhase(net, donePhase, net.myTeamIdx);

  const currentMatchWeek = match.careerWeek ?? (league ? league.week : 1);
  const nextHumanCareerMatch =
    isCareer && league && currentMatchWeek <= league.maxWeeks
      ? (league.schedule[currentMatchWeek - 1] || []).find(
          (m) =>
            !m.done &&
            !(m.a === match.a && m.b === match.b) &&
            (draft.teams[m.a]?.isHuman || draft.teams[m.b]?.isHuman)
        ) || null
      : null;

  const statRows: { label: string; left: string | number; right: string | number; lVal: number; rVal: number }[] = [
    { label: 'Toplam Şut', left: match.shots[0], right: match.shots[1], lVal: match.shots[0], rVal: match.shots[1] },
    { label: 'İsabetli Şut', left: match.onTarget[0], right: match.onTarget[1], lVal: match.onTarget[0], rVal: match.onTarget[1] },
    { label: 'Kurtarış', left: match.saves[0], right: match.saves[1], lVal: match.saves[0], rVal: match.saves[1] },
    { label: 'Gol Beklentisi (xG)', left: match.xg[0].toFixed(2), right: match.xg[1].toFixed(2), lVal: match.xg[0], rVal: match.xg[1] },
    { label: 'Kırmızı Kart', left: match.redCards[0], right: match.redCards[1], lVal: match.redCards[0], rVal: match.redCards[1] },
  ];

  return (
    <section aria-label="Maç Simülasyonu" className="space-y-4">
      {!isCareer && tournament && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[var(--fg)]">Turnuva Ağacı</h2>
            {tournament.champion != null && (
              <span className="rounded-lg border border-amber-400/60 bg-amber-900/50 px-3 py-1 text-xs font-extrabold text-amber-200">
                ŞAMPİYON: {draft.teams[tournament.champion]?.name}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {tournament.matches.map((tm) => {
              const tA = tm.a != null ? draft.teams[tm.a] : null;
              const tB = tm.b != null ? draft.teams[tm.b] : null;
              const isCurr = match.tourneyMatchId === tm.id;
              return (
                <div
                  key={tm.id}
                  className={`rounded-xl border p-3 text-xs ${
                    isCurr
                      ? 'border-[var(--pri-bright)] bg-[#131c21]'
                      : 'border-[var(--border)] bg-[var(--card)]'
                  }`}
                >
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    {tm.title}
                  </div>
                  <div className="flex items-center justify-between font-semibold text-[var(--fg)]">
                    <span className="truncate">{tA ? tA.name : 'Bekleniyor'}</span>
                    <span className="font-mono-tab font-extrabold">
                      {tm.done && tm.sc
                        ? `${tm.sc[0]} - ${tm.sc[1]}${tm.pen ? ` (${tm.pen[0]}-${tm.pen[1]})` : ''}`
                        : 'vs'}
                    </span>
                    <span className="truncate text-right">{tB ? tB.name : 'Bekleniyor'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#0f151c] to-[#080b0f] p-5 shadow-xl">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          <div className="flex min-w-0 items-center justify-end gap-3 text-right">
            <div className="min-w-0">
              <div className="truncate font-disp text-lg font-extrabold text-white sm:text-xl">
                {teamA?.name}
              </div>
            </div>
            <TeamIdentityBadge team={teamA} size={46} className="shrink-0" />
          </div>

          <div className="flex flex-col items-center">
            <span className="mb-1 rounded bg-black/45 px-2.5 py-0.5 font-mono-tab text-xs font-bold text-[var(--pri-bright)]">
              {finished ? 'MAÇ SONUCU' : `${match.min}'`}
            </span>
            <div
              data-testid="match-scoreboard"
              className="rounded-2xl border border-[var(--pri-bright)]/45 bg-[#070a0e] px-5 py-2 font-mono-tab text-3xl font-extrabold text-white shadow-inner"
            >
              {match.sc[0]} - {match.sc[1]}
            </div>
            {match.penSc && (
              <span className="mt-1 text-xs font-bold text-amber-300">
                Penaltılar: {match.penSc[0]} - {match.penSc[1]}
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-center justify-start gap-3 text-left">
            <TeamIdentityBadge team={teamB} size={46} className="shrink-0" />
            <div className="min-w-0">
              <div className="truncate font-disp text-lg font-extrabold text-white sm:text-xl">
                {teamB?.name}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 border-t border-[var(--border)] pt-3">
          {!finished && (
            <>
              {net.connected && match.min === 0 && !match.run && (
                <OnlineReadyBadges net={net} phase={kickoffPhase} />
              )}
              {(!net.connected || (match.min === 0 && !match.run)) && (
                <button
                  type="button"
                  onClick={onToggleKickoff}
                  className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-4 py-2 text-xs font-bold text-white hover:bg-[#15803d]"
                >
                  {net.connected
                    ? myKickoffReady
                      ? 'Hazır ✓ (Diğer Oyuncu Bekleniyor...)'
                      : 'Santra İçin Hazır Ol ▶'
                    : match.run
                    ? 'Duraklat ❚❚'
                    : match.min > 0
                    ? 'Devam Et ▶'
                    : 'Maçı Başlat ▶'}
                </button>
              )}
              {([1, 2, 4] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  aria-pressed={match.speed === spd}
                  onClick={() => onSetSpeed(spd)}
                  className={`rounded-lg border px-3 py-2 font-mono-tab text-xs font-bold ${
                    match.speed === spd
                      ? 'border-amber-400 bg-amber-800/70 text-amber-100'
                      : 'border-[var(--border)] bg-[var(--raised)] text-[var(--muted)]'
                  }`}
                >
                  {spd}x
                </button>
              ))}
              {net.connected && net.readyPhase === instantPhase && (
                <OnlineReadyBadges net={net} phase={instantPhase} />
              )}
              <button
                type="button"
                onClick={onFinishInstantly}
                className="rounded-xl border border-amber-400/50 bg-amber-900/50 px-4 py-2 text-xs font-bold text-amber-100 hover:bg-amber-800/70"
              >
                {net.connected
                  ? myInstantReady
                    ? 'Hızlı Bitir: Hazır ✓ (Diğer Oyuncu Bekleniyor...)'
                    : 'Hızlı Bitirmek İçin Hazır Ol ⏭'
                  : 'Maçı Anında Bitir ⏭'}
              </button>
            </>
          )}

          {finished && (
            <>
              {net.connected && <OnlineReadyBadges net={net} phase={donePhase} />}
              {isCareer && league && (
                <button
                  type="button"
                  onClick={onBackAfterMatch}
                  className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-5 py-2.5 text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(34,197,94,0.65)]"
                >
                  {nextHumanCareerMatch
                    ? net.connected
                      ? myDoneReady
                        ? 'Hazır ✓ (Diğer Oyuncu Bekleniyor...)'
                        : `Haftanın 2. Maçı İçin Hazır Ol (${draft.teams[nextHumanCareerMatch.a]?.name} vs ${draft.teams[nextHumanCareerMatch.b]?.name}) →`
                      : `Haftanın 2. Maçına Geç (${draft.teams[nextHumanCareerMatch.a]?.name} vs ${draft.teams[nextHumanCareerMatch.b]?.name}) →`
                    : net.connected
                    ? myDoneReady
                      ? 'Hazır ✓ (Diğer Oyuncu Bekleniyor...)'
                      : 'Yeni Haftaya Geçmek İçin Hazır Ol →'
                    : `${league.leagueName || 'Premier Lig'} Merkezine Dön →`}
                </button>
              )}
              {!isCareer &&
                activeTourneyMatch &&
                !activeTourneyMatch.done &&
                activeTourneyMatch.a != null &&
                activeTourneyMatch.b != null && (
                  <button
                    type="button"
                    onClick={() =>
                      onStartNextTournamentMatch(
                        activeTourneyMatch.a!,
                        activeTourneyMatch.b!,
                        activeTourneyMatch.id
                      )
                    }
                    className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-5 py-2.5 text-xs font-bold text-white"
                  >
                    {net.connected
                      ? myDoneReady
                        ? 'Hazır ✓ (Diğer Oyuncu Bekleniyor...)'
                        : `Sıradaki Maç (${activeTourneyMatch.title}) İçin Hazır Ol →`
                      : `Sıradaki Maç: ${activeTourneyMatch.title} →`}
                  </button>
                )}
              {!isCareer && (!activeTourneyMatch || activeTourneyMatch.done) && (
                <button
                  type="button"
                  onClick={onBackAfterMatch}
                  className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-5 py-2.5 text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(34,197,94,0.65)]"
                >
                  {net.connected
                    ? myDoneReady
                      ? 'Hazır ✓ (Diğer Oyuncu Bekleniyor...)'
                      : 'Ana Menüye Dönmek İçin Hazır Ol →'
                    : 'Ana Menüye Dön →'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.1fr_1fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-lg">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--pri-bright)]">
            {teamA?.name} · İlk 11
          </h3>
          <div className="space-y-1">
            {match.sa.pitchRows.flatMap((r) => r.players).map((p) => {
              const st = match.playerStats[p.id];
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                    st?.red
                      ? 'border-red-500/60 bg-red-950/50'
                      : match.lastHighlightGoal === p.id
                      ? 'border-emerald-400 bg-emerald-950/60'
                      : 'border-[var(--border)] bg-[var(--card)]'
                  }`}
                >
                  <span className="truncate font-semibold text-[var(--fg)]">{p.n}</span>
                  <div className="flex shrink-0 items-center gap-1 font-mono-tab text-[10px]">
                    {st && st.goals > 0 && (
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 font-bold text-white">
                        ⚽ {st.goals}
                      </span>
                    )}
                    {st && st.assists > 0 && (
                      <span className="rounded bg-sky-700 px-1.5 py-0.5 font-bold text-white">
                        🅰 {st.assists}
                      </span>
                    )}
                    {st?.red && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 font-bold text-white">
                        🟥 K.Kart
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
            <h3 className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Canlı İstatistikler
            </h3>
            <div className="space-y-2.5">
              {statRows.map((row) => {
                const total = row.lVal + row.rVal || 1;
                const lPct = Math.round((row.lVal / total) * 100);
                return (
                  <div key={row.label} className="space-y-1 text-xs">
                    <div className="flex justify-between font-mono-tab">
                      <span className="font-bold text-white">{row.left}</span>
                      <span className="text-[11px] text-[var(--muted)]">{row.label}</span>
                      <span className="font-bold text-white">{row.right}</span>
                    </div>
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--raised)]">
                      <div
                        className="bg-emerald-500 transition-all"
                        style={{ width: `${row.lVal === row.rVal ? 50 : lPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Maç Anlatımı
            </h3>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {[...match.log].reverse().map((entry, idx) => (
                <div
                  key={`${entry.min}_${idx}`}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                    entry.isRed
                      ? 'border-red-500/60 bg-red-950/50 text-red-100'
                      : entry.isGoal
                      ? 'border-emerald-500/60 bg-emerald-950/45 text-emerald-100'
                      : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)]'
                  }`}
                >
                  <span className="mr-1.5 font-mono-tab font-bold text-white">
                    {typeof entry.min === 'number' ? `${entry.min}'` : entry.min}
                  </span>
                  <span>{entry.text}</span>
                </div>
              ))}
              {match.log.length === 0 && (
                <p className="py-4 text-center text-xs text-[var(--muted)]">
                  Maç başlamayı bekliyor...
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-lg">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            {teamB?.name} · İlk 11
          </h3>
          <div className="space-y-1">
            {match.sb.pitchRows.flatMap((r) => r.players).map((p) => {
              const st = match.playerStats[p.id];
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${
                    st?.red
                      ? 'border-red-500/60 bg-red-950/50'
                      : match.lastHighlightGoal === p.id
                      ? 'border-emerald-400 bg-emerald-950/60'
                      : 'border-[var(--border)] bg-[var(--card)]'
                  }`}
                >
                  <span className="truncate font-semibold text-[var(--fg)]">{p.n}</span>
                  <div className="flex shrink-0 items-center gap-1 font-mono-tab text-[10px]">
                    {st && st.goals > 0 && (
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 font-bold text-white">
                        ⚽ {st.goals}
                      </span>
                    )}
                    {st && st.assists > 0 && (
                      <span className="rounded bg-sky-700 px-1.5 py-0.5 font-bold text-white">
                        🅰 {st.assists}
                      </span>
                    )}
                    {st?.red && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 font-bold text-white">
                        🟥 K.Kart
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
