import React, { useMemo, useState } from 'react';
import { FORMATION_QUOTA, POSITIONS, ROUNDS } from '../data/database';
import type {
  AuctionState,
  DraftState,
  Player,
  Position,
} from '../types/game';
import {
  getMaxAllowedBid,
  getTeamRemainingBudget,
  isTeamEligibleForAuctionPlayer,
} from '../utils/auctionLogic';
import { posCountsOf } from '../utils/draftLogic';
import { ClubLogo, PosBadge, TeamIdentityBadge } from './ClubBadge';

interface AuctionDraftViewProps {
  draft: DraftState;
  auction: AuctionState;
  strictPos: boolean;
  errorMsg: string;
  onNominatePlayer: (playerId: number, openingBid: number) => void;
  onPlaceBid: (teamIdx: number, amount: number) => void;
  onPassLot: (teamIdx: number) => void;
  onAdvanceSold: () => void;
  onAutoComplete: () => void;
  onProceedAfterDraft: () => void;
  onResetToSetup: () => void;
}

export const AuctionDraftView: React.FC<AuctionDraftViewProps> = ({
  draft,
  auction,
  strictPos,
  errorMsg,
  onNominatePlayer,
  onPlaceBid,
  onPassLot,
  onAdvanceSold,
  onAutoComplete,
  onProceedAfterDraft,
  onResetToSetup,
}) => {
  const [searchQ, setSearchQ] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [posFilter, setPosFilter] = useState<'' | Position>('');
  const [page, setPage] = useState(1);
  const [openingBid, setOpeningBid] = useState(1);
  const [customBid, setCustomBid] = useState('');
  const PAGE_SIZE = 40;

  const done = auction.phase === 'done';
  const totalSlots = draft.teams.length * ROUNDS;
  const filledSlots = draft.teams.reduce((s, t) => s + t.picks.length, 0);

  const nominatorTeam = draft.teams[auction.nominatorIdx];
  const activeBidderTeam = draft.teams[auction.activeBidderIdx];
  const highestBidderTeam =
    auction.highestBidderIdx != null ? draft.teams[auction.highestBidderIdx] : null;

  const isHumanNominating =
    auction.phase === 'nominating' &&
    auction.nominationMode === 'player' &&
    Boolean(nominatorTeam?.isHuman);

  const isHumanBidding =
    auction.phase === 'bidding' && Boolean(activeBidderTeam?.isHuman);

  const poolLeagues = useMemo(() => [...new Set(draft.pool.map((p) => p.lg))], [draft.pool]);

  const filteredPool = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return draft.pool
      .filter((p) => !draft.taken.has(p.id))
      .filter((p) => !leagueFilter || p.lg === leagueFilter)
      .filter((p) => !posFilter || p.pos === posFilter)
      .filter(
        (p) =>
          !q ||
          p.n.toLowerCase().includes(q) ||
          p.c.toLowerCase().includes(q) ||
          (p.nat && p.nat.toLowerCase().includes(q)) ||
          (p.trait && p.trait.toLowerCase().includes(q))
      )
      .sort((a, b) => a.n.localeCompare(b.n, 'tr'));
  }, [draft.pool, draft.taken, leagueFilter, posFilter, searchQ]);

  const totalPages = Math.max(1, Math.ceil(filteredPool.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedPool = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredPool.slice(start, start + PAGE_SIZE);
  }, [filteredPool, safePage]);

  const minNextBid = Math.max(1, auction.currentBid + 1);
  const bidderMaxBid = activeBidderTeam
    ? getMaxAllowedBid(activeBidderTeam, auction.budgetPerTeam)
    : 0;
  const bidderRemBudget = activeBidderTeam
    ? getTeamRemainingBudget(activeBidderTeam, auction.budgetPerTeam)
    : 0;
  const nominatorMaxBid = nominatorTeam
    ? getMaxAllowedBid(nominatorTeam, auction.budgetPerTeam)
    : 1;

  const passedSet = useMemo(() => new Set(auction.passedTeams), [auction.passedTeams]);

  const handleCustomBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customBid, 10);
    if (!Number.isFinite(val)) return;
    onPlaceBid(auction.activeBidderIdx, val);
    setCustomBid('');
  };

  return (
    <section aria-label="Açık Artırma Draftı" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span className="font-semibold text-[var(--pri-bright)]">Açık Artırma Draftı</span>
            <span aria-hidden="true">·</span>
            <span>
              {auction.nominationMode === 'ai' ? 'Yapay Zeka Sunumu' : 'Sırayla Oyuncu Koyma'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tab">
              Lot #{auction.lotNumber} · {filledSlots}/{totalSlots} Oyuncu
            </span>
          </div>
          <h1 className="mt-0.5 text-lg font-extrabold text-[var(--fg)]">
            {done
              ? 'Tüm Kadrolar Tamamlandı'
              : auction.phase === 'sold_flash' && auction.lastSold
              ? `Satıldı: ${auction.lastSold.player.n} ($${auction.lastSold.price})`
              : auction.phase === 'nominating'
              ? isHumanNominating
                ? `Oyuncu Çıkarma Sırası: ${nominatorTeam?.name}`
                : `${nominatorTeam?.name} oyuncu çıkarıyor...`
              : isHumanBidding
              ? `Teklif Sırası: ${activeBidderTeam?.name}`
              : `${activeBidderTeam?.name} karar veriyor...`}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!done && (
            <button
              type="button"
              onClick={onAutoComplete}
              className="rounded-lg border border-amber-400/50 bg-amber-900/50 px-3.5 py-2 text-xs font-bold text-amber-100 transition hover:bg-amber-800/70 whitespace-nowrap"
            >
              Hızlı Tamamla
            </button>
          )}
          {done && (
            <button
              type="button"
              onClick={onProceedAfterDraft}
              className="rounded-lg border border-[var(--pri-bright)] bg-[var(--pri)] px-4 py-2 text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(34,197,94,0.6)] transition hover:bg-[#15803d] whitespace-nowrap"
            >
              Takım Kimliği Adımına Geç
            </button>
          )}
          <button
            type="button"
            onClick={onResetToSetup}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--fg)] whitespace-nowrap"
          >
            Çık
          </button>
        </div>
      </div>

      {errorMsg && (
        <p
          role="alert"
          className="rounded-xl border border-amber-500/45 bg-amber-950/45 px-4 py-2.5 text-xs font-medium text-amber-200"
        >
          {errorMsg}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {auction.phase === 'sold_flash' && auction.lastSold && (
            <div className="rounded-2xl border border-[var(--pri-bright)]/60 bg-[var(--surface)] p-5 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <ClubLogo club={auction.lastSold.player.c} size={38} />
                  <div>
                    <span className="text-xs font-semibold text-[var(--pri-bright)]">
                      Açık Artırma Sonucu
                    </span>
                    <h2 className="font-disp text-xl font-extrabold text-[var(--fg)]">
                      {auction.lastSold.player.n}
                    </h2>
                    <div className="mt-0.5 text-xs text-[var(--muted)]">
                      Kazanan:{' '}
                      <strong className="text-[var(--fg)]">
                        {draft.teams[auction.lastSold.winnerIdx]?.name}
                      </strong>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono-tab font-bold text-amber-300">
                        ${auction.lastSold.price}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onAdvanceSold}
                  className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#15803d] whitespace-nowrap"
                >
                  Sıradaki Oyuncuya Geç
                </button>
              </div>
            </div>
          )}

          {auction.phase === 'bidding' && auction.activePlayer && (
            <div
              data-testid="auction-podium"
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg space-y-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div className="flex items-start gap-3.5">
                  <ClubLogo club={auction.activePlayer.c} size={46} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PosBadge pos={auction.activePlayer.pos} />
                      <h2 className="font-disp text-2xl font-extrabold text-[var(--fg)]">
                        {auction.activePlayer.n}
                      </h2>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                      <span>{auction.activePlayer.c}</span>
                      {auction.activePlayer.nat && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--fg)]">{auction.activePlayer.nat}</span>
                        </>
                      )}
                      {auction.activePlayer.trait && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{auction.activePlayer.trait}</span>
                        </>
                      )}
                      {auction.activePlayer.role && (
                        <>
                          <span aria-hidden="true">/</span>
                          <span>{auction.activePlayer.role}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="block text-[11px] text-[var(--muted)]">
                    {highestBidderTeam ? 'Mevcut En Yüksek Teklif' : 'Açılış Fiyatı'}
                  </span>
                  <div
                    data-testid="auction-current-bid"
                    className="font-mono-tab text-3xl font-extrabold text-[var(--pri-bright)]"
                  >
                    ${auction.currentBid > 0 ? auction.currentBid : 0}
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    {highestBidderTeam ? (
                      <>
                        Lider: <strong className="text-[var(--fg)]">{highestBidderTeam.name}</strong>
                      </>
                    ) : (
                      'Henüz teklif verilmedi'
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {draft.teams.map((tm, idx) => {
                  const isHigh = auction.highestBidderIdx === idx;
                  const isTurn = auction.activeBidderIdx === idx;
                  const isPass = passedSet.has(idx);
                  const statusText = isHigh
                    ? 'En Yüksek'
                    : isTurn
                    ? 'Sırada'
                    : isPass
                    ? 'Çekildi'
                    : 'Bekliyor';

                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border px-3 py-2 text-xs ${
                        isTurn
                          ? 'border-[var(--pri-bright)] bg-[#111e1a]'
                          : isHigh
                          ? 'border-amber-400/50 bg-amber-950/25'
                          : isPass
                          ? 'border-[var(--border)] bg-[var(--card)] opacity-55'
                          : 'border-[var(--border)] bg-[var(--card)]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <TeamIdentityBadge team={tm} size={18} />
                        <span className="truncate font-bold text-[var(--fg)]">{tm.name}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-[var(--muted)]">{statusText}</span>
                        <span className="font-mono-tab font-semibold text-[var(--fg)]">
                          ${getTeamRemainingBudget(tm, auction.budgetPerTeam)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {isHumanBidding && activeBidderTeam ? (
                <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[var(--fg)]">
                      {activeBidderTeam.name} · Teklif Paneli
                    </span>
                    <span className="font-mono-tab text-[var(--muted)]">
                      Kasa: <strong className="text-[var(--fg)]">${bidderRemBudget}</strong> · Maks.
                      Teklif: <strong className="text-[var(--pri-bright)]">${bidderMaxBid}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {[1, 2, 5, 10].map((inc) => {
                      const target =
                        auction.currentBid === 0
                          ? inc
                          : auction.currentBid + inc;
                      const disabled = target < minNextBid || target > bidderMaxBid;
                      return (
                        <button
                          key={inc}
                          type="button"
                          disabled={disabled}
                          onClick={() => onPlaceBid(auction.activeBidderIdx, target)}
                          className="rounded-lg border border-[var(--pri-bright)] bg-[var(--pri)] px-4 py-2 font-mono-tab text-xs font-bold text-white transition hover:bg-[#15803d] disabled:border-[var(--border)] disabled:bg-[var(--raised)] disabled:text-[var(--muted)] disabled:opacity-45 whitespace-nowrap"
                        >
                          {auction.currentBid === 0 ? `$${target} Teklif` : `+$${inc} ($${target})`}
                        </button>
                      );
                    })}

                    <form onSubmit={handleCustomBidSubmit} className="flex items-center gap-1.5">
                      <label htmlFor="auction-custom-bid" className="sr-only">
                        Özel teklif tutarı
                      </label>
                      <input
                        id="auction-custom-bid"
                        type="number"
                        min={minNextBid}
                        max={bidderMaxBid}
                        value={customBid}
                        onChange={(e) => setCustomBid(e.target.value)}
                        placeholder={`$${minNextBid}+`}
                        className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 font-mono-tab text-xs text-[var(--fg)] focus:border-[var(--pri-bright)] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!customBid || Number(customBid) < minNextBid || Number(customBid) > bidderMaxBid}
                        className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-xs font-semibold text-[var(--fg)] transition hover:bg-[var(--accent)] disabled:opacity-45 whitespace-nowrap"
                      >
                        Teklif Ver
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() => onPassLot(auction.activeBidderIdx)}
                      className="ml-auto rounded-lg border border-rose-500/50 bg-rose-950/45 px-4 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-900/60 whitespace-nowrap"
                    >
                      Çekil (Pas)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-xs text-[var(--muted)]">
                  {activeBidderTeam?.name} teklifini değerlendiriyor...
                </div>
              )}

              {auction.bidLog.length > 0 && (
                <div className="border-t border-[var(--border)] pt-3">
                  <span className="mb-2 block text-[11px] font-semibold text-[var(--muted)]">
                    Son Hareketler
                  </span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {[...auction.bidLog].reverse().slice(0, 6).map((entry, idx) => (
                      <span key={idx} className="text-[var(--muted)]">
                        <strong className="text-[var(--fg)]">
                          {draft.teams[entry.teamIdx]?.name}
                        </strong>{' '}
                        {entry.action === 'pass' ? (
                          <span className="text-rose-300">çekildi</span>
                        ) : entry.action === 'nominate' ? (
                          <span className="font-mono-tab text-[var(--pri-bright)]">
                            açtı (${entry.amount})
                          </span>
                        ) : (
                          <span className="font-mono-tab text-[var(--pri-bright)]">
                            ${entry.amount}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {auction.phase === 'nominating' && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
              {!isHumanNominating ? (
                <div className="py-10 text-center text-sm text-[var(--muted)]">
                  {nominatorTeam?.name} açık artırmaya çıkaracağı oyuncuyu seçiyor...
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-[var(--fg)]">
                        Açık Artırmaya Oyuncu Çıkar ({nominatorTeam?.name})
                      </h2>
                      <p className="text-xs text-[var(--muted)]">
                        Seçtiğin oyuncu belirlediğin açılış fiyatıyla artırmaya açılır.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-[var(--muted)]">Açılış:</span>
                      {[1, 2, 5, 10].map((v) => (
                        <button
                          key={v}
                          type="button"
                          disabled={v > nominatorMaxBid}
                          aria-pressed={openingBid === v}
                          onClick={() => setOpeningBid(v)}
                          className={`rounded border px-2 py-1 font-mono-tab text-xs font-bold ${
                            openingBid === v
                              ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                              : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] disabled:opacity-40'
                          }`}
                        >
                          ${v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <label htmlFor="auction-search" className="sr-only">
                      Oyuncu, kulüp, uyruk veya özellik ara
                    </label>
                    <input
                      id="auction-search"
                      type="text"
                      value={searchQ}
                      onChange={(e) => {
                        setSearchQ(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Oyuncu, kulüp, uyruk veya özellik ara..."
                      className="min-w-[180px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--fg)] focus:border-[var(--pri-bright)] focus:outline-none"
                    />
                    <select
                      aria-label="Lig filtresi"
                      value={leagueFilter}
                      onChange={(e) => {
                        setLeagueFilter(e.target.value);
                        setPage(1);
                      }}
                      className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--fg)]"
                    >
                      <option value="">Tüm Ligler</option>
                      {poolLeagues.map((lg) => (
                        <option key={lg} value={lg}>
                          {lg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Mevki Filtresi">
                      {(
                        [
                          ['', 'Tümü'],
                          ['GK', 'KL'],
                          ['DEF', 'DF'],
                          ['MID', 'OS'],
                          ['FWD', 'FV'],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val || 'ALL'}
                          type="button"
                          aria-pressed={posFilter === val}
                          onClick={() => {
                            setPosFilter(val);
                            setPage(1);
                          }}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                            posFilter === val
                              ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                              : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span className="font-mono-tab text-[11px]">
                        {filteredPool.length} Oyuncu · Sayfa {safePage}/{totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={safePage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] font-bold text-[var(--fg)] disabled:opacity-40"
                      >
                        Önceki
                      </button>
                      <button
                        type="button"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] font-bold text-[var(--fg)] disabled:opacity-40"
                      >
                        Sonraki
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[460px] overflow-y-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-[var(--raised)] text-[11px] text-[var(--muted)]">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Oyuncu</th>
                          <th className="px-2 py-2 font-semibold">Uyruk / Özellik</th>
                          <th className="px-2 py-2 font-semibold">Mevki</th>
                          <th className="px-3 py-2 text-right font-semibold">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)] bg-[var(--card)]">
                        {pagedPool.map((p: Player) => {
                          const safeOpening = Math.min(openingBid, nominatorMaxBid);
                          const eligible =
                            nominatorTeam != null &&
                            isTeamEligibleForAuctionPlayer(
                              draft,
                              nominatorTeam,
                              p,
                              auction.budgetPerTeam,
                              safeOpening,
                              strictPos
                            );
                          return (
                            <tr key={p.id} className="hover:bg-[var(--raised)]/65">
                              <td className="px-3 py-2">
                                <div className="font-semibold text-[var(--fg)]">{p.n}</div>
                                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--muted)]">
                                  <ClubLogo club={p.c} size={13} />
                                  <span className="max-w-[130px] truncate">{p.c}</span>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-[11px] text-[var(--muted)]">
                                <div className="text-[var(--fg)]">{p.nat || '—'}</div>
                                <div className="truncate max-w-[170px]">
                                  {p.trait ? `${p.trait}${p.role ? ` / ${p.role}` : ''}` : '—'}
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <PosBadge pos={p.pos} />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  disabled={!eligible}
                                  onClick={() => onNominatePlayer(p.id, safeOpening)}
                                  className="rounded border border-[var(--pri-bright)] bg-[var(--pri)] px-2.5 py-1 font-mono-tab text-[11px] font-bold text-white transition hover:bg-[#15803d] disabled:border-[var(--border)] disabled:bg-[var(--raised)] disabled:text-[var(--muted)] disabled:opacity-45 whitespace-nowrap"
                                >
                                  Çıkar (${safeOpening})
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredPool.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-4 py-6 text-center text-[var(--muted)]">
                              Uygun oyuncu bulunamadı.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {done && (
            <div className="rounded-2xl border border-[var(--pri-bright)]/50 bg-[var(--surface)] p-6 text-center shadow-lg">
              <h2 className="font-disp text-xl font-extrabold text-[var(--fg)]">
                Açık Artırma Tamamlandı
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Tüm takımlar 14 kişilik kadrolarını tamamladı. Takım kimliği ve taktik adımına geçebilirsin.
              </p>
              <button
                type="button"
                onClick={onProceedAfterDraft}
                className="mt-4 rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#15803d]"
              >
                Takım Kimliği &amp; Kadroya Geç
              </button>
            </div>
          )}
        </div>

        <aside aria-label="Takım Kasaları ve Kadrolar" className="space-y-3">
          {draft.teams.map((tm, idx) => {
            const remBudget = getTeamRemainingBudget(tm, auction.budgetPerTeam);
            const maxBid = getMaxAllowedBid(tm, auction.budgetPerTeam);
            const counts = posCountsOf(tm);
            const isHighlighted =
              (auction.phase === 'nominating' && auction.nominatorIdx === idx) ||
              (auction.phase === 'bidding' && auction.activeBidderIdx === idx);

            return (
              <div
                key={`${tm.name}_${idx}`}
                className={`rounded-2xl border p-3 shadow-md ${
                  isHighlighted && !done
                    ? 'border-[var(--pri-bright)] bg-[#121a1e]'
                    : 'border-[var(--border)] bg-[var(--surface)]'
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <TeamIdentityBadge team={tm} size={22} />
                    <span className="truncate text-xs font-bold text-[var(--fg)]">{tm.name}</span>
                  </div>
                  <div className="shrink-0 text-right font-mono-tab text-[11px]">
                    <span className="font-bold text-[var(--pri-bright)]">${remBudget}</span>
                    <span className="text-[var(--muted)]"> · {tm.picks.length}/{ROUNDS}</span>
                  </div>
                </div>

                <div className="mb-2 flex flex-wrap items-center justify-between gap-1 text-[10px] text-[var(--muted)] font-mono-tab">
                  <span>
                    {POSITIONS.map(
                      (pk) =>
                        `${pk === 'GK' ? 'KL' : pk === 'DEF' ? 'DF' : pk === 'MID' ? 'OS' : 'FV'} ${counts[pk]}/${FORMATION_QUOTA[pk]}`
                    ).join(' · ')}
                  </span>
                  <span>Maks ${maxBid}</span>
                </div>

                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {tm.picks.map((pk) => {
                    const hItem = draft.history.find(
                      (h) => h.teamIdx === idx && h.playerId === pk.id
                    );
                    return (
                      <div
                        key={pk.id}
                        className="flex items-center justify-between gap-1.5 rounded bg-[var(--card)] px-2 py-1 text-[11px]"
                      >
                        <div className="flex min-w-0 items-center gap-1.5">
                          <PosBadge pos={pk.pos} />
                          <span className="truncate font-medium text-[var(--fg)]">{pk.n}</span>
                        </div>
                        <span className="shrink-0 font-mono-tab text-[10px] text-amber-300">
                          {hItem ? `$${hItem.paid}` : pk.c}
                        </span>
                      </div>
                    );
                  })}
                  {tm.picks.length === 0 && (
                    <p className="py-2 text-center text-[11px] text-[var(--muted)]">
                      Henüz oyuncu alınmadı.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </aside>
      </div>
    </section>
  );
};
