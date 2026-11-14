import { useEffect, useState } from 'react';
import {
  BookOpen,
  Cpu,
  Laptop,
  Terminal,
  Wrench,
} from 'lucide-react';
import {
  LocalEnvironmentScan,
  SavedProject,
  SetupReport,
} from './types/devsetup';
import { SetupAgentView } from './components/SetupAgentView';
import { MyEnvironmentView } from './components/MyEnvironmentView';
import { TroubleshooterView } from './components/TroubleshooterView';
import { CatalogView } from './components/CatalogView';
import { CompanionView } from './components/CompanionView';

type NavTab = 'agent' | 'environment' | 'troubleshoot' | 'catalog' | 'companion';

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Terminal }[] = [
  { id: 'agent', label: 'Setup Agent', icon: Terminal },
  { id: 'environment', label: 'My Environment', icon: Laptop },
  { id: 'troubleshoot', label: 'Troubleshooter', icon: Wrench },
  { id: 'catalog', label: 'Software Catalog', icon: BookOpen },
  { id: 'companion', label: 'Local Companion', icon: Cpu },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('agent');

  const [localScan, setLocalScan] = useState<LocalEnvironmentScan | null>(() => {
    try {
      const saved = localStorage.getItem('devsetup_local_scan');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [projects, setProjects] = useState<SavedProject[]>(() => {
    try {
      const saved = localStorage.getItem('devsetup_projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [reports, setReports] = useState<SetupReport[]>(() => {
    try {
      const saved = localStorage.getItem('devsetup_reports');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (localScan) {
      localStorage.setItem('devsetup_local_scan', JSON.stringify(localScan));
      fetch('/api/companion/sync-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localScan),
      }).catch(() => {});
    }
  }, [localScan]);

  useEffect(() => {
    localStorage.setItem('devsetup_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('devsetup_reports', JSON.stringify(reports));
  }, [reports]);

  const handleSaveProject = (project: SavedProject) => {
    setProjects((prev) => [project, ...prev]);
  };

  const handleDeleteProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSaveReport = (report: SetupReport) => {
    setReports((prev) => [report, ...prev].slice(0, 15));
  };

  const currentLabel = NAV_ITEMS.find((n) => n.id === activeTab)?.label ?? 'Setup Agent';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-[260px] shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-white flex flex-col justify-between">
        <div>
          <div className="h-14 px-5 flex items-center border-b border-slate-200">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              DevSetup AI
            </span>
          </div>

          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden md:block p-4 border-t border-slate-200 text-xs text-slate-500">
          <div>From software installation to a working development environment.</div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 whitespace-nowrap">
            <span>DevSetup AI</span>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-slate-900">{currentLabel}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('companion')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              {localScan ? `Scanned: ${localScan.hostname}` : 'Scan Local Machine'}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto">
          {activeTab === 'agent' && (
            <SetupAgentView
              localScan={localScan}
              onSaveProject={handleSaveProject}
              onSaveReport={handleSaveReport}
              onNavigateCompanion={() => setActiveTab('companion')}
            />
          )}
          {activeTab === 'environment' && (
            <MyEnvironmentView
              localScan={localScan}
              projects={projects}
              reports={reports}
              onAddProject={handleSaveProject}
              onDeleteProject={handleDeleteProject}
              onNavigateCompanion={() => setActiveTab('companion')}
            />
          )}
          {activeTab === 'troubleshoot' && (
            <TroubleshooterView localScan={localScan} />
          )}
          {activeTab === 'catalog' && <CatalogView />}
          {activeTab === 'companion' && (
            <CompanionView
              localScan={localScan}
              onScanLoaded={(scan) => setLocalScan(scan)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
