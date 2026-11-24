import React from 'react';

interface VirtualKeypadProps {
  isOpen: boolean;
  onToggle: () => void;
  onInsert: (text: string, cursorBackOffset?: number) => void;
  onBackspace: () => void;
  onEnter: () => void;
}

export const VirtualKeypad: React.FC<VirtualKeypadProps> = ({
  isOpen,
  onToggle,
  onInsert,
  onBackspace,
  onEnter,
}) => {
  if (!isOpen) {
    return (
      <div className="pointer-events-none absolute bottom-0 left-3 z-20">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Show Keypad"
          className="pointer-events-auto flex h-[32px] w-[72px] items-center justify-center gap-1.5 rounded-t-[5px] border border-b-0 border-[#c6c6c6] bg-[#f4f4f4] text-[#555555] shadow-[0_-1px_3px_rgba(0,0,0,0.08)] hover:bg-[#eaeaea] hover:text-[#222222] transition-colors"
        >
          {/* Classic Desmos keyboard + chevron-up icon */}
          <svg width="20" height="14" viewBox="0 0 22 15" fill="none" aria-hidden="true">
            <rect
              x="1"
              y="1"
              width="20"
              height="13"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <rect x="4" y="4" width="2" height="2" fill="currentColor" />
            <rect x="7.5" y="4" width="2" height="2" fill="currentColor" />
            <rect x="11" y="4" width="2" height="2" fill="currentColor" />
            <rect x="14.5" y="4" width="2" height="2" fill="currentColor" />
            <rect x="4" y="7.5" width="2" height="2" fill="currentColor" />
            <rect x="7.5" y="7.5" width="2" height="2" fill="currentColor" />
            <rect x="11" y="7.5" width="2" height="2" fill="currentColor" />
            <rect x="14.5" y="7.5" width="2" height="2" fill="currentColor" />
            <rect x="6.5" y="10.8" width="9" height="1.6" fill="currentColor" />
          </svg>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M2.5 7.5L6 4L9.5 7.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    );
  }

  const fnBtn =
    'h-[36px] rounded-[4px] border border-[#cfd4d8] bg-[#e5e8ea] font-math text-[15.5px] text-[#232323] hover:bg-[#dce0e3] active:bg-[#d0d5d9] flex items-center justify-center select-none';
  const numBtn =
    'h-[36px] rounded-[4px] border border-[#cfd4d8] bg-white font-sans text-[15.5px] font-medium text-[#232323] hover:bg-[#f7f7f7] active:bg-[#ececec] flex items-center justify-center select-none';
  const opBtn =
    'h-[36px] rounded-[4px] border border-[#cfd4d8] bg-[#e5e8ea] font-math text-[17px] text-[#232323] hover:bg-[#dce0e3] active:bg-[#d0d5d9] flex items-center justify-center select-none';

  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      className="relative z-30 w-full shrink-0 border-t border-[#c6c6c6] bg-[#eef0f2] pb-2.5 pt-2 shadow-[0_-2px_8px_rgba(0,0,0,0.08)] select-none"
    >
      {/* Hide Keypad Tab */}
      <button
        type="button"
        onClick={onToggle}
        aria-label="Hide Keypad"
        className="absolute -top-[31px] left-3 flex h-[31px] w-[72px] items-center justify-center gap-1.5 rounded-t-[5px] border border-b-0 border-[#c6c6c6] bg-[#eef0f2] text-[#555555] hover:text-[#222222]"
      >
        <svg width="20" height="14" viewBox="0 0 22 15" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <rect x="4" y="4" width="2" height="2" fill="currentColor" />
          <rect x="7.5" y="4" width="2" height="2" fill="currentColor" />
          <rect x="11" y="4" width="2" height="2" fill="currentColor" />
          <rect x="14.5" y="4" width="2" height="2" fill="currentColor" />
          <rect x="6.5" y="10.8" width="9" height="1.6" fill="currentColor" />
        </svg>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.5 4.5L6 8L9.5 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="mx-auto grid max-w-[760px] grid-cols-10 gap-1.5 px-3">
        {/* Row 1 */}
        <button type="button" onClick={() => onInsert('x')} className={`${fnBtn} italic`}>
          x
        </button>
        <button type="button" onClick={() => onInsert('y')} className={`${fnBtn} italic`}>
          y
        </button>
        <button type="button" onClick={() => onInsert('^2')} className={fnBtn}>
          <span>
            <i>a</i>
            <sup>2</sup>
          </span>
        </button>
        <button type="button" onClick={() => onInsert('^()', 1)} className={fnBtn}>
          <span>
            <i>a</i>
            <sup>b</sup>
          </span>
        </button>
        <button type="button" onClick={() => onInsert('(')} className={fnBtn}>
          (
        </button>
        <button type="button" onClick={() => onInsert(')')} className={fnBtn}>
          )
        </button>
        <button type="button" onClick={() => onInsert('7')} className={numBtn}>
          7
        </button>
        <button type="button" onClick={() => onInsert('8')} className={numBtn}>
          8
        </button>
        <button type="button" onClick={() => onInsert('9')} className={numBtn}>
          9
        </button>
        <button type="button" onClick={() => onInsert('/')} className={opBtn}>
          ÷
        </button>

        {/* Row 2 */}
        <button type="button" onClick={() => onInsert('<')} className={fnBtn}>
          &lt;
        </button>
        <button type="button" onClick={() => onInsert('>')} className={fnBtn}>
          &gt;
        </button>
        <button type="button" onClick={() => onInsert('abs()', 1)} className={fnBtn}>
          |<i>a</i>|
        </button>
        <button type="button" onClick={() => onInsert(', ')} className={fnBtn}>
          ,
        </button>
        <button type="button" onClick={() => onInsert('<=')} className={fnBtn}>
          ≤
        </button>
        <button type="button" onClick={() => onInsert('>=')} className={fnBtn}>
          ≥
        </button>
        <button type="button" onClick={() => onInsert('4')} className={numBtn}>
          4
        </button>
        <button type="button" onClick={() => onInsert('5')} className={numBtn}>
          5
        </button>
        <button type="button" onClick={() => onInsert('6')} className={numBtn}>
          6
        </button>
        <button type="button" onClick={() => onInsert(' * ')} className={opBtn}>
          ×
        </button>

        {/* Row 3 */}
        <button type="button" onClick={() => onInsert('sin()', 1)} className={`${fnBtn} not-italic font-sans text-[13px]`}>
          sin
        </button>
        <button type="button" onClick={() => onInsert('cos()', 1)} className={`${fnBtn} not-italic font-sans text-[13px]`}>
          cos
        </button>
        <button type="button" onClick={() => onInsert('sqrt()', 1)} className={fnBtn}>
          √
        </button>
        <button type="button" onClick={() => onInsert('pi')} className={fnBtn}>
          π
        </button>
        <button type="button" onClick={() => onInsert('tan()', 1)} className={`${fnBtn} not-italic font-sans text-[13px]`}>
          tan
        </button>
        <button type="button" onClick={() => onInsert('ln()', 1)} className={`${fnBtn} not-italic font-sans text-[13px]`}>
          ln
        </button>
        <button type="button" onClick={() => onInsert('1')} className={numBtn}>
          1
        </button>
        <button type="button" onClick={() => onInsert('2')} className={numBtn}>
          2
        </button>
        <button type="button" onClick={() => onInsert('3')} className={numBtn}>
          3
        </button>
        <button type="button" onClick={() => onInsert(' - ')} className={opBtn}>
          −
        </button>

        {/* Row 4 */}
        <button
          type="button"
          onClick={onBackspace}
          aria-label="Backspace"
          className="col-span-3 h-[36px] rounded-[4px] border border-[#cfd4d8] bg-[#e5e8ea] text-[13px] font-medium text-[#333333] hover:bg-[#dce0e3] active:bg-[#d0d5d9] flex items-center justify-center"
        >
          ⌫
        </button>
        <button
          type="button"
          onClick={onEnter}
          aria-label="Enter"
          className="col-span-3 h-[36px] rounded-[4px] border border-[#2562be] bg-[#2f72dc] text-[13px] font-medium text-white hover:bg-[#397ce6] active:bg-[#245cb3] flex items-center justify-center"
        >
          ↵
        </button>
        <button type="button" onClick={() => onInsert('0')} className={numBtn}>
          0
        </button>
        <button type="button" onClick={() => onInsert('.')} className={numBtn}>
          .
        </button>
        <button type="button" onClick={() => onInsert(' = ')} className={opBtn}>
          =
        </button>
        <button type="button" onClick={() => onInsert(' + ')} className={opBtn}>
          +
        </button>
      </div>
    </div>
  );
};
