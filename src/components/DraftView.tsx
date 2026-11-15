import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FORMATION_QUOTA, POSITIONS, ROUNDS } from '../data/database';
import { isPeerReadyForPhase } from '../services/onlineNet';
import type { DraftState, NetStateSnapshot, Player, Position, WheelState } from '../types/game';
import {
  canPickPlayer,
  canTeamPickPos,
  checkBudgetStatus,
  cost,
  getWheelClubsForTurn,
  posCountsOf,
} from '../utils/draftLogic';
import { ClubLogo, OnlineReadyBadges, PosBadge, TeamIdentityBadge } from './ClubBadge';

interface DraftViewProps {
  draft: DraftState;
  wheel: WheelState;
  strictPos: boolean;
  net: NetStateSnapshot;
  onPickPlayer: (playerId: number) => void;
  onAutoComplete: () => void;
  onUndo: () => void;
  onProceedAfterDraft: () => void;
  onSpinWheel: (useJoker?: boolean) => void;
  onResetToSetup: () => void;
}

const SLICE_COLORS = [
  '#166534',
  '#1e3a8a',
  '#7c2d12',
  '#581c87',
  '#0f766e',
  '#991b1b',
  '#365314',
  '#1e293b',
];

export const DraftView: React.FC<DraftViewProps> = ({
  draft,
  wheel,
  strictPos,
  net,
  onPickPlayer,
  onAutoComplete,
  onUndo,
  onProceedAfterDraft,
  onSpinWheel,
  onResetToSetup,
}) => {
  const [searchQ, setSearchQ] = useState('');
  const [leagueFilter, setLeagueFilter] = useState('');
  const [clubFilter, setClubFilter] = useState('');
  const [posFilter, setPosFilter] = useState<'' | Position>('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const done = draft.k >= draft.order.length;
  const activeTeamIdx = done ? 0 : draft.order[draft.k];
  const activeTeam = draft.teams[activeTeamIdx];
  const roundNum = Math.min(ROUNDS, Math.floor(draft.k / draft.teams.length) + 1);
  const isMyTurn = !done && activeTeam?.isHuman && (!net.connected || activeTeamIdx === net.myTeamIdx);
  const isWheelMode = draft.m.id === 'wheel';
  const myAutoReady = isPeerReadyForPhase(net, 'draft_auto', net.myTeamIdx);

  const wheelClubs = useMemo(() => {
    if (!isWheelMode || done || !activeTeam) return [];
    return getWheelClubsForTurn(draft, activeTeam, strictPos);
  }, [isWheelMode, done, draft, activeTeam, strictPos]);

  useEffect(() => {
    if (!isWheelMode || !canvasRef.current || wheelClubs.length === 0) return;
    const cvs = canvasRef.current;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const w = cvs.width;
    const h = cvs.height;
    const cx = w / 2;
    const cy = h / 2;
    const rad = Math.min(cx, cy) - 10;
    const slice = (Math.PI * 2) / wheelClubs.length;

    ctx.clearRect(0, 0, w, h);

    wheelClubs.forEach((club, idx) => {
      const a0 = wheel.angle + idx * slice;
      const a1 = a0 + slice;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rad, a0, a1);
      ctx.closePath();
      ctx.fillStyle = SLICE_COLORS[idx % SLICE_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a0 + slice / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
      const label = club.length > 16 ? `${club.slice(0, 15)}…` : club;
      ctx.fillText(label, rad - 12, 4);
      ctx.restore();
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#070a0e';
    ctx.fill();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [isWheelMode, wheelClubs, wheel.angle]);

  const poolLeagues = useMemo(() => [...new Set(draft.pool.map((p) => p.lg))], [draft.pool]);
  const poolClubs = useMemo(() => {
    const base = leagueFilter ? draft.pool.filter((p) => p.lg === leagueFilter) : draft.pool;
    return [...new Set(base.map((p) => p.c))];
  }, [draft.pool, leagueFilter]);

  const filteredPool = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return draft.pool
      .filter((p) => !draft.taken.has(p.id))
      .filter((p) => !leagueFilter || p.lg === leagueFilter)
      .filter((p) => !clubFilter || p.c === clubFilter)
      .filter((p) => !posFilter || p.pos === posFilter)
      .filter((p) => !q || p.n.toLowerCase().includes(q) || p.c.toLowerCase().includes(q))
      .sort((a, b) => b.r - a.r);
  }, [draft.pool, draft.taken, leagueFilter, clubFilter, posFilter, searchQ]);

  const counts = activeTeam ? posCountsOf(activeTeam) : { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const budgetLeft =
    draft.m.budget && activeTeam ? draft.m.budget - activeTeam.spent : null;

  return (
    <section aria-label="Draft Masası" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
        <div className="flex items-center gap-3">
          {activeTeam && <TeamIdentityBadge team={activeTeam} size={36} />}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-[var(--pri)]/30 px-2 py-0.5 text-[11px] font-bold text-[var(--pri-bright)]">
                {draft.m.name}
              </span>
              <span className="font-mono-tab text-xs text-[var(--muted)]">
                {done ? 'Draft Tamamlandı' : `Tur ${roundNum}/${ROUNDS} · Seçim ${draft.k + 1}/${draft.order.length}`}
              </span>
            </div>
            <h1 className="text-lg font-extrabold text-[var(--fg)]">
              {done
                ? 'Tüm Kadrolar Kuruldu! Sıradaki Adıma Geçebilirsin'
                : activeTeam.isHuman
                ? isMyTurn
                  ? `Seçim Sırası Sende: ${activeTeam.name}`
                  : `Rakip Seçim Yapıyor: ${activeTeam.name}`
                : `Yapay Zeka Seçiyor: ${activeTeam.name}...`}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!done && net.connected && net.readyPhase === 'draft_auto' && (
            <OnlineReadyBadges net={net} phase="draft_auto" />
          )}
          {!done && (
            <button
              type="button"
              onClick={onAutoComplete}
              className="rounded-lg border border-amber-400/50 bg-amber-900/50 px-3.5 py-2 text-xs font-bold text-amber-100 hover:bg-amber-800/70"
            >
              {net.connected
                ? myAutoReady
                  ? 'Hızlı Tamamla: Hazır ✓ (Rakip Bekleniyor...)'
                  : 'Hızlı Tamamla İçin Hazır Ol'
                : 'Hızlı Tamamla (Otomatik)'}
            </button>
          )}
          {!net.connected && draft.history.length > 0 && !done && (
            <button
              type="button"
              onClick={onUndo}
              className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3 py-2 text-xs font-semibold hover:bg-[var(--accent)]"
            >
              ↩ Son Seçimi Geri Al
            </button>
          )}
          {done && (
            <button
              type="button"
              onClick={onProceedAfterDraft}
              className="rounded-lg border border-[var(--pri-bright)] bg-[var(--pri)] px-4 py-2 text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(34,197,94,0.6)] hover:bg-[#15803d]"
            >
              Takım Kimliği &amp; Logo Adımına Geç →
            </button>
          )}
          {!net.connected && (
            <button
              type="button"
              onClick={onResetToSetup}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--muted)] hover:text-white"
            >
              Çık
            </button>
          )}
        </div>
      </div>

      {draft.budgetWarning && (
        <p
          role="alert"
          className="rounded-xl border border-amber-500/45 bg-amber-950/45 px-4 py-2.5 text-xs font-medium text-amber-200"
        >
          {draft.budgetWarning}
        </p>
      )}

      {!done && activeTeam && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[var(--muted)]">Zorunlu Mevkiler:</span>
            {POSITIONS.map((pos) => {
              const cur = counts[pos] || 0;
              const need = FORMATION_QUOTA[pos];
              const ok = cur >= need;
              return (
                <span
                  key={pos}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono-tab text-[11px] font-bold ${
                    ok
                      ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                  }`}
                >
                  <PosBadge pos={pos} />
                  {cur}/{need}
                </span>
              );
            })}
          </div>

          {draft.m.budget && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[var(--muted)]">
                Harcanan:{' '}
                <strong className="font-mono-tab text-[var(--fg)]">{activeTeam.spent} M€</strong>
              </span>
              <span className="text-[var(--muted)]">
                Kalan Bütçe:{' '}
                <strong className="font-mono-tab text-[var(--pri-bright)]">{budgetLeft} M€</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {isWheelMode && !done && (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-emerald-500/40 bg-[var(--surface)] p-4 lg:grid-cols-[320px_1fr]">
          <div className="flex flex-col items-center justify-center">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 text-lg text-amber-400 drop-shadow"
              >
                ▼
              </div>
              <canvas
                ref={canvasRef}
                width={290}
                height={290}
                className="rounded-full border border-[var(--border)] bg-[#070a0e]"
              />
            </div>

            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={!isMyTurn || wheel.spinning || !!wheel.selectedClub}
                onClick={() => onSpinWheel(false)}
                className="rounded-lg border border-[var(--pri-bright)] bg-[var(--pri)] px-4 py-2 text-xs font-bold text-white disabled:opacity-45"
              >
                {wheel.spinning ? 'Çark Dönüyor...' : 'Çarkı Çevir'}
              </button>
              <button
                type="button"
                disabled={!isMyTurn || wheel.spinning || !wheel.selectedClub || wheel.jokers <= 0}
                onClick={() => onSpinWheel(true)}
                className="rounded-lg border border-amber-400/50 bg-amber-900/50 px-3 py-2 text-xs font-bold text-amber-100 disabled:opacity-45"
              >
                Joker Yeniden Çevir ({wheel.jokers})
              </button>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <h2 className="mb-2 text-sm font-bold text-[var(--fg)]">
              {wheel.selectedClub ? (
                <span className="inline-flex items-center gap-2">
                  <ClubLogo club={wheel.selectedClub} size={22} />
                  Çıkan Kulüp: <strong className="text-[var(--pri-bright)]">{wheel.selectedClub}</strong>
                </span>
              ) : (
                'Çarktan Çıkacak Takımdan Oyuncu Seç'
              )}
            </h2>

            {wheel.selectedClub && wheel.offeredPlayers.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {wheel.offeredPlayers.map((p: Player) => {
                  const ok = isMyTurn && canPickPlayer(draft, activeTeam, p, strictPos);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <PosBadge pos={p.pos} />
                          <span className="truncate text-xs font-bold text-[var(--fg)]">{p.n}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                          <ClubLogo club={p.c} size={14} />
                          <span className="truncate">{p.c}</span>
                          {draft.m.budget ? <span className="shrink-0">· {cost(p)} M€</span> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!ok}
                        onClick={() => onPickPlayer(p.id)}
                        className="shrink-0 rounded-lg border border-[var(--pri-bright)] bg-[var(--pri)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                      >
                        Seç
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                Sıra sendeyken çarkı çevir; çıkan kulübün kadrosundan bir oyuncuyu kadrona kat.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label htmlFor="draft-search" className="sr-only">
              Oyuncu veya kulüp ara
            </label>
            <input
              id="draft-search"
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Oyuncu veya kulüp ara..."
              className="min-w-[180px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--fg)] focus:border-[var(--pri-bright)] focus:outline-none"
            />

            <label htmlFor="draft-league-filter" className="sr-only">
              Lig filtresi
            </label>
            <select
              id="draft-league-filter"
              value={leagueFilter}
              onChange={(e) => {
                setLeagueFilter(e.target.value);
                setClubFilter('');
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

            <label htmlFor="draft-club-filter" className="sr-only">
              Kulüp filtresi
            </label>
            <select
              id="draft-club-filter"
              value={clubFilter}
              onChange={(e) => setClubFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs text-[var(--fg)]"
            >
              <option value="">Tüm Kulüpler</option>
              {poolClubs.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Mevki Filtresi">
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
                onClick={() => setPosFilter(val)}
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

          <div className="max-h-[520px] overflow-y-auto rounded-xl border border-[var(--border)]">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[var(--raised)] text-[11px] uppercase tracking-wider text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Oyuncu</th>
                  <th className="px-2 py-2">Kulüp</th>
                  <th className="px-2 py-2">Mevki</th>
                  {draft.m.budget && <th className="px-2 py-2 text-right">Değer</th>}
                  <th className="px-3 py-2 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-[var(--card)]">
                {filteredPool.slice(0, 140).map((p) => {
                  const posAllowed =
                    done || !activeTeam
                      ? false
                      : canTeamPickPos(activeTeam, p.pos, draft.pool, draft.taken, strictPos);
                  const budgetCheck =
                    done || !activeTeam
                      ? { ok: false, reason: '' }
                      : checkBudgetStatus(draft, activeTeam, p, strictPos);
                  const canPick =
                    !isWheelMode && isMyTurn && posAllowed && budgetCheck.ok;

                  return (
                    <tr key={p.id} className="hover:bg-[var(--raised)]/65">
                      <td className="px-3 py-2 font-semibold text-[var(--fg)]">{p.n}</td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                          <ClubLogo club={p.c} size={16} />
                          <span className="max-w-[130px] truncate">{p.c}</span>
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <PosBadge pos={p.pos} />
                      </td>
                      {draft.m.budget && (
                        <td className="px-2 py-2 text-right font-mono-tab text-amber-300">
                          {cost(p)} M€
                        </td>
                      )}
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={!canPick}
                          title={!posAllowed ? 'Mevki kotası dolu' : budgetCheck.reason}
                          onClick={() => onPickPlayer(p.id)}
                          className="rounded border border-[var(--pri-bright)] bg-[var(--pri)] px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-[#15803d] disabled:border-[var(--border)] disabled:bg-[var(--raised)] disabled:text-[var(--muted)] disabled:opacity-45"
                        >
                          {isWheelMode ? 'Çark' : 'Seç'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredPool.length === 0 && (
                  <tr>
                    <td
                      colSpan={draft.m.budget ? 5 : 4}
                      className="px-4 py-6 text-center text-[var(--muted)]"
                    >
                      Arama kriterine uygun boşta oyuncu bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside aria-label="Takım Kadroları" className="space-y-3">
          {draft.teams.map((tm, idx) => (
            <div
              key={`${tm.name}_${idx}`}
              className={`rounded-2xl border p-3 shadow-md ${
                idx === activeTeamIdx && !done
                  ? 'border-[var(--pri-bright)] bg-[#121a1e]'
                  : 'border-[var(--border)] bg-[var(--surface)]'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                <div className="flex min-w-0 items-center gap-2">
                  <TeamIdentityBadge team={tm} size={22} />
                  <span className="truncate text-xs font-bold text-[var(--fg)]">{tm.name}</span>
                </div>
                <span className="shrink-0 font-mono-tab text-[11px] text-[var(--pri-bright)]">
                  {tm.picks.length}/{ROUNDS}
                  {draft.m.budget ? ` · ${draft.m.budget - tm.spent} M€` : ''}
                </span>
              </div>

              <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                {tm.picks.map((pk) => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between gap-1.5 rounded bg-[var(--card)] px-2 py-1 text-[11px]"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <PosBadge pos={pk.pos} />
                      <span className="truncate font-medium text-[var(--fg)]">{pk.n}</span>
                    </div>
                    <span className="inline-flex max-w-[44%] shrink-0 items-center gap-1 text-[10px] text-[var(--muted)]">
                      <ClubLogo club={pk.c} size={14} />
                      <span className="truncate">{pk.c}</span>
                    </span>
                  </div>
                ))}
                {tm.picks.length === 0 && (
                  <p className="py-2 text-center text-[11px] text-[var(--muted)]">
                    Henüz oyuncu seçilmedi.
                  </p>
                )}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </section>
  );
};
