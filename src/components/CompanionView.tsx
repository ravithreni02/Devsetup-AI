import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, Link2, RefreshCw, Unlink, Upload } from 'lucide-react';
import { LocalEnvironmentScan } from '../types/devsetup';

interface CompanionViewProps {
  localScan: LocalEnvironmentScan | null;
  onScanLoaded: (scan: LocalEnvironmentScan) => void;
}

interface NonilionStatus {
  connected: boolean;
  botName: string;
  room: string | null;
  lastPollAt: string | null;
  messagesHandled: number;
  lastError: string | null;
}

export const CompanionView: React.FC<CompanionViewProps> = ({
  localScan,
  onScanLoaded,
}) => {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState('');
  const [pairing, setPairing] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [nonilionStatus, setNonilionStatus] = useState<NonilionStatus | null>(null);

  const fetchNonilionStatus = async () => {
    try {
      const res = await fetch('/api/nonilion/status');
      if (res.ok) {
        setNonilionStatus(await res.json());
      }
    } catch {
      // ignore status check error
    }
  };

  useEffect(() => {
    fetchNonilionStatus();
    const timer = setInterval(fetchNonilionStatus, 5000);
    return () => clearInterval(timer);
  }, []);

  const handlePairNonilion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairCode.trim()) return;
    setPairing(true);
    setPairError(null);
    try {
      const res = await fetch('/api/nonilion/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Pairing failed.');
      }
      setPairCode('');
      await fetchNonilionStatus();
    } catch (err) {
      setPairError(err instanceof Error ? err.message : 'Pairing failed.');
    } finally {
      setPairing(false);
    }
  };

  const handleDisconnectNonilion = async () => {
    await fetch('/api/nonilion/disconnect', { method: 'POST' });
    await fetchNonilionStatus();
  };

  const handleConnectLive = async () => {
    setConnecting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('http://127.0.0.1:4789/scan');
      if (!res.ok) throw new Error('Companion returned an error.');
      const data = (await res.json()) as LocalEnvironmentScan;
      onScanLoaded(data);
      setSuccessMsg(`Connected to ${data.hostname} (${data.os})`);
    } catch {
      setError(
        'Could not reach http://127.0.0.1:4789/scan. Make sure devsetup-companion.ps1 is running on your computer, or upload devsetup-scan.json below.'
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result)) as LocalEnvironmentScan;
        if (!parsed.os || !Array.isArray(parsed.tools)) {
          throw new Error('Invalid scan file format.');
        }
        onScanLoaded(parsed);
        setSuccessMsg(`Imported scan from ${parsed.hostname || 'local machine'}`);
      } catch {
        setError('Invalid devsetup-scan.json file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Local Companion Agent
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          A cloud AI cannot inspect your laptop directly. Run our lightweight Windows PowerShell companion script locally to scan your real compilers, runtimes, IDEs, and PATH.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Step 1: Download & Run Companion (Windows 10/11)
            </h2>
            <p className="text-xs text-slate-600">
              Inspects Python, Node.js, Git, GCC/G++, Java/javac, VS Code, Docker, MySQL, and PATH without modifying anything.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/companion/script?format=raw');
                  const text = await res.text();
                  if (text.trim().startsWith('<')) {
                    throw new Error('Received HTML instead of script');
                  }
                  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'devsetup-companion.ps1';
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch {
                  setError('Failed to download script. Please redeploy or run from the dev URL.');
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download devsetup-companion.ps1
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await fetch('/api/companion/script?format=raw');
                const text = await res.text();
                navigator.clipboard.writeText(text);
                setSuccessMsg('Copied PowerShell script to clipboard! Paste into Notepad and save as devsetup-companion.ps1');
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Script
            </button>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs space-y-1">
            <div className="font-medium text-slate-700">Run in PowerShell:</div>
            <code className="block font-mono text-slate-900">
              powershell -ExecutionPolicy Bypass -File .\devsetup-companion.ps1
            </code>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Step 2: Connect or Import Scan
            </h2>
            <p className="text-xs text-slate-600">
              Fetch live results from the running companion or upload the generated <code className="font-mono">devsetup-scan.json</code> file.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleConnectLive}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connecting ? 'animate-spin' : ''}`} />
              {connecting ? 'Connecting...' : 'Connect to Localhost:4789'}
            </button>

            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              Upload devsetup-scan.json
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {localScan && (
            <div className="text-xs text-slate-500 tabular-nums">
              Last scanned: {new Date(localScan.scannedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Direct Nonilion.com Pairing Bridge */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Nonilion.com Direct Bridge (Pairing Code)
            </h2>
            <p className="text-xs text-slate-600">
              Connect this AI Studio app directly to your Nonilion virtual office without Render or public webhooks. Click <strong>Use a pairing code instead</strong> in Nonilion and paste the 6-character code here.
            </p>
          </div>
          {nonilionStatus?.connected && (
            <button
              type="button"
              onClick={handleDisconnectNonilion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shrink-0"
            >
              <Unlink className="w-3.5 h-3.5" />
              Disconnect
            </button>
          )}
        </div>

        {nonilionStatus?.connected ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs text-emerald-900">
            <div className="flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Connected to Nonilion as {nonilionStatus.botName}
                {nonilionStatus.room ? ` (${nonilionStatus.room})` : ''}
              </span>
            </div>
            <div className="tabular-nums text-emerald-800">
              {nonilionStatus.messagesHandled} messages answered
              {nonilionStatus.lastPollAt
                ? ` · Last checked ${new Date(nonilionStatus.lastPollAt).toLocaleTimeString()}`
                : ''}
            </div>
          </div>
        ) : (
          <form onSubmit={handlePairNonilion} className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={pairCode}
              onChange={(e) => setPairCode(e.target.value)}
              placeholder="Enter pairing code (e.g. A45-EHM)"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono uppercase text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none w-56"
            />
            <button
              type="submit"
              disabled={pairing || !pairCode.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" />
              {pairing ? 'Pairing...' : 'Pair with Nonilion'}
            </button>
          </form>
        )}

        {pairError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            {pairError}
          </div>
        )}

        {nonilionStatus?.lastError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Poller notice: {nonilionStatus.lastError}
          </div>
        )}
      </div>
    </div>
  );
};
