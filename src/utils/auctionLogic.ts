import { FORMATION_QUOTA, POSITIONS, ROUNDS } from '../data/database';
import type {
  AuctionNominationMode,
  AuctionState,
  DraftState,
  Player,
  Team,
} from '../types/game';
import { canTeamPickPos, posCountsOf, siblingIds } from './draftLogic';

export function getTeamRemainingBudget(team: Pick<Team, 'spent'>, budgetPerTeam: number): number {
  return Math.max(0, budgetPerTeam - team.spent);
}

/**
 * A team must always keep at least $1 for every remaining empty roster slot
 * after winning the current player.
 */
export function getMaxAllowedBid(
  team: Pick<Team, 'picks' | 'spent'>,
  budgetPerTeam: number
): number {
  const remSlots = ROUNDS - team.picks.length;
  if (remSlots <= 0) return 0;
  const remBudget = getTeamRemainingBudget(team, budgetPerTeam);
  const reserveForOthers = Math.max(0, remSlots - 1);
  return Math.max(0, remBudget - reserveForOthers);
}

export function isTeamEligibleForAuctionPlayer(
  draft: DraftState,
  team: Team,
  player: Player,
  budgetPerTeam: number,
  minBid: number,
  strictPos = true
): boolean {
  if (team.picks.length >= ROUNDS) return false;
  if (draft.taken.has(player.id)) return false;
  if (!canTeamPickPos(team, player.pos, draft.pool, draft.taken, strictPos)) return false;
  const maxBid = getMaxAllowedBid(team, budgetPerTeam);
  return maxBid >= Math.max(1, minBid);
}

export function getEligibleBiddersForLot(
  draft: DraftState,
  auction: AuctionState,
  player: Player,
  minBid: number,
  strictPos = true
): number[] {
  const passed = new Set(auction.passedTeams);
  const res: number[] = [];
  for (let i = 0; i < draft.teams.length; i++) {
    if (passed.has(i)) continue;
    if (
      isTeamEligibleForAuctionPlayer(
        draft,
        draft.teams[i],
        player,
        auction.budgetPerTeam,
        minBid,
        strictPos
      )
    ) {
      res.push(i);
    }
  }
  return res;
}

export function isAuctionDraftComplete(draft: DraftState): boolean {
  return draft.teams.every((t) => t.picks.length >= ROUNDS);
}

export function findNextNominatorIdx(draft: DraftState, fromIdx: number): number {
  const n = draft.teams.length;
  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIdx + offset) % n;
    if (draft.teams[idx].picks.length < ROUNDS) return idx;
  }
  return 0;
}

export function pickAiNominationPlayer(
  draft: DraftState,
  auction: AuctionState,
  strictPos = true
): Player | null {
  const skipped = new Set(auction.skippedIds);
  const openTeams = draft.teams.filter((t) => t.picks.length < ROUNDS);
  if (!openTeams.length) return null;

  // Determine which positions are urgently needed across open teams
  const urgentPos = new Set<string>();
  for (const tm of openTeams) {
    const counts = posCountsOf(tm);
    const remSlots = ROUNDS - tm.picks.length;
    let totalMissing = 0;
    for (const posKey of POSITIONS) {
      totalMissing += Math.max(0, FORMATION_QUOTA[posKey] - counts[posKey]);
    }
    if (remSlots <= totalMissing + 1) {
      for (const posKey of POSITIONS) {
        if (counts[posKey] < FORMATION_QUOTA[posKey]) urgentPos.add(posKey);
      }
    }
  }

  const filterPool = (ignoreSkipped: boolean) =>
    draft.pool.filter((p) => {
      if (draft.taken.has(p.id)) return false;
      if (!ignoreSkipped && skipped.has(p.id)) return false;
      return openTeams.some((tm) =>
        isTeamEligibleForAuctionPlayer(draft, tm, p, auction.budgetPerTeam, 1, strictPos)
      );
    });

  let candidates = filterPool(false);
  if (!candidates.length) candidates = filterPool(true);
  if (!candidates.length) return null;

  if (urgentPos.size > 0) {
    const urgentCand = candidates.filter((p) => urgentPos.has(p.pos));
    if (urgentCand.length) candidates = urgentCand;
  }

  // Mix top stars early, broader talent as auction progresses
  const sortedByRating = [...candidates].sort((a, b) => b.r - a.r);
  const sliceSize = Math.min(sortedByRating.length, auction.lotNumber <= 8 ? 35 : 80);
  const topSlice = sortedByRating.slice(0, sliceSize);
  return topSlice[Math.floor(Math.random() * topSlice.length)] || candidates[0];
}

export function initAuctionState(
  draft: DraftState,
  nominationMode: AuctionNominationMode,
  budgetPerTeam: number,
  strictPos = true
): AuctionState {
  const base: AuctionState = {
    nominationMode,
    budgetPerTeam,
    nominatorIdx: 0,
    phase: 'nominating',
    activePlayer: null,
    currentBid: 0,
    highestBidderIdx: null,
    activeBidderIdx: 0,
    passedTeams: [],
    lotNumber: 1,
    bidLog: [],
    lastSold: null,
    skippedIds: [],
  };

  if (nominationMode === 'ai') {
    const firstPlayer = pickAiNominationPlayer(draft, base, strictPos);
    if (firstPlayer) {
      return startAiOfferedLot(draft, base, firstPlayer, strictPos);
    }
  }

  return base;
}

export function startAiOfferedLot(
  draft: DraftState,
  auction: AuctionState,
  player: Player,
  strictPos = true
): AuctionState {
  const passedTeams: number[] = [];
  for (let i = 0; i < draft.teams.length; i++) {
    if (
      !isTeamEligibleForAuctionPlayer(
        draft,
        draft.teams[i],
        player,
        auction.budgetPerTeam,
        1,
        strictPos
      )
    ) {
      passedTeams.push(i);
    }
  }

  const n = draft.teams.length;
  let firstBidder = auction.nominatorIdx % n;
  for (let off = 0; off < n; off++) {
    const cand = (auction.nominatorIdx + off) % n;
    if (!passedTeams.includes(cand)) {
      firstBidder = cand;
      break;
    }
  }

  return {
    ...auction,
    phase: 'bidding',
    activePlayer: player,
    currentBid: 0,
    highestBidderIdx: null,
    activeBidderIdx: firstBidder,
    passedTeams,
    bidLog: [],
    lastSold: null,
  };
}

function findNextActiveBidder(
  draft: DraftState,
  auction: AuctionState,
  player: Player,
  fromIdx: number,
  nextMinBid: number,
  highestBidderIdx: number | null,
  passedTeams: number[],
  strictPos: boolean
): { nextIdx: number | null; updatedPassed: number[] } {
  const passed = new Set(passedTeams);
  const n = draft.teams.length;

  // Auto-pass anyone who cannot afford nextMinBid or isn't eligible
  for (let i = 0; i < n; i++) {
    if (i === highestBidderIdx) continue;
    if (passed.has(i)) continue;
    if (
      !isTeamEligibleForAuctionPlayer(
        draft,
        draft.teams[i],
        player,
        auction.budgetPerTeam,
        nextMinBid,
        strictPos
      )
    ) {
      passed.add(i);
    }
  }

  for (let offset = 1; offset <= n; offset++) {
    const idx = (fromIdx + offset) % n;
    if (idx === highestBidderIdx) continue;
    if (!passed.has(idx)) {
      return { nextIdx: idx, updatedPassed: [...passed] };
    }
  }

  return { nextIdx: null, updatedPassed: [...passed] };
}

export function resolveWonLot(
  draft: DraftState,
  auction: AuctionState,
  winnerIdx: number,
  player: Player,
  price: number
): { draft: DraftState; auction: AuctionState } {
  const tm = draft.teams[winnerIdx];
  tm.picks.push(player);
  tm.spent += price;
  const sibs = siblingIds(draft, player);
  sibs.forEach((id) => draft.taken.add(id));
  draft.history.push({
    teamIdx: winnerIdx,
    playerId: player.id,
    paid: price,
    isCpu: !tm.isHuman,
  });
  draft.k = draft.teams.reduce((s, t) => s + t.picks.length, 0);

  const done = isAuctionDraftComplete(draft);
  const nextAuction: AuctionState = {
    ...auction,
    phase: done ? 'done' : 'sold_flash',
    lastSold: { player, winnerIdx, price },
    currentBid: price,
    highestBidderIdx: winnerIdx,
  };
  return { draft, auction: nextAuction };
}

export function nominatePlayerForAuction(
  draft: DraftState,
  auction: AuctionState,
  player: Player,
  openingBid = 1,
  strictPos = true
): { draft: DraftState; auction: AuctionState; error?: string } {
  const nominatorIdx = auction.nominatorIdx;
  const tm = draft.teams[nominatorIdx];
  if (!tm) return { draft, auction, error: 'Geçersiz takım.' };

  const bid = Math.max(1, Math.floor(openingBid));
  if (!isTeamEligibleForAuctionPlayer(draft, tm, player, auction.budgetPerTeam, bid, strictPos)) {
    return {
      draft,
      auction,
      error: `${player.n} için mevki kotan veya kalan bütçen ($${getMaxAllowedBid(tm, auction.budgetPerTeam)}) uygun değil.`,
    };
  }

  const nextMin = bid + 1;
  const { nextIdx, updatedPassed } = findNextActiveBidder(
    draft,
    auction,
    player,
    nominatorIdx,
    nextMin,
    nominatorIdx,
    [],
    strictPos
  );

  const bidLog = [{ teamIdx: nominatorIdx, amount: bid, action: 'nominate' as const }];

  // If no other team can challenge, nominator immediately wins at opening bid
  if (nextIdx === null) {
    return resolveWonLot(
      draft,
      {
        ...auction,
        activePlayer: player,
        currentBid: bid,
        highestBidderIdx: nominatorIdx,
        passedTeams: updatedPassed,
        bidLog,
      },
      nominatorIdx,
      player,
      bid
    );
  }

  return {
    draft,
    auction: {
      ...auction,
      phase: 'bidding',
      activePlayer: player,
      currentBid: bid,
      highestBidderIdx: nominatorIdx,
      activeBidderIdx: nextIdx,
      passedTeams: updatedPassed,
      bidLog,
      lastSold: null,
    },
  };
}

export function placeAuctionBid(
  draft: DraftState,
  auction: AuctionState,
  teamIdx: number,
  amount: number,
  strictPos = true
): { draft: DraftState; auction: AuctionState; error?: string } {
  if (auction.phase !== 'bidding' || !auction.activePlayer) {
    return { draft, auction, error: 'Aktif açık artırma yok.' };
  }
  if (auction.activeBidderIdx !== teamIdx) {
    return { draft, auction, error: 'Teklif sırası bu takımda değil.' };
  }

  const player = auction.activePlayer;
  const tm = draft.teams[teamIdx];
  const minBid = Math.max(1, auction.currentBid + 1);
  const bid = Math.floor(amount);
  const maxBid = getMaxAllowedBid(tm, auction.budgetPerTeam);

  if (bid < minBid) {
    return { draft, auction, error: `En az $${minBid} teklif vermelisin.` };
  }
  if (bid > maxBid) {
    return {
      draft,
      auction,
      error: `Kalan boş kadro slotları için maksimum teklifin $${maxBid}.`,
    };
  }

  const newLog = [...auction.bidLog, { teamIdx, amount: bid, action: 'bid' as const }];
  const { nextIdx, updatedPassed } = findNextActiveBidder(
    draft,
    auction,
    player,
    teamIdx,
    bid + 1,
    teamIdx,
    auction.passedTeams,
    strictPos
  );

  if (nextIdx === null) {
    return resolveWonLot(
      draft,
      {
        ...auction,
        currentBid: bid,
        highestBidderIdx: teamIdx,
        passedTeams: updatedPassed,
        bidLog: newLog,
      },
      teamIdx,
      player,
      bid
    );
  }

  return {
    draft,
    auction: {
      ...auction,
      currentBid: bid,
      highestBidderIdx: teamIdx,
      activeBidderIdx: nextIdx,
      passedTeams: updatedPassed,
      bidLog: newLog,
    },
  };
}

export function passAuctionLot(
  draft: DraftState,
  auction: AuctionState,
  teamIdx: number,
  strictPos = true
): { draft: DraftState; auction: AuctionState } {
  if (auction.phase !== 'bidding' || !auction.activePlayer) return { draft, auction };

  const player = auction.activePlayer;
  const nextPassed = auction.passedTeams.includes(teamIdx)
    ? [...auction.passedTeams]
    : [...auction.passedTeams, teamIdx];
  const newLog = [...auction.bidLog, { teamIdx, amount: auction.currentBid, action: 'pass' as const }];

  const nextMin = Math.max(1, auction.currentBid + 1);
  const { nextIdx, updatedPassed } = findNextActiveBidder(
    draft,
    auction,
    player,
    teamIdx,
    nextMin,
    auction.highestBidderIdx,
    nextPassed,
    strictPos
  );

  if (nextIdx !== null) {
    return {
      draft,
      auction: {
        ...auction,
        activeBidderIdx: nextIdx,
        passedTeams: updatedPassed,
        bidLog: newLog,
      },
    };
  }

  // Everyone else passed! If someone holds the highest bid, they win
  if (auction.highestBidderIdx !== null) {
    return resolveWonLot(
      draft,
      {
        ...auction,
        passedTeams: updatedPassed,
        bidLog: newLog,
      },
      auction.highestBidderIdx,
      player,
      auction.currentBid
    );
  }

  // In AI nomination mode, nobody bid at all -> skip player and offer next
  const nextSkipped = [...auction.skippedIds, player.id];
  const nextNom = findNextNominatorIdx(draft, auction.nominatorIdx);
  const refreshed: AuctionState = {
    ...auction,
    nominatorIdx: nextNom,
    skippedIds: nextSkipped,
    lotNumber: auction.lotNumber + 1,
    activePlayer: null,
    currentBid: 0,
    highestBidderIdx: null,
    passedTeams: [],
    bidLog: [],
    lastSold: null,
  };

  const nextP = pickAiNominationPlayer(draft, refreshed, strictPos);
  if (!nextP) {
    return { draft, auction: { ...refreshed, phase: 'done' } };
  }
  return { draft, auction: startAiOfferedLot(draft, refreshed, nextP, strictPos) };
}

export function advanceAfterAuctionSold(
  draft: DraftState,
  auction: AuctionState,
  strictPos = true
): AuctionState {
  if (isAuctionDraftComplete(draft)) {
    return { ...auction, phase: 'done', activePlayer: null };
  }

  const nextNom = findNextNominatorIdx(draft, auction.nominatorIdx);
  const nextState: AuctionState = {
    ...auction,
    nominatorIdx: nextNom,
    phase: 'nominating',
    activePlayer: null,
    currentBid: 0,
    highestBidderIdx: null,
    activeBidderIdx: nextNom,
    passedTeams: [],
    lotNumber: auction.lotNumber + 1,
    bidLog: [],
    lastSold: null,
  };

  if (auction.nominationMode === 'ai') {
    const nextP = pickAiNominationPlayer(draft, nextState, strictPos);
    if (!nextP) return { ...nextState, phase: 'done' };
    return startAiOfferedLot(draft, nextState, nextP, strictPos);
  }

  return nextState;
}

/**
 * Computes a realistic AI valuation for a player during an auction lot.
 */
export function evaluateAiAuctionFairValue(
  team: Team,
  player: Player,
  budgetPerTeam: number
): number {
  const remSlots = Math.max(1, ROUNDS - team.picks.length);
  const remBudget = getTeamRemainingBudget(team, budgetPerTeam);
  const avgSlotBudget = remBudget / remSlots;
  const counts = posCountsOf(team);
  const needBonus = counts[player.pos] < FORMATION_QUOTA[player.pos] ? 1.2 : 0.72;

  // Rating curve: 70 -> 0.35x, 80 -> 0.85x, 85 -> 1.4x, 90 -> 2.3x, 95+ -> 3.2x
  const r = player.r || 78;
  let tierMult = 0.4;
  if (r >= 93) tierMult = 3.1;
  else if (r >= 90) tierMult = 2.4;
  else if (r >= 87) tierMult = 1.85;
  else if (r >= 84) tierMult = 1.35;
  else if (r >= 80) tierMult = 0.92;
  else if (r >= 76) tierMult = 0.6;

  // Deterministic per-player-per-team slight variance so AI personalities differ
  let hash = (player.id * 17 + team.name.length * 31) % 21;
  const variance = 0.85 + (hash / 20) * 0.35; // 0.85..1.20

  const raw = Math.round(avgSlotBudget * tierMult * needBonus * variance);
  const maxAllowed = getMaxAllowedBid(team, budgetPerTeam);
  return Math.max(1, Math.min(maxAllowed, raw));
}

export function decideAiAuctionAction(
  draft: DraftState,
  auction: AuctionState,
  teamIdx: number,
  strictPos = true
): { action: 'bid'; amount: number } | { action: 'pass' } {
  const player = auction.activePlayer;
  const team = draft.teams[teamIdx];
  if (!player || !team) return { action: 'pass' };

  const minBid = Math.max(1, auction.currentBid + 1);
  if (!isTeamEligibleForAuctionPlayer(draft, team, player, auction.budgetPerTeam, minBid, strictPos)) {
    return { action: 'pass' };
  }

  const maxBid = getMaxAllowedBid(team, auction.budgetPerTeam);
  const fairValue = evaluateAiAuctionFairValue(team, player, auction.budgetPerTeam);

  if (minBid > fairValue) {
    // If nobody has bid yet in AI mode and player is cheap ($1), take a bargain!
    if (auction.highestBidderIdx === null && minBid === 1 && maxBid >= 1) {
      return { action: 'bid', amount: 1 };
    }
    return { action: 'pass' };
  }

  // Realistic step increment: +1 usually, +2 or +3 if far below valuation
  const gap = fairValue - minBid;
  let step = 0;
  if (gap >= 14) step = Math.min(3, Math.floor(Math.random() * 3) + 1);
  else if (gap >= 6) step = Math.min(2, Math.floor(Math.random() * 2));
  const bid = Math.min(maxBid, Math.min(fairValue, minBid + step));

  return { action: 'bid', amount: Math.max(minBid, bid) };
}

export function pickAiPlayerToNominate(
  draft: DraftState,
  auction: AuctionState,
  teamIdx: number,
  strictPos = true
): Player | null {
  const team = draft.teams[teamIdx];
  if (!team || team.picks.length >= ROUNDS) return null;
  const eligible = draft.pool.filter((p) =>
    isTeamEligibleForAuctionPlayer(draft, team, p, auction.budgetPerTeam, 1, strictPos)
  );
  if (!eligible.length) return null;
  const sorted = [...eligible].sort((a, b) => b.r - a.r);
  const windowSize = Math.min(sorted.length, 24);
  return sorted[Math.floor(Math.random() * windowSize)] || sorted[0];
}

export function autoCompleteAuctionDraft(
  draft: DraftState,
  auction: AuctionState,
  strictPos = true
): { draft: DraftState; auction: AuctionState } {
  let curDraft = draft;
  let curAuction = auction;
  let safety = 0;

  while (!isAuctionDraftComplete(curDraft) && safety < 500) {
    safety++;

    if (curAuction.phase === 'sold_flash') {
      curAuction = advanceAfterAuctionSold(curDraft, curAuction, strictPos);
      continue;
    }

    if (curAuction.phase === 'nominating') {
      const p =
        curAuction.nominationMode === 'ai'
          ? pickAiNominationPlayer(curDraft, curAuction, strictPos)
          : pickAiPlayerToNominate(curDraft, curAuction, curAuction.nominatorIdx, strictPos);
      if (!p) break;

      if (curAuction.nominationMode === 'ai') {
        curAuction = startAiOfferedLot(curDraft, curAuction, p, strictPos);
      } else {
        const res = nominatePlayerForAuction(curDraft, curAuction, p, 1, strictPos);
        curDraft = res.draft;
        curAuction = res.auction;
      }
      continue;
    }

    if (curAuction.phase === 'bidding') {
      const decision = decideAiAuctionAction(
        curDraft,
        curAuction,
        curAuction.activeBidderIdx,
        strictPos
      );
      if (decision.action === 'bid') {
        const res = placeAuctionBid(
          curDraft,
          curAuction,
          curAuction.activeBidderIdx,
          decision.amount,
          strictPos
        );
        curDraft = res.draft;
        curAuction = res.auction;
      } else {
        const res = passAuctionLot(curDraft, curAuction, curAuction.activeBidderIdx, strictPos);
        curDraft = res.draft;
        curAuction = res.auction;
      }
    }
  }

  return {
    draft: curDraft,
    auction: { ...curAuction, phase: 'done', activePlayer: null },
  };
}
