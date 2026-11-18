import { PLAYERS_BY_ID } from '../data/database';
import type {
  LeagueState,
  LineupPlayer,
  MatchPlan,
  MatchState,
  PenaltyData,
  Position,
  ScheduledMatchEvent,
  SideEvaluation,
  Team,
  TournamentMatch,
  TournamentState,
} from '../types/game';
import {
  buildPitchRowsForTeam,
  ensureTeamLineup,
  getEffectivePlayerRating,
  groupStartersForPitch,
} from './lineupLogic';

const av = (a: LineupPlayer[]): number =>
  a.reduce((s, p) => s + (p.effR != null ? p.effR : p.r), 0) / (a.length || 1);

export function totRating(
  t: Team,
  lg?: LeagueState | null,
  isCareer = false
): number {
  const rows = buildPitchRowsForTeam(t, lg, isCareer);
  let sum = 0;
  rows.forEach((r) => {
    r.players.forEach((p) => {
      sum += getEffectivePlayerRating(p, r.pos);
    });
  });
  return sum;
}

export function avgRating(
  t: Team,
  lg?: LeagueState | null,
  isCareer = false
): number {
  ensureTeamLineup(t, lg, isCareer);
  return t.starters && t.starters.length ? totRating(t, lg, isCareer) / t.starters.length : 0;
}

export function side(
  t: Team,
  lg?: LeagueState | null,
  isCareer = false
): SideEvaluation {
  const L = groupStartersForPitch(t, lg, isCareer);
  const pitchRows = buildPitchRowsForTeam(t, lg, isCareer);
  const avg = avgRating(t, lg, isCareer);
  return {
    L,
    pitchRows,
    avg,
    att: (av(L.FWD) * 3 + av(L.MID) * 2) / 5,
    def: (av(L.DEF) * 3 + av(L.GK) * 2) / 5,
    mid: av(L.MID),
  };
}

export function pickGoalscorer(
  L: Record<Position, LineupPlayer[]>,
  sentOffSet: Set<number> = new Set()
): LineupPlayer | null {
  const weights: [LineupPlayer, number][] = [];
  const posShares: [Position, number][] = [
    ['FWD', 0.6],
    ['MID', 0.3],
    ['DEF', 0.1],
  ];
  for (const [k, baseShare] of posShares) {
    const activeGroup = (L[k] || []).filter((p) => !sentOffSet.has(p.id));
    if (!activeGroup.length) continue;

    const indivWeights = activeGroup.map((p) => {
      const rVal = p.effR != null ? p.effR : p.r;
      const starBoost = rVal >= 89 ? 1.35 : rVal >= 85 ? 1.18 : 1.0;
      return Math.pow(Math.max(6, rVal - 64), 2.1) * starBoost;
    });
    const sumIndiv = indivWeights.reduce((a, b) => a + b, 0) || 1;
    const avgGroupR =
      activeGroup.reduce((s, p) => s + (p.effR != null ? p.effR : p.r), 0) /
      activeGroup.length;
    const groupRatingMod = Math.pow(Math.max(0.65, (avgGroupR - 55) / 25), 1.35);
    const effectiveGroupShare = baseShare * groupRatingMod;

    activeGroup.forEach((p, idx) => {
      weights.push([p, effectiveGroupShare * (indivWeights[idx] / sumIndiv)]);
    });
  }
  if (!weights.length) return (L.FWD && L.FWD[0]) || (L.MID && L.MID[0]) || null;
  let r = Math.random() * weights.reduce((s, a) => s + a[1], 0);
  for (const [p, w] of weights) {
    if ((r -= w) <= 0) return p;
  }
  return weights[0][0];
}

export function pickAssister(
  L: Record<Position, LineupPlayer[]>,
  scorer: LineupPlayer | null,
  sentOffSet: Set<number> = new Set()
): LineupPlayer | null {
  const weights: [LineupPlayer, number][] = [];
  const entries: [Position, number][] = [
    ['MID', 5.0],
    ['FWD', 3.4],
    ['DEF', 1.2],
    ['GK', 0.1],
  ];
  for (const [k, posMult] of entries) {
    (L[k] || []).forEach((p) => {
      if ((scorer && p.id === scorer.id) || sentOffSet.has(p.id)) return;
      const rVal = p.effR != null ? p.effR : p.r;
      const ratingFactor = Math.pow(Math.max(8, rVal - 60), 1.7);
      weights.push([p, posMult * ratingFactor]);
    });
  }
  if (!weights.length) return null;
  let r = Math.random() * weights.reduce((s, a) => s + a[1], 0);
  for (const [p, w] of weights) {
    if ((r -= w) <= 0) return p;
  }
  return weights[0][0];
}

export function rollMatchScoreline(
  sA: SideEvaluation,
  sB: SideEvaluation,
  redCardMinutes: [number | null, number | null] = [null, null]
): { goals: [number, number]; netAdvantage: number } {
  const rawDiff = sA.avg - sB.avg;
  const attEdgeA = sA.att - sB.def;
  const attEdgeB = sB.att - sA.def;
  const scaledDiff = Math.max(
    -2.5,
    Math.min(2.5, rawDiff * 0.2 + (attEdgeA - attEdgeB) * 0.06)
  );
  const matchDaySwing = (Math.random() - 0.5) * 3.5;
  const redPenA = redCardMinutes[0] ? ((90 - redCardMinutes[0]) / 90) * 1.35 : 0;
  const redPenB = redCardMinutes[1] ? ((90 - redCardMinutes[1]) / 90) * 1.35 : 0;

  const netAdvantage = scaledDiff + matchDaySwing - redPenA + redPenB;
  const absAdv = Math.abs(netAdvantage);

  const isDraw = absAdv < 0.34 || (absAdv < 0.95 && Math.random() < 0.11);
  if (isDraw) {
    const drawScores: [number, number][] = [
      [1, 1],
      [1, 1],
      [2, 2],
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ];
    return {
      goals: drawScores[(Math.random() * drawScores.length) | 0],
      netAdvantage,
    };
  }

  const regWinner: 0 | 1 = netAdvantage >= 0 ? 0 : 1;
  const winEval = regWinner === 0 ? sA : sB;
  const loseEval = regWinner === 0 ? sB : sA;
  const dom = absAdv + Math.max(0, (winEval.att - loseEval.def) * 0.1);

  let pool: [number, number][];
  if (dom >= 2.2) {
    pool = [
      [2, 0],
      [3, 0],
      [3, 1],
      [3, 1],
      [4, 0],
      [4, 1],
      [4, 2],
      [5, 1],
      [5, 0],
      [3, 0],
    ];
  } else if (dom >= 1.25) {
    pool = [
      [2, 0],
      [2, 1],
      [2, 1],
      [3, 1],
      [3, 0],
      [3, 2],
      [4, 1],
      [1, 0],
    ];
  } else {
    pool = [
      [1, 0],
      [1, 0],
      [2, 1],
      [2, 0],
      [2, 1],
      [3, 2],
      [3, 1],
      [4, 2],
    ];
  }

  const ch = [...pool[(Math.random() * pool.length) | 0]] as [number, number];
  if (loseEval.def < 76.5 && Math.random() < 0.24) {
    ch[0] = Math.min(5, ch[0] + 1);
  }
  const goals: [number, number] = regWinner === 0 ? [ch[0], ch[1]] : [ch[1], ch[0]];
  return { goals, netAdvantage };
}

export function generateMatchPlan(
  _teamA: Team,
  _teamB: Team,
  sA: SideEvaluation,
  sB: SideEvaluation,
  allowExtraTime = true,
  aggOffset: [number, number] = [0, 0]
): MatchPlan {
  const scheduledByMin: ScheduledMatchEvent[][] = Array.from({ length: 121 }, () => []);
  const sentOff: [Set<number>, Set<number>] = [new Set(), new Set()];

  const redCardMinutes: [number | null, number | null] = [null, null];
  ([0, 1] as const).forEach((sideIdx) => {
    if (Math.random() < 0.12) {
      const rcMin = 20 + ((Math.random() * 56) | 0);
      redCardMinutes[sideIdx] = rcMin;
      const sObj = sideIdx === 0 ? sA : sB;
      const candidates = [...sObj.L.DEF, ...sObj.L.MID];
      const sentPlayer = candidates[(Math.random() * candidates.length) | 0];
      if (sentPlayer) {
        sentOff[sideIdx].add(sentPlayer.id);
        scheduledByMin[rcMin].push({
          type: 'red',
          side: sideIdx,
          min: rcMin,
          player: sentPlayer,
        });
      }
    }
  });

  const { goals: regGoals, netAdvantage } = rollMatchScoreline(sA, sB, redCardMinutes);
  const totRegA = regGoals[0] + (aggOffset[0] || 0);
  const totRegB = regGoals[1] + (aggOffset[1] || 0);
  const goesToET = totRegA === totRegB && allowExtraTime;

  const usedMinutes = new Set<number | null>([45, 90, 105, 120, redCardMinutes[0], redCardMinutes[1]]);
  function pickMinute(minStart: number, minEnd: number): number {
    for (let tries = 0; tries < 50; tries++) {
      const m = minStart + ((Math.random() * (minEnd - minStart)) | 0);
      if (!usedMinutes.has(m)) {
        usedMinutes.add(m);
        return m;
      }
    }
    return minStart + 2;
  }

  ([0, 1] as const).forEach((sideIdx) => {
    const count = regGoals[sideIdx];
    const sideObj = sideIdx === 0 ? sA : sB;
    const oppObj = sideIdx === 0 ? sB : sA;
    for (let g = 0; g < count; g++) {
      const min = pickMinute(4, 89);
      const rc = redCardMinutes[sideIdx];
      const activeSentOff = rc && min > rc ? sentOff[sideIdx] : new Set<number>();
      const scorer = pickGoalscorer(sideObj.L, activeSentOff);
      const assister = pickAssister(sideObj.L, scorer, activeSentOff);
      scheduledByMin[min].push({
        type: 'goal',
        side: sideIdx,
        min,
        scorer,
        assister,
        gk: oppObj.L.GK[0] || null,
      });
    }
  });

  let goesToPenalties = false;
  let penaltyData: PenaltyData | null = null;
  let finalWinnerSide: -1 | 0 | 1 =
    totRegA > totRegB ? 0 : totRegB > totRegA ? 1 : -1;

  if (goesToET) {
    if (Math.random() < 0.48) {
      const etWinner: 0 | 1 = netAdvantage + (Math.random() - 0.5) * 2.0 >= 0 ? 0 : 1;
      const etMin = pickMinute(93, 118);
      const sideObj = etWinner === 0 ? sA : sB;
      const oppObj = etWinner === 0 ? sB : sA;
      const scorer = pickGoalscorer(sideObj.L, sentOff[etWinner]);
      const assister = pickAssister(sideObj.L, scorer, sentOff[etWinner]);
      scheduledByMin[etMin].push({
        type: 'goal',
        side: etWinner,
        min: etMin,
        scorer,
        assister,
        gk: oppObj.L.GK[0] || null,
      });
      finalWinnerSide = etWinner;
    } else {
      goesToPenalties = true;
      const penWinner: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
      const penPatterns: [number, number][] = [
        [5, 4],
        [4, 3],
        [5, 3],
        [4, 2],
        [6, 5],
      ];
      const pat = penPatterns[(Math.random() * penPatterns.length) | 0];
      const penScore: [number, number] = penWinner === 0 ? [pat[0], pat[1]] : [pat[1], pat[0]];
      finalWinnerSide = penWinner;

      const takersA = [...sA.L.FWD, ...sA.L.MID].slice(0, 5).map((p) => p.n);
      const takersB = [...sB.L.FWD, ...sB.L.MID].slice(0, 5).map((p) => p.n);
      penaltyData = {
        score: penScore,
        winnerSide: penWinner,
        takersA,
        takersB,
      };
    }
  }

  const maxMin = goesToET ? 120 : 90;
  for (let m = 2; m < maxMin; m++) {
    if (m === 45 || m === 90 || m === 105 || scheduledByMin[m].length > 0) continue;
    if (Math.random() < 0.21) {
      const attSide: 0 | 1 = Math.random() < 0.5 ? 0 : 1;
      const sideObj = attSide === 0 ? sA : sB;
      const oppObj = attSide === 0 ? sB : sA;
      const shooter = pickGoalscorer(sideObj.L, sentOff[attSide]);
      const gk = oppObj.L.GK[0] || { n: 'Kaleci' };
      const r = Math.random();
      if (r < 0.55) {
        scheduledByMin[m].push({ type: 'save', side: attSide, min: m, player: shooter, gk });
      } else if (r < 0.82) {
        scheduledByMin[m].push({ type: 'miss', side: attSide, min: m, player: shooter });
      } else if (r < 0.92) {
        scheduledByMin[m].push({ type: 'post', side: attSide, min: m, player: shooter });
      } else {
        const defList = oppObj.L.DEF.length ? oppObj.L.DEF : oppObj.L.MID;
        const carded = defList[(Math.random() * defList.length) | 0];
        scheduledByMin[m].push({ type: 'card', side: (1 - attSide) as 0 | 1, min: m, player: carded });
      }
    }
  }

  return {
    winnerSide: finalWinnerSide,
    goesToET,
    goesToPenalties,
    penaltyData,
    maxMin,
    scheduledByMin,
    aggOffset: [aggOffset[0] || 0, aggOffset[1] || 0],
  };
}

export interface SerializedMatchPlan {
  winnerSide: -1 | 0 | 1;
  goesToET: boolean;
  goesToPenalties: boolean;
  penaltyData: PenaltyData | null;
  maxMin: number;
  aggOffset?: [number, number];
  scheduledByMin: {
    type: ScheduledMatchEvent['type'];
    side: 0 | 1;
    min: number;
    scorerId: number | null;
    assisterId: number | null;
    playerId: number | null;
    gkId: number | null;
  }[][];
}

export function serializeMatchPlan(plan: MatchPlan): SerializedMatchPlan {
  return {
    winnerSide: plan.winnerSide,
    goesToET: plan.goesToET,
    goesToPenalties: plan.goesToPenalties,
    penaltyData: plan.penaltyData,
    maxMin: plan.maxMin,
    aggOffset: plan.aggOffset,
    scheduledByMin: plan.scheduledByMin.map((arr) =>
      arr.map((ev) => ({
        type: ev.type,
        side: ev.side,
        min: ev.min,
        scorerId: ev.scorer ? ev.scorer.id : null,
        assisterId: ev.assister ? ev.assister.id : null,
        playerId: ev.player ? ev.player.id : null,
        gkId: ev.gk && ev.gk.id != null ? ev.gk.id : null,
      }))
    ),
  };
}

export function hydrateNetworkPlan(raw: SerializedMatchPlan): MatchPlan {
  return {
    winnerSide: raw.winnerSide,
    goesToET: raw.goesToET,
    goesToPenalties: raw.goesToPenalties,
    penaltyData: raw.penaltyData,
    maxMin: raw.maxMin,
    aggOffset: raw.aggOffset,
    scheduledByMin: raw.scheduledByMin.map((arr) =>
      arr.map((ev) => ({
        type: ev.type,
        side: ev.side,
        min: ev.min,
        scorer: ev.scorerId != null ? PLAYERS_BY_ID[ev.scorerId] || null : null,
        assister: ev.assisterId != null ? PLAYERS_BY_ID[ev.assisterId] || null : null,
        player: ev.playerId != null ? PLAYERS_BY_ID[ev.playerId] || null : null,
        gk: ev.gkId != null ? PLAYERS_BY_ID[ev.gkId] || { n: 'Kaleci' } : { n: 'Kaleci' },
      }))
    ),
  };
}

export function createInitialMatchState(
  a: number,
  b: number,
  tourneyMatchId: string | null,
  plan: MatchPlan,
  teams: Team[],
  lg: LeagueState | null,
  isCareer: boolean
): MatchState {
  const sA = side(teams[a], lg, isCareer);
  const sB = side(teams[b], lg, isCareer);

  const moraleA =
    isCareer && lg && teams[a]?.isHuman
      ? lg.teamCareer?.[a]?.moraleMod ?? (a === 0 ? lg.moraleMod : 0)
      : 0;
  const moraleB =
    isCareer && lg && teams[b]?.isHuman
      ? lg.teamCareer?.[b]?.moraleMod ?? (b === 0 ? lg.moraleMod : 0)
      : 0;

  const initPerfA = 100 + moraleA;
  const initPerfB = 100 + moraleB;

  return {
    a,
    b,
    tourneyMatchId,
    sa: sA,
    sb: sB,
    plan,
    min: 0,
    sc: [0, 0],
    penSc: null,
    redCards: [0, 0],
    perfFactor: [initPerfA, initPerfB],
    shots: [0, 0],
    onTarget: [0, 0],
    saves: [0, 0],
    xg: [0, 0],
    goalsList: [[], []],
    playerStats: {},
    lastHighlightGoal: null,
    lastHighlightAssist: null,
    log: [],
    run: 0,
    speed: 1,
    leagueWeekRecorded: false,
    careerWeek: lg ? lg.week : 1,
  };
}

export function stepMatchMinute(m: MatchState, minNum: number, teams: Team[]): void {
  const events = m.plan.scheduledByMin[minNum] || [];
  const names = [teams[m.a].name, teams[m.b].name];

  for (const ev of events) {
    const i = ev.side;
    if (ev.type === 'goal' && ev.scorer) {
      m.sc[i]++;
      m.shots[i]++;
      m.onTarget[i]++;
      m.xg[i] += 0.36 + Math.random() * 0.22;

      const scId = ev.scorer.id;
      if (!m.playerStats[scId]) m.playerStats[scId] = { goals: 0, assists: 0, red: false };
      m.playerStats[scId].goals++;
      m.lastHighlightGoal = scId;

      let astText = 'Bireysel';
      if (ev.assister) {
        const asId = ev.assister.id;
        if (!m.playerStats[asId]) m.playerStats[asId] = { goals: 0, assists: 0, red: false };
        m.playerStats[asId].assists++;
        m.lastHighlightAssist = asId;
        astText = `Asist: ${ev.assister.n}`;
      }

      m.goalsList[i].push({
        min: minNum,
        scorer: ev.scorer.n,
        assister: ev.assister ? ev.assister.n : null,
      });

      m.log.push({
        min: minNum,
        isGoal: true,
        isRed: false,
        text: `GOL! ${ev.scorer.n} topu ağlara gönderdi. (${astText} · ${names[i]})`,
      });
    } else if (ev.type === 'red' && ev.player) {
      m.redCards[i]++;
      m.perfFactor[i] = Math.round(m.perfFactor[i] * 0.82);
      const sideObj = i === 0 ? m.sa : m.sb;
      sideObj.att *= 0.82;
      sideObj.mid *= 0.82;
      sideObj.def *= 0.82;

      const pId = ev.player.id;
      if (!m.playerStats[pId]) m.playerStats[pId] = { goals: 0, assists: 0, red: false };
      m.playerStats[pId].red = true;

      m.log.push({
        min: minNum,
        isGoal: false,
        isRed: true,
        text: `KIRMIZI KART! ${ev.player.n} (${names[i]}) oyun dışı kaldı.`,
      });
    } else if (ev.type === 'save' && ev.player) {
      m.shots[i]++;
      m.onTarget[i]++;
      m.saves[1 - i]++;
      m.xg[i] += 0.11 + Math.random() * 0.1;
      m.log.push({
        min: minNum,
        isGoal: false,
        isRed: false,
        text: `${ev.player.n} (${names[i]}) şutunu çekti, kaleci ${ev.gk?.n || 'Kaleci'} gole izin vermedi.`,
      });
    } else if (ev.type === 'post' && ev.player) {
      m.shots[i]++;
      m.xg[i] += 0.2;
      m.log.push({
        min: minNum,
        isGoal: false,
        isRed: false,
        text: `DİREK! ${ev.player.n} (${names[i]}) sert vurdu, top direkten döndü.`,
      });
    } else if (ev.type === 'miss' && ev.player) {
      m.shots[i]++;
      m.xg[i] += 0.07;
      m.log.push({
        min: minNum,
        isGoal: false,
        isRed: false,
        text: `${ev.player.n} (${names[i]}) uygun pozisyonda şutunu auta gönderdi.`,
      });
    } else if (ev.type === 'card' && ev.player) {
      m.log.push({
        min: minNum,
        isGoal: false,
        isRed: false,
        text: `${ev.player.n} (${names[i]}) sarı kart gördü.`,
      });
    }
  }

  if (minNum === 45) {
    m.log.push({
      min: 45,
      isGoal: false,
      isRed: false,
      text: `İlk Yarı Sona Erdi · Skor: ${m.sc[0]} - ${m.sc[1]}`,
    });
  } else if (minNum === 90 && m.plan.goesToET) {
    const off = m.plan.aggOffset || [0, 0];
    const hasAgg = off[0] > 0 || off[1] > 0;
    const aggText = hasAgg
      ? `Toplam Skor Eşitlendi (${m.sc[0] + off[0]} - ${m.sc[1] + off[1]})`
      : `Normal Süre Berabere Tamamlandı (${m.sc[0]} - ${m.sc[1]})`;
    m.log.push({
      min: 90,
      isGoal: true,
      isRed: false,
      text: `${aggText} · Uzatma devrelerine geçiliyor.`,
    });
  } else if (minNum === 105 && m.plan.goesToET) {
    m.log.push({
      min: 105,
      isGoal: false,
      isRed: false,
      text: `1. Uzatma Devresi Sona Erdi · Skor: ${m.sc[0]} - ${m.sc[1]}`,
    });
  }
}

export function initTournamentState(teams: Team[]): TournamentState {
  teams.forEach((tm) => ensureTeamLineup(tm));
  const n = teams.length;
  if (n === 2) {
    return {
      matches: [
        { id: 'FINAL', title: 'BÜYÜK FİNAL', a: 0, b: 1, done: false, sc: null, pen: null, winner: null, goals: [] },
      ],
      champion: null,
    };
  }
  if (n === 3) {
    return {
      matches: [
        { id: 'SF1', title: 'YARI FİNAL', a: 1, b: 2, done: false, sc: null, pen: null, winner: null, goals: [] },
        { id: 'FINAL', title: 'BÜYÜK FİNAL', a: 0, b: null, done: false, sc: null, pen: null, winner: null, goals: [] },
      ],
      champion: null,
    };
  }
  return {
    matches: [
      { id: 'SF1', title: 'YARI FİNAL 1', a: 0, b: 3, done: false, sc: null, pen: null, winner: null, goals: [] },
      { id: 'SF2', title: 'YARI FİNAL 2', a: 1, b: 2, done: false, sc: null, pen: null, winner: null, goals: [] },
      { id: 'FINAL', title: 'BÜYÜK FİNAL', a: null, b: null, done: false, sc: null, pen: null, winner: null, goals: [] },
    ],
    champion: null,
  };
}

export function getActiveTournamentMatch(t: TournamentState | null): TournamentMatch | null {
  if (!t) return null;
  return t.matches.find((m) => !m.done && m.a != null && m.b != null) || t.matches[t.matches.length - 1];
}

export function recordTournamentMatchResult(
  t: TournamentState | null,
  teamsCount: number,
  matchId: string | null,
  sc: [number, number],
  penScore: [number, number] | null,
  winnerIdx: number,
  goalsList: MatchState['goalsList']
): void {
  if (!t || !matchId) return;
  const m = t.matches.find((x) => x.id === matchId);
  if (!m) return;
  m.done = true;
  m.sc = [...sc] as [number, number];
  m.pen = penScore ? ([...penScore] as [number, number]) : null;
  m.winner = winnerIdx;
  m.goals = goalsList;

  const fin = t.matches.find((x) => x.id === 'FINAL');
  if (m.id === 'SF1' && fin) {
    if (teamsCount === 3) fin.b = winnerIdx;
    else fin.a = winnerIdx;
  } else if (m.id === 'SF2' && fin) {
    fin.b = winnerIdx;
  } else if (m.id === 'FINAL') {
    t.champion = winnerIdx;
  }
}

export function finalizeMatchState(
  m: MatchState,
  teams: Team[],
  tournament: TournamentState | null,
  isCareerMatch: boolean
): void {
  m.run = 0;
  const A = teams[m.a];
  const B = teams[m.b];

  if (isCareerMatch) {
    const off = m.plan.aggOffset || [0, 0];
    const hasAgg = off[0] > 0 || off[1] > 0;
    const totA = m.sc[0] + off[0];
    const totB = m.sc[1] + off[1];
    if (totA === totB && m.plan.goesToPenalties && m.plan.penaltyData) {
      const pd = m.plan.penaltyData;
      m.penSc = [...pd.score] as [number, number];
      m.log.push({
        min: 120,
        isGoal: true,
        isRed: false,
        text: `120 Dakika Sonunda Eşitlik Bozulmadı (${hasAgg ? `Toplam ${totA} - ${totB}` : `${m.sc[0]} - ${m.sc[1]}`}) · Seri Penaltı Atışları Sonucu: ${A.name} ${m.penSc[0]} - ${m.penSc[1]} ${B.name}`,
      });
    }
    const aggNote = hasAgg ? ` (Toplam: ${totA}-${totB})` : '';
    const penNote = m.penSc ? ` (Pen: ${m.penSc[0]}-${m.penSc[1]})` : '';
    m.log.push({
      min: m.plan.maxMin || 90,
      isGoal: true,
      isRed: false,
      text: `Maç Tamamlandı: ${A.name} ${m.sc[0]} - ${m.sc[1]} ${B.name}${aggNote}${penNote} · Haftanın diğer maçları da simüle edildi.`,
    });
    return;
  }

  let winnerIdx = m.sc[0] > m.sc[1] ? m.a : m.b;

  if (m.sc[0] === m.sc[1] && m.plan.goesToPenalties && m.plan.penaltyData) {
    const pd = m.plan.penaltyData;
    m.penSc = [...pd.score] as [number, number];
    winnerIdx = pd.winnerSide === 0 ? m.a : m.b;

    m.log.push({
      min: 120,
      isGoal: true,
      isRed: false,
      text: `120 Dakika Berabere Bitti (${m.sc[0]} - ${m.sc[1]}) · Seri Penaltı Atışları Başlıyor`,
    });

    for (let r = 0; r < 5; r++) {
      const pA = pd.takersA[r] || 'Oyuncu A';
      const pB = pd.takersB[r] || 'Oyuncu B';
      const hitA = r < pd.score[0] ? 'GOL' : 'Kaçırdı';
      const hitB = r < pd.score[1] ? 'GOL' : 'Kaçırdı';
      m.log.push({
        min: 'PEN',
        isGoal: false,
        isRed: false,
        text: `${r + 1}. Penaltı: ${A.name} - ${pA} (${hitA}) | ${B.name} - ${pB} (${hitB})`,
      });
    }
  }

  const winner = teams[winnerIdx];
  if (m.tourneyMatchId) {
    recordTournamentMatchResult(
      tournament,
      teams.length,
      m.tourneyMatchId,
      m.sc,
      m.penSc,
      winnerIdx,
      m.goalsList
    );
  }

  let mvp = (winner.starters && winner.starters[0]) || winner.picks[0];
  let bestScore = -1;
  [...(A.starters || []), ...(B.starters || [])].forEach((p) => {
    const st = m.playerStats[p.id] || { goals: 0, assists: 0, red: false };
    const scVal = p.r + st.goals * 15 + st.assists * 10 - (st.red ? 25 : 0);
    if (scVal > bestScore) {
      bestScore = scVal;
      mvp = p;
    }
  });
  const mvpStats = mvp ? m.playerStats[mvp.id] || { goals: 0, assists: 0 } : { goals: 0, assists: 0 };

  const penSummary = m.penSc
    ? ` (Penaltılar: ${m.penSc[0]}-${m.penSc[1]})`
    : m.plan.goesToET
    ? ' (Uzatmalarda)'
    : '';
  m.log.push({
    min: m.plan.maxMin || 90,
    isGoal: true,
    isRed: false,
    text: `Maç Sonucu: ${A.name} ${m.sc[0]} - ${m.sc[1]} ${B.name}${penSummary} · Kazanan: ${winner.name} · Maçın Oyuncusu: ${mvp?.n || '—'} (${mvpStats.goals}G, ${mvpStats.assists}A)`,
  });
}
