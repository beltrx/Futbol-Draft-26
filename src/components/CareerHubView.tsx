import React, { useMemo, useState } from 'react';
import { CLUB_STADIUMS } from '../data/database';
import { UCL_BRAND_LOGOS } from '../data/logos';
import { isPeerReadyForPhase } from '../services/onlineNet';
import type {
  CareerEventChoice,
  LeagueState,
  LeagueTab,
  NetStateSnapshot,
  Team,
} from '../types/game';
import {
  getSortedStandings,
  getSuspendedPlayersForTeam,
  getUclWeekTitle,
} from '../utils/careerLogic';
import {
  ClubLogo,
  LeagueLogo,
  MediaLogoBadge,
  OnlineReadyBadges,
  TeamIdentityBadge,
} from './ClubBadge';

interface CareerHubViewProps {
  league: LeagueState;
  teams: Team[];
  net: NetStateSnapshot;
  myTeamIdx?: number;
  onSwitchTab: (tab: LeagueTab) => void;
  onChangeViewWeek: (weekNum: number) => void;
  onPlayNextMatch: () => void;
  onSimulateSeason: () => void;
  onEditLineup: () => void;
  onResetToSetup: () => void;
  onResolveEventChoice: (choice: CareerEventChoice, choiceIdx: number) => string;
  onDismissEvent: () => void;
  onDismissNews: () => void;
  onAcceptPressConference: (teamIdx: number) => void;
  onDeclinePressConference: (teamIdx: number) => void;
  onAnswerPressConference: (teamIdx: number, choiceIdx: number) => void;
  onClosePressConference: (teamIdx: number) => void;
}

export const CareerHubView: React.FC<CareerHubViewProps> = ({
  league,
  teams,
  net,
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
  onAcceptPressConference,
  onDeclinePressConference,
  onAnswerPressConference,
  onClosePressConference,
}) => {
  const [eventOutcomeText, setEventOutcomeText] = useState<string | null>(null);
  const [cameraFlash, setCameraFlash] = useState<boolean>(false);

  const standings = useMemo(() => getSortedStandings(league), [league]);
  const seasonOver = league.week > league.maxWeeks;
  const currentRoundMatches = !seasonOver ? league.schedule[league.week - 1] || [] : [];

  const humanRoundMatches = currentRoundMatches.filter(
    (m) => teams[m.a]?.isHuman || teams[m.b]?.isHuman
  );
  const myWeekMatch =
    currentRoundMatches.find((m) => m.a === myTeamIdx || m.b === myTeamIdx) || null;
  const nextUserMatch =
    currentRoundMatches.find((m) => !m.done && (teams[m.a]?.isHuman || teams[m.b]?.isHuman)) ||
    myWeekMatch ||
    null;

  const activeUserIdx = teams[myTeamIdx]?.isHuman
    ? myTeamIdx
    : nextUserMatch
    ? teams[nextUserMatch.a]?.isHuman
      ? nextUserMatch.a
      : nextUserMatch.b
    : 0;
  const userRank = standings.findIndex((r) => r.teamIdx === activeUserIdx) + 1;
  const userTeam = teams[activeUserIdx] || teams[0];
  const myCareer = league.teamCareer?.[activeUserIdx];
  const myFunds = myCareer ? myCareer.clubFunds : league.clubFunds;
  const mySponsor = myCareer ? myCareer.sponsorName : league.sponsorName;
  const myMorale = myCareer ? myCareer.moraleMod : league.moraleMod;
  const myActiveEvent = myCareer
    ? myCareer.activeEvent
    : activeUserIdx === 0
    ? league.activeEvent
    : null;
  const myEventHistory = myCareer ? myCareer.eventHistory : league.eventHistory;

  // Determine active Press Conference for human player(s)
  const activePressTeamIdx = useMemo(() => {
    if (net.connected) {
      return league.teamCareer?.[myTeamIdx]?.activePressConference ? myTeamIdx : null;
    }
    for (let i = 0; i < teams.length; i++) {
      if (teams[i]?.isHuman && league.teamCareer?.[i]?.activePressConference) {
        return i;
      }
    }
    if (league.activePressConference) {
      return league.activePressConference.teamIdx;
    }
    return null;
  }, [league.teamCareer, league.activePressConference, teams, net.connected, myTeamIdx]);

  const activePressConference =
    activePressTeamIdx != null
      ? league.teamCareer?.[activePressTeamIdx]?.activePressConference ||
        league.activePressConference ||
        null
      : null;
  const activePressTeam = activePressTeamIdx != null ? teams[activePressTeamIdx] : userTeam;

  const triggerShutterFlash = () => {
    setCameraFlash(true);
    window.setTimeout(() => setCameraFlash(false), 220);
  };

  const myMatchForBans = myWeekMatch || nextUserMatch;
  const nextOppIdx = myMatchForBans
    ? myMatchForBans.a === activeUserIdx
      ? myMatchForBans.b
      : myMatchForBans.a
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

  const weekPhase = `league_hub_w${league.week}`;
  const myReady = isPeerReadyForPhase(net, weekPhase, net.myTeamIdx);

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

  const isUcl = !!league.isUcl || league.leagueName === 'Şampiyonlar Ligi';
  const championRow = standings[0];
  const championTeam =
    isUcl && league.uclChampionTeamIdx != null
      ? teams[league.uclChampionTeamIdx]
      : championRow
      ? teams[championRow.teamIdx]
      : undefined;

  const potByTeamIdx = useMemo(() => {
    const map: Record<number, number> = {};
    (league.uclPots || []).forEach((p) => {
      map[p.teamIdx] = p.pot;
    });
    return map;
  }, [league.uclPots]);

  const getTeamStadium = (tm: Team | undefined): string | null => {
    if (!tm) return null;
    return (
      CLUB_STADIUMS[tm.name] ||
      (tm.customIdentity?.club ? CLUB_STADIUMS[tm.customIdentity.club] : null) ||
      null
    );
  };

  const tabItems: [LeagueTab, string][] = isUcl
    ? [
        ['standings', `Lig Aşaması Puan Durumu (${teams.length} Takım)`],
        ['pots', 'Torbalar & Katsayılar (1-4)'],
        ['bracket', 'Play-Off & Eleme Ağacı'],
        ['fixtures', 'Fikstür & Sonuçlar'],
        ['leaders', 'Gol & Asist Krallığı'],
        ['news', `Turnuva Haberleri (${league.newsFeed.length})`],
      ]
    : [
        ['standings', `Puan Durumu (${teams.length} Takım)`],
        ['fixtures', 'Haftalık Fikstür & Sonuçlar'],
        ['leaders', 'Gol & Asist Krallığı'],
        ['news', `Lig Haberleri (${league.newsFeed.length})`],
      ];

  const knockoutStages = [
    {
      leg1Idx: 8,
      leg2Idx: 9,
      title: 'Play-Off Eleme Turu (Rövanşlı)',
      desc: 'Lig aşamasını 9–24. sırada tamamlayan takımların çift maçlı eleme mücadelesi',
    },
    {
      leg1Idx: 10,
      leg2Idx: 11,
      title: 'Son 16 Turu (Rövanşlı)',
      desc: 'İlk 8 sıradaki takımlar ile Play-Off turunu geçen 8 takımın çift maçlı eşleşmeleri',
    },
    {
      leg1Idx: 12,
      leg2Idx: 13,
      title: 'Çeyrek Final (Rövanşlı)',
      desc: 'Son 8 takım arasında çift maçlı eleme turu',
    },
    {
      leg1Idx: 14,
      leg2Idx: 15,
      title: 'Yarı Final (Rövanşlı)',
      desc: 'Finale yükselmek için son 4 takımın çift maçlı mücadelesi',
    },
    {
      leg1Idx: 16,
      leg2Idx: null,
      title: 'UEFA Şampiyonlar Ligi Finali (Tek Maç)',
      desc: 'Tarafsız sahada tek maç üzerinden Avrupa Şampiyonluğu',
    },
  ] as const;

  return (
    <section aria-label={`${league.leagueName} Kariyer Merkezi`} className="relative space-y-4">
      {isUcl && (
        <img
          src={UCL_BRAND_LOGOS.starballWhite}
          alt=""
          aria-hidden="true"
          className="pointer-events-none fixed right-[-80px] top-[90px] z-0 h-[460px] w-[460px] select-none object-contain opacity-[0.055]"
        />
      )}

      <div
        className={`relative overflow-hidden rounded-2xl border border-[var(--border)] p-5 shadow-xl ${
          isUcl
            ? 'bg-gradient-to-br from-[#061338] via-[#0a1d56] to-[#03091c]'
            : 'bg-gradient-to-br from-[#0f151c] to-[#090c10]'
        }`}
      >
        {isUcl && (
          <img
            src={UCL_BRAND_LOGOS.starballWhite}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 select-none object-contain opacity-10"
          />
        )}

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <TeamIdentityBadge team={userTeam} size={50} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded bg-[var(--pri)]/40 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--pri-bright)]">
                  <LeagueLogo league={league.leagueName} size={16} />
                  <span>
                    {isUcl
                      ? 'UEFA Şampiyonlar Ligi · 36 Takım Yeni Format'
                      : `${league.leagueName} · ${league.maxWeeks} Haftalık Tam Sezon`}
                  </span>
                </span>
                <span className="font-mono-tab text-xs font-bold text-amber-300">
                  {seasonOver
                    ? 'Turnuva Tamamlandı'
                    : isUcl
                    ? getUclWeekTitle(league.week)
                    : `Hafta ${league.week} / ${league.maxWeeks}`}
                </span>
              </div>
              <h1 className="mt-0.5 text-2xl font-extrabold text-[var(--fg)]">
                {userTeam?.name || 'Kulübün'}
              </h1>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                <span>
                  Lig Aşaması Sırası: <strong className="text-white">{userRank}.</strong>
                </span>
                {isUcl && potByTeamIdx[activeUserIdx] && (
                  <span>
                    Torba:{' '}
                    <strong className="text-sky-300">{potByTeamIdx[activeUserIdx]}. Torba</strong>
                  </span>
                )}
                <span>
                  Kulüp Kasası:{' '}
                  <strong className="font-mono-tab text-emerald-300">{myFunds} M€</strong>
                </span>
                <span>
                  Sponsor: <strong className="text-white">{mySponsor}</strong>
                </span>
                <span>
                  Moral:{' '}
                  <strong className={myMorale >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                    {myMorale >= 0 ? `+${myMorale}%` : `${myMorale}%`}
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
            {!seasonOver && !net.connected && (
              <button
                type="button"
                onClick={onSimulateSeason}
                className="rounded-lg border border-amber-400/50 bg-amber-900/45 px-3.5 py-2 text-xs font-bold text-amber-100 hover:bg-amber-800/65"
              >
                {isUcl ? 'Turnuvayı Tamamla (Hızlı Simülasyon)' : 'Sezonu Tamamla (Hızlı Simülasyon)'}
              </button>
            )}
          </div>
        </div>

        {seasonOver && championTeam ? (
          <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/50 bg-amber-950/35 p-4">
            <div className="flex items-center gap-3">
              <TeamIdentityBadge team={championTeam} size={40} />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {isUcl
                    ? 'UEFA ŞAMPİYONLAR LİGİ ŞAMPİYONU'
                    : `${league.maxWeeks} HAFTALIK ${league.leagueName.toUpperCase()} ŞAMPİYONU`}
                </div>
                <div className="text-lg font-extrabold text-white">
                  {championTeam.name}{' '}
                  {!isUcl && championRow ? `(${championRow.pts} Puan)` : '· Avrupa Şampiyonu 🏆'}
                </div>
                <div className="text-xs text-amber-100/80">
                  Lig aşaması sıralaman: {userRank}. sıra (
                  {standings.find((r) => r.teamIdx === activeUserIdx)?.pts ?? 0} puan)
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
          <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[#0b1016]/90 p-3.5">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                <span>
                  {isUcl
                    ? `Sıradaki Maç · ${getUclWeekTitle(league.week)}`
                    : humanRoundMatches.length > 1
                    ? `Sıradaki Hafta Maçları · ${league.week}. Hafta`
                    : `Sıradaki Maç · ${league.week}. Hafta (${
                        (myMatchForBans || nextUserMatch).a === activeUserIdx
                          ? 'İç Saha'
                          : 'Deplasman'
                      })`}
                </span>
                {getTeamStadium(teams[(myMatchForBans || nextUserMatch).a]) && (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                    🏟 {getTeamStadium(teams[(myMatchForBans || nextUserMatch).a])}
                  </span>
                )}
                {(myMatchForBans || nextUserMatch).leg === 2 &&
                  (myMatchForBans || nextUserMatch).firstLegSc && (
                    <span className="rounded border border-sky-400/35 bg-sky-950/60 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                      İlk Maç Skoru:{' '}
                      {(myMatchForBans || nextUserMatch).firstLegSc![1]} -{' '}
                      {(myMatchForBans || nextUserMatch).firstLegSc![0]}
                    </span>
                  )}
              </div>

              <div className="space-y-1">
                {humanRoundMatches.map((hm, idx) => (
                  <div
                    key={`${hm.a}_${hm.b}_${idx}`}
                    className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--fg)]"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <TeamIdentityBadge team={teams[hm.a]} size={20} />
                      <span className={teams[hm.a]?.isHuman ? 'text-[var(--pri-bright)]' : ''}>
                        {teams[hm.a].name}
                      </span>
                    </span>
                    <span className="font-mono-tab text-xs text-[var(--muted)]">
                      {hm.done && hm.sc ? `${hm.sc[0]} - ${hm.sc[1]}` : 'vs'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <TeamIdentityBadge team={teams[hm.b]} size={20} />
                      <span className={teams[hm.b]?.isHuman ? 'text-[var(--pri-bright)]' : ''}>
                        {teams[hm.b].name}
                      </span>
                    </span>
                  </div>
                ))}
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

            <div className="flex flex-wrap items-center gap-2.5">
              {net.connected && <OnlineReadyBadges net={net} phase={weekPhase} />}
              <button
                type="button"
                onClick={onPlayNextMatch}
                className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-5 py-2.5 text-xs font-bold text-white shadow-[0_8px_22px_-6px_rgba(34,197,94,0.65)] transition hover:opacity-95"
              >
                {net.connected
                  ? myReady
                    ? 'Hazır ✓ (Diğer Oyuncu Bekleniyor...)'
                    : `${isUcl ? getUclWeekTitle(league.week) : `${league.week}. Hafta`} İçin Hazır Ol →`
                  : `${isUcl ? getUclWeekTitle(league.week) : `${league.week}. Hafta`} Maçına Çık →`}
              </button>
            </div>
          </div>
        ) : !seasonOver ? (
          <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[#0b1016]/90 p-3.5">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300">
                {getUclWeekTitle(league.week)}
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {(league.week === 9 || league.week === 10) && userRank <= 8
                  ? 'Takımın Lig Aşamasını ilk 8 sırada tamamladığı için doğrudan Son 16 turuna yükseldi! Play-Off maçlarını simüle ederek rakibini bekleyebilirsin.'
                  : 'Bu turda takımının maçı bulunmuyor. Turnuvanın sıradaki eleme turunu simüle edebilirsin.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onPlayNextMatch}
              className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-5 py-2.5 text-xs font-bold text-white"
            >
              {getUclWeekTitle(league.week)} Maçlarını Simüle Et →
            </button>
          </div>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="Kariyer Sekmeleri"
        className="relative z-10 flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"
      >
        {tabItems.map(([tabId, label]) => (
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
        <div className="relative z-10 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          {isUcl && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                1–8. Sıra: Doğrudan Son 16 Turu
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-sky-300">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                9–24. Sıra: Play-Off Eleme Turu
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold text-rose-300">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                25–36. Sıra: Turnuvadan Elendi
              </span>
            </div>
          )}

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
                const relegationStart = Math.max(15, standings.length - 2);
                const zoneClass = isUcl
                  ? rank <= 8
                    ? 'border-l-4 border-l-emerald-400'
                    : rank <= 24
                    ? 'border-l-4 border-l-sky-400'
                    : 'border-l-4 border-l-rose-500/80'
                  : rank <= 4
                  ? 'border-l-4 border-l-emerald-500'
                  : rank <= 6
                  ? 'border-l-4 border-l-sky-500'
                  : rank >= relegationStart
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
                        {isUcl && potByTeamIdx[row.teamIdx] && (
                          <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono-tab text-[9px] font-semibold text-sky-200">
                            T{potByTeamIdx[row.teamIdx]}
                          </span>
                        )}
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

      {isUcl && league.tab === 'pots' && (
        <div className="relative z-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {([1, 2, 3, 4] as const).map((potNum) => {
            const potTeams = (league.uclPots || []).filter((p) => p.pot === potNum);
            return (
              <div
                key={potNum}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
              >
                <div className="mb-3 flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={UCL_BRAND_LOGOS.starballWhite}
                      alt=""
                      className="h-4 w-4 object-contain"
                    />
                    <h2 className="text-sm font-extrabold text-sky-300">{potNum}. Torba</h2>
                  </div>
                  <span className="font-mono-tab text-[11px] font-semibold text-[var(--muted)]">
                    Katsayı
                  </span>
                </div>
                <div className="space-y-1.5">
                  {potTeams.map((pt) => {
                    const tm = teams[pt.teamIdx];
                    const isUser = !!tm?.isHuman;
                    return (
                      <div
                        key={pt.teamIdx}
                        className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-xs ${
                          isUser
                            ? 'border-sky-400 bg-blue-950/60 font-bold text-white'
                            : 'border-[var(--border)] bg-[var(--card)] text-[var(--fg)]'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <TeamIdentityBadge team={tm} size={20} className="shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-semibold">{tm?.name || pt.club}</span>
                              {pt.note && (
                                <span className="rounded bg-sky-500/20 px-1 py-0.2 text-[9px] font-bold text-sky-300">
                                  {pt.note}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[10px] text-[var(--muted)]">
                              {pt.country}
                              {getTeamStadium(tm) ? ` · ${getTeamStadium(tm)}` : ''}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 font-mono-tab text-xs font-bold text-amber-300">
                          {pt.coeff}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isUcl && league.tab === 'bracket' && (
        <div className="relative z-10 space-y-4">
          {knockoutStages.map((stage) => {
            const leg1Matches = league.schedule[stage.leg1Idx] || [];
            const leg2Matches = stage.leg2Idx != null ? league.schedule[stage.leg2Idx] || [] : [];

            return (
              <div
                key={stage.leg1Idx}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                  <div>
                    <h2 className="text-sm font-extrabold text-sky-300">{stage.title}</h2>
                    <p className="text-[11px] text-[var(--muted)]">{stage.desc}</p>
                  </div>
                  <span className="rounded-full bg-[var(--raised)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                    {leg1Matches.length > 0
                      ? `${leg1Matches.length} Eşleşme`
                      : 'Önceki Tur Sonrası Belli Olacak'}
                  </span>
                </div>

                {leg1Matches.length === 0 ? (
                  <p className="py-3 text-center text-xs text-[var(--muted)]">
                    Önceki aşama tamamlandığında eşleşmeler otomatik olarak burada yer alacak.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                    {leg1Matches.map((m1, mIdx) => {
                      const m2 = leg2Matches[mIdx];
                      const tA = teams[m1.a];
                      const tB = teams[m1.b];
                      const tieWinner = m2 ? m2.winner : m1.winner;
                      // Aggregate goals in terms of [tA, tB]
                      const aggA =
                        m1.done && m1.sc
                          ? m1.sc[0] + (m2 && m2.done && m2.sc ? m2.sc[1] : 0)
                          : null;
                      const aggB =
                        m1.done && m1.sc
                          ? m1.sc[1] + (m2 && m2.done && m2.sc ? m2.sc[0] : 0)
                          : null;

                      return (
                        <div
                          key={`${stage.leg1Idx}_${mIdx}`}
                          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
                        >
                          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-sky-300/90">
                            <span>
                              {stage.leg2Idx != null
                                ? `${mIdx + 1}. Eşleşme (Çift Maç)`
                                : m1.stageLabel || stage.title}
                            </span>
                            {m2 && m2.done && aggA != null && aggB != null && (
                              <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono-tab text-[10px] text-sky-200">
                                Toplam: {aggA} - {aggB}
                                {m2.pen ? ` (P ${m2.pen[1]}-${m2.pen[0]})` : ''}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-xs">
                            <div className="flex min-w-0 items-center justify-end gap-1.5 text-right">
                              <span
                                className={`truncate font-bold ${
                                  tieWinner === m1.a ? 'text-emerald-300' : 'text-white'
                                }`}
                              >
                                {tA?.name}
                              </span>
                              <TeamIdentityBadge team={tA} size={20} className="shrink-0" />
                            </div>

                            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-center font-mono-tab font-extrabold text-white">
                              {stage.leg2Idx == null
                                ? m1.done && m1.sc
                                  ? `${m1.sc[0]} - ${m1.sc[1]}${
                                      m1.pen ? ` (P ${m1.pen[0]}-${m1.pen[1]})` : ''
                                    }`
                                  : 'vs'
                                : m2 && m2.done && aggA != null && aggB != null
                                ? `${aggA} - ${aggB}`
                                : m1.done && m1.sc
                                ? `${m1.sc[0]} - ${m1.sc[1]}`
                                : 'vs'}
                            </div>

                            <div className="flex min-w-0 items-center justify-start gap-1.5 text-left">
                              <TeamIdentityBadge team={tB} size={20} className="shrink-0" />
                              <span
                                className={`truncate font-bold ${
                                  tieWinner === m1.b ? 'text-emerald-300' : 'text-white'
                                }`}
                              >
                                {tB?.name}
                              </span>
                            </div>
                          </div>

                          {stage.leg2Idx != null && (
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)]/60 pt-1.5 font-mono-tab text-[10px] text-[var(--muted)]">
                              <span>
                                1. Maç ({tA?.name} ev):{' '}
                                <strong className="text-white">
                                  {m1.done && m1.sc ? `${m1.sc[0]} - ${m1.sc[1]}` : 'Oynanmadı'}
                                </strong>
                              </span>
                              {m2 && (
                                <span>
                                  Rövanş ({tB?.name} ev):{' '}
                                  <strong className="text-white">
                                    {m2.done && m2.sc
                                      ? `${m2.sc[0]} - ${m2.sc[1]}${
                                          m2.pen ? ` (P ${m2.pen[0]}-${m2.pen[1]})` : ''
                                        }`
                                      : 'Oynanmadı'}
                                  </strong>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {league.tab === 'fixtures' && (
        <div className="relative z-10 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <h2 className="text-sm font-bold text-[var(--fg)]">
              {isUcl
                ? getUclWeekTitle(league.viewWeek)
                : `${league.viewWeek}. Hafta Maçları (${league.maxWeeks} Haftalık Fikstür)`}
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
                    {isUcl ? getUclWeekTitle(w) : `${w}. Hafta`} {w === league.week ? '(Aktif)' : ''}
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
              const stadium = getTeamStadium(tA);
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
                  {(stadium || m.stageLabel) && (
                    <div className="mb-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
                      <span>{m.stageLabel || `${league.viewWeek}. Hafta`}</span>
                      {stadium && <span>🏟 {stadium}</span>}
                    </div>
                  )}
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
                      {m.done && m.sc
                        ? `${m.sc[0]} - ${m.sc[1]}${m.pen ? ` (${m.pen[0]}-${m.pen[1]})` : ''}`
                        : 'vs'}
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

                  {m.leg === 2 && m.done && m.aggSc && (
                    <div className="mt-1 text-center font-mono-tab text-[10px] font-bold text-sky-300">
                      Toplam Skor: {m.aggSc[0]} - {m.aggSc[1]}
                      {m.winner != null ? ` · Turu Geçen: ${teams[m.winner]?.name}` : ''}
                    </div>
                  )}

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
            {myEventHistory.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--muted)]">
                Henüz kulüp kararı verilmedi.
              </p>
            ) : (
              myEventHistory.map((ev, idx) => (
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

      {/* UEFA Champions League Press Conference Studio Modal */}
      {activePressConference && activePressTeamIdx != null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="press-conference-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md"
        >
          <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border-2 border-sky-400/50 bg-[#050d28] shadow-[0_24px_80px_rgba(0,0,0,0.9)]">
            {/* Camera Shutter Flash Effect */}
            {cameraFlash && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-40 bg-white/40 transition-opacity duration-200"
              />
            )}

            {/* Broadcast Camera Viewfinder Overlay */}
            <div className="relative border-b border-sky-400/30 bg-[#03081a] px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-tab">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded bg-red-600/90 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    REC
                  </span>
                  <span className="font-bold text-sky-300">
                    UEFA MEDIA BROADCAST · CAM 01
                  </span>
                  <span className="hidden text-sky-200/60 sm:inline">
                    1080p 50fps · CANLI YAYIN
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sky-200/80">
                  <span>
                    OYUNCU: <strong className="text-white">{activePressTeam?.name}</strong>
                  </span>
                  <span className="rounded border border-sky-400/30 bg-sky-950/60 px-2 py-0.5 text-[10px] text-sky-200">
                    {activePressConference.week}. Hafta Sonu
                  </span>
                </div>
              </div>
            </div>

            {/* Sponsor Backdrop Wall (UEFA Media Backdrop) + Studio Stage */}
            <div className="relative overflow-hidden bg-gradient-to-b from-[#071642] via-[#061133] to-[#040a1e] p-4 sm:p-6">
              {/* Camera Viewfinder Corner Brackets */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-sky-300/50"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-sky-300/50"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-sky-300/50"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-sky-300/50"
              />

              {/* Sponsor Logo Wall Grid (Behind Manager) */}
              <div
                aria-label="UEFA Basın Toplantısı Sponsor Panosu"
                className="mb-4 rounded-xl border border-sky-300/20 bg-[#030b24]/90 p-3 shadow-inner"
              >
                <div className="mb-2 flex items-center justify-between text-[9px] font-extrabold uppercase tracking-widest text-sky-300/75">
                  <span className="inline-flex items-center gap-1.5">
                    <img
                      src={UCL_BRAND_LOGOS.starballWhite}
                      alt=""
                      className="h-3.5 w-3.5 object-contain"
                    />
                    UEFA CHAMPIONS LEAGUE · PRESS CONFERENCE BACKDROP
                  </span>
                  <span>OFFICIAL MEDIA CENTER</span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <div className="flex h-8 items-center justify-center rounded border border-[#1d4ed8]/60 bg-gradient-to-r from-[#003791] to-[#0052cc] px-2">
                    <img
                      src={UCL_BRAND_LOGOS.sponsors[1]?.logo}
                      alt="PlayStation"
                      className="h-4 w-auto object-contain"
                    />
                  </div>
                  <div className="flex h-8 items-center justify-center rounded border border-emerald-500/50 bg-gradient-to-r from-[#00592d] to-[#00843d] px-2">
                    <img
                      src={UCL_BRAND_LOGOS.heinekenWhite}
                      alt="Heineken"
                      className="h-4 w-auto object-contain"
                    />
                  </div>
                  <div className="flex h-8 items-center justify-center rounded border border-amber-500/40 bg-[#0d1528] px-2">
                    <img
                      src={UCL_BRAND_LOGOS.sponsors[0]?.logo}
                      alt="Mastercard"
                      className="h-4 w-auto object-contain"
                    />
                  </div>
                  <div className="flex h-8 items-center justify-center rounded border border-yellow-400/50 bg-gradient-to-r from-[#b91c1c] to-[#d97706] px-2">
                    <img
                      src={UCL_BRAND_LOGOS.sponsors[3]?.logo}
                      alt="Lay's"
                      className="h-4 w-auto object-contain"
                    />
                  </div>
                  <div className="hidden h-8 items-center justify-center rounded border border-[#1d4ed8]/60 bg-gradient-to-r from-[#003791] to-[#0052cc] px-2 sm:flex">
                    <img
                      src={UCL_BRAND_LOGOS.sponsors[1]?.logo}
                      alt="PlayStation"
                      className="h-4 w-auto object-contain"
                    />
                  </div>
                  <div className="hidden h-8 items-center justify-center rounded border border-emerald-500/50 bg-gradient-to-r from-[#00592d] to-[#00843d] px-2 sm:flex">
                    <img
                      src={UCL_BRAND_LOGOS.heinekenWhite}
                      alt="Heineken"
                      className="h-4 w-auto object-contain"
                    />
                  </div>
                </div>
              </div>

              {/* Manager Podium & Microphones */}
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-400/30 bg-[#08153d]/90 px-4 py-3">
                <div className="flex items-center gap-3">
                  <TeamIdentityBadge team={activePressTeam} size={42} />
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      Basın Kürsüsü · Teknik Direktör
                    </div>
                    <div className="text-base font-extrabold text-white">
                      {activePressConference.teamName}
                    </div>
                    <div className="text-[11px] text-sky-200/80">
                      Son Maç: {activePressConference.lastMatchSummary}
                    </div>
                  </div>
                </div>

                {/* Broadcast Microphones on Desk */}
                <div className="flex items-center gap-1.5">
                  {['SKY', 'BBC', 'UEFA', 'ATH'].map((mic) => (
                    <div
                      key={mic}
                      className="flex flex-col items-center"
                      title={`${mic} Mikrofonu`}
                    >
                      <span className=" rounded-t-full border border-white/25 bg-slate-800 px-1.5 py-0.5 font-mono-tab text-[8px] font-extrabold text-sky-200">
                        🎙 {mic}
                      </span>
                      <span className="h-2.5 w-1 bg-slate-600" />
                    </div>
                  ))}
                </div>
              </div>

              {/* STEP 1: INVITATION */}
              {activePressConference.status === 'invited' && (
                <div className="space-y-4 rounded-xl border border-sky-400/35 bg-[#040c24]/95 p-4">
                  <div>
                    <span className="inline-block rounded bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      UEFA Medya Daveti
                    </span>
                    <h2
                      id="press-conference-title"
                      className="mt-1.5 text-lg font-extrabold text-white"
                    >
                      {activePressConference.week}. Hafta Sonrası Basın Toplantısı Daveti
                    </h2>
                    <p className="mt-2 text-xs leading-relaxed text-sky-100/90">
                      Basın salonu dolu: muhabirler {activePressConference.rank}. sıradaki{' '}
                      {activePressConference.teamName} hakkında soru sormak için bekliyor. Son maçın
                      sonucu: {activePressConference.lastMatchSummary}. Katılırsan 3 soru gelecek;
                      cevaplarının tonu moral ve kulüp kasasını etkileyebilir. Katılmak istiyor musun?
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerShutterFlash();
                        onAcceptPressConference(activePressTeamIdx);
                      }}
                      className="rounded-xl border border-emerald-400/60 bg-emerald-600/90 px-4 py-3 text-left text-xs font-extrabold text-white shadow-lg transition hover:bg-emerald-500"
                    >
                      <div>🎙 Basın Toplantısına Katıl</div>
                      <div className="mt-0.5 text-[10px] font-medium text-emerald-100">
                        3 soru, cevapların moral ve kasayı etkiler
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onDeclinePressConference(activePressTeamIdx);
                      }}
                      className="rounded-xl border border-rose-400/40 bg-rose-950/60 px-4 py-3 text-left text-xs font-extrabold text-rose-100 transition hover:bg-rose-900/70"
                    >
                      <div>🚪 Katılma (sözcü gönderilir)</div>
                      <div className="mt-0.5 text-[10px] font-medium text-rose-200/80">
                        Yenilgi sonrası çıkmamak moral kaybına yol açabilir
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: DECLINED */}
              {activePressConference.status === 'declined' && (
                <div className="space-y-4 rounded-xl border border-amber-400/40 bg-[#040c24]/95 p-4">
                  <h2
                    id="press-conference-title"
                    className="text-base font-extrabold text-white"
                  >
                    Basın Toplantısı Raporu
                  </h2>
                  <p className="text-xs leading-relaxed text-sky-100/90">
                    {activePressConference.declineOutcomeText}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded border px-2.5 py-1 text-xs font-bold ${
                        (activePressConference.declineMoraleDelta || 0) < 0
                          ? 'border-red-500/40 bg-red-950/60 text-red-300'
                          : 'border-sky-400/30 bg-sky-950/60 text-sky-200'
                      }`}
                    >
                      {(activePressConference.declineMoraleDelta || 0) < 0
                        ? `Moral ${activePressConference.declineMoraleDelta}`
                        : 'Etki Yok'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onClosePressConference(activePressTeamIdx)}
                    className="w-full rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] py-2.5 text-xs font-bold text-white"
                  >
                    Kariyer Merkezine Dön
                  </button>
                </div>
              )}

              {/* STEP 3: IN PROGRESS (3 QUESTIONS) */}
              {activePressConference.status === 'in_progress' && (
                <div className="space-y-4">
                  {/* Previous answer outcome banner if user already answered Q1 or Q2 */}
                  {activePressConference.answers.length > 0 && (
                    <div className="rounded-xl border border-sky-400/30 bg-[#03091c]/90 p-3 text-xs">
                      {(() => {
                        const lastLog =
                          activePressConference.answers[
                            activePressConference.answers.length - 1
                          ];
                        return (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                                Önceki Cevabın Yansıması ({lastLog.media}):
                              </span>
                              <p className="mt-0.5 font-semibold text-white">
                                “{lastLog.outcomeText}”
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5 font-mono-tab text-[11px] font-bold">
                              <span
                                className={`rounded border px-2 py-0.5 ${
                                  lastLog.moraleDelta >= 0
                                    ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                                    : 'border-red-500/40 bg-red-950/60 text-red-300'
                                }`}
                              >
                                Moral {lastLog.moraleDelta >= 0 ? `+${lastLog.moraleDelta}` : lastLog.moraleDelta}
                              </span>
                              {lastLog.fundsDelta !== 0 && (
                                <span
                                  className={`rounded border px-2 py-0.5 ${
                                    lastLog.fundsDelta > 0
                                      ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                                      : 'border-red-500/40 bg-red-950/60 text-red-300'
                                  }`}
                                >
                                  Kasa {lastLog.fundsDelta > 0 ? `+${lastLog.fundsDelta}` : lastLog.fundsDelta} M€
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {(() => {
                    const qIdx = activePressConference.currentQIdx;
                    const curQ = activePressConference.questions[qIdx];
                    if (!curQ) return null;
                    return (
                      <div className="rounded-xl border border-sky-400/40 bg-[#040c24]/95 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <MediaLogoBadge source={curQ.media} />
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                Soru {qIdx + 1} / {activePressConference.questions.length} · Canlı Soru
                              </span>
                              <h2
                                id="press-conference-title"
                                className="text-base font-extrabold text-white"
                              >
                                {curQ.media} Muhabiri Soruyor
                              </h2>
                            </div>
                          </div>
                          <span className="rounded-full border border-sky-400/30 bg-sky-950/70 px-2.5 py-0.5 text-[10px] font-bold text-sky-200">
                            📸 Basın Salonu Canlı
                          </span>
                        </div>

                        <blockquote className="mb-4 rounded-xl border-l-4 border-l-sky-400 bg-[#08163f]/80 p-3.5 text-sm font-bold italic text-sky-100">
                          “{curQ.questionText}”
                        </blockquote>

                        <div className="space-y-2">
                          {curQ.choices.map((ch, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                triggerShutterFlash();
                                onAnswerPressConference(activePressTeamIdx, idx);
                              }}
                              className="w-full rounded-xl border border-sky-400/25 bg-[#0a1944]/90 px-4 py-3 text-left text-xs font-semibold text-white transition hover:border-sky-300 hover:bg-[#102663]"
                            >
                              <span className="mr-2 inline-block rounded bg-sky-500/30 px-1.5 py-0.5 font-mono-tab text-[10px] font-extrabold text-sky-200">
                                {ch.tone}
                              </span>
                              {ch.text}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* STEP 4: COMPLETED SUMMARY */}
              {activePressConference.status === 'completed' && (
                <div className="space-y-4 rounded-xl border border-emerald-400/40 bg-[#040c24]/95 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-400/20 pb-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                        Basın Toplantısı Tamamlandı
                      </span>
                      <h2
                        id="press-conference-title"
                        className="text-base font-extrabold text-white"
                      >
                        {activePressConference.headline || 'Medya Manşetleri & Kulüp Etkisi'}
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {activePressConference.answers.map((log, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-sky-400/20 bg-[#08153b]/80 p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-sky-300">
                            {i + 1}. Soru · {log.media} Muhabiri ({log.chosenTone})
                          </span>
                          <div className="flex items-center gap-1.5 font-mono-tab text-[10px] font-bold">
                            <span
                              className={`rounded px-2 py-0.5 ${
                                log.moraleDelta >= 0
                                  ? 'bg-emerald-950/80 text-emerald-300'
                                  : 'bg-red-950/80 text-red-300'
                              }`}
                            >
                              Moral {log.moraleDelta >= 0 ? `+${log.moraleDelta}` : log.moraleDelta}
                            </span>
                            {log.fundsDelta !== 0 && (
                              <span
                                className={`rounded px-2 py-0.5 ${
                                  log.fundsDelta > 0
                                    ? 'bg-emerald-950/80 text-emerald-300'
                                    : 'bg-red-950/80 text-red-300'
                                }`}
                              >
                                Kasa {log.fundsDelta > 0 ? `+${log.fundsDelta}` : log.fundsDelta} M€
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-sky-200/75">
                          Cevabın: “{log.chosenText}”
                        </p>
                        <p className="mt-1 font-semibold text-white">
                          Manşet: {log.outcomeText}
                        </p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => onClosePressConference(activePressTeamIdx)}
                    className="w-full rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] py-2.5 text-xs font-bold text-white"
                  >
                    Basın Toplantısını Bitir ve Devam Et
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {!activePressConference && myActiveEvent && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="career-event-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-xl rounded-2xl border border-amber-400/50 bg-[var(--surface)] p-5 shadow-2xl">
            <span className="inline-block rounded bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300">
              {myActiveEvent.tag}
            </span>
            <h2 id="career-event-title" className="mt-2 text-lg font-extrabold text-white">
              {myActiveEvent.title}
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
              {myActiveEvent.desc}
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
                {myActiveEvent.choices.map((ch, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const out = onResolveEventChoice(ch, idx);
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

      {!activePressConference && !myActiveEvent && league.activeNews && (
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
