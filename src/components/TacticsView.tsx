import React, { useMemo, useState } from 'react';
import { CLUB_STADIUMS } from '../data/database';
import type {
  DraftState,
  LeagueState,
  NetStateSnapshot,
  PendingMatchContext,
  TeamTactics,
} from '../types/game';
import { getUclWeekTitle } from '../utils/careerLogic';
import {
  BUILDUP_OPTIONS,
  COUNTER_PRESS_OPTIONS,
  DEFENSIVE_LINE_OPTIONS,
  evaluateTacticalFit,
  FINAL_THIRD_OPTIONS,
  getTeamTactics,
  PRESS_OPTIONS,
  TACKLING_OPTIONS,
  TACTIC_PRESETS,
  TEMPO_OPTIONS,
  WIDTH_OPTIONS,
  type TacticOptionMeta,
} from '../utils/tacticsLogic';
import { TeamIdentityBadge } from './ClubBadge';

interface TacticsViewProps {
  draft: DraftState;
  league: LeagueState | null;
  pendingMatch: PendingMatchContext;
  net: NetStateSnapshot;
  onUpdateTactics: (teamIdx: number, next: TeamTactics) => void;
  onBackToLineup: () => void;
  onStartMatch: () => void;
}

interface SegmentRowProps<T extends string> {
  label: string;
  value: T;
  options: TacticOptionMeta<T>[];
  onChange: (val: T) => void;
}

function SegmentRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentRowProps<T>) {
  const activeOpt = options.find((o) => o.value === value) || options[0];
  return (
    <div className="space-y-1.5 border-b border-[var(--border)]/70 pb-3.5 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[var(--fg)]">{label}</span>
        <span className="text-[11px] font-medium text-[var(--pri-bright)]">{activeOpt.label}</span>
      </div>
      <div
        role="group"
        aria-label={label}
        className={`grid gap-1.5 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(opt.value)}
              className={`rounded-lg border px-2.5 py-2 text-center text-xs font-semibold transition whitespace-nowrap truncate ${
                selected
                  ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white shadow-sm'
                  : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:border-[#32465c] hover:text-[var(--fg)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] leading-snug text-[var(--muted)]">{activeOpt.hint}</p>
    </div>
  );
}

export const TacticsView: React.FC<TacticsViewProps> = ({
  draft,
  league,
  pendingMatch,
  net,
  onUpdateTactics,
  onBackToLineup,
  onStartMatch,
}) => {
  const teamA = draft.teams[pendingMatch.a];
  const teamB = draft.teams[pendingMatch.b];
  const isCareer = !!draft.m.career;
  const isUcl = Boolean(isCareer && (league?.isUcl || league?.leagueName === 'Şampiyonlar Ligi'));

  const editableTeamIndices = useMemo(() => {
    if (net.connected) {
      if (pendingMatch.a === net.myTeamIdx) return [pendingMatch.a];
      if (pendingMatch.b === net.myTeamIdx) return [pendingMatch.b];
      return [net.myTeamIdx];
    }
    const list: number[] = [];
    if (teamA?.isHuman) list.push(pendingMatch.a);
    if (teamB?.isHuman && pendingMatch.b !== pendingMatch.a) list.push(pendingMatch.b);
    return list.length ? list : [pendingMatch.a];
  }, [net.connected, net.myTeamIdx, pendingMatch.a, pendingMatch.b, teamA, teamB]);

  const [activeEditIdx, setActiveEditIdx] = useState<number>(editableTeamIndices[0]);
  const safeEditIdx = editableTeamIndices.includes(activeEditIdx)
    ? activeEditIdx
    : editableTeamIndices[0];
  const activeTeam = draft.teams[safeEditIdx];
  const tactics = getTeamTactics(activeTeam);

  const starters = useMemo(
    () =>
      activeTeam?.starters && activeTeam.starters.length
        ? activeTeam.starters
        : activeTeam?.picks.slice(0, 11) || [],
    [activeTeam]
  );

  const fitReport = useMemo(() => evaluateTacticalFit(starters, tactics), [starters, tactics]);

  if (!teamA || !teamB || !activeTeam) return null;

  const stadiumName = CLUB_STADIUMS[teamA.name];
  const matchContextLabel = isCareer && league
    ? isUcl
      ? `UEFA Şampiyonlar Ligi · ${getUclWeekTitle(league.week)}`
      : `${league.leagueName} · ${league.week}. Hafta`
    : pendingMatch.tourneyMatchId === 'FINAL'
    ? 'Turnuva · Büyük Final'
    : pendingMatch.tourneyMatchId
    ? `Turnuva · ${pendingMatch.tourneyMatchId}`
    : 'Hazırlık Maçı';

  const patch = <K extends keyof TeamTactics>(key: K, val: TeamTactics[K]) => {
    onUpdateTactics(safeEditIdx, { ...tactics, [key]: val });
  };

  return (
    <section aria-label="Maç Öncesi Taktik Ekranı" className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span className="font-semibold text-[var(--pri-bright)]">Maç Öncesi Taktik</span>
              <span aria-hidden="true">·</span>
              <span>{matchContextLabel}</span>
              {stadiumName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{stadiumName}</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <TeamIdentityBadge team={teamA} size={28} />
                <span className="font-disp text-base font-bold text-[var(--fg)]">{teamA.name}</span>
                <span className="font-mono-tab text-xs text-[var(--muted)]">{teamA.formation}</span>
              </div>
              <span className="text-xs font-semibold text-[var(--muted)]">vs</span>
              <div className="flex items-center gap-2">
                <TeamIdentityBadge team={teamB} size={28} />
                <span className="font-disp text-base font-bold text-[var(--fg)]">{teamB.name}</span>
                <span className="font-mono-tab text-xs text-[var(--muted)]">{teamB.formation}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!net.connected && (
              <button
                type="button"
                onClick={onBackToLineup}
                className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3.5 py-2 text-xs font-semibold text-[var(--fg)] transition hover:bg-[var(--accent)] whitespace-nowrap"
              >
                Kadroya Dön
              </button>
            )}
            <button
              type="button"
              onClick={onStartMatch}
              className="rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-5 py-2 text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(34,197,94,0.55)] transition hover:bg-[#15803d] whitespace-nowrap"
            >
              Maça Başla
            </button>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
          {editableTeamIndices.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Takım Seçimi">
              {editableTeamIndices.map((idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-pressed={safeEditIdx === idx}
                  onClick={() => setActiveEditIdx(idx)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                    safeEditIdx === idx
                      ? 'border-[var(--pri-bright)] bg-[var(--pri)] text-white'
                      : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  <TeamIdentityBadge team={draft.teams[idx]} size={18} />
                  <span>{draft.teams[idx].name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span>Aktif Takım:</span>
              <strong className="text-[var(--fg)]">{activeTeam.name}</strong>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Hazır Şablonlar">
            <span className="mr-1 text-[11px] font-medium text-[var(--muted)]">Şablon:</span>
            {TACTIC_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onUpdateTactics(safeEditIdx, { ...preset.tactics })}
                className="rounded-md border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-[11px] font-semibold text-[var(--fg)] transition hover:border-[var(--pri-bright)]/60 hover:bg-[var(--raised)] whitespace-nowrap"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-lg">
          <div className="mb-4 border-b border-[var(--border)] pb-2.5">
            <h2 className="font-disp text-base font-bold text-[var(--fg)]">Top Rakipteyken</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Savunma yerleşimi, pres ve müdahale planı</p>
          </div>

          <div className="space-y-4">
            <SegmentRow
              label="Pres Şiddeti"
              value={tactics.pressIntensity}
              options={PRESS_OPTIONS}
              onChange={(val) => patch('pressIntensity', val)}
            />
            <SegmentRow
              label="Savunma Çizgisi"
              value={tactics.defensiveLine}
              options={DEFENSIVE_LINE_OPTIONS}
              onChange={(val) => patch('defensiveLine', val)}
            />
            <SegmentRow
              label="Top Kapma Yaklaşımı"
              value={tactics.tackling}
              options={TACKLING_OPTIONS}
              onChange={(val) => patch('tackling', val)}
            />
            <SegmentRow
              label="Karşı Pres (Top Kaybında)"
              value={tactics.counterPress}
              options={COUNTER_PRESS_OPTIONS}
              onChange={(val) => patch('counterPress', val)}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-lg">
          <div className="mb-4 border-b border-[var(--border)] pb-2.5">
            <h2 className="font-disp text-base font-bold text-[var(--fg)]">Top Bizdeyken</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Oyun kurma, tempo, genişlik ve bitiricilik</p>
          </div>

          <div className="space-y-4">
            <SegmentRow
              label="Oyun Kurma Tarzı"
              value={tactics.buildUp}
              options={BUILDUP_OPTIONS}
              onChange={(val) => patch('buildUp', val)}
            />
            <SegmentRow
              label="Hücum Temposu"
              value={tactics.tempo}
              options={TEMPO_OPTIONS}
              onChange={(val) => patch('tempo', val)}
            />
            <SegmentRow
              label="Hücum Genişliği"
              value={tactics.width}
              options={WIDTH_OPTIONS}
              onChange={(val) => patch('width', val)}
            />
            <SegmentRow
              label="Son Bölge Talimatı"
              value={tactics.finalThird}
              options={FINAL_THIRD_OPTIONS}
              onChange={(val) => patch('finalThird', val)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <span className="block text-[11px] text-[var(--muted)]">Kadro-Taktik Uyumu</span>
            <strong
              className={`font-mono-tab text-sm font-bold ${
                fitReport.fitRating >= 1.2
                  ? 'text-[var(--pri-bright)]'
                  : fitReport.fitRating >= 0
                  ? 'text-[var(--fg)]'
                  : 'text-amber-300'
              }`}
            >
              {fitReport.fitRating >= 0 ? `+${fitReport.fitRating.toFixed(1)}` : fitReport.fitRating.toFixed(1)}
            </strong>
          </div>
          <div>
            <span className="block text-[11px] text-[var(--muted)]">Kondisyon Yükü</span>
            <strong
              className={`text-sm font-bold ${
                fitReport.staminaLevel === 'Yüksek'
                  ? 'text-amber-300'
                  : fitReport.staminaLevel === 'Düşük'
                  ? 'text-[var(--pri-bright)]'
                  : 'text-[var(--fg)]'
              }`}
            >
              {fitReport.staminaLevel}
            </strong>
          </div>
          <div>
            <span className="block text-[11px] text-[var(--muted)]">Kart Riski</span>
            <strong
              className={`text-sm font-bold ${
                fitReport.cardRisk === 'Yüksek'
                  ? 'text-rose-300'
                  : fitReport.cardRisk === 'Düşük'
                  ? 'text-[var(--pri-bright)]'
                  : 'text-[var(--fg)]'
              }`}
            >
              {fitReport.cardRisk}
            </strong>
          </div>
        </div>
        <div className="mt-3 border-t border-[var(--border)] pt-2.5 text-xs text-[var(--muted)]">
          Analiz: <span className="text-[var(--fg)]">{fitReport.strengthNote}</span>
        </div>
      </div>
    </section>
  );
};
