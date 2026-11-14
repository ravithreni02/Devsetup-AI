import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { SOFTWARE_KNOWLEDGE_BASE } from './src/data/knowledgeBase.ts';

dotenv.config();

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function generateWithFallback(params: Omit<Parameters<typeof ai.models.generateContent>[0], 'model'>) {
  const models = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let lastError: unknown;
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (err) {
      lastError = err;
      const errText = `${err instanceof Error ? err.message : ''} ${JSON.stringify(err)}`;
      if (!errText.includes('503') && !errText.includes('UNAVAILABLE')) {
        throw err;
      }
      if (i < models.length - 1) {
        await new Promise((r) => setTimeout(r, 800 * (i + 1)));
      }
    }
  }
  throw lastError;
}

const WINDOWS_COMPANION_PS1 = `# DevSetup AI - Local Companion Agent (Windows 10/11)
# Scans your actual local development environment and serves it on http://127.0.0.1:4789/scan
# Also outputs devsetup-scan.json in the current directory.

$ErrorActionPreference = "SilentlyContinue"

function Get-CmdVersion($cmd, $argsList) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if (-not $found) {
        return @{ installed = $false; version = $null; path = $null }
    }
    try {
        $out = & $cmd $argsList 2>&1 | Select-Object -First 1
        return @{ installed = $true; version = "$out".Trim(); path = $found.Source }
    } catch {
        return @{ installed = $true; version = "Detected (version unknown)"; path = $found.Source }
    }
}

Write-Host "Scanning local development environment..." -ForegroundColor Cyan

$os = Get-CimInstance Win32_OperatingSystem
$python = Get-CmdVersion "python" "--version"
$node = Get-CmdVersion "node" "-v"
$npm = Get-CmdVersion "npm" "-v"
$git = Get-CmdVersion "git" "--version"
$gcc = Get-CmdVersion "gcc" "--version"
$gpp = Get-CmdVersion "g++" "--version"
$java = Get-CmdVersion "java" "-version"
$javac = Get-CmdVersion "javac" "-version"
$code = Get-CmdVersion "code" "--version"
$winget = Get-CmdVersion "winget" "--version"
$pip = Get-CmdVersion "pip" "--version"
$docker = Get-CmdVersion "docker" "--version"
$mysql = Get-CmdVersion "mysql" "--version"

$vscodeExt = @()
if ($code.installed) {
    $vscodeExt = & code --list-extensions 2>$null
}

$tools = @(
    @{ name = "Python"; installed = $python.installed; version = $python.version; path = $python.path; source = "companion"; status = $(if ($python.installed) { "ok" } else { "missing" }) },
    @{ name = "Node.js"; installed = $node.installed; version = $node.version; path = $node.path; source = "companion"; status = $(if ($node.installed) { "ok" } else { "missing" }) },
    @{ name = "Git"; installed = $git.installed; version = $git.version; path = $git.path; source = "companion"; status = $(if ($git.installed) { "ok" } else { "missing" }) },
    @{ name = "GCC"; installed = $gcc.installed; version = $gcc.version; path = $gcc.path; source = "companion"; status = $(if ($gcc.installed) { "ok" } else { "missing" }) },
    @{ name = "G++"; installed = $gpp.installed; version = $gpp.version; path = $gpp.path; source = "companion"; status = $(if ($gpp.installed) { "ok" } else { "missing" }) },
    @{ name = "Java Runtime"; installed = $java.installed; version = $java.version; path = $java.path; source = "companion"; status = $(if ($java.installed) { "ok" } else { "missing" }) },
    @{ name = "Java Compiler (javac)"; installed = $javac.installed; version = $javac.version; path = $javac.path; source = "companion"; status = $(if ($javac.installed) { "ok" } else { "missing" }) },
    @{ name = "VS Code"; installed = $code.installed; version = $code.version; path = $code.path; source = "companion"; status = $(if ($code.installed) { "ok" } else { "missing" }) },
    @{ name = "Docker"; installed = $docker.installed; version = $docker.version; path = $docker.path; source = "companion"; status = $(if ($docker.installed) { "ok" } else { "missing" }) },
    @{ name = "MySQL"; installed = $mysql.installed; version = $mysql.version; path = $mysql.path; source = "companion"; status = $(if ($mysql.installed) { "ok" } else { "missing" }) }
)

$scanResult = @{
    scannedAt = (Get-Date).ToString("o")
    os = $os.Caption
    osVersion = $os.Version
    architecture = $env:PROCESSOR_ARCHITECTURE
    hostname = $env:COMPUTERNAME
    shell = "PowerShell $($PSVersionTable.PSVersion)"
    packageManagers = @{
        winget = $winget.version
        pip = $pip.version
        npm = $npm.version
        conda = $null
        choco = $null
    }
    tools = $tools
    pathEntries = ($env:PATH -split ";" | Where-Object { $_ -ne "" })
    vscodeExtensions = @($vscodeExt)
    envVars = @{
        JAVA_HOME = $env:JAVA_HOME
        PYTHONPATH = $env:PYTHONPATH
        NODE_ENV = $env:NODE_ENV
    }
}

$json = $scanResult | ConvertTo-Json -Depth 6
$json | Out-File -FilePath "devsetup-scan.json" -Encoding utf8
Write-Host "Saved scan to devsetup-scan.json" -ForegroundColor Green

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:4789/")
$listener.Start()
Write-Host "DevSetup Companion listening on http://127.0.0.1:4789 (Press Ctrl+C to stop)" -ForegroundColor Yellow

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
    $response.Headers.Add("Content-Type", "application/json")
    if ($request.HttpMethod -eq "OPTIONS") {
        $response.StatusCode = 204
        $response.Close()
        continue
    }
    if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/execute") {
        $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
        $body = $reader.ReadToEnd() | ConvertFrom-Json
        $cmd = "$($body.command)"
        $blocked = '(?i)(rm\s+-rf|del\s+/[sq]|format\s+[a-z]:|diskpart|reg\s+delete|shutdown|restart-computer|remove-item.*-recurse|iex\s*\(|invoke-expression|\|\s*iex|mkfs|dd\s+if=)'
        if ($cmd -match $blocked) {
            $resObj = @{ success = $false; output = "Blocked potentially harmful command by DevSetup AI Safety Guardrail."; exitCode = 403 } | ConvertTo-Json
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($resObj)
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }
        $env:PATH | Out-File -FilePath "devsetup-path-backup.txt" -Encoding utf8
        Write-Host "Executing approved command: $cmd" -ForegroundColor Cyan
        try {
            $out = Invoke-Expression $cmd 2>&1 | Out-String
            $resObj = @{ success = $true; output = $out.Trim(); exitCode = 0 } | ConvertTo-Json
        } catch {
            $resObj = @{ success = $false; output = $_.Exception.Message; exitCode = 1 } | ConvertTo-Json
        }
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($resObj)
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
        $response.Close()
        continue
    }
    $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
    $response.ContentLength64 = $buffer.Length
    $response.OutputStream.Write($buffer, 0, $buffer.Length)
    $response.Close()
}
`;

app.get('/api/knowledge-base', (_req, res) => {
  res.json(SOFTWARE_KNOWLEDGE_BASE);
});

app.get('/api/companion/script', (req, res) => {
  const format = req.query.format === 'raw' ? 'raw' : 'download';
  if (format === 'raw') {
    res.type('text/plain').send(WINDOWS_COMPANION_PS1);
    return;
  }
  res.setHeader('Content-Disposition', 'attachment; filename="devsetup-companion.ps1"');
  res.type('text/plain').send(WINDOWS_COMPANION_PS1);
});

app.post('/api/agent/analyze', async (req, res) => {
  try {
    const { prompt, assignmentText, localScan } = req.body as {
      prompt: string;
      assignmentText?: string;
      localScan?: unknown;
    };

    if (!prompt || !prompt.trim()) {
      res.status(400).json({ error: 'Please describe what you want to set up or build.' });
      return;
    }

    const kbSummary = SOFTWARE_KNOWLEDGE_BASE.map(
      (item) =>
        `${item.name} (${item.category}): v${item.recommendedVersion}, official=${item.officialUrl}, install="${item.installCommand}", verify="${item.verifyCommand}"`
    ).join('\n');

    const systemInstruction = `You are DevSetup AI, a universal student software setup and environment engineering agent.
Your job:
1. Understand the student's natural-language request and any uploaded assignment/project text.
2. Identify ONLY the software, languages, compilers, IDEs, databases, and packages actually needed (distinguish mandatory vs optional). If an equivalent tool is ALREADY installed in the local scan (e.g., VS Code is already installed when no specific IDE was named, or conda/pip already satisfies Python), DO NOT recommend downloading a redundant competing tool.
3. Compare against the student's actual local environment scan if provided. If no local scan is provided, set envStatus to "not_scanned" — NEVER invent or fake installed software.
4. Use official software sources and verified commands (winget, pip, npm, or official GUI installers). Never invent download URLs or destructive/unverified shell scripts.
5. Generate a clear, ordered setup plan where system-modifying actions have requiresApproval=true and each step's description explicitly states its system impact (what is installed, modified in PATH, or written to disk).
6. Provide a small, realistic sample test program and verification command to confirm the environment works.

Reference Knowledge Base:
${kbSummary}`;

    const userContent = [
      `Student Request: ${prompt}`,
      assignmentText ? `Uploaded Assignment / Project Document:\n${assignmentText}` : '',
      localScan ? `Actual Local Environment Scan:\n${JSON.stringify(localScan)}` : 'Local Environment Scan: Not yet connected.',
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await generateWithFallback({
      contents: userContent,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectTitle: { type: Type.STRING },
            summary: { type: Type.STRING },
            clarifyingQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            requirements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  requiredVersion: { type: Type.STRING },
                  mandatory: { type: Type.BOOLEAN },
                  purpose: { type: Type.STRING },
                  officialUrl: { type: Type.STRING },
                  installMethod: { type: Type.STRING },
                  installCommand: { type: Type.STRING },
                  verifyCommand: { type: Type.STRING },
                  requiresAdminOrGui: { type: Type.BOOLEAN },
                  envStatus: { type: Type.STRING },
                  detectedVersion: { type: Type.STRING },
                  configSteps: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  'name',
                  'category',
                  'requiredVersion',
                  'mandatory',
                  'purpose',
                  'officialUrl',
                  'installMethod',
                  'installCommand',
                  'verifyCommand',
                  'requiresAdminOrGui',
                  'envStatus',
                ],
              },
            },
            setupPlan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  command: { type: Type.STRING },
                  requiresApproval: { type: Type.BOOLEAN },
                  verifyCommand: { type: Type.STRING },
                },
                required: ['stepNumber', 'title', 'description', 'requiresApproval'],
              },
            },
            sampleProject: {
              type: Type.OBJECT,
              properties: {
                filename: { type: Type.STRING },
                language: { type: Type.STRING },
                code: { type: Type.STRING },
                runCommand: { type: Type.STRING },
                expectedOutput: { type: Type.STRING },
              },
              required: ['filename', 'language', 'code', 'runCommand', 'expectedOutput'],
            },
            nextSteps: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ['projectTitle', 'summary', 'requirements', 'setupPlan', 'sampleProject', 'nextSteps'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    if (Array.isArray(parsed.setupPlan)) {
      parsed.setupPlan = parsed.setupPlan.map((step: Record<string, unknown>) => ({
        ...step,
        approved: false,
        completed: false,
      }));
    }
    res.json(parsed);
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to analyze setup requirements.',
    });
  }
});

app.post('/api/agent/troubleshoot', async (req, res) => {
  try {
    const { errorOutput, context, localScan } = req.body as {
      errorOutput: string;
      context?: string;
      localScan?: unknown;
    };

    if (!errorOutput || !errorOutput.trim()) {
      res.status(400).json({ error: 'Please paste the terminal or compiler error output.' });
      return;
    }

    const systemInstruction = `You are DevSetup AI's Intelligent Troubleshooting Engine.
Analyze the student's actual terminal/IDE error output, classify it, explain the root cause in beginner-friendly language, recommend a safe fix, list exact commands that require user approval, and provide a verification command to confirm the fix worked.`;

    const userContent = [
      `Error Output:\n${errorOutput}`,
      context ? `What the student was trying to do: ${context}` : '',
      localScan ? `Local Environment Scan:\n${JSON.stringify(localScan)}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await generateWithFallback({
      contents: userContent,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: { type: Type.STRING },
            severity: { type: Type.STRING },
            plainEnglishCause: { type: Type.STRING },
            recommendedFix: { type: Type.STRING },
            proposedCommands: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  command: { type: Type.STRING },
                  requiresApproval: { type: Type.BOOLEAN },
                },
                required: ['label', 'command', 'requiresApproval'],
              },
            },
            verifyCommand: { type: Type.STRING },
            preventionTip: { type: Type.STRING },
          },
          required: [
            'classification',
            'severity',
            'plainEnglishCause',
            'recommendedFix',
            'proposedCommands',
            'verifyCommand',
            'preventionTip',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err) {
    console.error('Troubleshoot error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to analyze error output.',
    });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'devsetup-ai', timestamp: new Date().toISOString() });
});

app.get('/api/nonilion/webhook', (_req, res) => {
  res.json({
    ok: true,
    status: 'ready',
    agent: 'DevSetup AI',
    message: 'DevSetup AI Nonilion webhook is online.',
  });
});

app.get('/webhook', (_req, res) => {
  res.json({ ok: true, status: 'ready', agent: 'DevSetup AI' });
});

function buildKbFallbackReply(userMessage: string): string {
  const lower = userMessage.toLowerCase();
  const matches = SOFTWARE_KNOWLEDGE_BASE.filter(
    (item) =>
      lower.includes(item.id.toLowerCase()) ||
      lower.includes(item.name.toLowerCase()) ||
      item.name
        .toLowerCase()
        .split(/[\s/+()-]+/)
        .some((word) => word.length > 2 && lower.includes(word))
  );

  const selected = matches.length > 0 ? matches.slice(0, 4) : SOFTWARE_KNOWLEDGE_BASE.slice(0, 3);
  const lines = selected.map(
    (item) =>
      `### ${item.name} (${item.recommendedVersion})\n- **Install**: \`${item.installCommand || 'See official installer'}\`\n- **Verify**: \`${item.verifyCommand}\`\n- **Official Source**: ${item.officialUrl}\n- **Note**: ${item.notes}`
  );

  return `## DevSetup AI — Recommended Environment Setup\n\n${lines.join('\n\n')}\n\n> Run \`devsetup-companion.ps1\` locally to auto-scan your PC and execute approved commands safely.`;
}

// --- Synced Local Scan & Generated Setup Artifacts ---
const NONILION_SCAN_FILE = path.resolve(process.cwd(), '.nonilion-scan.json');
let latestSyncedScan: Record<string, unknown> | null = null;

try {
  if (fs.existsSync(NONILION_SCAN_FILE)) {
    latestSyncedScan = JSON.parse(fs.readFileSync(NONILION_SCAN_FILE, 'utf8'));
  }
} catch {
  latestSyncedScan = null;
}

const generatedArtifacts = new Map<string, Record<string, { content: string; contentType: string }>>();

app.post('/api/companion/sync-scan', (req, res) => {
  const scan = req.body;
  if (!scan || typeof scan !== 'object' || !Array.isArray(scan.tools)) {
    res.status(400).json({ ok: false, error: 'Invalid scan payload.' });
    return;
  }
  latestSyncedScan = scan as Record<string, unknown>;
  try {
    fs.writeFileSync(NONILION_SCAN_FILE, JSON.stringify(latestSyncedScan), 'utf8');
  } catch {
    // ignore read-only fs
  }
  res.json({ ok: true, hostname: scan.hostname || 'local-pc', toolsCount: scan.tools.length });
});

app.get('/api/companion/sync-scan', (_req, res) => {
  res.json({ synced: Boolean(latestSyncedScan), scan: latestSyncedScan });
});

app.get('/api/artifacts/:id/:filename', (req, res) => {
  const bundle = generatedArtifacts.get(req.params.id);
  const file = bundle?.[req.params.filename];
  if (!file) {
    res.status(404).send('Artifact not found or expired.');
    return;
  }
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
  res.type(file.contentType).send(file.content);
});

function buildPowerShellSetupScript(
  projectTitle: string,
  requirements: Array<{
    name: string;
    mandatory: boolean;
    installCommand: string;
    verifyCommand: string;
    envStatus: string;
  }>,
  sampleProject?: { filename: string; code: string; runCommand: string }
): string {
  const lines: string[] = [
    `# DevSetup AI - Automated Environment Setup & Verification Script`,
    `# Project: ${projectTitle}`,
    `# Generated: ${new Date().toISOString()}`,
    `$ErrorActionPreference = "Continue"`,
    `Write-Host "=== DevSetup AI: ${projectTitle} ===" -ForegroundColor Cyan`,
    ``,
  ];

  for (const req of requirements) {
    if (req.envStatus === 'installed') {
      lines.push(`Write-Host "[OK] ${req.name} already installed." -ForegroundColor Green`);
      continue;
    }
    lines.push(`# ${req.mandatory ? 'Mandatory' : 'Optional'}: ${req.name}`);
    lines.push(`$ans = Read-Host "Install ${req.name} using '${req.installCommand}'? (Y/n)"`);
    lines.push(`if ($ans -eq "" -or $ans -match "^[Yy]") {`);
    lines.push(`    Write-Host "Installing ${req.name}..." -ForegroundColor Yellow`);
    lines.push(`    ${req.installCommand}`);
    lines.push(`}`);
    lines.push(``);
  }

  if (sampleProject?.filename && sampleProject?.code) {
    const b64 = Buffer.from(sampleProject.code, 'utf8').toString('base64');
    lines.push(`# Create & Run Verification Sample Program`);
    lines.push(`$samplePath = Join-Path (Get-Location) "${sampleProject.filename}"`);
    lines.push(`[System.IO.File]::WriteAllBytes($samplePath, [System.Convert]::FromBase64String("${b64}"))`);
    lines.push(`Write-Host "Created sample file: $samplePath" -ForegroundColor Cyan`);
    lines.push(`Write-Host "Running verification: ${sampleProject.runCommand}" -ForegroundColor Yellow`);
    lines.push(`${sampleProject.runCommand}`);
  }

  return lines.join('\n');
}

interface NonilionAgentOutput {
  markdown: string;
  voice: string;
}

async function generateNonilionReply(userMessage: string): Promise<NonilionAgentOutput> {
  if (!userMessage.trim()) {
    const msg =
      'Hi! I am **DevSetup AI**. Tell me what software or project you want to set up (e.g., *"Set up VS Code for C++"* or *"Fix g++ is not recognized"*), and I will inspect your environment, generate a 1-click setup script, and verify it works.';
    return { markdown: msg, voice: 'DevSetup AI is ready. Tell me what project or error you need help setting up.' };
  }

  const kbSummary = SOFTWARE_KNOWLEDGE_BASE.map(
    (item) =>
      `- **${item.name}** (${item.category}): v${item.recommendedVersion} | \`${item.installCommand}\` | verify=\`${item.verifyCommand}\` | [Official](${item.officialUrl})`
  ).join('\n');

  const scanContext = latestSyncedScan
    ? `REAL LOCAL MACHINE SCAN (from user's laptop):\n${JSON.stringify(latestSyncedScan)}`
    : 'REAL LOCAL MACHINE SCAN: Not yet synced. Mark envStatus as "not_scanned" unless known.';

  try {
    const response = await generateWithFallback({
      contents: `User message: ${userMessage}\n\n${scanContext}`,
      config: {
        systemInstruction: `You are DevSetup AI inside a Nonilion.com virtual office.
You MUST NOT act like a generic chatbot. Return structured JSON for one of three modes:
1. "clarify_or_impossible": If the user's request is too vague (e.g., "set up my laptop") OR impossible (e.g., "install Xcode on Windows" or "install iOS Simulator on Linux"), set mode="clarify_or_impossible", explain clearly what is missing or impossible, and ask 2-3 specific follow-up questions or give the real alternative.
2. "troubleshoot": If the user shares an error message, stack trace, or asks to fix something broken (e.g., "g++ is not recognized", "ModuleNotFoundError"), set mode="troubleshoot", diagnose the root cause in plain English, give exact approval-gated fix commands, and give a verification command.
3. "setup": For any valid setup/project request, compare against the REAL LOCAL MACHINE SCAN if provided (never fake installed software!), list mandatory vs optional tools from the Knowledge Base (do NOT suggest downloading a redundant competing tool if an equivalent tool is already installed in the scan, e.g., VS Code already present), provide config steps, and provide a small runnable sample test program.

Knowledge Base:
${kbSummary}`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            mode: { type: Type.STRING },
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            voiceSummary: { type: Type.STRING },
            followUpQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            requirements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  mandatory: { type: Type.BOOLEAN },
                  requiredVersion: { type: Type.STRING },
                  envStatus: { type: Type.STRING },
                  detectedVersion: { type: Type.STRING },
                  installCommand: { type: Type.STRING },
                  verifyCommand: { type: Type.STRING },
                  officialUrl: { type: Type.STRING },
                },
                required: ['name', 'mandatory', 'requiredVersion', 'envStatus', 'installCommand', 'verifyCommand', 'officialUrl'],
              },
            },
            configSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
            troubleshoot: {
              type: Type.OBJECT,
              properties: {
                classification: { type: Type.STRING },
                cause: { type: Type.STRING },
                fixCommands: { type: Type.ARRAY, items: { type: Type.STRING } },
                verifyCommand: { type: Type.STRING },
              },
            },
            sampleProject: {
              type: Type.OBJECT,
              properties: {
                filename: { type: Type.STRING },
                language: { type: Type.STRING },
                code: { type: Type.STRING },
                runCommand: { type: Type.STRING },
                expectedOutput: { type: Type.STRING },
              },
            },
          },
          required: ['mode', 'title', 'summary', 'voiceSummary'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim()) as Record<string, unknown>;
    const mode = String(parsed.mode || 'setup');
    const title = String(parsed.title || 'DevSetup AI Report');
    const summary = String(parsed.summary || '');
    const voice = String(parsed.voiceSummary || summary || 'DevSetup AI finished your request.');

    if (mode === 'clarify_or_impossible') {
      const qs = Array.isArray(parsed.followUpQuestions)
        ? (parsed.followUpQuestions as string[]).map((q, i) => `${i + 1}. ${q}`).join('\n')
        : '';
      return {
        markdown: `## ${title}\n\n${summary}${qs ? `\n\n### Questions to Clarify\n${qs}` : ''}`,
        voice,
      };
    }

    if (mode === 'troubleshoot' && parsed.troubleshoot && typeof parsed.troubleshoot === 'object') {
      const tr = parsed.troubleshoot as Record<string, unknown>;
      const cmds = Array.isArray(tr.fixCommands)
        ? (tr.fixCommands as string[]).map((c) => `- \`${c}\``).join('\n')
        : '';
      return {
        markdown: [
          `## Troubleshooting: ${title}`,
          `**Classification:** ${tr.classification || 'Environment Issue'}`,
          `**Why this happened:** ${tr.cause || summary}`,
          cmds ? `### Approved Fix Commands\n${cmds}` : '',
          tr.verifyCommand ? `### Verify Resolution\n\`\`\`powershell\n${tr.verifyCommand}\n\`\`\`` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        voice,
      };
    }

    const reqs = Array.isArray(parsed.requirements)
      ? (parsed.requirements as Array<{
          name: string;
          mandatory: boolean;
          requiredVersion: string;
          envStatus: string;
          detectedVersion?: string;
          installCommand: string;
          verifyCommand: string;
          officialUrl: string;
        }>)
      : [];

    const sample =
      parsed.sampleProject && typeof parsed.sampleProject === 'object'
        ? (parsed.sampleProject as {
            filename: string;
            language: string;
            code: string;
            runCommand: string;
            expectedOutput: string;
          })
        : undefined;

    const bundleId = `b${Date.now().toString(36)}`;
    const ps1Content = buildPowerShellSetupScript(title, reqs, sample);
    const lockContent = JSON.stringify(
      {
        project: title,
        generatedAt: new Date().toISOString(),
        machineScanned: latestSyncedScan ? latestSyncedScan.hostname : null,
        requirements: reqs,
      },
      null,
      2
    );

    const tableRows = reqs
      .map((r) => {
        const statusText =
          r.envStatus === 'installed'
            ? `Installed (${r.detectedVersion || 'detected'})`
            : r.envStatus === 'missing'
            ? 'Missing on PC'
            : 'Needs Scan / Config';
        return `| **${r.name}** | ${r.mandatory ? 'Mandatory' : 'Optional'} | ${r.requiredVersion} | ${statusText} | \`${r.installCommand}\` | [Official](${r.officialUrl}) |`;
      })
      .join('\n');

    const configSteps = Array.isArray(parsed.configSteps)
      ? (parsed.configSteps as string[]).map((s, i) => `${i + 1}. ${s}`).join('\n')
      : '';

    const reportMd = [
      `# DevSetup AI Setup Report: ${title}`,
      summary,
      latestSyncedScan
        ? `**Scanned Machine:** ${latestSyncedScan.hostname} (${latestSyncedScan.os})`
        : `**Machine Scan:** Not synced yet (run Local Companion to auto-detect installed tools).`,
      `## Software Matrix`,
      `| Software | Priority | Target Version | Local Status | Command | Source |`,
      `| :--- | :--- | :--- | :--- | :--- | :--- |`,
      tableRows,
      configSteps ? `## Configuration Steps\n${configSteps}` : '',
      sample
        ? `## Verification Program (${sample.filename})\n\`\`\`${sample.language || 'text'}\n${sample.code}\n\`\`\`\nRun: \`${sample.runCommand}\` → Expected: \`${sample.expectedOutput}\``
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const filesMap: Record<string, { content: string; contentType: string }> = {
      'setup-env.ps1': { content: ps1Content, contentType: 'text/plain' },
      'devsetup.lock.json': { content: lockContent, contentType: 'application/json' },
      'setup-report.md': { content: reportMd, contentType: 'text/markdown' },
    };
    if (sample?.filename && sample?.code) {
      filesMap[sample.filename] = { content: sample.code, contentType: 'text/plain' };
    }
    generatedArtifacts.set(bundleId, filesMap);

    const appBase = process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
      ? process.env.APP_URL.replace(/\/$/, '')
      : '';
    const artifactLinks = appBase
      ? [
          `- **1-Click Installer & Verifier Script:** [setup-env.ps1](${appBase}/api/artifacts/${bundleId}/setup-env.ps1)`,
          `- **Reproducible Lockfile:** [devsetup.lock.json](${appBase}/api/artifacts/${bundleId}/devsetup.lock.json)`,
          `- **Full Setup Report:** [setup-report.md](${appBase}/api/artifacts/${bundleId}/setup-report.md)`,
        ].join('\n')
      : '';

    const scanBanner = latestSyncedScan
      ? `**Environment Context:** Matched against your real PC scan (**${latestSyncedScan.hostname}** · ${latestSyncedScan.os})`
      : `**Environment Context:** Local scan not synced yet — showing verified Windows setup plan.`;

    const markdown = [
      `## ${title}`,
      `${summary}\n\n${scanBanner}`,
      tableRows
        ? `| Software | Priority | Version | Local Status | Command | Source |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n${tableRows}`
        : '',
      configSteps ? `### Configuration Steps\n${configSteps}` : '',
      sample
        ? `### Verification Test (${sample.filename})\n\`\`\`${sample.language || 'text'}\n${sample.code}\n\`\`\`\n**Run:** \`${sample.runCommand}\` · **Expected:** \`${sample.expectedOutput}\``
        : '',
      artifactLinks ? `### Generated Setup Files\n${artifactLinks}` : '',
      `### Run 1-Click Automated Setup (PowerShell)\n\`\`\`powershell\n${ps1Content.split('\n').slice(0, 18).join('\n')}\n\`\`\``,
    ]
      .filter(Boolean)
      .join('\n\n');

    return { markdown, voice };
  } catch (err) {
    console.error('Nonilion webhook Gemini fallback triggered:', err);
    return {
      markdown: buildKbFallbackReply(userMessage),
      voice: 'I generated a setup checklist from the verified software catalog.',
    };
  }
}

async function handleNonilionEvent(event: Record<string, unknown>) {
  if (event.type === 'test') {
    return;
  }

  const directCandidate =
    event.text ?? event.message ?? event.prompt ?? event.content ?? event.input ?? event.query;
  const userMessage = typeof directCandidate === 'string' ? directCandidate : '';
  const result = await generateNonilionReply(userMessage);

  const apiBase = typeof event.api_base === 'string' ? event.api_base : '';
  const token = process.env.NONILION_BOT_TOKEN;
  if (!apiBase || !token) return;

  const isPrivate = event.type === 'console_message';
  const endpoint = `${apiBase}/${isPrivate ? 'inbox' : 'chat'}`;
  const payload = isPrivate
    ? { text: result.markdown, reply_to: event.message_id }
    : { text: result.markdown };

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!resp.ok) {
    console.error('Failed posting reply to Nonilion:', resp.status, await resp.text());
  }

  // Speak concise summary aloud in the Nonilion virtual office
  await fetch(`${apiBase}/say`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: result.voice }),
  }).catch(() => {});
}

const nonilionWebhookHandler: express.RequestHandler = async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret) {
    const authHeader = req.get('authorization');
    const customHeader = req.get('x-webhook-secret') || req.get('x-sender-key');
    if (authHeader !== `Bearer ${secret}` && customHeader !== secret) {
      res.sendStatus(401);
      return;
    }
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  if (typeof body.challenge === 'string') {
    res.json({ ok: true, challenge: body.challenge });
    return;
  }

  if (typeof body.api_base === 'string' || typeof body.type === 'string') {
    res.status(200).json({ ok: true });
    handleNonilionEvent(body).catch((err) => console.error('Nonilion async handler error:', err));
    return;
  }

  const directCandidate =
    body.message ?? body.text ?? body.prompt ?? body.content ?? body.input ?? body.query;
  let userMessage = typeof directCandidate === 'string' ? directCandidate : '';
  if (!userMessage && Array.isArray(body.messages) && body.messages.length > 0) {
    const last = body.messages[body.messages.length - 1] as Record<string, unknown> | undefined;
    if (last && typeof last.content === 'string') {
      userMessage = last.content;
    }
  }

  const result = await generateNonilionReply(userMessage);
  res.json({ ok: true, reply: result.markdown, text: result.markdown, message: result.markdown, content: result.markdown });
};

app.post('/api/nonilion/webhook', nonilionWebhookHandler);
app.post('/webhook', nonilionWebhookHandler);

// --- Nonilion Direct Pairing & Polling Bridge (Works inside AI Studio without public webhooks) ---
const NONILION_DEFAULT_API_BASE = 'https://www.nonilion.com/api/bots/v1';
const NONILION_SESSION_FILE = path.resolve(process.cwd(), '.nonilion-session.json');

interface NonilionSessionState {
  token: string;
  apiBase: string;
  botName?: string;
  room?: string;
}

let nonilionSession: NonilionSessionState | null = null;
const processedNonilionIds = new Set<string>();
let nonilionPollTimer: NodeJS.Timeout | null = null;
let nonilionPollingBusy = false;
let nonilionStats = {
  lastPollAt: null as string | null,
  messagesHandled: 0,
  lastError: null as string | null,
};

function loadSavedNonilionSession() {
  try {
    if (fs.existsSync(NONILION_SESSION_FILE)) {
      const raw = JSON.parse(fs.readFileSync(NONILION_SESSION_FILE, 'utf8')) as NonilionSessionState;
      if (raw?.token) {
        nonilionSession = {
          token: raw.token,
          apiBase: raw.apiBase || NONILION_DEFAULT_API_BASE,
          botName: raw.botName,
          room: raw.room,
        };
        return;
      }
    }
  } catch {
    // ignore corrupt local session file
  }
  if (process.env.NONILION_BOT_TOKEN && process.env.NONILION_BOT_TOKEN !== 'MY_NONILION_BOT_TOKEN') {
    nonilionSession = {
      token: process.env.NONILION_BOT_TOKEN,
      apiBase: NONILION_DEFAULT_API_BASE,
    };
  }
}

async function pollNonilionInbox() {
  if (!nonilionSession || nonilionPollingBusy) return;
  nonilionPollingBusy = true;
  try {
    const { token, apiBase } = nonilionSession;
    const res = await fetch(`${apiBase}/inbox`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    nonilionStats.lastPollAt = new Date().toISOString();

    if (!res.ok) {
      nonilionStats.lastError = `Inbox poll HTTP ${res.status}`;
      return;
    }
    nonilionStats.lastError = null;

    const data = (await res.json()) as unknown;
    let items: (Record<string, unknown> & { _channel?: 'inbox' | 'chat' })[] = [];
    if (Array.isArray(data)) {
      items = data as Record<string, unknown>[];
    } else if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      const pendingArr = Array.isArray(obj.pending)
        ? (obj.pending as Record<string, unknown>[]).map((m) => ({ ...m, _channel: 'inbox' as const }))
        : null;
      const mentionsArr = Array.isArray(obj.room_mentions)
        ? (obj.room_mentions as Record<string, unknown>[]).map((m) => ({ ...m, _channel: 'chat' as const }))
        : [];
      if (pendingArr !== null) {
        items = [...pendingArr, ...mentionsArr];
      } else {
        const candidate = obj.messages ?? obj.items ?? obj.events ?? obj.inbox ?? obj.data;
        if (Array.isArray(candidate)) {
          items = candidate as Record<string, unknown>[];
        }
      }
    }

    for (const msg of items) {
      const id = String(msg.id ?? msg.message_id ?? '');
      if (!id || processedNonilionIds.has(id)) continue;

      if (msg.is_bot === true || msg.from_bot === true || msg.sender_type === 'bot' || msg.role === 'assistant') {
        processedNonilionIds.add(id);
        continue;
      }
      if (msg.replied === true || msg.handled === true) {
        processedNonilionIds.add(id);
        continue;
      }

      const rawText = msg.text ?? msg.content ?? msg.message ?? msg.body ?? '';
      const text = typeof rawText === 'string' ? rawText.trim() : '';
      if (!text) {
        processedNonilionIds.add(id);
        continue;
      }

      processedNonilionIds.add(id);
      const result = await generateNonilionReply(text);

      const isRoomChat =
        msg._channel === 'chat' ||
        msg.type === 'room_mention' ||
        msg.type === 'chat' ||
        msg.channel === 'chat';
      const targetEndpoint = `${apiBase}/${isRoomChat ? 'chat' : 'inbox'}`;
      const payload = isRoomChat ? { text: result.markdown } : { text: result.markdown, reply_to: id };

      const postRes = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (postRes.ok) {
        nonilionStats.messagesHandled += 1;
        await fetch(`${apiBase}/say`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: result.voice }),
        }).catch(() => {});
      } else {
        nonilionStats.lastError = `Reply failed HTTP ${postRes.status}`;
      }
    }
  } catch (err) {
    nonilionStats.lastError = err instanceof Error ? err.message : 'Polling error';
  } finally {
    nonilionPollingBusy = false;
  }
}

function startNonilionPolling() {
  if (nonilionPollTimer) clearInterval(nonilionPollTimer);
  if (!nonilionSession) return;
  pollNonilionInbox().catch(() => {});
  nonilionPollTimer = setInterval(() => {
    pollNonilionInbox().catch(() => {});
  }, 3000);
}

app.get('/api/nonilion/status', (_req, res) => {
  res.json({
    connected: Boolean(nonilionSession?.token),
    botName: nonilionSession?.botName || 'DevSetup AI',
    room: nonilionSession?.room || null,
    lastPollAt: nonilionStats.lastPollAt,
    messagesHandled: nonilionStats.messagesHandled,
    lastError: nonilionStats.lastError,
  });
});

app.post('/api/nonilion/pair', async (req, res) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    if (!code) {
      res.status(400).json({ ok: false, error: 'Enter the 6-character pairing code from Nonilion.' });
      return;
    }

    const pairRes = await fetch(`${NONILION_DEFAULT_API_BASE}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const pairData = (await pairRes.json()) as Record<string, unknown>;

    if (!pairRes.ok || !pairData.token) {
      res.status(pairRes.status || 400).json({
        ok: false,
        error: String(pairData.error || 'Pairing code invalid or expired. Generate a fresh pairing code in Nonilion.'),
      });
      return;
    }

    const token = String(pairData.token);
    const apiBase = typeof pairData.api_base === 'string' ? pairData.api_base : NONILION_DEFAULT_API_BASE;
    let botName = typeof pairData.bot_name === 'string' ? pairData.bot_name : typeof pairData.name === 'string' ? pairData.name : 'DevSetup AI';
    let room = typeof pairData.room === 'string' ? pairData.room : typeof pairData.room_id === 'string' ? pairData.room_id : undefined;

    try {
      const meRes = await fetch(`${apiBase}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.ok) {
        const me = (await meRes.json()) as Record<string, unknown>;
        const bot = (me.bot && typeof me.bot === 'object' ? me.bot : me) as Record<string, unknown>;
        if (typeof bot.name === 'string') botName = bot.name;
        if (typeof bot.room === 'string') room = bot.room;
        if (typeof bot.room_id === 'string') room = bot.room_id;
      }
    } catch {
      // optional profile fetch
    }

    nonilionSession = { token, apiBase, botName, room };
    try {
      fs.writeFileSync(NONILION_SESSION_FILE, JSON.stringify(nonilionSession), 'utf8');
    } catch {
      // ignore if filesystem is read-only
    }

    startNonilionPolling();

    res.json({
      ok: true,
      connected: true,
      botName,
      room: room || null,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to pair with Nonilion.',
    });
  }
});

app.post('/api/nonilion/disconnect', (_req, res) => {
  nonilionSession = null;
  if (nonilionPollTimer) {
    clearInterval(nonilionPollTimer);
    nonilionPollTimer = null;
  }
  try {
    if (fs.existsSync(NONILION_SESSION_FILE)) fs.unlinkSync(NONILION_SESSION_FILE);
  } catch {
    // ignore
  }
  res.json({ ok: true, connected: false });
});

loadSavedNonilionSession();
if (nonilionSession) {
  startNonilionPolling();
}

async function startServer() {
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/')) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error.' });
      return;
    }
    next(err);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DevSetup AI server running on http://localhost:${PORT}`);
  });
}

startServer();
