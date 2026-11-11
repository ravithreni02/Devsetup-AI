import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2, Wrench } from 'lucide-react';
import { LocalEnvironmentScan, TroubleshootResult } from '../types/devsetup';

interface TroubleshooterViewProps {
  localScan: LocalEnvironmentScan | null;
}

const SAMPLE_ERRORS = [
  {
    label: "'g++' is not recognized",
    error: "g++ : The term 'g++' is not recognized as the name of a cmdlet, function, script file, or operable program.",
    context: 'Trying to compile main.cpp in VS Code terminal on Windows 11',
  },
  {
    label: 'ModuleNotFoundError (Python)',
    error: "Traceback (most recent call last):\n  File \"train.py\", line 2, in <module>\n    import pandas as pd\nModuleNotFoundError: No module named 'pandas'",
    context: 'Running a machine learning script in Python',
  },
  {
    label: "'javac' is not recognized",
    error: "'javac' is not recognized as an internal or external command, operable program or batch file.",
    context: 'Preparing for Java practical',
  },
];

export const TroubleshooterView: React.FC<TroubleshooterViewProps> = ({ localScan }) => {
  const [errorOutput, setErrorOutput] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TroubleshootResult | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!errorOutput.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/agent/troubleshoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          errorOutput: errorOutput.trim(),
          context: context.trim() || undefined,
          localScan: localScan || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Troubleshooting failed.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze error.');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 1500);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Intelligent Troubleshooter
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Paste your actual terminal, compiler, or IDE error output. DevSetup AI classifies the issue, explains the cause in plain English, and recommends a verified fix.
        </p>
      </div>

      <form
        onSubmit={handleAnalyze}
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div>
          <label htmlFor="error-output" className="block text-sm font-semibold text-slate-900 mb-2">
            Terminal or Compiler Error Output
          </label>
          <textarea
            id="error-output"
            rows={5}
            value={errorOutput}
            onChange={(e) => setErrorOutput(e.target.value)}
            placeholder="Paste the exact error message from your terminal or VS Code..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Common issues:</span>
          {SAMPLE_ERRORS.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => {
                setErrorOutput(sample.error);
                setContext(sample.context);
              }}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {sample.label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="error-context" className="block text-xs font-semibold text-slate-700 mb-1.5">
            What were you trying to do? (optional)
          </label>
          <input
            id="error-context"
            type="text"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g., Compiling a C++ file in VS Code, running pip install..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={loading || !errorOutput.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Diagnosing Error...
              </>
            ) : (
              <>
                <Wrench className="w-4 h-4" />
                Diagnose & Recommend Fix
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
                <AlertTriangle className="w-4 h-4" />
                <span>{result.classification}</span>
              </div>
              <h2 className="mt-1 text-lg font-bold text-slate-900">Root Cause & Fix</h2>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold text-slate-500">Why this happened</h3>
              <p className="text-sm text-slate-800 leading-relaxed">{result.plainEnglishCause}</p>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold text-slate-500">Recommended Fix</h3>
              <p className="text-sm text-slate-800 leading-relaxed">{result.recommendedFix}</p>
            </div>
          </div>

          {result.proposedCommands && result.proposedCommands.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                Proposed Fix Commands (Review before running)
              </h3>
              <div className="space-y-2">
                {result.proposedCommands.map((cmd, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-700">{cmd.label}</div>
                      <code className="mt-1 block text-xs font-mono text-slate-900">
                        {cmd.command}
                      </code>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(cmd.command)}
                      className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 shrink-0"
                    >
                      {copiedCmd === cmd.command ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs">
            <div>
              <span className="font-semibold text-emerald-900">Verify resolution: </span>
              <code className="font-mono text-emerald-800">{result.verifyCommand}</code>
            </div>
            <span className="text-emerald-800">{result.preventionTip}</span>
          </div>
        </div>
      )}
    </div>
  );
};
