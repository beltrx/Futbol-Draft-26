import React from 'react';
import { CAREER_LEAGUES_PREVIEW } from '../data/database';
import { LeagueLogo } from './ClubBadge';

interface CareerLeagueSelectorViewProps {
  teamName: string;
  isGuestWaiting?: boolean;
  onSelectLeague: (leagueName: string) => void;
  onBackToLineup: () => void;
}

export const CareerLeagueSelectorView: React.FC<CareerLeagueSelectorViewProps> = ({
  teamName,
  isGuestWaiting = false,
  onSelectLeague,
  onBackToLineup,
}) => {
  return (
    <section aria-label="Kariyer Ligi Seçimi" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-lg">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--pri-bright)]">
            LİG KARİYER MODU · 2026-27 SEZONU
          </span>
          <h1 className="text-2xl font-extrabold text-[var(--fg)]">
            {teamName} İçin Mücadele Edeceğin Ligi Seç
          </h1>
          <p className="text-xs text-[var(--muted)]">
            Premier Lig (20 takım · 38 hafta), Bundesliga (18 takım · 34 hafta) ve Serie A (20
            takım · 38 hafta) çift devreli tam sezon olarak hazır.
          </p>
        </div>

        <button
          type="button"
          onClick={onBackToLineup}
          className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3.5 py-2 text-xs font-semibold hover:bg-[var(--accent)]"
        >
          ← Kadro Dizilişine Dön
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {CAREER_LEAGUES_PREVIEW.map((lg) => (
          <div
            key={lg.id}
            className={`flex flex-col justify-between rounded-2xl border p-4 shadow-md ${
              lg.active
                ? 'border-[var(--pri-bright)] bg-gradient-to-br from-[#101820] to-[#090d12]'
                : 'border-[var(--border)] bg-[var(--card)] opacity-70'
            }`}
          >
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  <LeagueLogo league={lg.id} size={20} />
                  <span>{lg.country}</span>
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    lg.active
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-slate-700/40 text-slate-300'
                  }`}
                >
                  {lg.active ? 'AKTİF' : 'YAKINDA'}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-[var(--fg)]">{lg.name}</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">{lg.note}</p>
            </div>

            <div className="mt-4">
              {lg.active ? (
                <button
                  type="button"
                  disabled={isGuestWaiting}
                  onClick={() => onSelectLeague(lg.id)}
                  className="w-full rounded-xl border border-[var(--pri-bright)] bg-[var(--pri)] px-4 py-2.5 text-xs font-bold text-white shadow-[0_6px_18px_-6px_rgba(34,197,94,0.65)] transition hover:bg-[#15803d] disabled:opacity-50"
                >
                  {isGuestWaiting
                    ? 'Oda Kurucusu Ligi Başlatıyor...'
                    : `${lg.name}'i Başlat →`}
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--raised)] px-4 py-2 text-xs font-semibold text-[var(--muted)]"
                >
                  Yakında Eklenecek
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
