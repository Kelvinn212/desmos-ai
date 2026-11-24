import React, { useEffect, useRef, useState } from 'react';
import {
  AiTriggerMode,
  DESMOS_COLORS,
  DesmosEvaluation,
  ExpressionItem,
} from '../types';
import {
  classifyInput,
  formatDesmosNumber,
  renderMathToHtml,
  renderStealthLineHtml,
} from '../utils/mathParser';

interface ExpressionRowProps {
  index: number;
  item: ExpressionItem;
  isFocused: boolean;
  editListMode: boolean;
  triggerMode: AiTriggerMode;
  prefixChar: string;
  evaluation?: DesmosEvaluation;
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

export const ExpressionRow: React.FC<ExpressionRowProps> = ({
  index,
  item,
  isFocused,
  editListMode,
  triggerMode,
  prefixChar,
  evaluation,
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const itemType = item.itemType || 'expression';
  const isMathOrAiCapable = itemType === 'expression' || itemType === 'inference';

  useEffect(() => {
    if (isFocused && inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused]);

  useEffect(() => {
    if (!editListMode) {
      setShowColorPicker(false);
    }
  }, [editListMode]);

  const { isAi } = isMathOrAiCapable
    ? classifyInput(item.rawInput, triggerMode, prefixChar)
    : { isAi: false };
  const isAiRow =
    isMathOrAiCapable &&
    (isAi || item.isAiMode || Boolean(item.aiResponse) || Boolean(item.aiLoading));
  const hasContent =
    itemType === 'table' ||
    itemType === 'image' ||
    item.rawInput.trim().length > 0;

  // Determine left-gutter curve badge visibility
  const showGraphBadge =
    isMathOrAiCapable &&
    !isAiRow &&
    item.rawInput.trim().length > 0 &&
    (evaluation
      ? evaluation.isGraphable
      : /[xy]|normaldist|tdist|binomialdist/i.test(item.rawInput));

  const showSyntaxWarning =
    isMathOrAiCapable &&
    !isAiRow &&
    !isFocused &&
    item.rawInput.trim().length > 0 &&
    Boolean(evaluation?.isError) &&
    !evaluation?.isGraphable &&
    evaluation?.numericValue === undefined;

  // Render unfocused math via KaTeX
  const renderedMathHtml =
    isMathOrAiCapable && !isFocused && item.rawInput.trim().length > 0 && !isAiRow
      ? renderMathToHtml(item.rawInput)
      : '';

  // Normal math inline numeric evaluation (e.g. 145 * 18 -> = 2610)
  const formattedNumericEval =
    evaluation?.numericValue !== undefined && Number.isFinite(evaluation.numericValue)
      ? formatDesmosNumber(evaluation.numericValue)
      : '';
  const showNumericEval =
    isMathOrAiCapable &&
    !isAiRow &&
    item.rawInput.trim().length > 0 &&
    !evaluation?.isGraphable &&
    formattedNumericEval.length > 0;

  const showListEval =
    isMathOrAiCapable &&
    !isAiRow &&
    item.rawInput.trim().length > 0 &&
    !evaluation?.isGraphable &&
    evaluation?.numericValue === undefined &&
    Array.isArray(evaluation?.listValue);

  const aiLines = item.aiResponse ? item.aiResponse.split('\n').filter(Boolean) : [];
  const isSingleShortAiLine =
    !item.aiError && aiLines.length === 1 && aiLines[0].length <= 44;

  const subNum = item.tableSubscript ?? 1;

  return (
    <div
      className={`group relative flex min-h-[54px] border-b border-[#dcdcdc] bg-white transition-colors ${
        isFocused ? 'z-[2] ring-1 ring-inset ring-[#4d88cc]' : ''
      }`}
    >
      {/* Left numbered gutter + item-specific icon/badge */}
      <div
        onClick={() => {
          if (!showGraphBadge && itemType !== 'folder') {
            inputRef.current?.focus();
          }
        }}
        className={`relative flex w-[38px] shrink-0 flex-col items-center justify-center border-r select-none transition-colors ${
          isFocused
            ? 'border-[#4d88cc] bg-[#5a95d6] text-white'
            : 'border-[#d5d5d5] bg-[#ededed] text-[#767676]'
        }`}
      >
        <span className="absolute left-[4px] top-[3px] text-[10px] font-normal leading-none">
          {index + 1}
        </span>

        {/* Graph curve indicator for expression / inference */}
        {showGraphBadge && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (editListMode) {
                setShowColorPicker((prev) => !prev);
              } else {
                onToggleHidden(item.id);
              }
            }}
            aria-label={item.hidden ? 'Show graph curve' : 'Hide graph curve'}
            className="mt-1.5 flex h-[24px] w-[24px] items-center justify-center rounded-full transition-transform active:scale-95"
            style={
              item.hidden
                ? {
                    backgroundColor: 'transparent',
                    border: `2px solid ${isFocused ? 'rgba(255,255,255,0.75)' : '#b5b5b5'}`,
                  }
                : {
                    backgroundColor: item.color,
                    border: `2px solid ${item.color}`,
                    boxShadow: isFocused ? '0 0 0 1px rgba(255,255,255,0.65)' : 'none',
                  }
            }
          >
            {itemType === 'inference' ? (
              <svg width="15" height="13" viewBox="0 0 20 16" fill="none" aria-hidden="true">
                <path
                  d="M2 13C4.8 13 6 11 7.3 7C8.2 4.1 9 2.6 10 2.6C11 2.6 11.8 4.1 12.7 7C14 11 15.2 13 18 13"
                  stroke={
                    item.hidden
                      ? isFocused
                        ? 'rgba(255,255,255,0.8)'
                        : '#a6a6a6'
                      : '#ffffff'
                  }
                  strokeWidth="2.1"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3.5 14.5C7 6.5 10.2 6.5 12 12C13.8 17.5 17 17.5 20.5 9.5"
                  stroke={
                    item.hidden
                      ? isFocused
                        ? 'rgba(255,255,255,0.8)'
                        : '#a6a6a6'
                      : '#ffffff'
                  }
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        )}

        {/* Note gutter icon */}
        {itemType === 'note' && (
          <span
            aria-hidden="true"
            className={`mt-1.5 font-serif text-[16px] font-bold leading-none ${
              isFocused ? 'text-white/90' : 'text-[#888888]'
            }`}
          >
            “ ”
          </span>
        )}

        {/* Folder gutter icon */}
        {itemType === 'folder' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFolderCollapse(item.id);
            }}
            aria-label={item.folderCollapsed ? 'Expand folder' : 'Collapse folder'}
            className={`mt-1.5 flex items-center justify-center ${
              isFocused ? 'text-white' : 'text-[#777777] hover:text-[#333333]'
            }`}
          >
            <svg width="16" height="14" viewBox="0 0 18 15" fill="none" aria-hidden="true">
              <path
                d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.9c.42 0 .82.18 1.1.5l1.05 1.2c.28.32.68.5 1.1.5H15A1.5 1.5 0 0 1 16.5 5.2V12A1.5 1.5 0 0 1 15 13.5H3A1.5 1.5 0 0 1 1.5 12V3Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* Image row thumbnail / icon */}
        {itemType === 'image' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleHidden(item.id);
            }}
            aria-label={item.hidden ? 'Show image item' : 'Hide image item'}
            className={`mt-1.5 flex h-[24px] w-[24px] items-center justify-center overflow-hidden rounded-full border ${
              item.hidden ? 'border-[#bbbbbb] opacity-45' : 'border-[#999999]'
            } bg-white`}
          >
            {item.imageDataUrl ? (
              <img src={item.imageDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 18 15"
                fill="none"
                aria-hidden="true"
                className="text-[#777777]"
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
              </svg>
            )}
          </button>
        )}

        {showSyntaxWarning && (
          <span
            className="mt-1.5 flex h-[22px] w-[22px] items-center justify-center text-[#999999]"
            aria-label={evaluation?.errorMessage || 'Expression warning'}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M8 2L14.5 13.5H1.5L8 2Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path d="M8 6.3V9.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <circle cx="8" cy="11.6" r="0.75" fill="currentColor" />
            </svg>
          </span>
        )}

        {/* Inline Desmos 6-color picker when Edit List mode is active */}
        {showColorPicker && editListMode && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-[42px] top-1/2 z-30 flex -translate-y-1/2 items-center gap-1.5 rounded-[4px] border border-[#c8c8c8] bg-white p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.16)]"
          >
            {DESMOS_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChangeColor(item.id, c);
                  setShowColorPicker(false);
                }}
                aria-label={`Select color ${c}`}
                className="h-[18px] w-[18px] rounded-full border border-black/15 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: item.color === c ? '2px solid #4d88cc' : 'none',
                  outlineOffset: '1px',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Center Content Area */}
      {itemType === 'table' ? (
        <div
          className={`flex min-w-0 flex-1 flex-col py-2 pl-2.5 ${
            editListMode ? 'pr-20' : 'pr-9'
          }`}
        >
          <div className="overflow-hidden rounded-[3px] border border-[#d4d4d4] bg-white text-[14.5px]">
            {/* Table Header: x₁ | ● y₁ */}
            <div className="grid grid-cols-2 border-b border-[#d4d4d4] bg-[#f6f6f6] font-math">
              <div className="flex items-center justify-center border-r border-[#d4d4d4] py-1.5 text-[#333333]">
                <span>
                  <i>x</i>
                  <sub className="text-[11px]">{subNum}</sub>
                </span>
              </div>
              <div className="flex items-center justify-center gap-1.5 py-1.5 text-[#333333]">
                <button
                  type="button"
                  onClick={() => onToggleHidden(item.id)}
                  aria-label={item.hidden ? 'Show table points' : 'Hide table points'}
                  className="h-[14px] w-[14px] rounded-full transition-transform active:scale-95"
                  style={{
                    backgroundColor: item.hidden ? 'transparent' : item.color,
                    border: `2px solid ${item.hidden ? '#b0b0b0' : item.color}`,
                  }}
                />
                <span>
                  <i>y</i>
                  <sub className="text-[11px]">{subNum}</sub>
                </span>
              </div>
            </div>

            {/* Table Data Cells */}
            {(item.tableRows || []).map((pair, rIdx) => (
              <div
                key={rIdx}
                className="grid grid-cols-2 border-b border-[#eaeaea] last:border-b-0 font-math"
              >
                <input
                  type="text"
                  value={pair.x}
                  aria-label={`Table ${index + 1} row ${rIdx + 1} x`}
                  onFocus={(e) => onFocusRow(item.id, e.currentTarget)}
                  onBlur={() => onBlurRow(item.id)}
                  onChange={(e) => onUpdateTableCell(item.id, rIdx, 'x', e.target.value)}
                  className="h-[29px] w-full border-r border-[#eaeaea] bg-transparent px-2 text-center text-[15px] text-[#222222] outline-none focus:bg-[#f2f7fd]"
                />
                <input
                  type="text"
                  value={pair.y}
                  aria-label={`Table ${index + 1} row ${rIdx + 1} y`}
                  onFocus={(e) => onFocusRow(item.id, e.currentTarget)}
                  onBlur={() => onBlurRow(item.id)}
                  onChange={(e) => onUpdateTableCell(item.id, rIdx, 'y', e.target.value)}
                  className="h-[29px] w-full bg-transparent px-2 text-center text-[15px] text-[#222222] outline-none focus:bg-[#f2f7fd]"
                />
              </div>
            ))}
          </div>
        </div>
      ) : itemType === 'image' ? (
        <div
          onClick={() => inputRef.current?.focus()}
          className={`flex min-w-0 flex-1 flex-col justify-center px-3 py-2 ${
            editListMode ? 'pr-20' : 'pr-9'
          }`}
        >
          <input
            ref={inputRef}
            type="text"
            value={item.rawInput}
            placeholder="image.png"
            aria-label={`Image ${index + 1} label`}
            onFocus={(e) => onFocusRow(item.id, e.currentTarget)}
            onBlur={() => onBlurRow(item.id)}
            onChange={(e) => onChangeInput(item.id, e.target.value)}
            className="w-full bg-transparent text-[14px] font-medium text-[#333333] outline-none"
          />
          <div className="mt-1 flex items-center gap-3 text-[12px] text-[#666666] font-math">
            <span>Center: {item.imageCenter || '(0, 0)'}</span>
            <span>Size: {item.imageSize || '10 × 10'}</span>
          </div>
        </div>
      ) : (
        /* Expression / Inference / Note / Folder Row */
        <div
          onClick={() => {
            inputRef.current?.focus();
          }}
          className={`flex min-w-0 flex-1 cursor-text flex-col justify-center px-3 py-2 ${
            editListMode ? 'pr-20' : 'pr-9'
          }`}
        >
          <div className="relative flex min-h-[28px] w-full items-center gap-1.5">
            {itemType === 'folder' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFolderCollapse(item.id);
                }}
                aria-label={item.folderCollapsed ? 'Expand folder' : 'Collapse folder'}
                className="flex h-5 w-4 shrink-0 items-center justify-center text-[#777777] hover:text-[#222222]"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  aria-hidden="true"
                  className={`transition-transform ${
                    item.folderCollapsed ? '-rotate-90' : 'rotate-0'
                  }`}
                >
                  <path
                    d="M2 3.2L5 6.8L8 3.2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}

            <input
              ref={inputRef}
              type="text"
              value={item.rawInput}
              placeholder={
                itemType === 'note'
                  ? 'Enter a note...'
                  : itemType === 'folder'
                  ? 'Enter a note...'
                  : undefined
              }
              spellCheck={itemType === 'note' || itemType === 'folder'}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              aria-label={`Expression ${index + 1}`}
              onFocus={(e) => onFocusRow(item.id, e.currentTarget)}
              onBlur={() => onBlurRow(item.id)}
              onChange={(e) => onChangeInput(item.id, e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text');
                if (/[\r\n]/.test(pasted)) {
                  e.preventDefault();
                  const normalized = pasted.replace(/\s*[\r\n]+\s*/g, ' ').trim();
                  const el = e.currentTarget;
                  const start = el.selectionStart ?? el.value.length;
                  const end = el.selectionEnd ?? el.value.length;
                  const nextVal =
                    el.value.slice(0, start) + normalized + el.value.slice(end);
                  onChangeInput(item.id, nextVal);
                  const nextPos = start + normalized.length;
                  window.requestAnimationFrame(() => {
                    el.setSelectionRange(nextPos, nextPos);
                  });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSubmitRow(item.id);
                } else if (e.key === 'Backspace' && item.rawInput === '' && index > 0) {
                  e.preventDefault();
                  onDeleteRow(item.id);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  onNavigateRow(item.id, 'up');
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  onNavigateRow(item.id, 'down');
                }
              }}
              className={`w-full bg-transparent outline-none selection:bg-[#b5d5ff] placeholder:text-[#9c9c9c] ${
                itemType === 'note' || itemType === 'folder'
                  ? 'font-desmos text-[14.5px] leading-[1.4] text-[#3a3a3a]'
                  : isAiRow
                  ? 'font-math text-[17.5px] leading-[1.35] text-[#2a2a2a]'
                  : 'font-math text-[19px] leading-[1.35] text-[#222222]'
              } ${renderedMathHtml ? 'pointer-events-none absolute inset-0 opacity-0' : ''}`}
            />

            {renderedMathHtml && (
              <div
                className="desmos-math-render w-full overflow-x-auto no-scrollbar py-0.5 select-text"
                dangerouslySetInnerHTML={{ __html: renderedMathHtml }}
              />
            )}
          </div>

          {/* Standard Desmos numeric evaluation box */}
          {showNumericEval && (
            <div className="mt-1 inline-flex self-end items-center rounded-[3px] border border-[#dcdcdc] bg-[#f7f7f7] px-2 py-[1px] font-math text-[15px] text-[#444444] select-text">
              = {formattedNumericEval}
            </div>
          )}

          {/* Standard Desmos list evaluation box */}
          {showListEval && evaluation?.listValue && (
            <div className="mt-1 inline-flex max-w-full self-end items-center truncate rounded-[3px] border border-[#dcdcdc] bg-[#f7f7f7] px-2 py-[1px] font-math text-[14px] text-[#444444] select-text">
              = [{evaluation.listValue.slice(0, 6).map(formatDesmosNumber).join(', ')}
              {evaluation.listValue.length > 6 ? ', …' : ''}]
            </div>
          )}

          {/* Stealth Inline AI Loading State */}
          {item.aiLoading && (
            <div className="mt-1 inline-flex self-end items-center rounded-[3px] border border-[#e2e2e2] bg-[#f7f7f7] px-2 py-[1px] font-math text-[14px] text-[#777777]">
              = …
            </div>
          )}

          {/* Stealth Inline AI Output or API Error Message */}
          {!item.aiLoading && aiLines.length > 0 && (
            item.aiError ? (
              <div className="mt-1.5 w-full rounded-[3px] border border-[#dcdcdc] bg-[#f7f7f7] px-2.5 py-1 text-[12.5px] leading-[1.38] text-[#555555] whitespace-normal break-words select-text">
                {item.aiResponse}
              </div>
            ) : isSingleShortAiLine ? (
              <div
                className="desmos-stealth-render mt-1 inline-flex max-w-full self-end items-center overflow-x-auto no-scrollbar rounded-[3px] border border-[#dcdcdc] bg-[#f7f7f7] px-2 py-[1px] font-math text-[15px] text-[#444444] select-text"
                dangerouslySetInnerHTML={{
                  __html: `${aiLines[0].includes('=') ? '' : '= '}${renderStealthLineHtml(
                    aiLines[0]
                  )}`,
                }}
              />
            ) : (
              <div className="desmos-stealth-render mt-1 flex max-w-full flex-col items-end self-end gap-0.5 rounded-[3px] border border-[#dcdcdc] bg-[#f7f7f7] px-2.5 py-1 font-math text-[14.5px] leading-[1.38] text-[#484848] select-text">
                {aiLines.map((line, i) => (
                  <div
                    key={i}
                    className={
                      i === aiLines.length - 1
                        ? 'text-[#3b3b3b] whitespace-normal break-words text-right'
                        : 'text-[#666666] whitespace-normal break-words text-right'
                    }
                    dangerouslySetInnerHTML={{
                      __html: `${
                        i === aiLines.length - 1 && !line.includes('=') ? '= ' : ''
                      }${renderStealthLineHtml(line)}`,
                    }}
                  />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* Right actions: Edit List Mode (Duplicate + enlarged dark-gray ×) vs Normal subtle × */}
      {editListMode ? (
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateRow(item.id);
            }}
            aria-label={`Duplicate expression ${index + 1}`}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[4px] text-[#636363] hover:bg-black/5 hover:text-[#222222] transition-colors"
          >
            {/* Two overlapping pages icon */}
            <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect
                x="5.8"
                y="5.5"
                width="9.2"
                height="10"
                rx="1.3"
                fill="#ffffff"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M3.2 12.2V3.8C3.2 3.08 3.78 2.5 4.5 2.5H11.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRow(item.id);
            }}
            aria-label={`Delete expression ${index + 1}`}
            className="flex h-[30px] w-[30px] items-center justify-center rounded-[4px] text-[#555555] hover:bg-black/5 hover:text-[#111111] transition-colors"
          >
            {/* Enlarged dark-gray × delete icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 3L13 13M13 3L3 13"
                stroke="currentColor"
                strokeWidth="2.05"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ) : (
        <div className="absolute right-1 top-1.5 flex items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteRow(item.id);
            }}
            aria-label={`Delete expression ${index + 1}`}
            className={`flex h-[24px] w-[24px] items-center justify-center rounded text-[#a0a0a0] hover:text-[#444444] transition-opacity ${
              hasContent || isFocused
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M2.5 2.5L11.5 11.5M11.5 2.5L2.5 11.5"
                stroke="currentColor"
                strokeWidth="1.65"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
