import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  FolderPlus,
  Loader2,
  Play,
  ShieldCheck,
  Terminal,
  Upload,
} from 'lucide-react';
import {
  LocalEnvironmentScan,
  SavedProject,
  SetupAnalysisResult,
  SetupReport,
} from '../types/devsetup';

interface SetupAgentViewProps {
  localScan: LocalEnvironmentScan | null;
  onSaveProject: (project: SavedProject) => void;
  onSaveReport: (report: SetupReport) => void;
  onNavigateCompanion: () => void;
}

const EXAMPLE_PROMPTS = [
  'I need to set up VS Code for C++ programming on Windows.',
  'I have a Java practical tomorrow. Prepare my laptop for Java programming.',
  'I need React and Node.js for my web development project.',
  'Help me set up a Python environment for machine learning.',
  'I have to use MySQL for my DBMS assignment. Help me configure it.',
];

export const SetupAgentView: React.FC<SetupAgentViewProps> = ({
  localScan,
  onSaveProject,
  onSaveReport,
  onNavigateCompanion,
}) => {
  const [prompt, setPrompt] = useState('');
  const [assignmentText, setAssignmentText] = useState('');
  const [showAssignmentInput, setShowAssignmentInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SetupAnalysisResult | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [runningStep, setRunningStep] = useState<number | null>(null);
  const [stepOutputs, setStepOutputs] = useState<Record<number, { success: boolean; output: string }>>({});

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        setAssignmentText(content.slice(0, 12000));
        setShowAssignmentInput(true);
      }
    };
    reader.readAsText(file);
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          assignmentText: assignmentText.trim() || undefined,
          localScan: localScan || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze requirements.');
      }
      setResult(data);

      const installedCount = (data.requirements || []).filter(
        (r: { envStatus: string }) => r.envStatus === 'installed'
      ).length;
      const missingCount = (data.requirements || []).filter(
        (r: { envStatus: string }) => r.envStatus === 'missing'
      ).length;

      onSaveReport({
        id: `rep-${Date.now()}`,
        projectTitle: data.projectTitle || 'Setup Plan',
        createdAt: new Date().toISOString(),
        installedCount,
        missingCount,
        summary: data.summary || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 1500);
  };

  const toggleStepApproval = (stepNumber: number) => {
    if (!result) return;
    setResult({
      ...result,
      setupPlan: result.setupPlan.map((s) =>
        s.stepNumber === stepNumber ? { ...s, approved: !s.approved } : s
      ),
    });
  };

  const toggleStepCompleted = (stepNumber: number) => {
    if (!result) return;
    setResult({
      ...result,
      setupPlan: result.setupPlan.map((s) =>
        s.stepNumber === stepNumber ? { ...s, completed: !s.completed } : s
      ),
    });
  };

  const executeStepOnCompanion = async (stepNumber: number, command: string) => {
    setRunningStep(stepNumber);
    try {
      const res = await fetch('http://127.0.0.1:4789/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await res.json();
      setStepOutputs((prev) => ({
        ...prev,
        [stepNumber]: { success: Boolean(data.success), output: data.output || 'Done.' },
      }));
      if (data.success && result) {
        setResult({
          ...result,
          setupPlan: result.setupPlan.map((s) =>
            s.stepNumber === stepNumber ? { ...s, approved: true, completed: true } : s
          ),
        });
      }
    } catch {
      setStepOutputs((prev) => ({
        ...prev,
        [stepNumber]: {
          success: false,
          output: 'Could not reach Local Companion at http://127.0.0.1:4789. Start devsetup-companion.ps1 first.',
        },
      }));
    } finally {
      setRunningStep(null);
    }
  };

  const handleSaveAsProject = () => {
    if (!result) return;
    onSaveProject({
      id: `proj-${Date.now()}`,
      name: result.projectTitle,
      description: result.summary,
      createdAt: new Date().toISOString(),
      tools: result.requirements.map((r) => r.name),
      status: result.setupPlan.every((s) => s.completed) ? 'ready' : 'needs_setup',
    });
    setSavedSuccess(true);
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'installed':
        return { text: 'Installed', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'missing':
        return { text: 'Missing', cls: 'text-red-700 bg-red-50 border-red-200' };
      case 'version_mismatch':
        return { text: 'Version Mismatch', cls: 'text-amber-700 bg-amber-50 border-amber-200' };
      case 'needs_config':
        return { text: 'Needs Config', cls: 'text-amber-700 bg-amber-50 border-amber-200' };
      default:
        return { text: 'Not Scanned', cls: 'text-slate-600 bg-slate-50 border-slate-200' };
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Software Setup Agent
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Describe what you want to learn, build, or run. DevSetup AI extracts exact software requirements, compares them against your local machine, and builds a verified setup plan.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {localScan ? (
            <span className="text-xs font-medium text-emerald-700">
              Local Scan Connected · {localScan.os}
            </span>
          ) : (
            <button
              type="button"
              onClick={onNavigateCompanion}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 underline underline-offset-2 whitespace-nowrap"
            >
              Connect Local Companion for real scan
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={handleAnalyze}
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
      >
        <div>
          <label htmlFor="setup-prompt" className="block text-sm font-semibold text-slate-900 mb-2">
            What do you want to set up?
          </label>
          <textarea
            id="setup-prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., I need to set up VS Code for C++ programming, or I have a DBMS assignment using MySQL..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Examples:</span>
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 transition-colors text-left"
            >
              {ex}
            </button>
          ))}
        </div>

        {showAssignmentInput && (
          <div className="pt-2 border-t border-slate-100">
            <label htmlFor="assignment-text" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Assignment / Syllabus / Project Brief (optional)
            </label>
            <textarea
              id="assignment-text"
              rows={4}
              value={assignmentText}
              onChange={(e) => setAssignmentText(e.target.value)}
              placeholder="Paste assignment instructions or requirements..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-800 focus:border-blue-600 focus:outline-none"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAssignmentInput(!showAssignmentInput)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" />
              {showAssignmentInput ? 'Hide assignment text' : 'Paste assignment text'}
            </button>
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap">
              <Upload className="w-3.5 h-3.5" />
              Upload .txt / .md
              <input
                type="file"
                accept=".txt,.md,.json,.csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Requirements...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Generate Setup Plan
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
        <div className="space-y-8">
          {/* Summary Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-6">
            <div className="space-y-1 max-w-2xl">
              <h2 className="text-xl font-bold text-slate-900">{result.projectTitle}</h2>
              <p className="text-sm text-slate-600">{result.summary}</p>
            </div>
            <button
              type="button"
              onClick={handleSaveAsProject}
              disabled={savedSuccess}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:bg-emerald-50 disabled:text-emerald-700 disabled:border-emerald-200 whitespace-nowrap shrink-0"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Saved to My Environment
                </>
              ) : (
                <>
                  <FolderPlus className="w-3.5 h-3.5" />
                  Save Project
                </>
              )}
            </button>
          </div>

          {/* Clarifying Questions */}
          {result.clarifyingQuestions && result.clarifyingQuestions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700">
                Clarifying Questions to Consider
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                {result.clarifyingQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Requirements Comparison Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                01. Required Software & Environment Comparison
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">
                {result.requirements.length} components identified
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Software</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Required Version</th>
                    <th className="px-4 py-3">Local Status</th>
                    <th className="px-4 py-3">Install / Verify Command</th>
                    <th className="px-4 py-3 text-right">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.requirements.map((req, idx) => {
                    const badge = statusLabel(req.envStatus);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{req.name}</div>
                          <div className="text-xs text-slate-500">{req.purpose}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                          {req.mandatory ? 'Mandatory' : 'Optional'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                          {req.requiredVersion}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${badge.cls}`}
                          >
                            {badge.text}
                          </span>
                          {req.detectedVersion && (
                            <div className="mt-1 font-mono text-[11px] text-slate-500">
                              {req.detectedVersion}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-800 max-w-[260px] truncate">
                              {req.installCommand}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyText(req.installCommand)}
                              className="p-1 text-slate-400 hover:text-slate-700"
                              title="Copy install command"
                            >
                              {copiedCmd === req.installCommand ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <a
                            href={req.officialUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            Official
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Setup Plan with Permission & Verification */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">
                02. Actionable Setup Plan
              </h3>
              <span className="text-xs text-slate-500">
                Review and approve each system change before running
              </span>
            </div>

            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {result.setupPlan.map((step) => (
                <div key={step.stepNumber} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">
                        Step {String(step.stepNumber).padStart(2, '0')}
                      </span>
                      <h4 className="text-sm font-semibold text-slate-900">{step.title}</h4>
                      {step.requiresApproval && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Requires approval
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600">{step.description}</p>
                    {step.command && (
                      <div className="flex items-center gap-2 pt-1">
                        <code className="rounded bg-slate-900 px-3 py-1.5 text-xs font-mono text-slate-100">
                          {step.command}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyText(step.command!)}
                          className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          {copiedCmd === step.command ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    )}
                    {step.verifyCommand && (
                      <div className="text-xs text-slate-500">
                        Verify with: <code className="font-mono text-slate-700">{step.verifyCommand}</code>
                      </div>
                    )}
                    {stepOutputs[step.stepNumber] && (
                      <pre
                        className={`mt-2 rounded-lg border p-2.5 text-xs font-mono overflow-x-auto ${
                          stepOutputs[step.stepNumber].success
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-red-200 bg-red-50 text-red-900'
                        }`}
                      >
                        {stepOutputs[step.stepNumber].output}
                      </pre>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {step.command && (
                      <button
                        type="button"
                        disabled={runningStep === step.stepNumber}
                        onClick={() => executeStepOnCompanion(step.stepNumber, step.command!)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {runningStep === step.stepNumber ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            Run on My PC
                          </>
                        )}
                      </button>
                    )}
                    {step.requiresApproval && (
                      <button
                        type="button"
                        onClick={() => toggleStepApproval(step.stepNumber)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                          step.approved
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {step.approved ? 'Approved' : 'Approve'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleStepCompleted(step.stepNumber)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                        step.completed
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {step.completed ? 'Verified' : 'Mark Done'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sample Test Program */}
          {result.sampleProject && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-slate-900">
                03. Verification Test Program
              </h3>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-700">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span>{result.sampleProject.filename}</span>
                    <span className="text-slate-400">·</span>
                    <span>{result.sampleProject.language}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(result.sampleProject.code)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    {copiedCmd === result.sampleProject.code ? 'Copied' : 'Copy Code'}
                  </button>
                </div>
                <pre className="p-4 text-xs font-mono text-slate-800 bg-white overflow-x-auto">
                  <code>{result.sampleProject.code}</code>
                </pre>
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs">
                  <div>
                    <span className="text-slate-500">Run: </span>
                    <code className="font-mono font-medium text-slate-900">
                      {result.sampleProject.runCommand}
                    </code>
                  </div>
                  <div>
                    <span className="text-slate-500">Expected output: </span>
                    <code className="font-mono text-emerald-700">
                      {result.sampleProject.expectedOutput}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
