import { useCallback, useEffect, useRef, useState } from 'react';
import { CareerHubView } from './components/CareerHubView';
import { CareerLeagueSelectorView } from './components/CareerLeagueSelectorView';
import { ClubSelectView } from './components/ClubSelectView';
import { DraftView } from './components/DraftView';
import { HeaderBar } from './components/HeaderBar';
import { IdentityView } from './components/IdentityView';
import { LineupView } from './components/LineupView';
import { MatchView } from './components/MatchView';
import { OnlineModal } from './components/OnlineModal';
import { SetupView } from './components/SetupView';
import {
  ALL_CLUBS,
  CLUB_TO_LEAGUE,
  ICONIC_CLUBS,
  MODERN_LEAGUES,
  PLAYERS_BY_ID,
  ROUNDS,
} from './data/database';
import { onlineNet, type NetEnvelope } from './services/onlineNet';
import type {
  AppView,
  CareerEventChoice,
  DraftState,
  FormationName,
  GameModeId,
  IdentityShape,
  LeagueState,
  LeagueTab,
  MatchState,
  NetStateSnapshot,
  TournamentState,
  WheelState,
} from './types/game';
import {
  finalizeCareerWeekAfterUserMatch,
  initCareerLeague,
  simulateRestOfLeagueSeason,
} from './utils/careerLogic';
import {
  buildDraftState,
  canPickPlayer,
  checkBudgetStatus,
  chooseCpuPlayer,
  cloneDraftState,
  cost,
  getWheelClubsForTurn,
  siblingIds,
} from './utils/draftLogic';
import {
  autoBuildLineupForTeam,
  ensureTeamLineup,
  swapTeamPlayers,
} from './utils/lineupLogic';
import {
  createInitialMatchState,
  finalizeMatchState,
  generateMatchPlan,
  getActiveTournamentMatch,
  hydrateNetworkPlan,
  initTournamentState,
  serializeMatchPlan,
  side,
  stepMatchMinute,
  type SerializedMatchPlan,
} from './utils/matchEngine';

function cloneLeague(lg: LeagueState): LeagueState {
  return {
    ...lg,
    schedule: lg.schedule.map((w) => w.map((f) => ({ ...f, redCards: f.redCards ? [...f.redCards] : undefined }))),
    standings: lg.standings.map((r) => ({ ...r })),
    playerStats: { ...lg.playerStats },
    injuries: { ...lg.injuries },
    suspensions: { ...lg.suspensions },
    usedEventIds: new Set(lg.usedEventIds),
    usedNewsIds: new Set(lg.usedNewsIds),
    eventHistory: [...lg.eventHistory],
    newsFeed: [...lg.newsFeed],
  };
}

export default function App() {
  const [view, setView] = useState<AppView>('setup');
  const [mode, setMode] = useState<GameModeId>('career');
  const [leagues, setLeagues] = useState<Set<string>>(() => new Set(MODERN_LEAGUES));
  const [clubs, setClubs] = useState<Set<string>>(() => new Set());
  const [opp, setOpp] = useState<number>(1);
  const [humanCount, setHumanCount] = useState<number>(1);
  const [format, setFormat] = useState<'snake' | 'linear'>('snake');
  const [strictPos, setStrictPos] = useState<boolean>(true);
  const [teamName, setTeamName] = useState<string>('1. Oyuncu');
  const [setupErr, setSetupErr] = useState<string>('');
  const [swapErr, setSwapErr] = useState<string>('');

  const [onlineModalOpen, setOnlineModalOpen] = useState<boolean>(false);
  const [onlineMsg, setOnlineMsg] = useState<string>('');
  const [net, setNet] = useState<NetStateSnapshot>(onlineNet.snapshot);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [wheel, setWheel] = useState<WheelState>({
    spinning: false,
    angle: 0,
    selectedClub: null,
    offeredPlayers: [],
    jokers: 3,
  });
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const [league, setLeague] = useState<LeagueState | null>(null);
  const [match, setMatch] = useState<MatchState | null>(null);

  const wheelRafRef = useRef<number | null>(null);
  const cpuTimerRef = useRef<number | null>(null);
  const matchTimerRef = useRef<number | null>(null);

  // Refs to access fresh state inside event/interval callbacks without tearing down listeners
  const stateRef = useRef({
    view,
    mode,
    leagues,
    clubs,
    opp,
    humanCount,
    format,
    strictPos,
    teamName,
    draft,
    wheel,
    tournament,
    league,
    match,
    net,
  });
  stateRef.current = {
    view,
    mode,
    leagues,
    clubs,
    opp,
    humanCount,
    format,
    strictPos,
    teamName,
    draft,
    wheel,
    tournament,
    league,
    match,
    net,
  };

  // Subscribe to online room snapshot updates
  useEffect(() => {
    const unsubState = onlineNet.subscribeState((snap) => setNet(snap));
    return () => {
      unsubState();
      onlineNet.disconnect(true);
    };
  }, []);

  // Cleanup animations & timers on unmount
  useEffect(() => {
    return () => {
      if (wheelRafRef.current != null) cancelAnimationFrame(wheelRafRef.current);
      if (cpuTimerRef.current != null) window.clearTimeout(cpuTimerRef.current);
      if (matchTimerRef.current != null) window.clearInterval(matchTimerRef.current);
    };
  }, []);

  const applyPickDirectly = useCallback((playerId: number, isCpu = false) => {
    const { draft: curDraft, strictPos: curStrict } = stateRef.current;
    if (!curDraft || curDraft.k >= curDraft.order.length) return;
    const p = PLAYERS_BY_ID[playerId];
    if (!p || curDraft.taken.has(p.id)) return;

    const ti = curDraft.order[curDraft.k];
    const nextDraft = cloneDraftState(curDraft);
    const tm = nextDraft.teams[ti];
    if (!tm) return;

    if (!isCpu && nextDraft.m.budget) {
      const check = checkBudgetStatus(nextDraft, tm, p, curStrict);
      if (!check.ok) {
        nextDraft.budgetWarning = check.reason;
        setDraft(nextDraft);
        return;
      }
    }

    nextDraft.budgetWarning = '';
    tm.picks.push(p);
    tm.spent += cost(p);
    const sibs = siblingIds(nextDraft, p);
    sibs.forEach((id) => nextDraft.taken.add(id));
    nextDraft.history.push({ teamIdx: ti, playerId: p.id, paid: cost(p), isCpu });
    nextDraft.k += 1;

    setWheel((w) => ({
      ...w,
      spinning: false,
      selectedClub: null,
      offeredPlayers: [],
    }));

    if (nextDraft.k >= nextDraft.order.length) {
      nextDraft.teams.forEach((t) => ensureTeamLineup(t, null, false));
      if (!nextDraft.m.career) {
        setTournament(initTournamentState(nextDraft.teams));
      }
      setDraft(nextDraft);
      setView('identity');
    } else {
      setDraft(nextDraft);
    }
  }, []);

  const setupMatch = useCallback(
    (a: number, b: number, tourneyMatchId: string | null = null) => {
      const { draft: curDraft, league: curLeague, net: curNet } = stateRef.current;
      if (!curDraft) return;
      const isCareer = !!curDraft.m.career;
      const cloned = cloneDraftState(curDraft);
      cloned.teams.forEach((tm) => ensureTeamLineup(tm, curLeague, isCareer));
      const sA = side(cloned.teams[a], curLeague, isCareer);
      const sB = side(cloned.teams[b], curLeague, isCareer);
      const plan = generateMatchPlan(cloned.teams[a], cloned.teams[b], sA, sB, !isCareer);
      const mState = createInitialMatchState(
        a,
        b,
        tourneyMatchId,
        plan,
        cloned.teams,
        curLeague,
        isCareer
      );

      setDraft(cloned);
      setMatch(mState);
      setView('match');

      if (curNet.connected && curNet.role === 'host') {
        onlineNet.send({
          type: 'MATCH_SYNC',
          a,
          b,
          tourneyMatchId,
          plan: serializeMatchPlan(plan),
          autoStart: false,
        });
      }
    },
    []
  );

  const handleFinishInstantly = useCallback((fromNet = false) => {
    const {
      match: curMatch,
      draft: curDraft,
      tournament: curTourney,
      league: curLeague,
      net: curNet,
    } = stateRef.current;
    if (!curMatch || !curDraft) return;
    if (matchTimerRef.current != null) {
      window.clearInterval(matchTimerRef.current);
      matchTimerRef.current = null;
    }

    const mNext: MatchState = {
      ...curMatch,
      sc: [...curMatch.sc] as [number, number],
      redCards: [...curMatch.redCards] as [number, number],
      perfFactor: [...curMatch.perfFactor] as [number, number],
      shots: [...curMatch.shots] as [number, number],
      onTarget: [...curMatch.onTarget] as [number, number],
      saves: [...curMatch.saves] as [number, number],
      xg: [...curMatch.xg] as [number, number],
      goalsList: [[...curMatch.goalsList[0]], [...curMatch.goalsList[1]]],
      playerStats: { ...curMatch.playerStats },
      log: [...curMatch.log],
    };

    const draftClone = cloneDraftState(curDraft);
    const tourneyClone = curTourney
      ? { ...curTourney, matches: curTourney.matches.map((x) => ({ ...x })) }
      : null;

    while (mNext.min < mNext.plan.maxMin) {
      mNext.min++;
      stepMatchMinute(mNext, mNext.min, draftClone.teams);
    }

    const isCareer = !!draftClone.m.career;
    finalizeMatchState(mNext, draftClone.teams, tourneyClone, isCareer);

    if (isCareer && curLeague && !mNext.leagueWeekRecorded) {
      const lgClone = cloneLeague(curLeague);
      finalizeCareerWeekAfterUserMatch(
        lgClone,
        draftClone.teams,
        { a: mNext.a, b: mNext.b },
        mNext.sc[0],
        mNext.sc[1],
        mNext.goalsList[0],
        mNext.goalsList[1],
        mNext.playerStats
      );
      mNext.leagueWeekRecorded = true;
      setLeague(lgClone);
      if (curNet.connected && curNet.role === 'host') {
        onlineNet.send({
          type: 'CAREER_SYNC',
          teams: draftClone.teams,
          league: {
            ...lgClone,
            usedEventIds: [...lgClone.usedEventIds],
            usedNewsIds: [...lgClone.usedNewsIds],
          },
        });
      }
    }

    setDraft(draftClone);
    if (tourneyClone) setTournament(tourneyClone);
    setMatch(mNext);

    if (!fromNet && curNet.connected && curNet.role === 'host') {
      onlineNet.send({ type: 'MATCH_CTRL', action: 'instant' });
    }
  }, []);

  // Online message listener
  useEffect(() => {
    const unsub = onlineNet.subscribeMessages((msg: NetEnvelope) => {
      const st = stateRef.current;

      if (msg.type === 'HELLO' && st.net.role === 'host') {
        const peerName = (msg.name as string) || 'Arkadaşın';
        onlineNet.updateSnapshot({
          connected: true,
          peerName,
          statusText: `${peerName} ile Canlı Bağlı (Oda: ${st.net.roomCode})`,
        });
        setOnlineMsg(`${peerName} odaya bağlandı! Lig ve takım seçip draftı başlatabilirsin.`);
        onlineNet.send(
          {
            type: 'WELCOME',
            hostName: st.teamName || '1. Oyuncu (Host)',
            mode: st.mode,
            leagues: [...st.leagues],
            clubs: [...st.clubs],
            opp: st.opp,
            format: st.format,
            strictPos: st.strictPos,
          },
          true
        );
      } else if (msg.type === 'WELCOME' && st.net.role === 'guest') {
        const hostName = (msg.hostName as string) || 'Oda Kurucu';
        onlineNet.updateSnapshot({
          connected: true,
          peerName: hostName,
          statusText: `${hostName} ile Canlı Bağlı (Oda: ${st.net.roomCode})`,
        });
        if (msg.mode) setMode(msg.mode as GameModeId);
        if (Array.isArray(msg.leagues)) setLeagues(new Set(msg.leagues as string[]));
        if (Array.isArray(msg.clubs)) setClubs(new Set(msg.clubs as string[]));
        if (msg.opp != null) setOpp(Number(msg.opp));
        if (msg.format) setFormat(msg.format as 'snake' | 'linear');
        if (msg.strictPos != null) setStrictPos(Boolean(msg.strictPos));
        setOnlineMsg(`${hostName} odasına canlı bağlandın! Oda kurucunun draftı başlatması bekleniyor.`);
      } else if (msg.type === 'START_DRAFT') {
        const nextMode = (msg.mode as GameModeId) || st.mode;
        const nextLeagues = new Set((msg.leagues as string[]) || []);
        const nextClubs = new Set((msg.clubs as string[]) || []);
        const nextOpp = Number(msg.opp ?? st.opp);
        const nextFormat = (msg.format as 'snake' | 'linear') || st.format;
        const nextStrict = msg.strictPos != null ? Boolean(msg.strictPos) : st.strictPos;

        setMode(nextMode);
        setLeagues(nextLeagues);
        setClubs(nextClubs);
        setOpp(nextOpp);
        setFormat(nextFormat);
        setStrictPos(nextStrict);
        setHumanCount(2);

        const res = buildDraftState({
          mode: nextMode,
          leagues: nextLeagues,
          clubs: nextClubs,
          opp: nextOpp,
          humanCount: 2,
          format: nextFormat,
          strictPos: nextStrict,
          netConnected: true,
          myTeamIdx: st.net.myTeamIdx,
        });
        if (res.state) {
          const teamNames = (msg.teamNames as string[]) || [];
          if (teamNames[0]) res.state.teams[0].name = teamNames[0];
          if (teamNames[1]) res.state.teams[1].name = teamNames[1];
          if (Array.isArray(msg.order)) res.state.order = msg.order as number[];
          onlineNet.updateSnapshot({ connected: true });
          onlineNet.resetReady();
          setDraft(res.state);
          setTournament(null);
          setLeague(null);
          setOnlineModalOpen(false);
          setView('draft');
        }
      } else if (msg.type === 'PICK') {
        applyPickDirectly(Number(msg.playerId), Boolean(msg.isCpu));
      } else if (msg.type === 'WHEEL_RESULT') {
        const ids = (msg.offeredIds as number[]) || [];
        setWheel((w) => ({
          ...w,
          spinning: false,
          selectedClub: (msg.club as string) || null,
          offeredPlayers: ids.map((id) => PLAYERS_BY_ID[id]).filter(Boolean),
          jokers: Number(msg.jokers ?? w.jokers),
        }));
      } else if (msg.type === 'AUTO_COMPLETE_SYNC') {
        if (st.draft && Array.isArray(msg.picksByTeam)) {
          const next = cloneDraftState(st.draft);
          next.taken.clear();
          (msg.picksByTeam as number[][]).forEach((idList, idx) => {
            if (next.teams[idx]) {
              next.teams[idx].picks = idList.map((id) => PLAYERS_BY_ID[id]).filter(Boolean);
              next.teams[idx].spent = next.teams[idx].picks.reduce((s, p) => s + cost(p), 0);
              idList.forEach((id) => next.taken.add(id));
            }
          });
          next.k = next.order.length;
          next.teams.forEach((tm) => ensureTeamLineup(tm));
          setDraft(next);
          if (!next.m.career) {
            setTournament(initTournamentState(next.teams));
          }
          setView('identity');
        }
      } else if (msg.type === 'CAREER_INIT' || msg.type === 'CAREER_SYNC') {
        if (st.draft && msg.league && Array.isArray(msg.teams)) {
          const nextDraft = cloneDraftState(st.draft);
          nextDraft.teams = msg.teams as typeof nextDraft.teams;
          const rawLg = msg.league as Omit<LeagueState, 'usedEventIds' | 'usedNewsIds'> & {
            usedEventIds?: string[];
            usedNewsIds?: string[];
          };
          const hydratedLg: LeagueState = {
            ...rawLg,
            usedEventIds: new Set(rawLg.usedEventIds || []),
            usedNewsIds: new Set(rawLg.usedNewsIds || []),
          };
          setDraft(nextDraft);
          setLeague(hydratedLg);
          if (msg.type === 'CAREER_INIT') {
            setView('league_hub');
          }
        }
      } else if (msg.type === 'IDENTITY_SYNC') {
        if (st.draft) {
          const ti = Number(msg.teamIdx);
          const next = cloneDraftState(st.draft);
          const tm = next.teams[ti];
          if (tm) {
            if (msg.name) tm.name = String(msg.name);
            if (msg.customIdentity) {
              tm.customIdentity = msg.customIdentity as typeof tm.customIdentity;
            }
            tm.identityDone = Boolean(msg.identityDone);
            setDraft(next);
          }
        }
      } else if (msg.type === 'LINEUP_SYNC') {
        if (st.draft) {
          const ti = Number(msg.teamIdx);
          const next = cloneDraftState(st.draft);
          const tm = next.teams[ti];
          if (tm) {
            if (msg.name) tm.name = String(msg.name);
            if (msg.customIdentity) {
              tm.customIdentity = msg.customIdentity as typeof tm.customIdentity;
            }
            tm.formation = (msg.formation as FormationName) || '4-3-3';
            tm.starters = ((msg.starterIds as number[]) || [])
              .map((id) => PLAYERS_BY_ID[id])
              .filter(Boolean);
            tm.bench = ((msg.benchIds as number[]) || [])
              .map((id) => PLAYERS_BY_ID[id])
              .filter(Boolean);
            setDraft(next);
            onlineNet.setReady(ti, Boolean(msg.ready));
          }
        }
      } else if (msg.type === 'MATCH_SYNC') {
        if (!st.draft) return;
        const plan = hydrateNetworkPlan(msg.plan as SerializedMatchPlan);
        const cloned = cloneDraftState(st.draft);
        const isCareer = !!cloned.m.career;
        cloned.teams.forEach((tm) => ensureTeamLineup(tm, st.league, isCareer));
        const a = Number(msg.a);
        const b = Number(msg.b);
        const tmId = (msg.tourneyMatchId as string) || null;
        if (!isCareer && !st.tournament) setTournament(initTournamentState(cloned.teams));
        const mState = createInitialMatchState(a, b, tmId, plan, cloned.teams, st.league, isCareer);
        if (msg.autoStart) mState.run = 1;
        setDraft(cloned);
        setMatch(mState);
        setView('match');
      } else if (msg.type === 'MATCH_CTRL') {
        if (msg.action === 'toggle') {
          setMatch((prev) => (prev ? { ...prev, run: prev.run ? 0 : 1 } : prev));
        } else if (msg.action === 'speed') {
          const spd = Number(msg.speed) as 1 | 2 | 4;
          setMatch((prev) => (prev ? { ...prev, speed: spd } : prev));
        } else if (msg.action === 'instant') {
          handleFinishInstantly(true);
        }
      } else if (msg.type === 'CHAT') {
        onlineNet.pushChat((msg.sender as string) || 'Rakip', (msg.text as string) || '');
      }
    });
    return unsub;
  }, [applyPickDirectly, handleFinishInstantly]);

  // Auto-join room or ?autostart=1 for automated testability
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        const res = onlineNet.joinRoom(roomParam, stateRef.current.teamName);
        if (res.ok) {
          setOnlineModalOpen(true);
          setOnlineMsg(`${res.code} numaralı davet odasına bağlanılıyor...`);
        }
        return;
      }

      const autostart = params.get('autostart');
      if (autostart === '1' || autostart === 'career') {
        const res = buildDraftState({
          mode: 'career',
          leagues: new Set(MODERN_LEAGUES),
          clubs: new Set(),
          opp: 1,
          humanCount: 1,
          format: 'snake',
          strictPos: true,
        });
        if (res.state) {
          const d = res.state;
          while (d.k < d.order.length) {
            const ti = d.order[d.k];
            const p = chooseCpuPlayer(d, d.teams[ti], true);
            if (!p) break;
            d.teams[ti].picks.push(p);
            d.teams[ti].spent += cost(p);
            siblingIds(d, p).forEach((id) => d.taken.add(id));
            d.k++;
          }
          d.teams[0].name = 'Atletik İstanbul';
          d.teams.forEach((tm) => ensureTeamLineup(tm, null, false));
          const { teams: allTeams, league: lg } = initCareerLeague(d.teams, d.m.budget);
          d.teams = allTeams;
          setDraft(d);
          setLeague(lg);
          setView('league_hub');
        }
      }
    } catch {
      // ignore query parsing errors
    }
  }, []);

  // CPU draft turn loop
  useEffect(() => {
    if (cpuTimerRef.current != null) {
      window.clearTimeout(cpuTimerRef.current);
      cpuTimerRef.current = null;
    }
    if (view !== 'draft' || !draft || draft.k >= draft.order.length) return;
    const ti = draft.order[draft.k];
    const activeTeam = draft.teams[ti];
    if (!activeTeam || activeTeam.isHuman) return;
    if (net.connected && net.role !== 'host') return;

    cpuTimerRef.current = window.setTimeout(() => {
      const cur = stateRef.current;
      if (!cur.draft || cur.draft.k >= cur.draft.order.length) return;
      const curTi = cur.draft.order[cur.draft.k];
      const curTeam = cur.draft.teams[curTi];
      if (!curTeam || curTeam.isHuman) return;
      const chosen = chooseCpuPlayer(cur.draft, curTeam, cur.strictPos);
      if (chosen) {
        applyPickDirectly(chosen.id, true);
        if (cur.net.connected && cur.net.role === 'host') {
          onlineNet.send({ type: 'PICK', playerId: chosen.id, isCpu: true });
        }
      }
    }, 280);

    return () => {
      if (cpuTimerRef.current != null) {
        window.clearTimeout(cpuTimerRef.current);
        cpuTimerRef.current = null;
      }
    };
  }, [view, draft, net.connected, net.role, applyPickDirectly]);

  // Match minute interval simulation
  useEffect(() => {
    if (matchTimerRef.current != null) {
      window.clearInterval(matchTimerRef.current);
      matchTimerRef.current = null;
    }
    if (view !== 'match' || !match || !match.run) return;

    const tickMs = Math.max(45, Math.round(330 / match.speed));
    matchTimerRef.current = window.setInterval(() => {
      const {
        match: curMatch,
        draft: curDraft,
        tournament: curTourney,
        league: curLeague,
      } = stateRef.current;
      if (!curMatch || !curDraft || !curMatch.run) return;

      const mNext: MatchState = {
        ...curMatch,
        sc: [...curMatch.sc] as [number, number],
        redCards: [...curMatch.redCards] as [number, number],
        perfFactor: [...curMatch.perfFactor] as [number, number],
        shots: [...curMatch.shots] as [number, number],
        onTarget: [...curMatch.onTarget] as [number, number],
        saves: [...curMatch.saves] as [number, number],
        xg: [...curMatch.xg] as [number, number],
        goalsList: [[...curMatch.goalsList[0]], [...curMatch.goalsList[1]]],
        playerStats: { ...curMatch.playerStats },
        log: [...curMatch.log],
      };

      mNext.min += 1;
      stepMatchMinute(mNext, mNext.min, curDraft.teams);

      if (mNext.min >= mNext.plan.maxMin) {
        const draftClone = cloneDraftState(curDraft);
        const tourneyClone = curTourney
          ? { ...curTourney, matches: curTourney.matches.map((x) => ({ ...x })) }
          : null;
        const isCareer = !!draftClone.m.career;
        finalizeMatchState(mNext, draftClone.teams, tourneyClone, isCareer);

        if (isCareer && curLeague && !mNext.leagueWeekRecorded) {
          const lgClone = cloneLeague(curLeague);
          finalizeCareerWeekAfterUserMatch(
            lgClone,
            draftClone.teams,
            { a: mNext.a, b: mNext.b },
            mNext.sc[0],
            mNext.sc[1],
            mNext.goalsList[0],
            mNext.goalsList[1],
            mNext.playerStats
          );
          mNext.leagueWeekRecorded = true;
          setLeague(lgClone);
          if (stateRef.current.net.connected && stateRef.current.net.role === 'host') {
            onlineNet.send({
              type: 'CAREER_SYNC',
              teams: draftClone.teams,
              league: {
                ...lgClone,
                usedEventIds: [...lgClone.usedEventIds],
                usedNewsIds: [...lgClone.usedNewsIds],
              },
            });
          }
        }

        setDraft(draftClone);
        if (tourneyClone) setTournament(tourneyClone);
      }

      setMatch(mNext);
    }, tickMs);

    return () => {
      if (matchTimerRef.current != null) {
        window.clearInterval(matchTimerRef.current);
        matchTimerRef.current = null;
      }
    };
  }, [view, match?.run, match?.speed]);

  const handleSelectMode = (modeId: GameModeId) => {
    setMode(modeId);
    setSetupErr('');
    if (modeId === 'iconic') {
      setLeagues(new Set(['İkonik Takımlar']));
      setClubs(new Set(ICONIC_CLUBS));
    } else if (modeId === 'career') {
      const nextL = new Set(leagues);
      nextL.delete('İkonik Takımlar');
      if (nextL.size === 0) {
        MODERN_LEAGUES.forEach((l) => nextL.add(l));
      }
      setLeagues(nextL);
      const nextC = new Set(
        [...clubs].filter((c) => CLUB_TO_LEAGUE[c] !== 'İkonik Takımlar')
      );
      setClubs(nextC);
      setOpp(1);
    } else {
      if (leagues.size === 1 && leagues.has('İkonik Takımlar')) {
        setLeagues(new Set(MODERN_LEAGUES));
        setClubs(new Set());
      }
    }
  };

  const handleStartDraft = () => {
    setSetupErr('');
    const res = buildDraftState({
      mode,
      leagues,
      clubs,
      opp,
      humanCount,
      format,
      strictPos,
      netConnected: net.connected,
      myTeamIdx: net.myTeamIdx,
    });
    if (!res.state) {
      setSetupErr(res.error);
      return;
    }

    const d = res.state;
    if (net.connected) {
      d.teams[0].name = net.role === 'host' ? teamName : net.peerName || '1. Oyuncu';
      d.teams[1].name = net.role === 'guest' ? teamName : net.peerName || '2. Oyuncu';
      onlineNet.resetReady();
      if (net.role === 'host') {
        onlineNet.send({
          type: 'START_DRAFT',
          mode,
          leagues: [...res.effectiveLeagues],
          clubs: [...clubs],
          opp,
          format,
          strictPos,
          teamNames: d.teams.map((t) => t.name),
          order: d.order,
        });
      }
    } else if (teamName.trim()) {
      d.teams[0].name = teamName.trim();
    }

    setLeagues(res.effectiveLeagues);
    setDraft(d);
    setTournament(null);
    setLeague(null);
    setMatch(null);
    setWheel({ spinning: false, angle: 0, selectedClub: null, offeredPlayers: [], jokers: 3 });
    setView('draft');
  };

  const handleAutoCompleteDraft = () => {
    if (!draft) return;
    const next = cloneDraftState(draft);
    while (next.k < next.order.length) {
      const ti = next.order[next.k];
      const tm = next.teams[ti];
      const chosen = chooseCpuPlayer(next, tm, strictPos);
      if (!chosen) {
        const fallback = next.pool.find((p) => !next.taken.has(p.id));
        if (!fallback) break;
        tm.picks.push(fallback);
        tm.spent += cost(fallback);
        siblingIds(next, fallback).forEach((id) => next.taken.add(id));
        next.k++;
        continue;
      }
      tm.picks.push(chosen);
      tm.spent += cost(chosen);
      siblingIds(next, chosen).forEach((id) => next.taken.add(id));
      next.k++;
    }
    next.teams.forEach((tm) => ensureTeamLineup(tm, null, false));
    setDraft(next);
    if (!next.m.career) {
      setTournament(initTournamentState(next.teams));
    }
    setView('identity');

    if (net.connected && net.role === 'host') {
      onlineNet.send({
        type: 'AUTO_COMPLETE_SYNC',
        picksByTeam: next.teams.map((t) => t.picks.map((p) => p.id)),
      });
    }
  };

  const handleUndoPick = () => {
    if (!draft || draft.history.length === 0 || net.connected) return;
    const next = cloneDraftState(draft);
    const removeOne = () => {
      const last = next.history.pop();
      if (!last) return null;
      const tm = next.teams[last.teamIdx];
      const idx = tm.picks.findIndex((p) => p.id === last.playerId);
      if (idx >= 0) {
        const [removed] = tm.picks.splice(idx, 1);
        tm.spent = Math.max(0, tm.spent - last.paid);
        siblingIds(next, removed).forEach((id) => next.taken.delete(id));
      }
      next.k = Math.max(0, next.k - 1);
      return last;
    };

    const firstRemoved = removeOne();
    while (firstRemoved && next.history.length > 0 && next.history[next.history.length - 1].isCpu) {
      removeOne();
    }
    next.budgetWarning = '';
    setDraft(next);
  };

  const handleSpinWheel = (useJoker = false) => {
    if (!draft || draft.k >= draft.order.length) return;
    const ti = draft.order[draft.k];
    const tm = draft.teams[ti];
    const wheelClubs = getWheelClubsForTurn(draft, tm, strictPos);
    if (wheelClubs.length === 0) return;

    const nextJokers = useJoker ? Math.max(0, wheel.jokers - 1) : wheel.jokers;
    const targetIdx = (Math.random() * wheelClubs.length) | 0;
    const landedClub = wheelClubs[targetIdx];
    const slice = (Math.PI * 2) / wheelClubs.length;
    // Top pointer sits at -PI/2; rotate wheel so slice targetIdx centers under -PI/2
    const desiredMod = -Math.PI / 2 - (targetIdx + 0.5) * slice;
    const extraSpins = 4 * Math.PI * 2;
    const startAngle = wheel.angle;
    const delta =
      extraSpins +
      (((desiredMod - startAngle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const durationMs = 1350;
    const t0 = performance.now();

    setWheel((w) => ({
      ...w,
      spinning: true,
      selectedClub: null,
      offeredPlayers: [],
      jokers: nextJokers,
    }));

    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      const curAngle = startAngle + delta * eased;
      if (p < 1) {
        setWheel((w) => ({ ...w, angle: curAngle }));
        wheelRafRef.current = requestAnimationFrame(frame);
      } else {
        const curState = stateRef.current.draft || draft;
        const offered = curState.pool
          .filter((pl) => pl.c === landedClub && !curState.taken.has(pl.id))
          .filter((pl) => canPickPlayer(curState, curState.teams[ti], pl, strictPos))
          .sort((a, b) => b.r - a.r);

        setWheel({
          spinning: false,
          angle: curAngle,
          selectedClub: landedClub,
          offeredPlayers: offered,
          jokers: nextJokers,
        });

        if (net.connected) {
          onlineNet.send({
            type: 'WHEEL_RESULT',
            club: landedClub,
            offeredIds: offered.map((pl) => pl.id),
            jokers: nextJokers,
          });
        }
      }
    };
    if (wheelRafRef.current != null) cancelAnimationFrame(wheelRafRef.current);
    wheelRafRef.current = requestAnimationFrame(frame);
  };

  const handleUpdateIdentity = (
    teamIdx: number,
    patch: {
      name?: string;
      type?: 'custom' | 'club';
      shape?: IdentityShape;
      c1?: string;
      c2?: string;
      club?: string;
    }
  ) => {
    if (!draft) return;
    const next = cloneDraftState(draft);
    const tm = next.teams[teamIdx];
    if (!tm) return;
    if (patch.name !== undefined) tm.name = patch.name;
    if (patch.type) tm.customIdentity.type = patch.type;
    if (patch.shape) tm.customIdentity.shape = patch.shape;
    if (patch.c1) tm.customIdentity.c1 = patch.c1;
    if (patch.c2) tm.customIdentity.c2 = patch.c2;
    if (patch.club) tm.customIdentity.club = patch.club;
    setDraft(next);
  };

  const handleConfirmIdentity = (teamIdx: number) => {
    if (!draft) return;
    const next = cloneDraftState(draft);
    const tm = next.teams[teamIdx];
    if (tm) {
      if (!tm.name.trim()) tm.name = 'Kulübüm';
      tm.identityDone = true;
      ensureTeamLineup(tm, league, !!next.m.career);
      if (net.connected) {
        onlineNet.send({
          type: 'IDENTITY_SYNC',
          teamIdx,
          name: tm.name,
          customIdentity: tm.customIdentity,
          identityDone: true,
        });
      }
    }
    setDraft(next);
    setSwapErr('');
    setView('result');
  };

  const handleSelectFormation = (teamIdx: number, form: FormationName) => {
    if (!draft) return;
    const next = cloneDraftState(draft);
    const tm = next.teams[teamIdx];
    if (!tm) return;
    autoBuildLineupForTeam(tm, form, league, !!next.m.career);
    setDraft(next);
    setSwapErr('');
  };

  const handleAutoLineup = (teamIdx: number) => {
    if (!draft) return;
    const next = cloneDraftState(draft);
    const tm = next.teams[teamIdx];
    if (!tm) return;
    autoBuildLineupForTeam(tm, tm.formation || '4-3-3', league, !!next.m.career);
    setDraft(next);
    setSwapErr('');
  };

  const handleSwapPlayers = (teamIdx: number, id1: number, id2: number) => {
    if (!draft) return;
    const next = cloneDraftState(draft);
    const tm = next.teams[teamIdx];
    if (!tm) return;
    const res = swapTeamPlayers(tm, id1, id2, league, !!next.m.career);
    if (!res.swapped) {
      setSwapErr(res.error);
      return;
    }
    setSwapErr('');
    setDraft(next);
  };

  const handleProceedFromLineup = () => {
    if (!draft) return;
    const isCareer = !!draft.m.career;
    if (isCareer) {
      if (!league) {
        setView('league_select');
      } else {
        setView('league_hub');
      }
      return;
    }

    if (net.connected) {
      const myTm = draft.teams[net.myTeamIdx];
      if (myTm) {
        ensureTeamLineup(myTm);
        onlineNet.setReady(net.myTeamIdx, true);
        onlineNet.send({
          type: 'LINEUP_SYNC',
          teamIdx: net.myTeamIdx,
          name: myTm.name,
          customIdentity: myTm.customIdentity,
          formation: myTm.formation,
          starterIds: (myTm.starters || []).map((p) => p.id),
          benchIds: (myTm.bench || []).map((p) => p.id),
          ready: true,
        });
      }
      const otherReady = !!onlineNet.snapshot.readyMap[1 - net.myTeamIdx];
      if (!otherReady || net.role !== 'host') return;
    }

    const nextTourney = tournament || initTournamentState(draft.teams);
    if (!tournament) setTournament(nextTourney);
    const actMatch = getActiveTournamentMatch(nextTourney);
    if (actMatch && actMatch.a != null && actMatch.b != null) {
      setupMatch(actMatch.a, actMatch.b, actMatch.id);
    } else {
      setupMatch(0, 1);
    }
  };

  const handleSelectPremierLeague = () => {
    if (!draft) return;
    if (net.connected && net.role === 'guest') return;
    const { teams: allTeams, league: lg } = initCareerLeague(draft.teams, draft.m.budget);
    const nextDraft = cloneDraftState(draft);
    nextDraft.teams = allTeams;
    setDraft(nextDraft);
    setLeague(lg);
    setView('league_hub');
    if (net.connected && net.role === 'host') {
      onlineNet.send({
        type: 'CAREER_INIT',
        teams: allTeams,
        league: {
          ...lg,
          usedEventIds: [...lg.usedEventIds],
          usedNewsIds: [...lg.usedNewsIds],
        },
      });
    }
  };

  const handlePlayCareerMatch = () => {
    if (!draft || !league || league.week > league.maxWeeks) return;
    const roundMatches = league.schedule[league.week - 1] || [];
    const userMatch = roundMatches.find(
      (m) => !m.done && (draft.teams[m.a]?.isHuman || draft.teams[m.b]?.isHuman)
    );
    if (!userMatch) return;
    setupMatch(userMatch.a, userMatch.b, null);
  };

  const handleSimulateCareerSeason = () => {
    if (!draft || !league) return;
    const lgClone = cloneLeague(league);
    const draftClone = cloneDraftState(draft);
    simulateRestOfLeagueSeason(lgClone, draftClone.teams);
    setDraft(draftClone);
    setLeague(lgClone);
    if (net.connected && net.role === 'host') {
      onlineNet.send({
        type: 'CAREER_SYNC',
        teams: draftClone.teams,
        league: {
          ...lgClone,
          usedEventIds: [...lgClone.usedEventIds],
          usedNewsIds: [...lgClone.usedNewsIds],
        },
      });
    }
  };

  const handleResetToSetup = () => {
    if (matchTimerRef.current != null) {
      window.clearInterval(matchTimerRef.current);
      matchTimerRef.current = null;
    }
    if (cpuTimerRef.current != null) {
      window.clearTimeout(cpuTimerRef.current);
      cpuTimerRef.current = null;
    }
    if (wheelRafRef.current != null) {
      cancelAnimationFrame(wheelRafRef.current);
      wheelRafRef.current = null;
    }
    setDraft(null);
    setTournament(null);
    setLeague(null);
    setMatch(null);
    setSetupErr('');
    setSwapErr('');
    setView('setup');
  };

  const handleGoMatchDirect = () => {
    if (!draft) return;
    if (draft.k < draft.order.length) {
      handleAutoCompleteDraft();
      return;
    }
    if (draft.m.career) {
      setView(league ? 'league_hub' : 'league_select');
      return;
    }
    const nextTourney = tournament || initTournamentState(draft.teams);
    if (!tournament) setTournament(nextTourney);
    const actMatch = getActiveTournamentMatch(nextTourney);
    if (actMatch && actMatch.a != null && actMatch.b != null) {
      setupMatch(actMatch.a, actMatch.b, actMatch.id);
    } else {
      setupMatch(0, 1);
    }
  };

  return (
    <div className="mx-auto max-w-[1260px] px-3 pb-14 pt-4 sm:px-4">
      <HeaderBar
        view={view}
        draft={draft}
        league={league}
        net={net}
        onlineModalOpen={onlineModalOpen}
        onToggleOnlineModal={() => setOnlineModalOpen((o) => !o)}
        onNavigate={(nextV) => setView(nextV)}
        onGoMatchDirect={handleGoMatchDirect}
        onResetToSetup={handleResetToSetup}
        onSendChat={(text) => {
          const myLabel = net.role === 'host' ? teamName || 'Host' : teamName || 'Misafir';
          onlineNet.pushChat('Sen', text);
          onlineNet.send({ type: 'CHAT', sender: myLabel, text });
        }}
      />

      <OnlineModal
        open={onlineModalOpen}
        net={net}
        teamName={teamName}
        onlineMsg={onlineMsg}
        onTeamNameChange={setTeamName}
        onClose={() => setOnlineModalOpen(false)}
        onCreateRoom={() => {
          const code = onlineNet.createRoom(teamName);
          setOnlineMsg(
            `Oda Kodu ${code} oluşturuldu. Aşağıdaki davet linkini veya 5 haneli kodu arkadaşına gönder.`
          );
        }}
        onJoinRoom={(code) => {
          const res = onlineNet.joinRoom(code, teamName);
          if (!res.ok) {
            setOnlineMsg('Lütfen arkadaşının gönderdiği 5 haneli Oda Kodunu girin.');
            return;
          }
          setOnlineMsg(`${res.code} numaralı odaya bulut rölesi üzerinden bağlanılıyor...`);
        }}
        onDisconnect={() => {
          onlineNet.disconnect(false);
          setOnlineMsg('Bağlantı sonlandırıldı.');
        }}
        onCopyFeedback={(msg) => setOnlineMsg(msg)}
      />

      <main>
        {view === 'setup' && (
          <SetupView
            mode={mode}
            opp={opp}
            humanCount={humanCount}
            format={format}
            strictPos={strictPos}
            teamName={teamName}
            err={setupErr}
            net={net}
            onSelectMode={handleSelectMode}
            onChangeOpp={setOpp}
            onChangeHumanCount={setHumanCount}
            onChangeFormat={setFormat}
            onChangeStrictPos={setStrictPos}
            onChangeTeamName={setTeamName}
            onContinueToClubs={() => {
              setSetupErr('');
              setView('clubs');
            }}
            onOpenOnlineModal={() => setOnlineModalOpen(true)}
          />
        )}

        {view === 'clubs' && (
          <ClubSelectView
            mode={mode}
            leagues={leagues}
            clubs={clubs}
            err={setupErr}
            onToggleLeague={(lgId) => {
              setSetupErr('');
              const next = new Set(leagues);
              if (next.has(lgId)) next.delete(lgId);
              else next.add(lgId);
              setLeagues(next);
            }}
            onToggleClub={(club) => {
              setSetupErr('');
              const next = new Set(clubs);
              if (next.has(club)) next.delete(club);
              else next.add(club);
              setClubs(next);
            }}
            onSelectPreset={(preset) => {
              setSetupErr('');
              if (preset === 'all') {
                setLeagues(new Set(MODERN_LEAGUES));
                setClubs(new Set());
              } else if (preset === 'pl') {
                setLeagues(new Set(['Premier Lig']));
                setClubs(new Set());
              } else if (preset === 'superlig') {
                setLeagues(new Set(['Trendyol Süper Lig']));
                setClubs(new Set());
              } else if (preset === 'iconic') {
                setLeagues(new Set(['İkonik Takımlar']));
                setClubs(new Set(ICONIC_CLUBS));
              } else {
                setLeagues(new Set());
                setClubs(new Set());
              }
            }}
            onBack={() => setView('setup')}
            onStartDraft={handleStartDraft}
          />
        )}

        {view === 'draft' && draft && (
          <DraftView
            draft={draft}
            wheel={wheel}
            strictPos={strictPos}
            net={net}
            onPickPlayer={(pid) => {
              applyPickDirectly(pid, false);
              if (net.connected) {
                onlineNet.send({ type: 'PICK', playerId: pid, isCpu: false });
              }
            }}
            onAutoComplete={handleAutoCompleteDraft}
            onUndo={handleUndoPick}
            onProceedAfterDraft={() => setView('identity')}
            onSpinWheel={handleSpinWheel}
            onResetToSetup={handleResetToSetup}
          />
        )}

        {view === 'identity' && draft && (
          <IdentityView
            draft={draft}
            net={net}
            onUpdateIdentity={handleUpdateIdentity}
            onConfirmIdentity={handleConfirmIdentity}
          />
        )}

        {view === 'result' && draft && (
          <LineupView
            draft={draft}
            league={league}
            net={net}
            swapError={swapErr}
            onSelectFormation={handleSelectFormation}
            onAutoLineup={handleAutoLineup}
            onSwapPlayers={handleSwapPlayers}
            onProceed={handleProceedFromLineup}
            onEditIdentity={() => setView('identity')}
          />
        )}

        {view === 'league_select' && draft && (
          <CareerLeagueSelectorView
            teamName={
              draft.teams
                .filter((t) => t.isHuman)
                .map((t) => t.name)
                .join(' & ') || 'Kulübün'
            }
            isGuestWaiting={net.connected && net.role === 'guest'}
            onSelectPremierLeague={handleSelectPremierLeague}
            onBackToLineup={() => setView('result')}
          />
        )}

        {view === 'league_hub' && draft && league && (
          <CareerHubView
            league={league}
            teams={draft.teams}
            myTeamIdx={net.connected ? net.myTeamIdx : 0}
            onSwitchTab={(tab: LeagueTab) =>
              setLeague((prev) => (prev ? { ...prev, tab } : prev))
            }
            onChangeViewWeek={(wNum) =>
              setLeague((prev) => (prev ? { ...prev, viewWeek: wNum } : prev))
            }
            onPlayNextMatch={handlePlayCareerMatch}
            onSimulateSeason={handleSimulateCareerSeason}
            onEditLineup={() => setView('result')}
            onResetToSetup={handleResetToSetup}
            onResolveEventChoice={(choice: CareerEventChoice) => {
              const lgClone = cloneLeague(league);
              const draftClone = cloneDraftState(draft);
              const userTeam = draftClone.teams[0];
              const msg = choice.effect({ lg: lgClone, userTeam });
              if (lgClone.activeEvent) {
                lgClone.eventHistory.unshift({
                  week: lgClone.week,
                  title: lgClone.activeEvent.title,
                  outcome: msg,
                });
              }
              setDraft(draftClone);
              setLeague(lgClone);
              return msg;
            }}
            onDismissEvent={() => {
              setLeague((prev) => {
                if (!prev) return prev;
                const next = cloneLeague(prev);
                next.activeEvent = null;
                if (next.pendingNewsAfterEvent) {
                  next.activeNews = next.pendingNewsAfterEvent;
                  next.pendingNewsAfterEvent = null;
                }
                return next;
              });
            }}
            onDismissNews={() => {
              setLeague((prev) => (prev ? { ...prev, activeNews: null } : prev));
            }}
          />
        )}

        {view === 'match' && draft && match && (
          <MatchView
            draft={draft}
            match={match}
            tournament={tournament}
            league={league}
            net={net}
            onToggleKickoff={() => {
              setMatch((prev) => (prev ? { ...prev, run: prev.run ? 0 : 1 } : prev));
              if (net.connected && net.role === 'host') {
                onlineNet.send({ type: 'MATCH_CTRL', action: 'toggle' });
              }
            }}
            onSetSpeed={(spd) => {
              setMatch((prev) => (prev ? { ...prev, speed: spd } : prev));
              if (net.connected && net.role === 'host') {
                onlineNet.send({ type: 'MATCH_CTRL', action: 'speed', speed: spd });
              }
            }}
            onFinishInstantly={() => handleFinishInstantly(false)}
            onStartNextTournamentMatch={(a, b, id) => setupMatch(a, b, id)}
            onBackAfterMatch={() => {
              if (draft.m.career && league) {
                setView('league_hub');
              } else {
                setView('result');
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
