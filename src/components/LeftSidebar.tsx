import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AiTriggerMode,
  DesmosEvaluation,
  ExpressionItem,
  SidebarItemType,
} from '../types';
import { ExpressionRow } from './ExpressionRow';

function buildEightToothGearPath(): string {
  const cx = 10;
  const cy = 10;
  const teeth = 8;
  const rOuter = 8.45;
  const rRoot = 6.15;
  const rHole = 2.75;
  const tipHalf = (9.5 * Math.PI) / 180;
  const rootHalf = (14 * Math.PI) / 180;
  const step = (2 * Math.PI) / teeth;

  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const centerAngle = i * step - Math.PI / 2;
    const a1 = centerAngle - rootHalf;
    const a2 = centerAngle - tipHalf;
    const a3 = centerAngle + tipHalf;
    const a4 = centerAngle + rootHalf;
    const nextA1 = (i + 1) * step - Math.PI / 2 - rootHalf;

    const p1x = (cx + rRoot * Math.cos(a1)).toFixed(2);
    const p1y = (cy + rRoot * Math.sin(a1)).toFixed(2);
    const p2x = (cx + rOuter * Math.cos(a2)).toFixed(2);
    const p2y = (cy + rOuter * Math.sin(a2)).toFixed(2);
    const p3x = (cx + rOuter * Math.cos(a3)).toFixed(2);
    const p3y = (cy + rOuter * Math.sin(a3)).toFixed(2);
    const p4x = (cx + rRoot * Math.cos(a4)).toFixed(2);
    const p4y = (cy + rRoot * Math.sin(a4)).toFixed(2);
    const p5x = (cx + rRoot * Math.cos(nextA1)).toFixed(2);
    const p5y = (cy + rRoot * Math.sin(nextA1)).toFixed(2);

    if (i === 0) pts.push(`M ${p1x} ${p1y}`);
    pts.push(`L ${p2x} ${p2y}`);
    pts.push(`A ${rOuter} ${rOuter} 0 0 1 ${p3x} ${p3y}`);
    pts.push(`L ${p4x} ${p4y}`);
    pts.push(`A ${rRoot} ${rRoot} 0 0 1 ${p5x} ${p5y}`);
  }
  pts.push('Z');
  pts.push(
    `M ${(cx + rHole).toFixed(2)} ${cy} A ${rHole} ${rHole} 0 1 0 ${(cx - rHole).toFixed(
      2
    )} ${cy} A ${rHole} ${rHole} 0 1 0 ${(cx + rHole).toFixed(2)} ${cy} Z`
  );
  return pts.join(' ');
}

const SOLID_GEAR_PATH = buildEightToothGearPath();

interface LeftSidebarProps {
  width: number;
  isCollapsed: boolean;
  onResizeWidth: (width: number) => void;
  onToggleCollapse: () => void;
  expressions: ExpressionItem[];
  focusedId: string | null;
  evaluations: Record<string, DesmosEvaluation>;
  triggerMode: AiTriggerMode;
  prefixChar: string;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddExpression: () => void;
  onAddItem: (itemType: SidebarItemType, imageFile?: File) => void;
  onDeleteAll: () => void;
  onFocusRow: (id: string, inputEl: HTMLInputElement | null) => void;
  onBlurRow: (id: string) => void;
  onChangeInput: (id: string, value: string) => void;
  onUpdateTableCell: (id: string, rowIdx: number, col: 'x' | 'y', val: string) => void;
  onToggleFolderCollapse: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onDuplicateRow: (id: string) => void;
  onDeleteRow: (id: string) => void;
  onSubmitRow: (id: string) => void;
  onNavigateRow: (id: string, direction: 'up' | 'down') => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  width,
  isCollapsed,
  onResizeWidth,
  onToggleCollapse,
  expressions,
  focusedId,
  evaluations,
  triggerMode,
  prefixChar,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddExpression,
  onAddItem,
  onDeleteAll,
  onFocusRow,
  onBlurRow,
  onChangeInput,
  onUpdateTableCell,
  onToggleFolderCollapse,
  onToggleHidden,
  onChangeColor,
  onDuplicateRow,
  onDeleteRow,
  onSubmitRow,
  onNavigateRow,
}) => {
  const [editListMode, setEditListMode] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const addTriggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const menuGroupRef = useRef<HTMLDivElement | null>(null);
  const sidebarImageInputRef = useRef<HTMLInputElement | null>(null);
  const isResizingRef = useRef(false);
  const addTriggerId = useId();

  // Close + Add Item dropdown on outside click or Escape
  useEffect(() => {
    if (!showAddMenu) return;

    const handleOutside = (e: PointerEvent) => {
      if (
        addMenuContainerRef.current &&
        !addMenuContainerRef.current.contains(e.target as Node)
      ) {
        setShowAddMenu(false);
      }
    };

    const handleKeyCapture = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setShowAddMenu(false);
        addTriggerBtnRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handleOutside);
    window.addEventListener('keydown', handleKeyCapture, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutside);
      window.removeEventListener('keydown', handleKeyCapture, true);
    };
  }, [showAddMenu]);

  // Progressive enhancement fallback for focusgroup="menu nomemory" per modern-web-guidance
  useEffect(() => {
    const group = menuGroupRef.current;
    if (!showAddMenu || !group) return;
    if ('focusGroup' in HTMLElement.prototype) return;

    group.setAttribute('role', 'menu');
    const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not([role])'));
    buttons.forEach((btn) => btn.setAttribute('role', 'menuitem'));

    const onKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = Array.from(group.querySelectorAll<HTMLButtonElement>('button')).filter(
        (item) => !item.disabled
      );
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
          ? items.length - 1
          : current < 0
          ? 0
          : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
      event.preventDefault();
      items[next]?.focus({ preventScroll: true });
    };

    group.addEventListener('keydown', onKeyDown);
    return () => group.removeEventListener('keydown', onKeyDown);
  }, [showAddMenu]);

  const startResizing = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isResizingRef.current = true;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      if (!isResizingRef.current) return;
      const clamped = Math.min(640, Math.max(260, ev.clientX));
      onResizeWidth(clamped);
    };

    const onUp = (ev: PointerEvent) => {
      isResizingRef.current = false;
      try {
        target.releasePointerCapture(ev.pointerId);
      } catch {
        // Ignore
      }
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  if (isCollapsed) {
    return null;
  }

  const selectMenuItem = (type: SidebarItemType) => {
    setShowAddMenu(false);
    if (type === 'image') {
      sidebarImageInputRef.current?.click();
      return;
    }
    onAddItem(type);
  };

  const menuItemClass =
    'flex w-full items-center gap-3 px-3.5 py-2 text-left text-[13.5px] font-normal text-[#333333] hover:bg-[#ededed] focus-visible:bg-[#e8eff7] outline-none transition-colors';
  const menuIconSlotClass =
    'flex w-[24px] shrink-0 items-center justify-center text-[#6e6e6e]';

  return (
    <aside
      style={{ width: `${width}px` }}
      aria-label="Expression List"
      className="relative z-20 flex h-full shrink-0 flex-col border-r border-[#c8c8c8] bg-[#f6f6f6] select-none"
    >
      {/* Hidden file picker for standard + -> image item */}
      <input
        ref={sidebarImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onAddItem('image', file);
          } else {
            onAddItem('image');
          }
          e.target.value = '';
        }}
      />

      {/* Top light-gray Desmos expression toolbar */}
      <div className="relative flex h-[44px] shrink-0 items-center justify-between border-b border-[#d5d5d5] bg-[#f5f5f5] px-2.5">
        {/* Left: + Add Item Dropdown (normal) OR Solid Red "Delete All" button (Edit List Mode) */}
        {editListMode ? (
          <button
            type="button"
            onClick={() => {
              onDeleteAll();
              setEditListMode(false);
            }}
            className="h-[30px] rounded-[4px] bg-[#cc3f3a] px-3 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-[#ba3732] active:bg-[#a52f2b] transition-colors"
          >
            Delete All
          </button>
        ) : (
          <div ref={addMenuContainerRef} className="relative flex items-center">
            <button
              ref={addTriggerBtnRef}
              id={addTriggerId}
              type="button"
              aria-label="Add Item"
              aria-haspopup="menu"
              aria-expanded={showAddMenu}
              onClick={() => setShowAddMenu((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setShowAddMenu(true);
                  window.requestAnimationFrame(() => {
                    menuGroupRef.current?.querySelector('button')?.focus();
                  });
                }
              }}
              className={`flex h-[32px] items-center gap-0.5 rounded-[4px] px-2 transition-colors ${
                showAddMenu
                  ? 'bg-black/10 text-[#222222]'
                  : 'text-[#666666] hover:bg-black/5 hover:text-[#222222]'
              }`}
            >
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M9 3V15M3 9H15"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <svg
                width="8"
                height="8"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
                className="ml-0.5 text-[#888888]"
              >
                <path
                  d="M2 3.5L5 6.5L8 3.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Authentic Desmos + Add Item Dropdown Menu with top-left pointer arrow */}
            {showAddMenu && (
              <div className="absolute left-0 top-[39px] z-40 w-[166px]">
                {/* Top-left pointer arrow pointing up at the + button */}
                <div
                  aria-hidden="true"
                  className="absolute -top-[5.5px] left-[13px] z-20 h-[10px] w-[10px] rotate-45 border-l border-t border-[#bebebe] bg-white"
                />

                <div
                  ref={menuGroupRef}
                  {...({
                    focusgroup: 'menu nomemory',
                  } as React.HTMLAttributes<HTMLDivElement>)}
                  aria-labelledby={addTriggerId}
                  className="relative z-10 overflow-hidden rounded-[5px] border border-[#bebebe] bg-white py-1 shadow-[0_3px_12px_rgba(0,0,0,0.18)]"
                >
                  {/* 1. expression */}
                  <button
                    type="button"
                    onClick={() => selectMenuItem('expression')}
                    className={menuItemClass}
                  >
                    <span className={`${menuIconSlotClass} font-math text-[15px] italic`}>
                      f(x)
                    </span>
                    <span>expression</span>
                  </button>

                  {/* 2. note */}
                  <button
                    type="button"
                    onClick={() => selectMenuItem('note')}
                    className={menuItemClass}
                  >
                    <span
                      className={`${menuIconSlotClass} font-serif text-[18px] font-bold leading-none tracking-tight`}
                    >
                      “ ”
                    </span>
                    <span>note</span>
                  </button>

                  {/* 3. table */}
                  <button
                    type="button"
                    onClick={() => selectMenuItem('table')}
                    className={menuItemClass}
                  >
                    <span className={menuIconSlotClass}>
                      <svg
                        width="16"
                        height="15"
                        viewBox="0 0 16 15"
                        fill="none"
                        aria-hidden="true"
                      >
                        <rect
                          x="1"
                          y="1"
                          width="14"
                          height="13"
                          rx="1.5"
                          stroke="currentColor"
                          strokeWidth="1.35"
                        />
                        <path
                          d="M1 5.2H15M1 9.6H15M8 1V14"
                          stroke="currentColor"
                          strokeWidth="1.25"
                        />
                      </svg>
                    </span>
                    <span>table</span>
                  </button>

                  {/* 4. inference */}
                  <button
                    type="button"
                    onClick={() => selectMenuItem('inference')}
                    className={menuItemClass}
                  >
                    <span className={menuIconSlotClass}>
                      <svg
                        width="18"
                        height="15"
                        viewBox="0 0 20 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M1.5 13.5C4.5 13.5 5.8 11.5 7.2 7.2C8.2 4.1 9 2.5 10 2.5C11 2.5 11.8 4.1 12.8 7.2C14.2 11.5 15.5 13.5 18.5 13.5"
                          stroke="currentColor"
                          strokeWidth="1.45"
                          strokeLinecap="round"
                        />
                        <path
                          d="M1 13.5H19"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <span>inference</span>
                  </button>

                  {/* 5. folder */}
                  <button
                    type="button"
                    onClick={() => selectMenuItem('folder')}
                    className={menuItemClass}
                  >
                    <span className={menuIconSlotClass}>
                      <svg
                        width="16"
                        height="14"
                        viewBox="0 0 18 15"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.9c.42 0 .82.18 1.1.5l1.05 1.2c.28.32.68.5 1.1.5H15A1.5 1.5 0 0 1 16.5 5.2V12A1.5 1.5 0 0 1 15 13.5H3A1.5 1.5 0 0 1 1.5 12V3Z"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span>folder</span>
                  </button>

                  {/* 6. image */}
                  <button
                    type="button"
                    onClick={() => selectMenuItem('image')}
                    className={menuItemClass}
                  >
                    <span className={menuIconSlotClass}>
                      <svg
                        width="16"
                        height="14"
                        viewBox="0 0 18 15"
                        fill="none"
                        aria-hidden="true"
                      >
                        <rect
                          x="1.5"
                          y="1.5"
                          width="15"
                          height="12"
                          rx="1.5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                        />
                        <circle cx="5.5" cy="5.2" r="1.2" fill="currentColor" />
                        <path
                          d="M2.5 12.5L6.8 8.4L10.2 11.4L12.8 9L15.8 12.5"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span>image</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Center: Undo / Redo arrows kept centered in both modes */}
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Undo"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[4px] text-[#555555] enabled:hover:bg-black/5 enabled:hover:text-[#222222] disabled:opacity-30 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M6.5 5L3 8.5L6.5 12"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3.5 8.5H10.5C13 8.5 14.8 10.2 14.8 12.5C14.8 13.3 14.6 14 14.2 14.5"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="Redo"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[4px] text-[#555555] enabled:hover:bg-black/5 enabled:hover:text-[#222222] disabled:opacity-30 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path
                d="M11.5 5L15 8.5L11.5 12"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14.5 8.5H7.5C5 8.5 3.2 10.2 3.2 12.5C3.2 13.3 3.4 14 3.8 14.5"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Right: Solid 8-Tooth Gear + << Collapse (normal) OR Solid Desmos-Blue "Done" (Edit List Mode) */}
        <div className="flex items-center gap-1">
          {editListMode ? (
            <button
              type="button"
              onClick={() => setEditListMode(false)}
              className="h-[30px] rounded-[4px] bg-[#2d70d3] px-3.5 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-[#2663be] active:bg-[#1f53a2] transition-colors"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowAddMenu(false);
                  setEditListMode(true);
                }}
                aria-label="Edit Expression List"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[4px] text-[#636363] hover:bg-black/5 hover:text-[#222222] transition-colors"
              >
                {/* Authentic Desmos Solid Dark-Gray 8-Tooth Gear/Cog SVG */}
                <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d={SOLID_GEAR_PATH} fill="currentColor" fillRule="evenodd" />
                </svg>
              </button>

              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Hide Expression List"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-[4px] text-[#666666] hover:bg-black/5 hover:text-[#222222] transition-colors"
              >
                {/* Double chevron << */}
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M10 4.5L5.5 9L10 13.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14.2 4.5L9.7 9L14.2 13.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scrollable Expression Rows + Desmos Ghost Row */}
      <div className="desmos-scrollbar flex-1 overflow-y-auto pb-14">
        {expressions.map((item, idx) => (
          <ExpressionRow
            key={item.id}
            index={idx}
            item={item}
            isFocused={focusedId === item.id}
            editListMode={editListMode}
            triggerMode={triggerMode}
            prefixChar={prefixChar}
            evaluation={evaluations[item.id]}
            onFocusRow={onFocusRow}
            onBlurRow={onBlurRow}
            onChangeInput={onChangeInput}
            onUpdateTableCell={onUpdateTableCell}
            onToggleFolderCollapse={onToggleFolderCollapse}
            onToggleHidden={onToggleHidden}
            onChangeColor={onChangeColor}
            onDuplicateRow={onDuplicateRow}
            onDeleteRow={onDeleteRow}
            onSubmitRow={onSubmitRow}
            onNavigateRow={onNavigateRow}
          />
        ))}

        {/* Authentic Desmos Ghost Row at bottom of expression list */}
        <div
          onClick={onAddExpression}
          role="button"
          tabIndex={0}
          aria-label="Add new expression row"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAddExpression();
            }
          }}
          className="flex h-[52px] cursor-text border-b border-[#e5e5e5] bg-[#fafafa]/70 opacity-65 hover:opacity-95 transition-opacity"
        >
          <div className="relative w-[38px] shrink-0 border-r border-[#dfdfdf] bg-[#efefef]">
            <span className="absolute left-[4px] top-[3px] text-[10px] leading-none text-[#8c8c8c]">
              {expressions.length + 1}
            </span>
          </div>
          <div className="flex-1" />
        </div>
      </div>

      {/* Right-edge invisible resize splitter */}
      <div
        onPointerDown={startResizing}
        className="absolute right-[-3px] top-0 z-30 h-full w-[6px] cursor-col-resize hover:bg-[#4d88cc]/30 active:bg-[#4d88cc]/50 transition-colors"
      />
    </aside>
  );
};
