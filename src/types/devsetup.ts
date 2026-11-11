export type SoftwareCategory =
  | 'Programming Languages & Runtimes'
  | 'IDEs & Code Editors'
  | 'Compilers & Build Tools'
  | 'Databases'
  | 'Web Development'
  | 'Data Science & AI/ML'
  | 'Development & Deployment';

export interface SoftwareCatalogItem {
  id: string;
  name: string;
  category: SoftwareCategory;
  recommendedVersion: string;
  officialUrl: string;
  windowsWingetId?: string;
  installCommand?: string;
  verifyCommand: string;
  notes: string;
  requiresManualGui?: boolean;
  pathHint?: string;
}

export interface LocalToolStatus {
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
  source: 'companion' | 'manual';
  status: 'ok' | 'missing' | 'warning';
  note?: string;
}

export interface LocalEnvironmentScan {
  scannedAt: string;
  os: string;
  osVersion: string;
  architecture: string;
  hostname: string;
  shell: string;
  packageManagers: {
    winget?: string | null;
    pip?: string | null;
    npm?: string | null;
    conda?: string | null;
    choco?: string | null;
  };
  tools: LocalToolStatus[];
  pathEntries: string[];
  vscodeExtensions: string[];
  envVars: Record<string, string>;
}

export interface SetupRequirementItem {
  name: string;
  category: SoftwareCategory;
  requiredVersion: string;
  mandatory: boolean;
  purpose: string;
  officialUrl: string;
  installMethod: 'winget' | 'pip' | 'npm' | 'manual_installer' | 'vscode_extension';
  installCommand: string;
  verifyCommand: string;
  requiresAdminOrGui: boolean;
  envStatus: 'installed' | 'missing' | 'version_mismatch' | 'needs_config' | 'not_scanned';
  detectedVersion?: string;
  configSteps?: string[];
}

export interface SetupPlanStep {
  stepNumber: number;
  title: string;
  description: string;
  command?: string;
  requiresApproval: boolean;
  approved: boolean;
  completed: boolean;
  verifyCommand?: string;
}

export interface SetupAnalysisResult {
  projectTitle: string;
  summary: string;
  clarifyingQuestions: string[];
  requirements: SetupRequirementItem[];
  setupPlan: SetupPlanStep[];
  sampleProject: {
    filename: string;
    language: string;
    code: string;
    runCommand: string;
    expectedOutput: string;
  };
  nextSteps: string[];
}

export interface TroubleshootResult {
  classification: string;
  severity: 'error' | 'warning' | 'info';
  plainEnglishCause: string;
  recommendedFix: string;
  proposedCommands: {
    label: string;
    command: string;
    requiresApproval: boolean;
  }[];
  verifyCommand: string;
  preventionTip: string;
}

export interface SavedProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  tools: string[];
  lastVerifiedAt?: string;
  status: 'ready' | 'needs_setup' | 'error';
  notes?: string;
}

export interface SetupReport {
  id: string;
  projectTitle: string;
  createdAt: string;
  installedCount: number;
  missingCount: number;
  summary: string;
}
