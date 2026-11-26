import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AiChatTurn,
  AppSettings,
  ChatMessage,
  DESMOS_COLORS,
  DesmosEvaluation,
  ExpressionItem,
  MathBounds,
  PopoverViewMode,
  SidebarItemType,
  StoredImage,
} from './types';
import {
  createBlankExpression,
  createSidebarItem,
  loadChatSender,
  loadExpressions,
  loadGraphTitle,
  loadSavedRoomCode,
  loadSettings,
  saveChatSender,
  saveExpressions,
  saveGraphTitle,
  saveRoomCode,
  saveSettings,
} from './services/storage';
import {
  addImages,
  clearAllImages,
  deleteImage,
  getAllImages,
} from './services/imageDb';
import {
  connectToChatRoom,
  RoomSubscriptionHandle,
} from './services/supabaseChat';
import { queryDetailedAiChat, queryInlineAi } from './services/aiService';
import { classifyInput } from './utils/mathParser';
import { TopHeader } from './components/TopHeader';
import { LeftSidebar } from './components/LeftSidebar';
import { DesmosCanvas, DesmosCanvasHandle } from './components/DesmosCanvas';
import { WrenchImagePopover } from './components/WrenchImagePopover';
import { VirtualKeypad } from './components/VirtualKeypad';
import { ConfigModal } from './components/ConfigModal';

function buildDecoyItems(equations: string[]): ExpressionItem[] {
  return equations.map((eq, i) => ({
    id: `decoy-${i}`,
    itemType: 'expression',
    rawInput: eq,
    color: DESMOS_COLORS[i % DESMOS_COLORS.length],
    hidden: false,
    isAiMode: false,
  }));
}

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [graphTitle, setGraphTitle] = useState<string>(() => loadGraphTitle());
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  // User expressions + Undo/Redo history
  const [userExpressions, setUserExpressions] = useState<ExpressionItem[]>(() =>
    loadExpressions()
  );
  const [undoStack, setUndoStack] = useState<ExpressionItem[][]>([]);
  const [redoStack, setRedoStack] = useState<ExpressionItem[][]>([]);

  // Tier 1 Quick Hide state + interactive decoy expressions
  const [isPanicMode, setIsPanicMode] = useState(false);
  const [decoyExpressions, setDecoyExpressions] = useState<ExpressionItem[]>(() =>
    buildDecoyItems(loadSettings().decoyEquations)
  );
  const savedViewportRef = useRef<MathBounds | null>(null);

  // UI panels & focus state
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isWrenchOpen, setIsWrenchOpen] = useState(false);
  const [popoverView, setPopoverView] = useState<PopoverViewMode>('image');
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const activeInputRef = useRef<HTMLInputElement | null>(null);

  // Real-time Group Chat state (kept alive in background when Wrench popover is closed)
  const [roomCode, setRoomCode] = useState<string | null>(() => loadSavedRoomCode());
  const [senderName, setSenderName] = useState<string>(() => loadChatSender());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatConnected, setIsChatConnected] = useState(false);
  const [hasUnreadChat, setHasUnreadChat] = useState(false);

  const roomSubRef = useRef<RoomSubscriptionHandle | null>(null);
  const isWrenchOpenRef = useRef(isWrenchOpen);
  const popoverViewRef = useRef(popoverView);
  const isPanicModeRef = useRef(isPanicMode);
  const hasUnreadChatRef = useRef(hasUnreadChat);

  useEffect(() => {
    isWrenchOpenRef.current = isWrenchOpen;
    popoverViewRef.current = popoverView;
    isPanicModeRef.current = isPanicMode;
    hasUnreadChatRef.current = hasUnreadChat;
    if (isWrenchOpen && popoverView === 'chat') {
      setHasUnreadChat(false);
    }
  }, [isWrenchOpen, popoverView, isPanicMode, hasUnreadChat]);

  // Background Supabase Realtime room listener
  useEffect(() => {
    roomSubRef.current?.unsubscribe();
    roomSubRef.current = null;
    setChatMessages([]);
    setIsChatConnected(false);

    if (!roomCode) {
      return;
    }

    const sub = connectToChatRoom({
      roomCode,
      supabaseUrl: settings.supabaseUrl,
      supabaseAnonKey: settings.supabaseAnonKey,
      onHistoryLoaded: (history) => {
        setChatMessages((prev) => {
          const map = new Map<string, ChatMessage>();
          for (const m of history) map.set(m.id, m);
          for (const m of prev) map.set(m.id, m);
          return Array.from(map.values()).sort(
            (a, b) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });
      },
      onNewRealtimeMessage: (msg, isRemote) => {
        setChatMessages((prev) => {
          if (prev.some((existing) => existing.id === msg.id)) return prev;
          return [...prev, msg];
        });

        if (
          isRemote &&
          !isPanicModeRef.current &&
          (!isWrenchOpenRef.current || popoverViewRef.current !== 'chat')
        ) {
          setHasUnreadChat(true);
        }
      },
      onConnectionChange: (connected) => {
        setIsChatConnected(connected);
      },
    });

    roomSubRef.current = sub;

    return () => {
      sub.unsubscribe();
      if (roomSubRef.current === sub) {
        roomSubRef.current = null;
      }
    };
  }, [roomCode, settings.supabaseUrl, settings.supabaseAnonKey]);

  const handleJoinRoom = useCallback((code: string, displayName: string) => {
    const cleanCode = code.replace(/\D/g, '').slice(0, 4);
    const cleanName = displayName.trim().slice(0, 24);
    if (cleanCode.length !== 4 || !cleanName) return;
    setSenderName(cleanName);
    saveChatSender(cleanName);
    setRoomCode(cleanCode);
    saveRoomCode(cleanCode);
    setHasUnreadChat(false);
  }, []);

  const handleLeaveRoom = useCallback(() => {
    setRoomCode(null);
    saveRoomCode(null);
    setChatMessages([]);
    setHasUnreadChat(false);
  }, []);

  const handleChangeSenderName = useCallback((nextName: string) => {
    const clean = nextName.trim().slice(0, 24);
    if (!clean) return;
    setSenderName(clean);
    saveChatSender(clean);
  }, []);

  const handleSendChatMessage = useCallback(
    async (content: string) => {
      if (!roomSubRef.current) return;
      await roomSubRef.current.sendMessage(senderName, content);
    },
    [senderName]
  );

  // Dedicated Multi-Turn AI Chat state inside WrenchImagePopover (preserved across popover toggles & Tier 1 Quick Hide)
  const [aiTurns, setAiTurns] = useState<AiChatTurn[]>([]);
  const [isAiChatLoading, setIsAiChatLoading] = useState(false);
  const aiChatAbortRef = useRef<AbortController | null>(null);
  const aiTurnsRef = useRef<AiChatTurn[]>(aiTurns);
  aiTurnsRef.current = aiTurns;

  const handleSendAiChatMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) return;

      aiChatAbortRef.current?.abort();
      const controller = new AbortController();
      aiChatAbortRef.current = controller;

      const userTurn: AiChatTurn = {
        id: `ai-u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        content: trimmed,
      };

      const nextHistory = [...aiTurnsRef.current, userTurn];
      setAiTurns(nextHistory);
      setIsAiChatLoading(true);

      try {
        const res = await queryDetailedAiChat(
          nextHistory,
          settings,
          controller.signal
        );
        if (controller.signal.aborted) return;

        const assistantTurn: AiChatTurn = {
          id: `ai-a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content: res.text,
          isError: res.isError,
        };
        setAiTurns((prev) => [...prev, assistantTurn]);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setAiTurns((prev) => [
          ...prev,
          {
            id: `ai-err-${Date.now()}`,
            role: 'assistant',
            content: err instanceof Error ? err.message : 'Network request failed',
            isError: true,
          },
        ]);
      } finally {
        if (aiChatAbortRef.current === controller) {
          aiChatAbortRef.current = null;
          setIsAiChatLoading(false);
        }
      }
    },
    [settings]
  );

  const handleClearAiChat = useCallback(() => {
    aiChatAbortRef.current?.abort();
    aiChatAbortRef.current = null;
    setIsAiChatLoading(false);
    setAiTurns([]);
  }, []);

  // Desmos canvas evaluations & viewport status
  const canvasRef = useRef<DesmosCanvasHandle | null>(null);
  const [evaluations, setEvaluations] = useState<Record<string, DesmosEvaluation>>({});
  const [isViewportMoved, setIsViewportMoved] = useState(false);

  // IndexedDB persisted images for Wrench Popover
  const [images, setImages] = useState<StoredImage[]>([]);

  // Abort controllers for in-flight AI requests per row
  const aiAbortMapRef = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    getAllImages()
      .then((loaded) => setImages(loaded))
      .catch(() => setImages([]));
  }, []);

  useEffect(() => {
    saveExpressions(userExpressions);
  }, [userExpressions]);

  // Tier 1 — Quick Hide: Closes Wrench popover, hides inline AI output, stops green unread pulse
  // without deleting any images, chat rooms, or settings. Toggles back cleanly on second trigger.
  const triggerTier1QuickHide = useCallback(() => {
    const wrenchWasOpen = isWrenchOpenRef.current;
    const hadUnreadPulse = hasUnreadChatRef.current;

    setIsConfigOpen(false);
    setIsWrenchOpen(false);
    setIsKeypadOpen(false);
    setHasUnreadChat(false);
    setFocusedId(null);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    setIsPanicMode((currentlyHidden) => {
      if (!currentlyHidden) {
        savedViewportRef.current = canvasRef.current?.getViewportBounds() ?? null;
        setDecoyExpressions(buildDecoyItems(settings.decoyEquations));
        window.requestAnimationFrame(() => {
          canvasRef.current?.resetDefaultViewport();
        });
        return true;
      }
      // If Wrench was open or unread pulse was active while already hidden, keep AI rows hidden while closing Wrench
      if (wrenchWasOpen || hadUnreadPulse) {
        return true;
      }
      const prevBounds = savedViewportRef.current;
      if (prevBounds) {
        window.requestAnimationFrame(() => {
          canvasRef.current?.setViewportBounds(prevBounds);
        });
      }
      return false;
    });
  }, [settings.decoyEquations]);

  // Tier 2 — Instant Official Desmos Redirect (preserves ALL localStorage keys, chat state, & IndexedDB images)
  const triggerTier2OfficialRedirect = useCallback(() => {
    window.location.replace('https://www.desmos.com/calculator');
  }, []);

  // Global Two-Tier Keyboard Listeners:
  // - Escape does NOT trigger panic (accidental presses ignored).
  // - Double-Tap Tab within 400ms -> Tier 2 Instant Official Desmos Redirect.
  // - Double-Tap Shift within 400ms -> Tier 1 Quick Hide toggle.
  const lastShiftDownRef = useRef<number>(0);
  const cleanShiftTapRef = useRef<boolean>(false);
  const lastTabDownRef = useRef<number>(0);
  const cleanTabTapRef = useRef<boolean>(false);

  useEffect(() => {
    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        cleanShiftTapRef.current = false;
        if (e.repeat || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
          cleanTabTapRef.current = false;
          return;
        }
        const now = performance.now();
        if (cleanTabTapRef.current && now - lastTabDownRef.current <= 400) {
          lastTabDownRef.current = 0;
          cleanTabTapRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          triggerTier2OfficialRedirect();
          return;
        }
        // Single Tab preserves native sequential focus navigation
        lastTabDownRef.current = now;
        cleanTabTapRef.current = true;
        return;
      }

      if (e.key === 'Shift') {
        cleanTabTapRef.current = false;
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        const now = performance.now();
        if (cleanShiftTapRef.current && now - lastShiftDownRef.current <= 400) {
          e.preventDefault();
          lastShiftDownRef.current = 0;
          cleanShiftTapRef.current = false;
          triggerTier1QuickHide();
          return;
        }
        lastShiftDownRef.current = now;
        cleanShiftTapRef.current = true;
        return;
      }

      cleanShiftTapRef.current = false;
      cleanTabTapRef.current = false;
    };

    const handlePointerDownReset = () => {
      cleanShiftTapRef.current = false;
      cleanTabTapRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDownCapture, true);
    window.addEventListener('pointerdown', handlePointerDownReset, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, true);
      window.removeEventListener('pointerdown', handlePointerDownReset, true);
    };
  }, [triggerTier1QuickHide, triggerTier2OfficialRedirect]);

  const activeExpressions = isPanicMode ? decoyExpressions : userExpressions;

  const pushUserHistory = useCallback((prev: ExpressionItem[]) => {
    setUndoStack((stack) => [...stack.slice(-39), prev]);
    setRedoStack([]);
  }, []);

  const updateActiveExpressions = useCallback(
    (
      updater: (prev: ExpressionItem[]) => ExpressionItem[],
      recordUndo = false
    ) => {
      if (isPanicMode) {
        setDecoyExpressions((prev) => updater(prev));
      } else {
        setUserExpressions((prev) => {
          if (recordUndo) pushUserHistory(prev);
          return updater(prev);
        });
      }
    },
    [isPanicMode, pushUserHistory]
  );

  const handleUndo = useCallback(() => {
    if (isPanicMode || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, userExpressions]);
    setUserExpressions(previous);
  }, [isPanicMode, undoStack, userExpressions]);

  const handleRedo = useCallback(() => {
    if (isPanicMode || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, userExpressions]);
    setUserExpressions(next);
  }, [isPanicMode, redoStack, userExpressions]);

  const handleAddItem = useCallback(
    (itemType: SidebarItemType, imageFile?: File) => {
      if (itemType === 'image' && imageFile) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
          let createdId = '';
          updateActiveExpressions((prev) => {
            const item = createSidebarItem('image', prev.length, imageFile.name, {
              imageDataUrl: dataUrl,
            });
            createdId = item.id;
            return [...prev, item];
          }, true);
          window.requestAnimationFrame(() => setFocusedId(createdId));
        };
        reader.readAsDataURL(imageFile);
        return;
      }

      let createdId = '';
      updateActiveExpressions((prev) => {
        const existingTables = prev.filter((p) => p.itemType === 'table').length;
        const item = createSidebarItem(itemType, prev.length, '', {
          tableSubscript: existingTables + 1,
        });
        createdId = item.id;
        return [...prev, item];
      }, true);

      window.requestAnimationFrame(() => {
        setFocusedId(createdId);
      });
    },
    [updateActiveExpressions]
  );

  const handleAddExpression = useCallback(() => {
    handleAddItem('expression');
  }, [handleAddItem]);

  const handleDeleteAll = useCallback(() => {
    for (const ctrl of aiAbortMapRef.current.values()) {
      ctrl.abort();
    }
    aiAbortMapRef.current.clear();

    let freshId = '';
    updateActiveExpressions(() => {
      const fresh = createBlankExpression(0);
      freshId = fresh.id;
      return [fresh];
    }, true);
    window.requestAnimationFrame(() => setFocusedId(freshId));
  }, [updateActiveExpressions]);

  const handleFocusRow = useCallback((id: string, inputEl: HTMLInputElement | null) => {
    setFocusedId(id);
    activeInputRef.current = inputEl;
  }, []);

  const handleBlurRow = useCallback((id: string) => {
    setFocusedId((curr) => (curr === id ? null : curr));
  }, []);

  const handleChangeInput = useCallback(
    (id: string, value: string) => {
      const pending = aiAbortMapRef.current.get(id);
      if (pending) {
        pending.abort();
        aiAbortMapRef.current.delete(id);
      }

      updateActiveExpressions((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const itemType = item.itemType || 'expression';
          const isMathOrAi = itemType === 'expression' || itemType === 'inference';
          const { isAi } = isMathOrAi
            ? classifyInput(
                value,
                isPanicMode ? 'prefix' : settings.triggerMode,
                settings.prefixChar
              )
            : { isAi: false };

          return {
            ...item,
            rawInput: value,
            isAiMode: isPanicMode || !isMathOrAi ? false : isAi,
            aiLoading: false,
            aiError: false,
            aiResponse: value.trim() === '' || !isAi ? undefined : item.aiResponse,
          };
        })
      );
    },
    [isPanicMode, settings.triggerMode, settings.prefixChar, updateActiveExpressions]
  );

  const handleUpdateTableCell = useCallback(
    (id: string, rowIdx: number, col: 'x' | 'y', val: string) => {
      updateActiveExpressions((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          const rows = [...(item.tableRows || [])];
          if (!rows[rowIdx]) return item;
          rows[rowIdx] = { ...rows[rowIdx], [col]: val };
          const last = rows[rows.length - 1];
          if (last && (last.x.trim() !== '' || last.y.trim() !== '')) {
            rows.push({ x: '', y: '' });
          }
          return { ...item, tableRows: rows };
        })
      );
    },
    [updateActiveExpressions]
  );

  const handleToggleFolderCollapse = useCallback(
    (id: string) => {
      updateActiveExpressions((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, folderCollapsed: !item.folderCollapsed }
            : item
        )
      );
    },
    [updateActiveExpressions]
  );

  const handleToggleHidden = useCallback(
    (id: string) => {
      updateActiveExpressions(
        (prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, hidden: !item.hidden } : item
          ),
        true
      );
    },
    [updateActiveExpressions]
  );

  const handleChangeColor = useCallback(
    (id: string, color: string) => {
      updateActiveExpressions(
        (prev) =>
          prev.map((item) => (item.id === id ? { ...item, color } : item)),
        true
      );
    },
    [updateActiveExpressions]
  );

  const handleDuplicateRow = useCallback(
    (id: string) => {
      let dupId = '';
      updateActiveExpressions((prev) => {
        const idx = prev.findIndex((r) => r.id === id);
        if (idx === -1) return prev;
        const src = prev[idx];
        const existingTables = prev.filter((p) => p.itemType === 'table').length;
        const copy: ExpressionItem = {
          ...createSidebarItem(src.itemType || 'expression', prev.length, src.rawInput),
          color: DESMOS_COLORS[(idx + 1) % DESMOS_COLORS.length],
          isAiMode: src.isAiMode,
          aiResponse: src.aiResponse,
          aiError: src.aiError,
          tableRows: src.tableRows ? src.tableRows.map((r) => ({ ...r })) : undefined,
          tableSubscript:
            src.itemType === 'table' ? existingTables + 1 : src.tableSubscript,
          folderCollapsed: src.folderCollapsed,
          imageDataUrl: src.imageDataUrl,
          imageCenter: src.imageCenter,
          imageSize: src.imageSize,
        };
        dupId = copy.id;
        const next = [...prev];
        next.splice(idx + 1, 0, copy);
        return next;
      }, true);
      window.requestAnimationFrame(() => setFocusedId(dupId));
    },
    [updateActiveExpressions]
  );

  const handleDeleteRow = useCallback(
    (id: string) => {
      const pending = aiAbortMapRef.current.get(id);
      if (pending) {
        pending.abort();
        aiAbortMapRef.current.delete(id);
      }

      let nextFocusId: string | null = null;
      updateActiveExpressions((prev) => {
        const idx = prev.findIndex((r) => r.id === id);
        if (idx === -1) return prev;
        if (prev.length === 1) {
          const fresh = createBlankExpression(0);
          nextFocusId = fresh.id;
          return [fresh];
        }
        const filtered = prev.filter((r) => r.id !== id);
        const targetIdx = Math.max(0, idx - 1);
        nextFocusId = filtered[targetIdx]?.id ?? null;
        return filtered;
      }, true);

      window.requestAnimationFrame(() => {
        setFocusedId(nextFocusId);
      });
    },
    [updateActiveExpressions]
  );

  const handleSubmitRow = useCallback(
    async (id: string) => {
      const row = activeExpressions.find((r) => r.id === id);
      if (!row) return;

      const itemType = row.itemType || 'expression';
      const isMathOrAi = itemType === 'expression' || itemType === 'inference';

      const { isAi, prompt } = isMathOrAi
        ? classifyInput(
            row.rawInput,
            isPanicMode ? 'prefix' : settings.triggerMode,
            settings.prefixChar
          )
        : { isAi: false, prompt: '' };

      if (!isPanicMode && isMathOrAi && isAi && prompt.length > 0) {
        const prevAbort = aiAbortMapRef.current.get(id);
        if (prevAbort) prevAbort.abort();

        const controller = new AbortController();
        aiAbortMapRef.current.set(id, controller);

        setUserExpressions((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, isAiMode: true, aiLoading: true, aiError: false }
              : item
          )
        );

        try {
          const result = await queryInlineAi(prompt, settings, controller.signal);
          if (controller.signal.aborted) return;
          setUserExpressions((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    isAiMode: true,
                    aiLoading: false,
                    aiError: result.isError,
                    aiResponse: result.text,
                  }
                : item
            )
          );
        } catch (err) {
          if (controller.signal.aborted) return;
          if (err instanceof Error && err.name === 'AbortError') return;
          const errMsg = err instanceof Error ? err.message : 'Network request failed';
          setUserExpressions((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    aiLoading: false,
                    aiError: true,
                    aiResponse: errMsg,
                  }
                : item
            )
          );
        } finally {
          if (aiAbortMapRef.current.get(id) === controller) {
            aiAbortMapRef.current.delete(id);
          }
        }
        return;
      }

      let targetId = '';
      updateActiveExpressions((prev) => {
        const idx = prev.findIndex((r) => r.id === id);
        if (idx === -1) return prev;
        if (
          idx < prev.length - 1 &&
          (prev[idx + 1].itemType || 'expression') === 'expression' &&
          prev[idx + 1].rawInput.trim() === ''
        ) {
          targetId = prev[idx + 1].id;
          return prev;
        }
        const inserted = createBlankExpression(prev.length);
        targetId = inserted.id;
        const next = [...prev];
        next.splice(idx + 1, 0, inserted);
        return next;
      }, true);

      window.requestAnimationFrame(() => setFocusedId(targetId));
    },
    [activeExpressions, isPanicMode, settings, updateActiveExpressions]
  );

  const handleNavigateRow = useCallback(
    (id: string, direction: 'up' | 'down') => {
      const idx = activeExpressions.findIndex((r) => r.id === id);
      if (idx === -1) return;
      if (direction === 'up' && idx > 0) {
        setFocusedId(activeExpressions[idx - 1].id);
      } else if (direction === 'down') {
        if (idx < activeExpressions.length - 1) {
          setFocusedId(activeExpressions[idx + 1].id);
        } else {
          handleAddExpression();
        }
      }
    },
    [activeExpressions, handleAddExpression]
  );

  const handleKeypadInsert = useCallback(
    (text: string, cursorBackOffset = 0) => {
      let targetRowId = focusedId;
      if (!targetRowId || !activeExpressions.some((r) => r.id === targetRowId)) {
        targetRowId = activeExpressions[activeExpressions.length - 1]?.id ?? null;
        if (targetRowId) setFocusedId(targetRowId);
      }
      if (!targetRowId) return;

      const input = activeInputRef.current;
      if (input && focusedId === targetRowId) {
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const nextVal = input.value.slice(0, start) + text + input.value.slice(end);
        handleChangeInput(targetRowId, nextVal);
        const nextPos = start + text.length - cursorBackOffset;
        window.requestAnimationFrame(() => {
          input.focus();
          input.setSelectionRange(nextPos, nextPos);
        });
      } else {
        const current = activeExpressions.find((r) => r.id === targetRowId)?.rawInput ?? '';
        handleChangeInput(targetRowId, current + text);
      }
    },
    [activeExpressions, focusedId, handleChangeInput]
  );

  const handleKeypadBackspace = useCallback(() => {
    const targetRowId =
      focusedId ?? activeExpressions[activeExpressions.length - 1]?.id ?? null;
    if (!targetRowId) return;
    const input = activeInputRef.current;
    if (input && focusedId === targetRowId) {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      if (start !== end) {
        const nextVal = input.value.slice(0, start) + input.value.slice(end);
        handleChangeInput(targetRowId, nextVal);
        window.requestAnimationFrame(() => input.setSelectionRange(start, start));
      } else if (start > 0) {
        const nextVal = input.value.slice(0, start - 1) + input.value.slice(end);
        handleChangeInput(targetRowId, nextVal);
        window.requestAnimationFrame(() =>
          input.setSelectionRange(start - 1, start - 1)
        );
      }
    } else {
      const current = activeExpressions.find((r) => r.id === targetRowId)?.rawInput ?? '';
      if (current.length > 0) {
        handleChangeInput(targetRowId, current.slice(0, -1));
      }
    }
  }, [activeExpressions, focusedId, handleChangeInput]);

  const handleKeypadEnter = useCallback(() => {
    const targetRowId =
      focusedId ?? activeExpressions[activeExpressions.length - 1]?.id ?? null;
    if (targetRowId) {
      void handleSubmitRow(targetRowId);
    }
  }, [activeExpressions, focusedId, handleSubmitRow]);

  const handleAddImageFiles = useCallback(async (files: File[]): Promise<number> => {
    const added = await addImages(files);
    if (added.length > 0) {
      const all = await getAllImages();
      setImages(all);
    }
    return added.length;
  }, []);

  const handleDeleteImage = useCallback(async (id: string) => {
    await deleteImage(id);
    const all = await getAllImages();
    setImages(all);
  }, []);

  const handleWipeAllImages = useCallback(async () => {
    await clearAllImages();
    setImages([]);
  }, []);

  const handleSaveSettings = useCallback(
    (next: AppSettings) => {
      setSettings(next);
      saveSettings(next);
      if (isPanicMode) {
        setDecoyExpressions(buildDecoyItems(next.decoyEquations));
      }
    },
    [isPanicMode]
  );

  const handleSaveGraph = useCallback(() => {
    saveExpressions(userExpressions);
    saveGraphTitle(graphTitle);
    setIsSavedFeedback(true);
    window.setTimeout(() => setIsSavedFeedback(false), 1400);
  }, [userExpressions, graphTitle]);

  const handleTitleChange = useCallback((nextTitle: string) => {
    setGraphTitle(nextTitle);
    saveGraphTitle(nextTitle);
  }, []);

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-white font-desmos">
      <h1 className="sr-only">Desmos Graphing Calculator</h1>

      <TopHeader
        title={graphTitle}
        onTitleChange={handleTitleChange}
        onSave={handleSaveGraph}
        isSavedFeedback={isSavedFeedback}
        isPanicMode={isPanicMode}
        onTripleClickLogo={() => setIsConfigOpen(true)}
        onTier1QuickHide={triggerTier1QuickHide}
        onTier2Redirect={triggerTier2OfficialRedirect}
      />

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <LeftSidebar
            width={sidebarWidth}
            isCollapsed={isSidebarCollapsed}
            onResizeWidth={setSidebarWidth}
            onToggleCollapse={() => setIsSidebarCollapsed(true)}
            expressions={activeExpressions}
            focusedId={focusedId}
            evaluations={evaluations}
            triggerMode={isPanicMode ? 'prefix' : settings.triggerMode}
            prefixChar={settings.prefixChar}
            canUndo={!isPanicMode && undoStack.length > 0}
            canRedo={!isPanicMode && redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onAddExpression={handleAddExpression}
            onAddItem={handleAddItem}
            onDeleteAll={handleDeleteAll}
            onFocusRow={handleFocusRow}
            onBlurRow={handleBlurRow}
            onChangeInput={handleChangeInput}
            onUpdateTableCell={handleUpdateTableCell}
            onToggleFolderCollapse={handleToggleFolderCollapse}
            onToggleHidden={handleToggleHidden}
            onChangeColor={handleChangeColor}
            onDuplicateRow={handleDuplicateRow}
            onDeleteRow={handleDeleteRow}
            onSubmitRow={(id) => void handleSubmitRow(id)}
            onNavigateRow={handleNavigateRow}
          />

          <div className="relative min-w-0 flex-1 h-full overflow-hidden">
            {isSidebarCollapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(false)}
                aria-label="Show Expression List"
                className="touch-manipulation absolute left-[10px] top-[10px] z-30 flex h-[36px] w-[36px] items-center justify-center rounded-[5px] border border-[#c4c4c4] bg-white text-[#666666] shadow-[0_1px_4px_rgba(0,0,0,0.12)] hover:border-[#a8a8a8] hover:text-[#222222] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M8 4.5L12.5 9L8 13.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3.8 4.5L8.3 9L3.8 13.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}

            <DesmosCanvas
              ref={canvasRef}
              expressions={activeExpressions}
              triggerMode={isPanicMode ? 'prefix' : settings.triggerMode}
              prefixChar={settings.prefixChar}
              onEvaluationsChange={setEvaluations}
              onViewportMovedChange={setIsViewportMoved}
            />

            <WrenchImagePopover
              isWrenchOpen={isWrenchOpen}
              popoverView={popoverView}
              onChangePopoverView={setPopoverView}
              hasUnreadChat={!isPanicMode && hasUnreadChat}
              onToggleWrench={() => setIsWrenchOpen((o) => !o)}
              onCloseWrench={() => setIsWrenchOpen(false)}
              onZoomIn={() => canvasRef.current?.zoomIn()}
              onZoomOut={() => canvasRef.current?.zoomOut()}
              onResetZoom={() => canvasRef.current?.resetDefaultViewport()}
              showHomeButton={isViewportMoved}
              images={images}
              onAddImageFiles={handleAddImageFiles}
              onDeleteImage={handleDeleteImage}
              roomCode={roomCode}
              isChatConnected={isChatConnected}
              senderName={senderName}
              onChangeSenderName={handleChangeSenderName}
              messages={chatMessages}
              onJoinRoom={handleJoinRoom}
              onLeaveRoom={handleLeaveRoom}
              onSendMessage={handleSendChatMessage}
              aiTurns={aiTurns}
              isAiChatLoading={isAiChatLoading}
              activeModelName={settings.model}
              onSendAiChatMessage={handleSendAiChatMessage}
              onClearAiChat={handleClearAiChat}
            />
          </div>
        </div>

        <VirtualKeypad
          isOpen={isKeypadOpen}
          onToggle={() => setIsKeypadOpen((k) => !k)}
          onInsert={handleKeypadInsert}
          onBackspace={handleKeypadBackspace}
          onEnter={handleKeypadEnter}
        />
      </main>

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        images={images}
        onAddImageFiles={handleAddImageFiles}
        onDeleteImage={handleDeleteImage}
        onWipeAllImages={handleWipeAllImages}
      />
    </div>
  );
};

export default App;
