import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { SOFTWARE_KNOWLEDGE_BASE } from './src/data/knowledgeBase.ts';

dotenv.config();

const app = express();
app.use(express.json({ limit: '5mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

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
        $cmd = $body.command
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
2. Identify ONLY the software, languages, compilers, IDEs, databases, and packages actually needed (distinguish mandatory vs optional).
3. Compare against the student's actual local environment scan if provided. If no local scan is provided, set envStatus to "not_scanned" — NEVER invent or fake installed software.
4. Use official software sources and verified commands (winget, pip, npm, or official GUI installers). Never invent download URLs.
5. Generate a clear, ordered setup plan where system-modifying actions have requiresApproval=true.
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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

app.post('/api/nonilion/webhook', async (req, res) => {
  try {
    const userMessage =
      req.body?.message || req.body?.text || req.body?.prompt || '';
    if (!userMessage || typeof userMessage !== 'string') {
      res.json({
        reply:
          'Hi! I am **DevSetup AI**. Tell me what software or project you want to set up (e.g., *"Set up VS Code for C++"* or *"Fix g++ is not recognized"*), and I will generate a verified setup plan.',
      });
      return;
    }

    const kbSummary = SOFTWARE_KNOWLEDGE_BASE.map(
      (item) =>
        `- **${item.name}** (${item.category}): v${item.recommendedVersion} | \`${item.installCommand}\` | [Official](${item.officialUrl})`
    ).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userMessage,
      config: {
        systemInstruction: `You are DevSetup AI running inside a Nonilion.com virtual office.
Respond with a clean, structured Markdown reply (headings, bullet lists, and exact terminal commands).
Always distinguish mandatory vs optional software, use official sources from the knowledge base below, and include a verification command.
If the user's request is unclear or impossible, ask a clarifying follow-up question instead of guessing.

Knowledge Base:
${kbSummary}`,
      },
    });

    res.json({
      reply: response.text || 'I could not generate a setup plan for that request.',
      text: response.text || 'I could not generate a setup plan for that request.',
    });
  } catch (err) {
    console.error('Nonilion webhook error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Webhook processing failed.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DevSetup AI server running on http://localhost:${PORT}`);
  });
}

startServer();
