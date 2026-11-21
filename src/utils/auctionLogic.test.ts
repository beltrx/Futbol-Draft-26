import test from 'node:test';
import assert from 'node:assert/strict';
import { MODERN_LEAGUES, ROUNDS } from '../data/database';
import { buildDraftState } from './draftLogic';
import {
  advanceAfterAuctionSold,
  autoCompleteAuctionDraft,
  getMaxAllowedBid,
  initAuctionState,
  nominatePlayerForAuction,
  passAuctionLot,
  placeAuctionBid,
} from './auctionLogic';

test('getMaxAllowedBid reserves at least $1 for every remaining roster slot', () => {
  assert.equal(getMaxAllowedBid({ picks: [], spent: 0 }, 200), 187); // 200 - 13
  assert.equal(getMaxAllowedBid({ picks: Array(13).fill({}), spent: 180 }, 200), 20);
  assert.equal(getMaxAllowedBid({ picks: Array(14).fill({}), spent: 180 }, 200), 0);
});

test('player-nominated auction flow resolves bidding war accurately', () => {
  const built = buildDraftState({
    mode: 'auction',
    leagues: new Set(MODERN_LEAGUES),
    clubs: new Set(),
    opp: 1,
    humanCount: 2,
    format: 'snake',
    strictPos: true,
    auctionBudget: 200,
  });
  assert.ok(built.state);
  const draft = built.state;
  let auction = initAuctionState(draft, 'player', 200, true);
  assert.equal(auction.phase, 'nominating');
  assert.equal(auction.nominatorIdx, 0);

  const star = draft.pool[0];
  const nom = nominatePlayerForAuction(draft, auction, star, 1, true);
  assert.equal(nom.error, undefined);
  assert.equal(nom.auction.phase, 'bidding');
  assert.equal(nom.auction.currentBid, 1);
  assert.equal(nom.auction.highestBidderIdx, 0);
  assert.equal(nom.auction.activeBidderIdx, 1);

  // Team 1 bids $2
  const bid1 = placeAuctionBid(nom.draft, nom.auction, 1, 2, true);
  assert.equal(bid1.error, undefined);
  assert.equal(bid1.auction.currentBid, 2);
  assert.equal(bid1.auction.highestBidderIdx, 1);
  assert.equal(bid1.auction.activeBidderIdx, 0);

  // Team 0 raises to $5
  const bid2 = placeAuctionBid(bid1.draft, bid1.auction, 0, 5, true);
  assert.equal(bid2.error, undefined);
  assert.equal(bid2.auction.currentBid, 5);
  assert.equal(bid2.auction.highestBidderIdx, 0);
  assert.equal(bid2.auction.activeBidderIdx, 1);

  // Team 1 passes -> Team 0 wins for $5
  const passed = passAuctionLot(bid2.draft, bid2.auction, 1, true);
  assert.equal(passed.auction.phase, 'sold_flash');
  assert.equal(passed.auction.lastSold?.winnerIdx, 0);
  assert.equal(passed.auction.lastSold?.price, 5);
  assert.equal(passed.draft.teams[0].picks.length, 1);
  assert.equal(passed.draft.teams[0].spent, 5);
  assert.equal(passed.draft.taken.has(star.id), true);

  // Next lot rotates nominator to Team 1
  const next = advanceAfterAuctionSold(passed.draft, passed.auction, true);
  assert.equal(next.phase, 'nominating');
  assert.equal(next.nominatorIdx, 1);
  assert.equal(next.lotNumber, 2);
});

test('AI-nominated auction starts directly in bidding phase and auto-completes full 14-player rosters', () => {
  const built = buildDraftState({
    mode: 'auction',
    leagues: new Set(['Premier Lig', 'Milli İkonlar']),
    clubs: new Set(),
    opp: 2,
    humanCount: 1,
    format: 'snake',
    strictPos: true,
    auctionBudget: 200,
  });
  assert.ok(built.state);
  const draft = built.state;
  const auction = initAuctionState(draft, 'ai', 200, true);
  assert.equal(auction.phase, 'bidding');
  assert.ok(auction.activePlayer);

  const completed = autoCompleteAuctionDraft(draft, auction, true);
  assert.equal(completed.auction.phase, 'done');
  for (const tm of completed.draft.teams) {
    assert.equal(tm.picks.length, ROUNDS);
    assert.ok(tm.spent <= 200, `${tm.name} overspent: ${tm.spent}`);
  }
});
