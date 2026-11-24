import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  AiTriggerMode,
  DesmosCalculatorInstance,
  DesmosEvaluation,
  DesmosHelperExpression,
  ExpressionItem,
  MathBounds,
} from '../types';
import { classifyInput, toDesmosLatex } from '../utils/mathParser';

export interface DesmosCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetDefaultViewport: () => void;
  getViewportBounds: () => MathBounds | null;
  setViewportBounds: (bounds: MathBounds) => void;
}

interface DesmosCanvasProps {
  expressions: ExpressionItem[];
  triggerMode: AiTriggerMode;
  prefixChar: string;
  onEvaluationsChange: (evals: Record<string, DesmosEvaluation>) => void;
  onViewportMovedChange: (isMovedFromDefault: boolean) => void;
}

export const DesmosCanvas = React.forwardRef<DesmosCanvasHandle, DesmosCanvasProps>(
  (
    {
      expressions,
      triggerMode,
      prefixChar,
      onEvaluationsChange,
      onViewportMovedChange,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const calcRef = useRef<DesmosCalculatorInstance | null>(null);
    const syncedIdsRef = useRef<Set<string>>(new Set());
    const helpersRef = useRef<Map<string, { latex: string; helper: DesmosHelperExpression }>>(
      new Map()
    );
    const helperValuesRef = useRef<
      Map<string, { numericValue?: number; listValue?: number[] }>
    >(new Map());
    const [calcReady, setCalcReady] = useState(false);

    const computeProportionalDefaultBounds = useCallback((): MathBounds => {
      const el = containerRef.current;
      const width = el?.clientWidth || 1000;
      const height = el?.clientHeight || 700;
      const aspect = height / Math.max(1, width);
      const halfWidth = 10;
      const halfHeight = halfWidth * aspect;
      return {
        left: -halfWidth,
        right: halfWidth,
        bottom: -halfHeight,
        top: halfHeight,
      };
    }, []);

    const emitEvaluations = useCallback(() => {
      const calc = calcRef.current;
      if (!calc) return;
      const analysis = calc.expressionAnalysis || {};
      const next: Record<string, DesmosEvaluation> = {};

      for (const id of syncedIdsRef.current) {
        const entry = analysis[id];
        const helperVal = helperValuesRef.current.get(id);
        next[id] = {
          isGraphable: Boolean(entry?.isGraphable),
          isError: Boolean(entry?.isError),
          errorMessage: entry?.errorMessage,
          numericValue: helperVal?.numericValue,
          listValue: helperVal?.listValue,
        };
      }

      onEvaluationsChange(next);
    }, [onEvaluationsChange]);

    // Initialize Official Desmos GraphingCalculator instance
    useEffect(() => {
      let cancelled = false;
      let pollTimer: number | undefined;

      const init = () => {
        if (cancelled || !containerRef.current) return;
        if (!window.Desmos?.GraphingCalculator) {
          pollTimer = window.setTimeout(init, 60);
          return;
        }

        const calc = window.Desmos.GraphingCalculator(containerRef.current, {
          expressions: false,
          settingsMenu: false,
          zoomButtons: false,
          border: false,
          keypad: false,
          lockViewport: false,
        });

        calcRef.current = calc;
        calc.setMathBounds(computeProportionalDefaultBounds());

        calc.observe('expressionAnalysis', () => {
          emitEvaluations();
        });

        calc.observe('graphpaperBounds', () => {
          const b = calc.graphpaperBounds?.mathCoordinates;
          if (!b) return;
          const def = computeProportionalDefaultBounds();
          const moved =
            Math.abs(b.left - def.left) > 0.25 ||
            Math.abs(b.right - def.right) > 0.25 ||
            Math.abs(b.top - def.top) > 0.25 ||
            Math.abs(b.bottom - def.bottom) > 0.25;
          onViewportMovedChange(moved);
        });

        setCalcReady(true);
      };

      init();

      return () => {
        cancelled = true;
        if (pollTimer) window.clearTimeout(pollTimer);
        for (const { helper } of helpersRef.current.values()) {
          helper.unobserve('numericValue');
          helper.unobserve('listValue');
        }
        helpersRef.current.clear();
        helperValuesRef.current.clear();
        syncedIdsRef.current.clear();
        if (calcRef.current) {
          calcRef.current.destroy();
          calcRef.current = null;
        }
      };
    }, [computeProportionalDefaultBounds, emitEvaluations, onViewportMovedChange]);

    // ResizeObserver so collapsing or dragging the sidebar resizes Desmos smoothly
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const observer = new ResizeObserver(() => {
        calcRef.current?.resize();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    // Sync math/inference/table rows to Desmos via setExpression() & removeExpression()
    useEffect(() => {
      const calc = calcRef.current;
      if (!calc || !calcReady) return;

      const nextActiveIds = new Set<string>();

      for (const item of expressions) {
        const itemType = item.itemType || 'expression';

        // Notes, folders, and sidebar placeholder images do not plot in Desmos expression list
        if (itemType === 'note' || itemType === 'folder' || itemType === 'image') {
          continue;
        }

        // Sync x/y Table rows directly into Desmos API
        if (itemType === 'table') {
          const validPairs = (item.tableRows || []).filter(
            (r) => r.x.trim() !== '' || r.y.trim() !== ''
          );
          if (validPairs.length === 0) continue;

          const sub = item.tableSubscript ?? 1;
          nextActiveIds.add(item.id);
          calc.setExpression({
            id: item.id,
            type: 'table',
            columns: [
              {
                latex: `x_{${sub}}`,
                values: validPairs.map((p) => toDesmosLatex(p.x)),
              },
              {
                latex: `y_{${sub}}`,
                values: validPairs.map((p) => toDesmosLatex(p.y)),
                color: item.color,
                hidden: item.hidden,
              },
            ],
          });
          continue;
        }

        const trimmed = item.rawInput.trim();
        const { isAi } = classifyInput(trimmed, triggerMode, prefixChar);
        const isAiRow =
          isAi || item.isAiMode || Boolean(item.aiResponse) || Boolean(item.aiLoading);

        if (!trimmed || isAiRow) {
          continue;
        }

        const latex = toDesmosLatex(trimmed);
        if (!latex) continue;

        nextActiveIds.add(item.id);

        calc.setExpression({
          id: item.id,
          latex,
          color: item.color,
          hidden: item.hidden,
        });

        const assignMatch = latex.match(/^[a-zA-Z](?:_\{?[a-zA-Z0-9]+\}?)?\s*=\s*(.+)$/);
        const evalLatex =
          assignMatch && !/[xy]/i.test(latex) ? assignMatch[1].trim() : latex;

        const existingHelper = helpersRef.current.get(item.id);
        if (!existingHelper || existingHelper.latex !== evalLatex) {
          if (existingHelper) {
            existingHelper.helper.unobserve('numericValue');
            existingHelper.helper.unobserve('listValue');
          }
          helperValuesRef.current.delete(item.id);

          const helper = calc.HelperExpression({ latex: evalLatex });
          const updateVal = () => {
            const num = helper.numericValue;
            const list = helper.listValue;
            helperValuesRef.current.set(item.id, {
              numericValue:
                typeof num === 'number' && !Number.isNaN(num) ? num : undefined,
              listValue: Array.isArray(list) ? list : undefined,
            });
            emitEvaluations();
          };
          helper.observe('numericValue', updateVal);
          helper.observe('listValue', updateVal);
          helpersRef.current.set(item.id, { latex: evalLatex, helper });
        }
      }

      // Remove any expressions no longer active
      for (const prevId of Array.from(syncedIdsRef.current)) {
        if (!nextActiveIds.has(prevId)) {
          calc.removeExpression({ id: prevId });
          syncedIdsRef.current.delete(prevId);
          const oldHelper = helpersRef.current.get(prevId);
          if (oldHelper) {
            oldHelper.helper.unobserve('numericValue');
            oldHelper.helper.unobserve('listValue');
            helpersRef.current.delete(prevId);
          }
          helperValuesRef.current.delete(prevId);
        }
      }

      syncedIdsRef.current = nextActiveIds;
      emitEvaluations();
    }, [expressions, triggerMode, prefixChar, calcReady, emitEvaluations]);

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => {
          const calc = calcRef.current;
          if (!calc) return;
          const b = calc.graphpaperBounds.mathCoordinates;
          const cx = (b.left + b.right) / 2;
          const cy = (b.top + b.bottom) / 2;
          const hw = (b.right - b.left) / 4;
          const hh = (b.top - b.bottom) / 4;
          calc.setMathBounds({
            left: cx - hw,
            right: cx + hw,
            bottom: cy - hh,
            top: cy + hh,
          });
        },
        zoomOut: () => {
          const calc = calcRef.current;
          if (!calc) return;
          const b = calc.graphpaperBounds.mathCoordinates;
          const cx = (b.left + b.right) / 2;
          const cy = (b.top + b.bottom) / 2;
          const hw = b.right - b.left;
          const hh = b.top - b.bottom;
          calc.setMathBounds({
            left: cx - hw,
            right: cx + hw,
            bottom: cy - hh,
            top: cy + hh,
          });
        },
        resetDefaultViewport: () => {
          calcRef.current?.setMathBounds(computeProportionalDefaultBounds());
        },
        getViewportBounds: () => {
          const b = calcRef.current?.graphpaperBounds?.mathCoordinates;
          return b ? { ...b } : null;
        },
        setViewportBounds: (bounds: MathBounds) => {
          calcRef.current?.setMathBounds(bounds);
        },
      }),
      [computeProportionalDefaultBounds]
    );

    return (
      <div
        ref={containerRef}
        className="h-full w-full bg-white"
        aria-label="Graphing Paper"
      />
    );
  }
);

DesmosCanvas.displayName = 'DesmosCanvas';
