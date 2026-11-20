interface HeaderBarProps {
  onNavigateSection: (sectionId: string) => void;
  onTriggerExport: () => void;
  isExporting: boolean;
}

export function HeaderBar({ onNavigateSection, onTriggerExport, isExporting }: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#232833] bg-[#0E1014]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-3.5">
        <a
          href="#photo-studio"
          onClick={(e) => {
            e.preventDefault();
            onNavigateSection('photo-studio');
          }}
          className="font-display text-lg font-bold tracking-tight text-zinc-100 whitespace-nowrap shrink-0"
        >
          2T Shorts Studio
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400">
          <button
            type="button"
            onClick={() => onNavigateSection('photo-studio')}
            className="hover:text-zinc-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Foto &amp; Narasi
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('storyboard-editor')}
            className="hover:text-zinc-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Storyboard
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('preview-export')}
            className="hover:text-zinc-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Pratinjau 9:16
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onTriggerExport}
            disabled={isExporting}
            className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-orange-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExporting ? 'Merender Video...' : 'Ekspor Video'}
          </button>
        </div>
      </div>
    </header>
  );
}
