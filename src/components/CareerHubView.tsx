import React, { useMemo, useState } from 'react';
import type { CareerEventChoice, LeagueState, LeagueTab, Team } from '../types/game';
import { getSortedStandings, getSuspendedPlayersForTeam } from '../utils/careerLogic';
import { ClubLogo, MediaLogoBadge, TeamIdentityBadge } from './ClubBadge';

interface CareerHubViewProps {
  league: LeagueState;
  teams: Team[];
  myTeamIdx?: number;
  onSwitchTab: (tab: LeagueTab) => void;
  onChangeViewWeek: (weekNum: number) => void;
  onPlayNextMatch: () => void;
  onSimulateSeason: () => void;
  onEditLineup: () => void;
  onResetToSetup: () => void;
  onResolveEventChoice: (choice: CareerEventChoice) => string;
  onDismissEvent: () => void;
  onDismissNews: () => void;
}

export const CareerHubView: React.FC<CareerHubViewProps> = ({
  league,
  teams,
  myTeamIdx = 0,
  onSwitchTab,
  onChangeViewWeek,
  onPlayNextMatch,
  onSimulateSeason,
  onEditLineup,
  onResetToSetup,
  onResolveEventChoice,
  onDismissEvent,
  onDismissNews,
}) => {
  const [eventOutcomeText, setEventOutcomeText] = useState<string | null>(null);

  const standings = useMemo(() => getSortedStandings(league), [league]);
  const seasonOver = league.week > league.maxWeeks;
  const currentRoundMatches = !seasonOver ? league.schedule[league.week - 1] || [] : [];

  const nextUserMatch =
    currentRoundMatches.find((m) => !m.done && (teams[m.a]?.isHuman || teams[m.b]?.isHuman)) ||
    currentRoundMatches.find((m) => m.a === myTeamIdx || m.b === myTeamIdx) ||
    null;

  const activeUserIdx = nextUserMatch
    ? teams[nextUserMatch.a]?.isHuman
      ? nextUserMatch.a
      : nextUserMatch.b
    : teams[myTeamIdx]?.isHuman
    ? myTeamIdx
    : 0;
  const userRank = standings.findIndex((r) => r.teamIdx === activeUserIdx) + 1;
  const userTeam = teams[activeUserIdx] || teams[0];

  const nextOppIdx = nextUserMatch
    ? nextUserMatch.a === activeUserIdx
      ? nextUserMatch.b
      : nextUserMatch.a
    : null;
  const nextOppTeam = nextOppIdx != null ? teams[nextOppIdx] : undefined;
  const oppSuspendedPlayers = useMemo(
    () => getSuspendedPlayersForTeam(league, nextOppTeam),
    [league, nextOppTeam]
  );
  const userSuspendedPlayers = useMemo(
    () => getSuspendedPlayersForTeam(league, userTeam),
    [league, userTeam]
  );

  const viewWeekMatches = league.schedule[league.viewWeek - 1] || [];

  const topScorers = useMemo(
    () =>
      Object.values(league.playerStats)
        .filter((s) => s.goals > 0)
        .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
        .slice(0, 15),
    [league.playerStats]
  );

  const topAssisters = useMemo(
    () =>
      Object.values(league.playerStats)
        .filter((s) => s.assists > 0)
        .sort((a, b) => b.assists - a.assists || b.goals - a.goals)
        .slice(0, 15),
    [league.playerStats]
  );

  const championRow = standings[0];
  const championTeam = championRow ? teams[championRow.teamIdx] : undefined;

  return (
    <section aria-label="Premier Lig Kariyer Merkezi" className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[#0f151c] to-[#090c10] p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <TeamIdentityBadge team={userTeam} size={50} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[var(--pri)]/40 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--pri-bright)]">
                  {league.leagueName} · {league.maxWeeks} Haftalık Tam Sezon
                </span>
                <span className="font-mono-tab text-xs font-bold text-amber-300">
                  {seasonOver
                    ? 'Sezon Tamamlandı'
                    : `Hafta ${league.week} / ${league.maxWeeks}`}
                </span>
              </div>
              <h1 className="mt-0.5 text-2xl font-extrabold text-[var(--fg)]">
                {userTeam?.name || 'Kulübün'}
              </h1>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                <span>
                  Sıralama: <strong className="text-white">{userRank}.</strong>
                </span>
                <span>
                  Kulüp Kasası:{' '}
                  <strong className="font-mono-tab text-emerald-300">{league.clubFunds} M€</strong>
                </span>
                <span>
                  Sponsor: <strong className="text-white">{league.sponsorName}</strong>
                </span>
                <span>
                  Moral:{' '}
                  <strong
                    className={
                      league.moraleMod >= 0 ? 'text-emerald-300' : 'text-red-300'
                    }
                  >
                    {league.moraleMod >= 0 ? `+${league.moraleMod}%` : `${league.moraleMod}%`}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onEditLineup}
              className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3.5 py-2 text-xs font-semibold hover:bg-[var(--accent)]"
            >
              Kadro &amp; Taktik
            </button>
            {!seasonOver && (
              <button
                type="button"
                onClick={onSimulateSeason}
                className="rounded-lg border border-amber-400/50 bg-amber-900/45 px-3.5 py-2 text-xs font-bold text-amber-100 hover:bg-amber-800/65"
              >
                Sezonu Tamamla (Hızlı Simülasyon)
              </button>
            )}
          </div>
        </div>

        {seasonOver && championTeam ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/50 bg-amber-950/35 p-4">
            <div className="flex items-center gap-3">
              <TeamIdentityBadge team={championTeam} size={40} />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  38 HAFTALIK SEZON ŞAMPİYONU
                </div>
                <div className="text-lg font-extrabold text-white">
                  {championTeam.name} ({championRow.pts} Puan)
                </div>
                <div className="text-xs text-amber-100/80">
                  Senin sıralaman: {userRank}. sıra ({standings.find((r) => r.teamIdx === 0)?.pts ?? 0} puan)
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onResetToSetup}
              className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-4 py-2 text-xs font-bold text-white"
            >
              Yeni Kariyer Başlat
            </button>
          </div>
        ) : nextUserMatch && nextOppTeam ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[#0b1016]/90 p-3.5">
            <div className="space-y-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Sıradaki Maç · {league.week}. Hafta ({nextUserMatch.a === activeUserIdx ? 'İç Saha' : 'Deplasman'})
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-sm font-bold text-[var(--fg)]">
                <span className="inline-flex items-center gap-1.5">
                  <TeamIdentityBadge team={teams[nextUserMatch.a]} size={22} />
                  {teams[nextUserMatch.a].name}
                </span>
                <span className="text-xs text-[var(--muted)]">vs</span>
                <span className="inline-flex items-center gap-1.5">
                  <TeamIdentityBadge team={teams[nextUserMatch.b]} size={22} />
                  {teams[nextUserMatch.b].name}
                </span>
              </div>

              {(oppSuspendedPlayers.length > 0 || userSuspendedPlayers.length > 0) && (
                <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
                  {oppSuspendedPlayers.length > 0 && (
                    <span className="rounded border border-red-500/40 bg-red-950/50 px-2 py-0.5 text-red-200">
                      {nextOppTeam.name} Cezalı: {oppSuspendedPlayers.map((p) => p.n).join(', ')}
                    </span>
                  )}
                  {userSuspendedPlayers.length > 0 && (
                    <span className="rounded border border-amber-500/40 bg-amber-950/50 px-2 py-0.5 text-amber-200">
                      Takımında Cezalı: {userSuspendedPlayers.map((p) => p.n).join(', ')}
                    </span>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onPlayNextMatch}
              className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-5 py-2.5 text-xs font-bold text-white shadow-[0_8px_22px_-6px_rgba(34,197,94,0.65)] transition hover:bg-[#15803d]"
            >
              {league.week}. Hafta Maçına Çık →
            </button>
          </div>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Kariyer Sekmeleri"
        className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"
      >
        {(
          [
            ['standings', `Puan Durumu (${teams.length} Takım)`],
            ['fixtures', 'Haftalık Fikstür & Sonuçlar'],
            ['leaders', 'Gol & Asist Krallığı'],
            ['news', `Lig Haberleri (${league.newsFeed.length})`],
          ] as [LeagueTab, string][]
        ).map(([tabId, label]) => (
          <button
            key={tabId}
            type="button"
            role="tab"
            aria-selected={league.tab === tabId}
            onClick={() => onSwitchTab(tabId)}
            className={`rounded-lg border px-3.5 py-2 text-xs font-bold transition ${
              league.tab === tabId
                ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                : 'border-transparent bg-[var(--card)] text-[var(--muted)] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {league.tab === 'standings' && (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <table className="w-full min-w-[600px] border-collapse text-left text-xs">
            <thead className="border-b border-[var(--border)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-2 py-2.5">#</th>
                <th className="px-2 py-2.5">Takım</th>
                <th className="px-2 py-2.5 text-center">O</th>
                <th className="px-2 py-2.5 text-center">G</th>
                <th className="px-2 py-2.5 text-center">B</th>
                <th className="px-2 py-2.5 text-center">M</th>
                <th className="px-2 py-2.5 text-center">AG</th>
                <th className="px-2 py-2.5 text-center">YG</th>
                <th className="px-2 py-2.5 text-center">AV</th>
                <th className="px-2 py-2.5 text-right font-bold">P</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {standings.map((row, i) => {
                const rank = i + 1;
                const tm = teams[row.teamIdx];
                const gd = row.gf - row.ga;
                const isUser = !!tm?.isHuman;
                const zoneClass =
                  rank <= 4
                    ? 'border-l-4 border-l-emerald-500'
                    : rank <= 6
                    ? 'border-l-4 border-l-sky-500'
                    : rank >= 18
                    ? 'border-l-4 border-l-red-500'
                    : 'border-l-4 border-l-transparent';

                return (
                  <tr
                    key={row.teamIdx}
                    className={`${zoneClass} ${
                      isUser ? 'bg-[#14241e]/80 font-bold' : 'hover:bg-[var(--raised)]/60'
                    }`}
                  >
                    <td className="px-2 py-2 font-mono-tab">{rank}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <TeamIdentityBadge team={tm} size={20} />
                        <span className="truncate text-[var(--fg)]">{tm?.name}</span>
                        {isUser && (
                          <span className="rounded bg-[var(--pri)] px-1.5 py-0.5 text-[10px] text-white">
                            {row.teamIdx === activeUserIdx ? 'SEN' : 'OYUNCU'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center font-mono-tab">{row.played}</td>
                    <td className="px-2 py-2 text-center font-mono-tab text-emerald-300">{row.w}</td>
                    <td className="px-2 py-2 text-center font-mono-tab">{row.d}</td>
                    <td className="px-2 py-2 text-center font-mono-tab text-red-300">{row.l}</td>
                    <td className="px-2 py-2 text-center font-mono-tab">{row.gf}</td>
                    <td className="px-2 py-2 text-center font-mono-tab">{row.ga}</td>
                    <td className="px-2 py-2 text-center font-mono-tab">
                      {gd > 0 ? `+${gd}` : gd}
                    </td>
                    <td className="px-2 py-2 text-right font-mono-tab text-sm font-extrabold text-[var(--pri-bright)]">
                      {row.pts}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {league.tab === 'fixtures' && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <h2 className="text-sm font-bold text-[var(--fg)]">
              {league.viewWeek}. Hafta Maçları ({league.maxWeeks} Haftalık Fikstür)
            </h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={league.viewWeek <= 1}
                onClick={() => onChangeViewWeek(Math.max(1, league.viewWeek - 1))}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-bold disabled:opacity-40"
              >
                ← Önceki
              </button>
              <label htmlFor="fixture-week-select" className="sr-only">
                Hafta seçin
              </label>
              <select
                id="fixture-week-select"
                value={league.viewWeek}
                onChange={(e) => onChangeViewWeek(Number(e.target.value))}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--fg)]"
              >
                {Array.from({ length: league.maxWeeks }, (_, idx) => idx + 1).map((w) => (
                  <option key={w} value={w}>
                    {w}. Hafta {w === league.week ? '(Aktif)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={league.viewWeek >= league.maxWeeks}
                onClick={() => onChangeViewWeek(Math.min(league.maxWeeks, league.viewWeek + 1))}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-bold disabled:opacity-40"
              >
                Sonraki →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {viewWeekMatches.map((m, idx) => {
              const tA = teams[m.a];
              const tB = teams[m.b];
              const isUserMatch = !!tA?.isHuman || !!tB?.isHuman;
              return (
                <div
                  key={`${league.viewWeek}_${idx}`}
                  data-testid="fixture-card"
                  className={`rounded-xl border px-2.5 py-2.5 sm:px-3 ${
                    isUserMatch
                      ? 'border-[var(--pri-bright)]/60 bg-[#111c19]'
                      : 'border-[var(--border)] bg-[var(--card)]'
                  }`}
                >
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 sm:gap-2.5">
                    <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
                      <span
                        title={tA?.name}
                        className={`min-w-0 truncate text-[11px] font-semibold sm:text-xs ${
                          tA?.isHuman ? 'font-bold text-[var(--pri-bright)]' : 'text-[var(--fg)]'
                        }`}
                      >
                        {tA?.name}
                      </span>
                      <TeamIdentityBadge team={tA} size={18} className="shrink-0 sm:h-5 sm:w-5" />
                    </div>

                    <div
                      data-testid="fixture-score-box"
                      className={`min-w-[54px] shrink-0 whitespace-nowrap rounded-lg border px-2 py-1 text-center font-mono-tab text-[11px] font-extrabold sm:w-16 sm:text-xs ${
                        m.done
                          ? 'border-[var(--pri-bright)]/40 bg-[#080c10] text-white'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
                      }`}
                    >
                      {m.done && m.sc ? `${m.sc[0]} - ${m.sc[1]}` : 'vs'}
                    </div>

                    <div className="flex min-w-0 items-center justify-start gap-1.5 text-left">
                      <TeamIdentityBadge team={tB} size={18} className="shrink-0 sm:h-5 sm:w-5" />
                      <span
                        title={tB?.name}
                        className={`min-w-0 truncate text-[11px] font-semibold sm:text-xs ${
                          tB?.isHuman ? 'font-bold text-[var(--pri-bright)]' : 'text-[var(--fg)]'
                        }`}
                      >
                        {tB?.name}
                      </span>
                    </div>
                  </div>

                  {m.redCards && m.redCards.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap justify-center gap-1.5 border-t border-[var(--border)]/60 pt-1.5 text-[10px] text-red-300">
                      {m.redCards.map((rc) => (
                        <span
                          key={`${rc.teamIdx}_${rc.playerId}`}
                          className="rounded bg-red-950/70 px-1.5 py-0.5 font-semibold"
                        >
                          🟥 {rc.playerName} ({teams[rc.teamIdx]?.name})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {league.tab === 'leaders' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
            <h2 className="mb-3 text-sm font-bold text-[var(--fg)]">Gol Krallığı</h2>
            {topScorers.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--muted)]">
                Henüz gol kaydedilmedi. İlk hafta maçını oynayın.
              </p>
            ) : (
              <div className="space-y-1.5">
                {topScorers.map((st, idx) => (
                  <div
                    key={`${st.teamIdx}_${st.name}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 font-mono-tab font-bold text-[var(--muted)]">
                        {idx + 1}.
                      </span>
                      {teams[st.teamIdx] ? (
                        <TeamIdentityBadge team={teams[st.teamIdx]} size={20} className="shrink-0" />
                      ) : (
                        <ClubLogo club={st.teamName} size={20} className="shrink-0" />
                      )}
                      <span className="truncate font-bold text-[var(--fg)]">{st.name}</span>
                      <span className="truncate text-[11px] text-[var(--muted)]">
                        ({st.teamName})
                      </span>
                    </div>
                    <span className="shrink-0 font-mono-tab font-extrabold text-[var(--pri-bright)]">
                      {st.goals} Gol
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
            <h2 className="mb-3 text-sm font-bold text-[var(--fg)]">Asist Krallığı</h2>
            {topAssisters.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--muted)]">
                Henüz asist kaydedilmedi. İlk hafta maçını oynayın.
              </p>
            ) : (
              <div className="space-y-1.5">
                {topAssisters.map((st, idx) => (
                  <div
                    key={`${st.teamIdx}_${st.name}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 font-mono-tab font-bold text-[var(--muted)]">
                        {idx + 1}.
                      </span>
                      {teams[st.teamIdx] ? (
                        <TeamIdentityBadge team={teams[st.teamIdx]} size={20} className="shrink-0" />
                      ) : (
                        <ClubLogo club={st.teamName} size={20} className="shrink-0" />
                      )}
                      <span className="truncate font-bold text-[var(--fg)]">{st.name}</span>
                      <span className="truncate text-[11px] text-[var(--muted)]">
                        ({st.teamName})
                      </span>
                    </div>
                    <span className="shrink-0 font-mono-tab font-extrabold text-amber-300">
                      {st.assists} Asist
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {league.tab === 'news' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
            <h2 className="text-sm font-bold text-[var(--fg)]">
              Basın Merkezi &amp; Lig Haberleri
            </h2>
            {league.newsFeed.map((item, idx) => (
              <article
                key={`${item.week}_${idx}_${item.title}`}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5"
              >
                <MediaLogoBadge source={item.source} clubLogoName={item.clubLogoName} />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--muted)]">
                    <span className="font-bold text-[var(--pri-bright)]">
                      {item.week}. Hafta
                    </span>
                    <span>·</span>
                    <span>{item.source}</span>
                  </div>
                  <h3 className="text-sm font-bold text-[var(--fg)]">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-[var(--muted)]">{item.body}</p>
                  {item.effectBadge && (
                    <span
                      className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${
                        item.effectPositive === true
                          ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                          : item.effectPositive === false
                          ? 'border-red-500/40 bg-red-950/50 text-red-300'
                          : 'border-[var(--border)] bg-[var(--raised)] text-[var(--fg)]'
                      }`}
                    >
                      {item.effectBadge}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="space-y-2.5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
            <h2 className="text-sm font-bold text-[var(--fg)]">Kulüp Karar Geçmişi</h2>
            {league.eventHistory.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--muted)]">
                Henüz kulüp kararı verilmedi.
              </p>
            ) : (
              league.eventHistory.map((ev, idx) => (
                <div
                  key={`${ev.week}_${idx}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs"
                >
                  <div className="font-bold text-amber-300">
                    {ev.week}. Hafta · {ev.title}
                  </div>
                  <p className="mt-1 text-[var(--muted)]">{ev.outcome}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {league.activeEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="career-event-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-xl rounded-2xl border border-amber-400/50 bg-[var(--surface)] p-5 shadow-2xl">
            <span className="inline-block rounded bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
              {league.activeEvent.tag}
            </span>
            <h2 id="career-event-title" className="mt-2 text-lg font-extrabold text-white">
              {league.activeEvent.title}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              {league.activeEvent.desc}
            </p>

            {eventOutcomeText ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 text-xs text-emerald-100">
                  {eventOutcomeText}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEventOutcomeText(null);
                    onDismissEvent();
                  }}
                  className="w-full rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] py-2.5 text-xs font-bold text-white"
                >
                  Devam Et
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {league.activeEvent.choices.map((ch, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const out = onResolveEventChoice(ch);
                      setEventOutcomeText(out);
                    }}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2.5 text-left text-xs font-semibold text-[var(--fg)] transition hover:border-[var(--pri-bright)] hover:bg-[var(--raised)]"
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!league.activeEvent && league.activeNews && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="career-news-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--pri-bright)]/50 bg-[var(--surface)] p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <MediaLogoBadge
                source={league.activeNews.source}
                clubLogoName={league.activeNews.clubLogoName}
              />
              <div>
                <span className="text-[11px] font-bold text-[var(--pri-bright)]">
                  {league.activeNews.source}
                </span>
                <h2 id="career-news-title" className="mt-0.5 text-base font-extrabold text-white">
                  {league.activeNews.title}
                </h2>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">
              {league.activeNews.body}
            </p>
            {league.activeNews.effectBadge && (
              <div className="mt-3">
                <span className="inline-block rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs font-bold text-amber-300">
                  {league.activeNews.effectBadge}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={onDismissNews}
              className="mt-4 w-full rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] py-2.5 text-xs font-bold text-white"
            >
              Tamam
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
