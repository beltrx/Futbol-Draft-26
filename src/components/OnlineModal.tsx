import React, { useState } from 'react';
import { copyToClipboardSafe, getRoomInviteUrl } from '../services/onlineNet';
import type { NetStateSnapshot } from '../types/game';

interface OnlineModalProps {
  open: boolean;
  net: NetStateSnapshot;
  teamName: string;
  onlineMsg: string;
  onTeamNameChange: (name: string) => void;
  onClose: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onDisconnect: () => void;
  onCopyFeedback: (msg: string) => void;
}

export const OnlineModal: React.FC<OnlineModalProps> = ({
  open,
  net,
  teamName,
  onlineMsg,
  onTeamNameChange,
  onClose,
  onCreateRoom,
  onJoinRoom,
  onDisconnect,
  onCopyFeedback,
}) => {
  const [joinCodeInput, setJoinCodeInput] = useState('');

  if (!open) return null;

  const inviteUrl = net.roomCode ? getRoomInviteUrl(net.roomCode) : '';

  const handleCopyCode = async () => {
    if (!net.roomCode) return;
    await copyToClipboardSafe(net.roomCode);
    onCopyFeedback(`Oda Kodu (${net.roomCode}) kopyalandı!`);
  };

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    await copyToClipboardSafe(inviteUrl);
    onCopyFeedback('Davet linki panoya kopyalandı! Arkadaşına gönder.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="online-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
          <div>
            <h2 id="online-modal-title" className="text-lg font-extrabold text-[var(--fg)]">
              Arkadaşınla Online 2 Kişilik Draft &amp; Maç
            </h2>
            <p className="text-xs text-[var(--muted)]">
              MQTT Bulut Rölesi + WebRTC P2P ile farklı ağlardaki cihazlarda eş zamanlı oynayın.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Online oda penceresini kapat"
            className="rounded-lg border border-[var(--border)] bg-[var(--raised)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--accent)]"
          >
            Kapat ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
          <label htmlFor="online-team-name" className="text-xs font-semibold text-[var(--muted)]">
            Online Takım Adın:
          </label>
          <input
            id="online-team-name"
            type="text"
            value={teamName}
            onChange={(e) => onTeamNameChange(e.target.value)}
            placeholder="Takım Adın"
            className="w-52 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--fg)] focus:border-[var(--pri-bright)] focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-1 text-sm font-bold text-[var(--fg)]">1. Oda Kur (Host)</h3>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Kısa 5 haneli Oda Kodu oluştur ve linki arkadaşına gönder.
            </p>
            <button
              type="button"
              onClick={onCreateRoom}
              className="rounded-lg border border-[var(--pri-bright)] bg-[var(--pri)] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#15803d]"
            >
              Yeni Online Oda Kur
            </button>

            {net.role === 'host' && net.roomCode && (
              <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-[var(--muted)]">Oda Kodu:</span>
                  <strong className="font-mono-tab text-base text-[var(--pri-bright)]">
                    {net.roomCode}
                  </strong>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="rounded border border-[var(--border)] bg-[var(--raised)] px-2.5 py-1 text-xs font-semibold hover:bg-[var(--accent)]"
                  >
                    Kodu Kopyala
                  </button>
                </div>

                {inviteUrl && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="invite-url-readonly" className="text-[11px] text-[var(--muted)]">
                      Arkadaşına göndereceğin Davet Linki:
                    </label>
                    <input
                      id="invite-url-readonly"
                      type="text"
                      readOnly
                      value={inviteUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[11px] text-[var(--fg)]"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="self-start rounded border border-[var(--pri-bright)] bg-[var(--pri)] px-3 py-1 text-xs font-semibold text-white hover:bg-[#15803d]"
                    >
                      Davet Linkini Kopyala
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <h3 className="mb-1 text-sm font-bold text-[var(--fg)]">2. Odaya Katıl (Misafir)</h3>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Arkadaşının paylaştığı 5 haneli Oda Kodunu buraya gir:
            </p>
            <div className="flex flex-wrap gap-2">
              <label htmlFor="friend-code-inp" className="sr-only">
                5 haneli Oda Kodu
              </label>
              <input
                id="friend-code-inp"
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onJoinRoom(joinCodeInput);
                }}
                placeholder="Örn: 48291"
                className="w-36 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 font-mono text-sm text-[var(--fg)] focus:border-[var(--pri-bright)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onJoinRoom(joinCodeInput)}
                className="rounded-lg border border-amber-400/60 bg-amber-900/70 px-3.5 py-1.5 text-xs font-bold text-amber-100 hover:bg-amber-800/80"
              >
                Odaya Bağlan
              </button>
            </div>
          </div>
        </div>

        {onlineMsg && (
          <div className="mt-3 rounded-lg border border-emerald-500/35 bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-200">
            {onlineMsg}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                net.connected ? 'bg-[var(--pri-bright)]' : 'bg-[var(--warn)]'
              }`}
            />
            <span>
              Durum: <strong className="text-[var(--fg)]">{net.statusText}</strong>
            </span>
          </div>
          {net.role && (
            <button
              type="button"
              onClick={onDisconnect}
              className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-900/50"
            >
              Bağlantıyı Kes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
