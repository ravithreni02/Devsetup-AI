import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Search } from 'lucide-react';
import { SOFTWARE_KNOWLEDGE_BASE } from '../data/knowledgeBase';
import { SoftwareCategory } from '../types/devsetup';

const CATEGORIES: ('All' | SoftwareCategory)[] = [
  'All',
  'Programming Languages & Runtimes',
  'IDEs & Code Editors',
  'Compilers & Build Tools',
  'Databases',
  'Web Development',
  'Data Science & AI/ML',
  'Development & Deployment',
];

export const CatalogView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'All' | SoftwareCategory>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return SOFTWARE_KNOWLEDGE_BASE.filter((item) => {
      const matchesCat = category === 'All' || item.category === category;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [search, category]);

  const copyCommand = (id: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Software Knowledge Base
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Verified official sources, recommended versions, and installation commands across 7 core development categories.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Python, MinGW, MySQL, Docker..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          Showing {filtered.length} of {SOFTWARE_KNOWLEDGE_BASE.length} tools
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              category === cat
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th className="px-4 py-3">Software</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Recommended</th>
              <th className="px-4 py-3">Install Command</th>
              <th className="px-4 py-3 text-right">Official</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{item.name}</div>
                  <div className="text-xs text-slate-500 max-w-md">{item.notes}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                  {item.category}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                  {item.recommendedVersion}
                </td>
                <td className="px-4 py-3">
                  {item.installCommand && (
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-800 max-w-[260px] truncate">
                        {item.installCommand}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyCommand(item.id, item.installCommand!)}
                        className="p-1 text-slate-400 hover:text-slate-700"
                        title="Copy command"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <a
                    href={item.officialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Download
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
