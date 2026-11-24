import React, { useRef, useState } from 'react';

interface TopHeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  onSave: () => void;
  isSavedFeedback: boolean;
  isPanicMode: boolean;
  onTripleClickLogo: () => void;
  onTier1QuickHide: () => void;
  onTier2Redirect: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  onTitleChange,
  onSave,
  isSavedFeedback,
  isPanicMode,
  onTripleClickLogo,
  onTier1QuickHide,
  onTier2Redirect,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  const logoClickTimestampsRef = useRef<number[]>([]);
  const folderTapTimestampsRef = useRef<number[]>([]);
  const helpTapTimestampsRef = useRef<number[]>([]);

  const displayTitle = isPanicMode ? 'Untitled Graph' : title;

  // Hidden Config Modal: Triple-click / triple-tap centered desmos wordmark
  const handleLogoClick = () => {
    const now = performance.now();
    const recent = logoClickTimestampsRef.current.filter((t) => now - t <= 550);
    recent.push(now);
    logoClickTimestampsRef.current = recent;

    if (recent.length >= 3) {
      logoClickTimestampsRef.current = [];
      onTripleClickLogo();
    }
  };

  // Tier 2 Panic: Triple-Tap Top-Left Folder Icon within 800ms -> Instant Official Desmos Redirect
  const handleFolderTap = () => {
    const now = performance.now();
    const recent = folderTapTimestampsRef.current.filter((t) => now - t <= 800);
    recent.push(now);
    folderTapTimestampsRef.current = recent;

    if (recent.length >= 3) {
      folderTapTimestampsRef.current = [];
      onTier2Redirect();
    }
  };

  // Tier 1 Panic: Double-Tap Top-Right Help (?) Icon within 400ms -> Quick Hide
  const handleHelpTap = () => {
    const now = performance.now();
    const recent = helpTapTimestampsRef.current.filter((t) => now - t <= 400);
    recent.push(now);
    helpTapTimestampsRef.current = recent;

    if (recent.length >= 2) {
      helpTapTimestampsRef.current = [];
      onTier1QuickHide();
    }
  };

  const commitTitle = () => {
    setIsEditingTitle(false);
    const cleaned = draftTitle.trim() || 'Untitled Graph';
    setDraftTitle(cleaned);
    onTitleChange(cleaned);
  };

  return (
    <header className="relative z-40 flex h-[45px] w-full shrink-0 items-center justify-between border-b border-[#1c1c1c] bg-[#2b2b2b] px-2.5 text-[#dddddd] select-none">
      {/* Left: Folder/Open Graph icon (Triple-Tap = Tier 2 Redirect) + Title + Blue Save button */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={handleFolderTap}
          aria-label="Open or manage graphs"
          className="touch-manipulation flex h-[31px] w-[34px] items-center justify-center rounded-[3px] text-[#cccccc] hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg
            width="19"
            height="16"
            viewBox="0 0 20 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1.5 3A1.5 1.5 0 0 1 3 1.5h4.38a1.5 1.5 0 0 1 1.14.52l1.16 1.35c.14.16.35.26.57.26H17A1.5 1.5 0 0 1 18.5 5.13V13A1.5 1.5 0 0 1 17 14.5H3A1.5 1.5 0 0 1 1.5 13V3Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M1.8 6h16.4"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeOpacity="0.75"
            />
          </svg>
        </button>

        {isEditingTitle && !isPanicMode ? (
          <input
            type="text"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              if (e.key === 'Escape') {
                setDraftTitle(title);
                setIsEditingTitle(false);
              }
            }}
            autoFocus
            aria-label="Graph title"
            className="h-[27px] w-[155px] rounded-[3px] border border-[#5a95d6] bg-[#1f1f1f] px-2 text-[13.5px] text-white outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!isPanicMode) {
                setDraftTitle(title);
                setIsEditingTitle(true);
              }
            }}
            className="touch-manipulation max-w-[180px] truncate rounded-[3px] px-1.5 py-1 text-left text-[14px] font-normal text-[#dedede] hover:bg-white/5 hover:text-white transition-colors"
          >
            {displayTitle}
          </button>
        )}

        <button
          type="button"
          onClick={onSave}
          className="touch-manipulation ml-0.5 h-[28px] rounded-[4px] bg-[#2f72dc] px-3.5 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-[#3a7ce5] active:bg-[#2660bd] transition-colors"
        >
          {isSavedFeedback ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Center: Official white desmos wordmark image (Triple-click opens hidden configuration modal) */}
      <div
        onClick={handleLogoClick}
        className="touch-manipulation absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-1 select-none cursor-default flex items-center justify-center"
      >
        <img
          src="/desmos-logo.png"
          alt="desmos"
          width={90}
          height={20}
          draggable={false}
          className="h-[19px] w-auto select-none pointer-events-none block"
        />
      </div>

      {/* Right: Log In, Sign Up, and Desmos utility icons (Share, Help, Language) */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="touch-manipulation hidden sm:inline-flex items-center h-[28px] rounded-[4px] px-2.5 text-[13px] font-normal text-[#d8d8d8] hover:bg-white/10 hover:text-white transition-colors"
        >
          Log In
        </button>
        <button
          type="button"
          className="touch-manipulation hidden sm:inline-flex items-center h-[28px] rounded-[4px] bg-[#388c46] px-2.5 text-[13px] font-medium text-white hover:bg-[#409b4f] active:bg-[#2f783b] transition-colors"
        >
          Sign Up
        </button>

        <div className="hidden sm:block mx-1 h-[18px] w-px bg-white/15" aria-hidden="true" />

        {/* Share Graph utility icon */}
        <button
          type="button"
          aria-label="Share graph"
          className="touch-manipulation flex h-[30px] w-[30px] items-center justify-center rounded-[3px] text-[#c9c9c9] hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M10.5 3.5H14.5V7.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M14.5 3.5L8 10"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M13 10.5V14A1.5 1.5 0 0 1 11.5 15.5H4A1.5 1.5 0 0 1 2.5 14V6.5A1.5 1.5 0 0 1 4 5H7.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Help (?) utility icon (Double-Tap within 400ms = Tier 1 Quick Hide) */}
        <button
          type="button"
          onClick={handleHelpTap}
          aria-label="Help"
          className="touch-manipulation flex h-[30px] w-[30px] items-center justify-center rounded-[3px] text-[#c9c9c9] hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M7.1 6.9C7.35 5.95 8.1 5.4 9.05 5.4C10.15 5.4 10.95 6.05 10.95 7C10.95 7.75 10.45 8.2 9.7 8.65C9.15 8.98 8.95 9.35 8.95 10.05"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="9" cy="12.5" r="0.9" fill="currentColor" />
          </svg>
        </button>

        {/* Language (Globe) utility icon */}
        <button
          type="button"
          aria-label="Language"
          className="touch-manipulation flex h-[30px] w-[30px] items-center justify-center rounded-[3px] text-[#c9c9c9] hover:bg-white/10 hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
            <ellipse cx="9" cy="9" rx="3.1" ry="7" stroke="currentColor" strokeWidth="1.3" />
            <path d="M2.3 9H15.7" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      </div>
    </header>
  );
};
