import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  AiChatTurn,
  ChatMessage,
  PopoverViewMode,
  StoredImage,
} from '../types';
import { renderRichAiMessageHtml } from '../utils/mathParser';

interface FloatingControlsProps {
  isWrenchOpen: boolean;
  popoverView: PopoverViewMode;
  onChangePopoverView: (view: PopoverViewMode) => void;
  hasUnreadChat: boolean;
  onToggleWrench: () => void;
  onCloseWrench: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  showHomeButton: boolean;
  images: StoredImage[];
  onAddImageFiles: (files: File[]) => Promise<number>;
  onDeleteImage: (id: string) => Promise<void>;
  // Supabase Room Chat props
  roomCode: string | null;
  isChatConnected: boolean;
  senderName: string;
  onChangeSenderName: (name: string) => void;
  messages: ChatMessage[];
  onJoinRoom: (code: string, displayName: string) => void;
  onLeaveRoom: () => void;
  onSendMessage: (content: string) => Promise<void>;
  // Dedicated AI Chat View props
  aiTurns: AiChatTurn[];
  isAiChatLoading: boolean;
  activeModelName: string;
  onSendAiChatMessage: (prompt: string) => Promise<void>;
  onClearAiChat: () => void;
}

function formatTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

const SparkleIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 1.5C8.38 5.15 10.85 7.62 14.5 8C10.85 8.38 8.38 10.85 8 14.5C7.62 10.85 5.15 8.38 1.5 8C5.15 7.62 7.62 5.15 8 1.5Z"
      stroke="currentColor"
      strokeWidth="1.35"
      strokeLinejoin="round"
    />
  </svg>
);

const ChatBubbleIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M2.5 3.5A1.5 1.5 0 0 1 4 2h8a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 12 11H6.2L3.2 13.4c-.38.3-.7.05-.7-.4V3.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

export const WrenchImagePopover: React.FC<FloatingControlsProps> = ({
  isWrenchOpen,
  popoverView,
  onChangePopoverView,
  hasUnreadChat,
  onToggleWrench,
  onCloseWrench,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  showHomeButton,
  images,
  onAddImageFiles,
  onDeleteImage,
  roomCode,
  isChatConnected,
  senderName,
  onChangeSenderName,
  messages,
  onJoinRoom,
  onLeaveRoom,
  onSendMessage,
  aiTurns,
  isAiChatLoading,
  activeModelName,
  onSendAiChatMessage,
  onClearAiChat,
}) => {
  const wrenchBtnRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Image Viewer State (preserved across Image <-> Chat <-> AI view switches)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  const zoomRef = useRef(1);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  zoomRef.current = zoom;
  panRef.current = pan;

  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{
    mode: 'idle' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    originPanX: number;
    originPanY: number;
    startDist: number;
    startMidX: number;
    startMidY: number;
    originZoom: number;
  }>({
    mode: 'idle',
    startX: 0,
    startY: 0,
    originPanX: 0,
    originPanY: 0,
    startDist: 1,
    startMidX: 0,
    startMidY: 0,
    originZoom: 1,
  });

  // Dynamic visualViewport max-height for tablet virtual keyboard safety
  const [keyboardSafeMaxHeight, setKeyboardSafeMaxHeight] = useState<number | null>(
    null
  );

  // Room Chat Join Lobby & Active Room State
  const [lobbyName, setLobbyName] = useState(senderName);
  const lobbyNameRef = useRef(lobbyName);
  lobbyNameRef.current = lobbyName;
  const [nameError, setNameError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const lobbyNameId = useId();
  const lobbyErrorId = useId();

  const [digits, setDigits] = useState<[string, string, string, string]>([
    '',
    '',
    '',
    '',
  ]);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([
    null,
    null,
    null,
    null,
  ]);
  const wasInLobbyRef = useRef(false);
  const [draftMessage, setDraftMessage] = useState('');
  const [isEditingSender, setIsEditingSender] = useState(false);
  const [draftSender, setDraftSender] = useState(senderName);
  const [copiedCodeFeedback, setCopiedCodeFeedback] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Dedicated AI Chat State
  const [draftAiPrompt, setDraftAiPrompt] = useState('');
  const aiFormRef = useRef<HTMLFormElement | null>(null);
  const aiMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const aiInputId = useId();

  useEffect(() => {
    // Never overwrite lobbyName while user is actively typing in "Your Name"
    if (document.activeElement !== nameInputRef.current) {
      setLobbyName(senderName);
    }
    setDraftSender(senderName);
  }, [senderName]);

  useEffect(() => {
    if (!roomCode) {
      setDigits(['', '', '', '']);
      setNameError(false);
      setCodeError(false);
    }
  }, [roomCode]);

  // Initial focus ONLY once when transitioning into Chat Lobby (never re-runs while typing!)
  const inLobby = isWrenchOpen && popoverView === 'chat' && !roomCode;
  useEffect(() => {
    if (inLobby && !wasInLobbyRef.current) {
      wasInLobbyRef.current = true;
      const isCoarse = window.matchMedia?.('(pointer: coarse)').matches;
      if (!isCoarse) {
        const hasSavedName = lobbyNameRef.current.trim().length > 0;
        const t = window.setTimeout(() => {
          // Do not steal focus if the user already clicked/focused a control inside the popover
          if (popoverRef.current?.contains(document.activeElement)) return;
          if (!hasSavedName) {
            nameInputRef.current?.focus();
          } else {
            digitRefs.current[0]?.focus();
          }
        }, 30);
        return () => window.clearTimeout(t);
      }
      return;
    }
    if (!inLobby) {
      wasInLobbyRef.current = false;
    }
  }, [inLobby]);

  // Track window.visualViewport so opening tablet on-screen keyboard keeps Chat & AI inputs visible above keyboard
  useEffect(() => {
    if (!isWrenchOpen) {
      setKeyboardSafeMaxHeight(null);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const updateViewportFit = () => {
      const topAnchor = popoverRef.current?.getBoundingClientRect().top ?? 56;
      const visibleBottom = vv.offsetTop + vv.height;
      const available = Math.floor(visibleBottom - topAnchor - 10);
      if (available > 0 && available < window.innerHeight - 60) {
        setKeyboardSafeMaxHeight(Math.max(190, available));
        window.requestAnimationFrame(() => {
          if (popoverView === 'chat' && roomCode) {
            messagesEndRef.current?.scrollIntoView({ block: 'end' });
          } else if (popoverView === 'ai') {
            aiMessagesEndRef.current?.scrollIntoView({ block: 'end' });
          }
        });
      } else {
        setKeyboardSafeMaxHeight(null);
      }
    };

    updateViewportFit();
    vv.addEventListener('resize', updateViewportFit);
    vv.addEventListener('scroll', updateViewportFit);
    return () => {
      vv.removeEventListener('resize', updateViewportFit);
      vv.removeEventListener('scroll', updateViewportFit);
    };
  }, [isWrenchOpen, popoverView, roomCode]);

  // Auto-scroll Room Chat feed
  useEffect(() => {
    if (isWrenchOpen && popoverView === 'chat' && roomCode) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages.length, isWrenchOpen, popoverView, roomCode]);

  // Auto-scroll AI Chat feed
  useEffect(() => {
    if (isWrenchOpen && popoverView === 'ai') {
      aiMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [aiTurns.length, isAiChatLoading, isWrenchOpen, popoverView]);

  // Clamp currentIndex when images are added or deleted
  useEffect(() => {
    if (images.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= images.length) {
      setCurrentIndex(images.length - 1);
    }
  }, [images.length, currentIndex]);

  const currentImage = images[currentIndex] || null;

  useEffect(() => {
    if (!currentImage) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(currentImage.blob);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [currentImage]);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentImage?.id]);

  // Light-dismiss when clicking/tapping anywhere outside popover & wrench button
  useEffect(() => {
    if (!isWrenchOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (wrenchBtnRef.current?.contains(target)) return;
      onCloseWrench();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isWrenchOpen, onCloseWrench]);

  const handleFilesAdded = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) return;
      const prevLen = images.length;
      const addedCount = await onAddImageFiles(imageFiles);
      if (addedCount > 0) {
        setCurrentIndex(prevLen);
      }
    },
    [images.length, onAddImageFiles]
  );

  // Clipboard Paste (Cmd+V / Ctrl+V) for images ONLY when Image View is active
  useEffect(() => {
    if (!isWrenchOpen || popoverView !== 'image') return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = item.type.split('/')[1] || 'png';
            const namedFile = new File([blob], `clipboard-${Date.now()}.${ext}`, {
              type: item.type,
            });
            pastedFiles.push(namedFile);
          }
        }
      }
      if (pastedFiles.length > 0) {
        e.preventDefault();
        void handleFilesAdded(pastedFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isWrenchOpen, popoverView, handleFilesAdded]);

  // Keyboard Left/Right navigation inside Image View when not typing in an input
  useEffect(() => {
    if (!isWrenchOpen || popoverView !== 'image' || images.length <= 1) return;
    const handleKey = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isWrenchOpen, popoverView, images.length]);

  // Non-passive mouse wheel & trackpad pinch zoom inside the Image View viewport
  useEffect(() => {
    const el = viewportRef.current;
    if (!isWrenchOpen || popoverView !== 'image' || !el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!currentImage) return;

      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - (rect.left + rect.width / 2);
      const cursorY = e.clientY - (rect.top + rect.height / 2);

      const sensitivity = e.ctrlKey ? 0.012 : 0.0022;
      const factor = Math.exp(-e.deltaY * sensitivity);

      const prevZoom = zoomRef.current;
      const nextZoom = Math.min(12, Math.max(0.5, prevZoom * factor));
      const ratio = nextZoom / prevZoom;

      const prevPan = panRef.current;
      const nextPan =
        nextZoom <= 1
          ? { x: prevPan.x * 0.4, y: prevPan.y * 0.4 }
          : {
              x: cursorX - (cursorX - prevPan.x) * ratio,
              y: cursorY - (cursorY - prevPan.y) * ratio,
            };

      setZoom(nextZoom);
      setPan(nextPan);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isWrenchOpen, popoverView, currentImage]);

  const stepZoom = (multiplier: number) => {
    setZoom((prev) => {
      const next = Math.min(12, Math.max(0.5, Number((prev * multiplier).toFixed(3))));
      if (next <= 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const resetImageTransform = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const initPinchBaseline = () => {
    const el = viewportRef.current;
    const pts = Array.from(activePointersRef.current.values());
    if (!el || pts.length < 2) return;
    const [p1, p2] = pts;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.max(8, Math.hypot(p2.x - p1.x, p2.y - p1.y));
    const midX = (p1.x + p2.x) / 2 - cx;
    const midY = (p1.y + p2.y) / 2 - cy;

    gestureRef.current = {
      mode: 'pinch',
      startX: 0,
      startY: 0,
      originPanX: panRef.current.x,
      originPanY: panRef.current.y,
      startDist: dist,
      startMidX: midX,
      startMidY: midY,
      originZoom: zoomRef.current,
    };
  };

  const handleViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!currentImage) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      setIsPanning(true);
      gestureRef.current = {
        ...gestureRef.current,
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        originPanX: panRef.current.x,
        originPanY: panRef.current.y,
      };
    } else if (activePointersRef.current.size >= 2) {
      setIsPanning(false);
      initPinchBaseline();
    }
  };

  const handleViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const count = activePointersRef.current.size;
    if (count >= 2 && gestureRef.current.mode === 'pinch') {
      const el = viewportRef.current;
      if (!el) return;
      const [p1, p2] = Array.from(activePointersRef.current.values());
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const currDist = Math.max(8, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const currMidX = (p1.x + p2.x) / 2 - cx;
      const currMidY = (p1.y + p2.y) / 2 - cy;

      const rawRatio = currDist / gestureRef.current.startDist;
      const nextZoom = Math.min(
        12,
        Math.max(0.5, gestureRef.current.originZoom * rawRatio)
      );
      const effectiveRatio = nextZoom / gestureRef.current.originZoom;

      const nextPan =
        nextZoom <= 0.55
          ? { x: 0, y: 0 }
          : {
              x:
                currMidX -
                (gestureRef.current.startMidX - gestureRef.current.originPanX) *
                  effectiveRatio,
              y:
                currMidY -
                (gestureRef.current.startMidY - gestureRef.current.originPanY) *
                  effectiveRatio,
            };

      setZoom(nextZoom);
      setPan(nextPan);
    } else if (count === 1 && gestureRef.current.mode === 'pan') {
      const dx = e.clientX - gestureRef.current.startX;
      const dy = e.clientY - gestureRef.current.startY;
      setPan({
        x: gestureRef.current.originPanX + dx,
        y: gestureRef.current.originPanY + dy,
      });
    }
  };

  const handleViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.delete(e.pointerId);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (activePointersRef.current.size === 0) {
      gestureRef.current.mode = 'idle';
      setIsPanning(false);
    } else if (activePointersRef.current.size === 1) {
      const [remaining] = Array.from(activePointersRef.current.values());
      setIsPanning(true);
      gestureRef.current = {
        ...gestureRef.current,
        mode: 'pan',
        startX: remaining.x,
        startY: remaining.y,
        originPanX: panRef.current.x,
        originPanY: panRef.current.y,
      };
    } else {
      initPinchBaseline();
    }
  };

  // Room Chat Join Handlers (Require non-empty "Your Name" before creating or joining a room)
  const attemptJoinWithCode = (candidateCode: string, focusOnMissingName = true) => {
    const cleanName = lobbyName.trim();
    if (!cleanName) {
      setNameError(true);
      if (focusOnMissingName) {
        nameInputRef.current?.focus();
      }
      return;
    }
    if (!/^\d{4}$/.test(candidateCode)) {
      setCodeError(true);
      const firstEmptyIdx = digits.findIndex((d) => !/^\d$/.test(d));
      digitRefs.current[Math.max(0, firstEmptyIdx)]?.focus();
      return;
    }

    setNameError(false);
    setCodeError(false);
    onJoinRoom(candidateCode, cleanName);
  };

  const handleCreateRandomRoom = () => {
    const cleanName = lobbyName.trim();
    if (!cleanName) {
      setNameError(true);
      nameInputRef.current?.focus();
      return;
    }
    setNameError(false);
    setCodeError(false);
    const randomCode = String(Math.floor(1000 + Math.random() * 9000));
    onJoinRoom(randomCode, cleanName);
  };

  const handleDigitChange = (idx: number, rawVal: string) => {
    // Clearing current box (e.g. Backspace/Delete): stay in the current box
    if (rawVal === '') {
      setDigits((prev) => {
        const next = [...prev] as [string, string, string, string];
        next[idx] = '';
        return next;
      });
      return;
    }

    const onlyDigits = rawVal.replace(/\D/g, '');
    // Ignore non-numeric keystrokes without moving focus
    if (!onlyDigits) {
      return;
    }

    const prevDigit = digits[idx];
    const cleanDigit =
      onlyDigits.length === 1
        ? onlyDigits
        : onlyDigits.startsWith(prevDigit) && prevDigit !== ''
        ? onlyDigits.slice(-1)
        : onlyDigits[0];

    const nextDigits = [...digits] as [string, string, string, string];
    nextDigits[idx] = cleanDigit;
    setDigits(nextDigits);
    setCodeError(false);

    // Only auto-advance to the next box when a single digit was entered in boxes 0..2
    if (cleanDigit && idx < 3) {
      digitRefs.current[idx + 1]?.focus();
      digitRefs.current[idx + 1]?.select();
      return;
    }

    // Only auto-join on the 4th box when all 4 digits are present and name is filled
    if (idx === 3 && nextDigits.every((d) => /^\d$/.test(d))) {
      if (lobbyName.trim()) {
        attemptJoinWithCode(nextDigits.join(''));
      } else {
        setNameError(true);
      }
    }
  };

  const handleDigitKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        e.preventDefault();
        const nextDigits = [...digits] as [string, string, string, string];
        nextDigits[idx] = '';
        setDigits(nextDigits);
      } else if (idx > 0) {
        e.preventDefault();
        const nextDigits = [...digits] as [string, string, string, string];
        nextDigits[idx - 1] = '';
        setDigits(nextDigits);
        digitRefs.current[idx - 1]?.focus();
      }
    } else if (e.key === 'Delete') {
      if (digits[idx]) {
        e.preventDefault();
        const nextDigits = [...digits] as [string, string, string, string];
        nextDigits[idx] = '';
        setDigits(nextDigits);
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      digitRefs.current[idx - 1]?.focus();
      digitRefs.current[idx - 1]?.select();
    } else if (e.key === 'ArrowRight' && idx < 3) {
      e.preventDefault();
      digitRefs.current[idx + 1]?.focus();
      digitRefs.current[idx + 1]?.select();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedDigits = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 4);
    if (!pastedDigits) return;
    e.preventDefault();
    setCodeError(false);
    const nextDigits: [string, string, string, string] = [
      pastedDigits[0] || '',
      pastedDigits[1] || '',
      pastedDigits[2] || '',
      pastedDigits[3] || '',
    ];
    setDigits(nextDigits);
    const focusIdx = Math.min(3, Math.max(0, pastedDigits.length - 1));
    digitRefs.current[focusIdx]?.focus();

    if (pastedDigits.length === 4 && lobbyName.trim()) {
      attemptJoinWithCode(pastedDigits);
    } else if (pastedDigits.length === 4 && !lobbyName.trim()) {
      setNameError(true);
    }
  };

  const handleLobbyFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = lobbyName.trim();
    if (!cleanName) {
      setNameError(true);
      nameInputRef.current?.focus();
      return;
    }
    onChangeSenderName(cleanName);
    const joinedDigits = digits.join('');
    if (/^\d{4}$/.test(joinedDigits)) {
      attemptJoinWithCode(joinedDigits);
    } else {
      const firstEmptyIdx = digits.findIndex((d) => !/^\d$/.test(d));
      digitRefs.current[Math.max(0, firstEmptyIdx)]?.focus();
      setCodeError(true);
    }
  };

  const submitChatMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = draftMessage.trim();
    if (!trimmed || !roomCode) return;
    setDraftMessage('');
    await onSendMessage(trimmed);
  };

  const submitAiPrompt = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = draftAiPrompt.trim();
    if (!trimmed || isAiChatLoading) return;
    setDraftAiPrompt('');
    await onSendAiChatMessage(trimmed);
  };

  const commitSenderEdit = () => {
    setIsEditingSender(false);
    const cleaned = draftSender.trim().slice(0, 24);
    if (cleaned) {
      onChangeSenderName(cleaned);
    } else {
      setDraftSender(senderName);
    }
  };

  const popoverHeightStyle = keyboardSafeMaxHeight
    ? `min(396px, 62dvh, ${keyboardSafeMaxHeight}px)`
    : 'min(396px, 62dvh)';

  const shortModelLabel = activeModelName.split('/').pop() || activeModelName;

  return (
    <div className="pointer-events-none absolute right-[10px] top-[10px] z-30 flex flex-col items-end select-none">
      {/* Hidden multi-file picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const list = e.target.files ? Array.from(e.target.files) : [];
          if (list.length > 0) {
            void handleFilesAdded(list);
          }
          e.target.value = '';
        }}
      />

      {/* Top Wrench Icon Button (pulses green when unread chat messages arrive) */}
      <button
        ref={wrenchBtnRef}
        type="button"
        onClick={onToggleWrench}
        aria-label="Graph Settings"
        aria-expanded={isWrenchOpen}
        className={`touch-manipulation pointer-events-auto flex h-[36px] w-[36px] items-center justify-center rounded-[5px] border shadow-[0_1px_4px_rgba(0,0,0,0.12)] transition-colors ${
          hasUnreadChat
            ? 'wrench-unread-blink'
            : isWrenchOpen
            ? 'border-[#9e9e9e] bg-[#ebebeb] text-[#222222]'
            : 'border-[#c4c4c4] bg-white text-[#666666] hover:border-[#a8a8a8] hover:text-[#222222]'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M14.7 6.3a4.5 4.5 0 0 0-5.94 5.94l-5.06 5.06a1.7 1.7 0 0 0 2.4 2.4l5.06-5.06a4.5 4.5 0 0 0 5.94-5.94l-2.6 2.6-2.4-2.4 2.6-2.6Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Stacked + / - Zoom Controls wired to Desmos API */}
      <div className="pointer-events-auto mt-2 flex w-[36px] flex-col overflow-hidden rounded-[5px] border border-[#c4c4c4] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]">
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom In"
          className="touch-manipulation flex h-[36px] w-full items-center justify-center border-b border-[#e2e2e2] text-[#666666] hover:bg-[#f7f7f7] hover:text-[#222222] active:bg-[#ececec] transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom Out"
          className="touch-manipulation flex h-[36px] w-full items-center justify-center text-[#666666] hover:bg-[#f7f7f7] hover:text-[#222222] active:bg-[#ececec] transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8H13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Desmos Default Viewport (Home) Button when zoomed/panned */}
      {showHomeButton && (
        <button
          type="button"
          onClick={onResetZoom}
          aria-label="Default Zoom"
          className="touch-manipulation pointer-events-auto mt-2 flex h-[36px] w-[36px] items-center justify-center rounded-[5px] border border-[#c4c4c4] bg-white text-[#666666] shadow-[0_1px_4px_rgba(0,0,0,0.12)] hover:border-[#a8a8a8] hover:text-[#222222] active:bg-[#ececec] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M2.5 8.5L9 3L15.5 8.5"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4.5 7.5V14.5H13.5V7.5"
              stroke="currentColor"
              strokeWidth="1.65"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {/* Responsive Tablet-Safe Popover: width min(320px, 84vw), height min(396px, 62dvh) + visualViewport safe */}
      {isWrenchOpen && (
        <div
          ref={popoverRef}
          style={{
            width: 'min(320px, 84vw)',
            height: popoverHeightStyle,
          }}
          onDragEnter={(e) => {
            if (popoverView !== 'image') return;
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(true);
          }}
          onDragOver={(e) => {
            if (popoverView !== 'image') return;
            e.preventDefault();
            e.stopPropagation();
            if (!isDraggingOver) setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            if (popoverView !== 'image') return;
            e.preventDefault();
            e.stopPropagation();
            if (e.currentTarget === e.target) {
              setIsDraggingOver(false);
            }
          }}
          onDrop={(e) => {
            if (popoverView !== 'image') return;
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
            const droppedFiles = e.dataTransfer.files
              ? Array.from(e.dataTransfer.files)
              : [];
            if (droppedFiles.length > 0) {
              void handleFilesAdded(droppedFiles);
            }
          }}
          className="pointer-events-auto absolute right-[46px] top-0 max-h-[420px] max-w-[calc(100dvw-56px)]"
        >
          {/* Right-pointing Desmos popover pointer arrow */}
          <div
            aria-hidden="true"
            className="absolute -right-[5.5px] top-[12px] z-20 h-[11px] w-[11px] rotate-45 border-r border-t border-[#bebebe] bg-white"
          />

          {/* Strictly bounded outer box */}
          <div
            className={`relative z-10 flex h-full w-full flex-col overflow-hidden rounded-[5px] border bg-white shadow-[0_2px_12px_rgba(0,0,0,0.18)] ${
              isDraggingOver && popoverView === 'image'
                ? 'border-[#4d88cc] ring-1 ring-[#4d88cc]'
                : 'border-[#bebebe]'
            }`}
          >
            {/* ==================== VIEW 1: IMAGE VIEWER ==================== */}
            {popoverView === 'image' && (
              <div
                ref={viewportRef}
                onPointerDown={handleViewportPointerDown}
                onPointerMove={handleViewportPointerMove}
                onPointerUp={handleViewportPointerUp}
                onPointerCancel={handleViewportPointerUp}
                onDoubleClick={() => {
                  if (!currentImage) return;
                  if (Math.abs(zoom - 1) > 0.05 || pan.x !== 0 || pan.y !== 0) {
                    resetImageTransform();
                  } else {
                    setZoom(2.4);
                  }
                }}
                className={`relative min-h-0 flex-1 overflow-hidden bg-[#f9f9f9] touch-none ${
                  currentImage
                    ? isPanning
                      ? 'cursor-grabbing'
                      : 'cursor-grab'
                    : 'cursor-default'
                }`}
              >
                {currentImage && objectUrl ? (
                  <>
                    <div
                      className="flex h-full w-full items-center justify-center will-change-transform"
                      style={{
                        transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
                        transformOrigin: 'center center',
                      }}
                    >
                      <img
                        src={objectUrl}
                        alt=""
                        draggable={false}
                        className="pointer-events-none max-h-full max-w-full object-contain select-none"
                      />
                    </div>

                    <div
                      onPointerDown={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      className="absolute bottom-2 right-2 z-20 flex items-center overflow-hidden rounded-[4px] border border-[#d6d6d6] bg-white/90 text-[11px] text-[#555555] shadow-sm backdrop-blur-[1px]"
                    >
                      <button
                        type="button"
                        onClick={() => stepZoom(1 / 1.25)}
                        aria-label="Zoom image out"
                        className="touch-manipulation flex h-[22px] w-[22px] items-center justify-center hover:bg-black/5 hover:text-[#111]"
                      >
                        −
                      </button>
                      <button
                        type="button"
                        onClick={resetImageTransform}
                        aria-label="Reset image zoom"
                        className="touch-manipulation h-[22px] border-x border-[#e2e2e2] px-1.5 font-mono text-[10px] text-[#666666] hover:bg-black/5 hover:text-[#111]"
                      >
                        {Math.round(zoom * 100)}%
                      </button>
                      <button
                        type="button"
                        onClick={() => stepZoom(1.25)}
                        aria-label="Zoom image in"
                        className="touch-manipulation flex h-[22px] w-[22px] items-center justify-center hover:bg-black/5 hover:text-[#111]"
                      >
                        +
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="touch-manipulation flex flex-col items-center gap-2 rounded-[5px] border border-dashed border-[#cccccc] bg-white px-4 py-3.5 text-[#666666] hover:border-[#999999] hover:text-[#333333] transition-colors"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        className="text-[#888888]"
                      >
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="16"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.6"
                        />
                        <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
                        <path
                          d="M21 15L16 10L6 20"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-[12px] font-medium text-[#555555]">
                        Select, drop, or paste images
                      </span>
                      <span className="text-[10.5px] text-[#909090]">
                        ⌘V / Ctrl+V · Pinch to zoom
                      </span>
                    </button>
                  </div>
                )}

                {isDraggingOver && (
                  <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-white/80 text-[12px] font-medium text-[#2d70b3]">
                    Drop images to append
                  </div>
                )}
              </div>
            )}

            {/* ==================== VIEW 2: SUPABASE ROOM CHAT ==================== */}
            {popoverView === 'chat' && (
              <div className="relative flex min-h-0 flex-1 flex-col bg-[#fafafa]">
                {!roomCode ? (
                  /* Room Join Screen: Top-left '+' button + Required "Your Name" input + 4-digit Room Code */
                  <div className="desmos-scrollbar relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-3">
                    <button
                      type="button"
                      onClick={handleCreateRandomRoom}
                      aria-label="Create group room"
                      className="touch-manipulation absolute left-2.5 top-2.5 flex h-[28px] w-[28px] items-center justify-center rounded-[4px] border border-[#d2d2d2] bg-white text-[#555555] shadow-[0_1px_2px_rgba(0,0,0,0.06)] hover:border-[#a8a8a8] hover:text-[#111111] active:bg-[#f2f2f2] transition-colors"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M7 2V12M2 7H12"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>

                    <form
                      onSubmit={handleLobbyFormSubmit}
                      noValidate
                      className="w-full max-w-[232px] space-y-2.5"
                    >
                      {/* Required "Your Name" Field */}
                      <div>
                        <label
                          htmlFor={lobbyNameId}
                          className="mb-1 block text-left text-[11px] font-medium text-[#555555]"
                        >
                          Your Name <span aria-hidden="true" className="text-[#c74440]">*</span>
                        </label>
                        <input
                          id={lobbyNameId}
                          ref={nameInputRef}
                          name="senderName"
                          type="text"
                          required
                          maxLength={24}
                          autoComplete="nickname"
                          value={lobbyName}
                          aria-invalid={nameError ? 'true' : undefined}
                          aria-describedby={nameError || codeError ? lobbyErrorId : undefined}
                          placeholder="Enter your name"
                          onChange={(e) => {
                            const val = e.target.value;
                            setLobbyName(val);
                            if (val.trim()) {
                              setNameError(false);
                            }
                          }}
                          onBlur={() => {
                            const clean = lobbyName.trim();
                            if (clean) onChangeSenderName(clean);
                          }}
                          className={`h-[32px] w-full rounded-[4px] border bg-white px-2.5 text-[16px] sm:text-[12.5px] text-[#2b2b2b] placeholder:text-[#9c9c9c] outline-none transition-colors ${
                            nameError
                              ? 'border-[#c74440] focus:border-[#c74440]'
                              : 'border-[#c8c8c8] focus:border-[#4d88cc] focus:ring-1 focus:ring-[#4d88cc]'
                          }`}
                        />
                      </div>

                      {/* 4-Digit Room Code + Join Button */}
                      <div>
                        <span className="mb-1 block text-left text-[11px] font-medium text-[#555555]">
                          Room Code
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1.5">
                            {[0, 1, 2, 3].map((idx) => (
                              <input
                                key={idx}
                                ref={(el) => {
                                  digitRefs.current[idx] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                maxLength={2}
                                value={digits[idx]}
                                aria-label={`Room code digit ${idx + 1}`}
                                onFocus={(e) => e.currentTarget.select()}
                                onChange={(e) => handleDigitChange(idx, e.target.value)}
                                onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                                onPaste={handleDigitPaste}
                                className={`h-[36px] w-[36px] rounded-[5px] border bg-white text-center font-mono text-[16px] font-medium text-[#2b2b2b] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none ${
                                  codeError
                                    ? 'border-[#c74440]'
                                    : 'border-[#c8c8c8] focus:border-[#4d88cc] focus:ring-1 focus:ring-[#4d88cc]'
                                }`}
                              />
                            ))}
                          </div>

                          <button
                            type="submit"
                            className="touch-manipulation ml-auto h-[36px] rounded-[4px] border border-[#c4c4c4] bg-[#f4f4f4] px-2.5 text-[11.5px] font-medium text-[#333333] hover:bg-[#eaeaea] active:bg-[#e0e0e0] transition-colors"
                          >
                            Join
                          </button>
                        </div>
                      </div>

                      {(nameError || codeError) && (
                        <p
                          id={lobbyErrorId}
                          role="status"
                          aria-live="polite"
                          className="text-left text-[10.5px] text-[#c74440]"
                        >
                          {nameError
                            ? 'Please enter your name before joining a room.'
                            : 'Enter a 4-digit room code or click + to create one.'}
                        </p>
                      )}
                    </form>
                  </div>
                ) : (
                  /* Active Chat Room Screen (persisted 2 hours in Supabase `room_messages`) */
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex h-[30px] shrink-0 items-center justify-between border-b border-[#e5e5e5] bg-[#f5f5f5] px-2">
                      <button
                        type="button"
                        onClick={onLeaveRoom}
                        aria-label="Leave room"
                        className="touch-manipulation flex h-[22px] w-[22px] items-center justify-center rounded text-[#666666] hover:bg-black/5 hover:text-[#222222]"
                      >
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M11.5 7H2.5M6 3.5L2.5 7L6 10.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(roomCode);
                          setCopiedCodeFeedback(true);
                          window.setTimeout(() => setCopiedCodeFeedback(false), 1100);
                        }}
                        aria-label={`Room code ${roomCode}`}
                        className="touch-manipulation flex items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[11.5px] font-medium text-[#4a4a4a] hover:bg-black/5"
                      >
                        <span
                          aria-hidden="true"
                          className={`h-[6px] w-[6px] rounded-full ${
                            isChatConnected ? 'bg-[#2d914d]' : 'bg-[#b0b0b0]'
                          }`}
                        />
                        <span>{copiedCodeFeedback ? 'Copied' : roomCode}</span>
                      </button>

                      {isEditingSender ? (
                        <input
                          type="text"
                          value={draftSender}
                          maxLength={24}
                          autoFocus
                          aria-label="Sender display label"
                          onChange={(e) => setDraftSender(e.target.value)}
                          onBlur={commitSenderEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitSenderEdit();
                            if (e.key === 'Escape') {
                              setDraftSender(senderName);
                              setIsEditingSender(false);
                            }
                          }}
                          className="h-[21px] w-[76px] rounded border border-[#4d88cc] bg-white px-1 text-right text-[10.5px] text-[#333333] outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftSender(senderName);
                            setIsEditingSender(true);
                          }}
                          aria-label="Edit sender label"
                          className="touch-manipulation max-w-[84px] truncate rounded px-1 py-0.5 text-[10.5px] font-medium text-[#555555] hover:bg-black/5 hover:text-[#222222]"
                        >
                          {senderName}
                        </button>
                      )}
                    </div>

                    {/* Message Feed: Sender's name displayed clearly above each bubble; distinct self vs others */}
                    <div className="desmos-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#fbfbfb] px-2.5 py-2 select-text">
                      {messages.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-[11px] text-[#9a9a9a]">
                          No messages in the last 2 hours
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isSelf =
                            msg.sender_name.trim().toLowerCase() ===
                            senderName.trim().toLowerCase();
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${
                                isSelf ? 'items-end' : 'items-start'
                              }`}
                            >
                              <div className="mb-0.5 flex items-center gap-1.5 px-0.5 text-[10px]">
                                <span
                                  className={
                                    isSelf
                                      ? 'font-medium text-[#3b6ca6]'
                                      : 'font-semibold text-[#4a4a4a]'
                                  }
                                >
                                  {msg.sender_name}
                                </span>
                                <span className="text-[#949494]">
                                  {formatTimeShort(msg.created_at)}
                                </span>
                              </div>
                              <div
                                className={`max-w-[86%] rounded-[5px] border px-2.5 py-1 text-[12px] leading-[1.38] whitespace-pre-wrap break-words ${
                                  isSelf
                                    ? 'border-[#cbd8ea] bg-[#edf3fa] text-[#1f2937]'
                                    : 'border-[#dcdcdc] bg-white text-[#2b2b2b]'
                                }`}
                              >
                                {msg.content}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    <form
                      onSubmit={(e) => void submitChatMessage(e)}
                      className="flex shrink-0 items-center gap-1 border-t border-[#e5e5e5] bg-white px-2 py-1.5"
                    >
                      <input
                        type="text"
                        value={draftMessage}
                        onChange={(e) => setDraftMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' &&
                            !e.nativeEvent.isComposing &&
                            e.nativeEvent.keyCode !== 229
                          ) {
                            e.preventDefault();
                            void submitChatMessage();
                          }
                        }}
                        placeholder="Message..."
                        aria-label="Chat message"
                        className="h-[28px] min-w-0 flex-1 rounded-[4px] border border-[#d4d4d4] bg-[#fafafa] px-2 text-[16px] sm:text-[12px] text-[#2b2b2b] placeholder:text-[#999999] focus:border-[#4d88cc] focus:bg-white outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!draftMessage.trim()}
                        aria-label="Send message"
                        className="touch-manipulation flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[4px] border border-[#d4d4d4] bg-[#f5f5f5] text-[#555555] enabled:hover:bg-[#eaeaea] enabled:hover:text-[#111111] disabled:opacity-35 transition-colors"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 14 14"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M2 7H12M8 3L12 7L8 11"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ==================== VIEW 3: DEDICATED AI CHAT VIEW ==================== */}
            {popoverView === 'ai' && (
              <div className="flex min-h-0 flex-1 flex-col bg-[#fafafa]">
                <div className="flex h-[30px] shrink-0 items-center justify-between border-b border-[#e5e5e5] bg-[#f5f5f5] px-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onChangePopoverView('image')}
                      aria-label="Back to image view"
                      className="touch-manipulation flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded text-[#666666] hover:bg-black/5 hover:text-[#222222]"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M11.5 7H2.5M6 3.5L2.5 7L6 10.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <span className="truncate text-[11px] font-medium text-[#555555]">
                      Step-by-Step
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={aiTurns.length === 0 && !isAiChatLoading}
                    onClick={onClearAiChat}
                    aria-label="Clear AI conversation"
                    className="touch-manipulation rounded px-1.5 py-0.5 text-[10.5px] font-medium text-[#6b6b6b] enabled:hover:bg-black/5 enabled:hover:text-[#222222] disabled:opacity-35 transition-colors"
                  >
                    Clear
                  </button>
                </div>

                <div className="desmos-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto bg-[#fbfbfb] px-2.5 py-2 select-text">
                  {aiTurns.length === 0 && !isAiChatLoading ? (
                    <div className="flex h-full flex-col items-center justify-center px-4 text-center text-[#8e8e8e]">
                      <span className="mb-1 text-[#999999]">
                        <SparkleIcon />
                      </span>
                      <p className="text-[11.5px] leading-[1.4] text-[#777777]">
                        Ask an open-ended or step-by-step question
                      </p>
                      <p className="mt-0.5 max-w-full truncate font-mono text-[10px] text-[#9c9c9c]">
                        {shortModelLabel}
                      </p>
                    </div>
                  ) : (
                    <>
                      {aiTurns.map((turn) => {
                        const isUser = turn.role === 'user';
                        return (
                          <div
                            key={turn.id}
                            className={`flex flex-col ${
                              isUser ? 'items-end' : 'items-start'
                            }`}
                          >
                            {isUser ? (
                              <div className="max-w-[88%] rounded-[5px] border border-[#cbd8ea] bg-[#edf3fa] px-2.5 py-1.5 text-[12px] leading-[1.4] text-[#1f2937] whitespace-pre-wrap break-words">
                                {turn.content}
                              </div>
                            ) : (
                              <div
                                className={`desmos-ai-chat-render max-w-[94%] rounded-[5px] border px-2.5 py-1.5 text-[12px] leading-[1.46] whitespace-pre-wrap break-words ${
                                  turn.isError
                                    ? 'border-[#e0c8c8] bg-[#fcf6f6] text-[#664444]'
                                    : 'border-[#e0e0e0] bg-white text-[#2b2b2b]'
                                }`}
                                dangerouslySetInnerHTML={{
                                  __html: renderRichAiMessageHtml(turn.content),
                                }}
                              />
                            )}
                          </div>
                        );
                      })}

                      {isAiChatLoading && (
                        <div className="flex items-start" role="status" aria-live="polite">
                          <div className="inline-flex items-center gap-1 rounded-[5px] border border-[#e0e0e0] bg-white px-2.5 py-1.5 text-[11.5px] text-[#777777]">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#888888]" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#888888] [animation-delay:160ms]" />
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#888888] [animation-delay:320ms]" />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <div ref={aiMessagesEndRef} />
                </div>

                <form
                  ref={aiFormRef}
                  onSubmit={(e) => void submitAiPrompt(e)}
                  className="flex shrink-0 items-end gap-1 border-t border-[#e5e5e5] bg-white px-2 py-1.5"
                >
                  <label htmlFor={aiInputId} className="sr-only">
                    Ask AI step-by-step question
                  </label>
                  <textarea
                    id={aiInputId}
                    rows={1}
                    value={draftAiPrompt}
                    onChange={(e) => setDraftAiPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
                          return;
                        }
                        aiFormRef.current?.requestSubmit();
                      }
                    }}
                    placeholder="Ask step-by-step..."
                    className="desmos-autoresize-textarea desmos-scrollbar min-w-0 flex-1 resize-none rounded-[4px] border border-[#d4d4d4] bg-[#fafafa] px-2 py-1 text-[16px] sm:text-[12px] leading-[1.35] text-[#2b2b2b] placeholder:text-[#999999] focus:border-[#4d88cc] focus:bg-white outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!draftAiPrompt.trim() || isAiChatLoading}
                    aria-label="Send AI question"
                    className="touch-manipulation flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[4px] border border-[#d4d4d4] bg-[#f5f5f5] text-[#555555] enabled:hover:bg-[#eaeaea] enabled:hover:text-[#111111] disabled:opacity-35 transition-colors"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 7H12M8 3L12 7L8 11"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </form>
              </div>
            )}

            {/* ==================== LOW-PROFILE FOOTER TOOLBAR ==================== */}
            <div className="flex h-[32px] shrink-0 items-center justify-between border-t border-[#e4e4e4] bg-[#f6f6f6] px-2 text-[11.5px] text-[#555555]">
              {popoverView === 'image' ? (
                <>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={images.length <= 1}
                      onClick={() =>
                        setCurrentIndex((i) => (i > 0 ? i - 1 : images.length - 1))
                      }
                      aria-label="Previous image"
                      className="touch-manipulation flex h-[22px] w-[22px] items-center justify-center rounded hover:bg-black/5 hover:text-[#222] disabled:opacity-30"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M7.5 2.5L4 6L7.5 9.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>

                    <span className="min-w-[44px] text-center font-mono text-[11px] text-[#666666]">
                      {images.length === 0
                        ? '0 / 0'
                        : `${currentIndex + 1} / ${images.length}`}
                    </span>

                    <button
                      type="button"
                      disabled={images.length <= 1}
                      onClick={() =>
                        setCurrentIndex((i) => (i < images.length - 1 ? i + 1 : 0))
                      }
                      aria-label="Next image"
                      className="touch-manipulation flex h-[22px] w-[22px] items-center justify-center rounded hover:bg-black/5 hover:text-[#222] disabled:opacity-30"
                    >
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M4.5 2.5L8 6L4.5 9.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onChangePopoverView('ai')}
                      aria-label="Toggle AI chat view"
                      className="touch-manipulation flex h-[22px] w-[22px] items-center justify-center rounded text-[#6b6b6b] hover:bg-black/5 hover:text-[#222222] transition-colors"
                    >
                      <SparkleIcon />
                    </button>

                    <button
                      type="button"
                      onClick={() => onChangePopoverView('chat')}
                      aria-label="Toggle chat view"
                      className="touch-manipulation relative flex h-[22px] w-[22px] items-center justify-center rounded text-[#6b6b6b] hover:bg-black/5 hover:text-[#222222] transition-colors"
                    >
                      <ChatBubbleIcon />
                      {hasUnreadChat && (
                        <span
                          aria-hidden="true"
                          className="absolute right-0.5 top-0.5 h-[5px] w-[5px] rounded-full bg-[#22c55e]"
                        />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Add images"
                      className="touch-manipulation flex h-[22px] w-[22px] items-center justify-center rounded text-[#555555] hover:bg-black/5 hover:text-[#111]"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M7 2.2V11.8M2.2 7H11.8"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>

                    <button
                      type="button"
                      disabled={!currentImage}
                      onClick={() => {
                        if (currentImage) {
                          void onDeleteImage(currentImage.id);
                        }
                      }}
                      aria-label="Delete current image"
                      className="touch-manipulation flex h-[22px] w-[22px] items-center justify-center rounded text-[#777777] enabled:hover:bg-[#c74440]/10 enabled:hover:text-[#c74440] disabled:opacity-30 transition-colors"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 14 14"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2.5 3.8H11.5M5.3 3.8V2.6C5.3 2.27 5.57 2 5.9 2H8.1C8.43 2 8.7 2.27 8.7 2.6V3.8M3.6 3.8L4.1 11.4C4.13 11.75 4.42 12 4.77 12H9.23C9.58 12 9.87 11.75 9.9 11.4L10.4 3.8"
                          stroke="currentColor"
                          strokeWidth="1.35"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="truncate px-1 text-[10.5px] text-[#8a8a8a]">
                    {popoverView === 'chat'
                      ? roomCode
                        ? `Room ${roomCode}`
                        : 'Group sync'
                      : shortModelLabel}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        onChangePopoverView(popoverView === 'ai' ? 'image' : 'ai')
                      }
                      aria-label="Toggle AI chat view"
                      className={`touch-manipulation flex h-[22px] w-[22px] items-center justify-center rounded transition-colors ${
                        popoverView === 'ai'
                          ? 'bg-black/10 text-[#222222] hover:bg-black/15'
                          : 'text-[#6b6b6b] hover:bg-black/5 hover:text-[#222222]'
                      }`}
                    >
                      <SparkleIcon />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onChangePopoverView(popoverView === 'chat' ? 'image' : 'chat')
                      }
                      aria-label="Toggle chat view"
                      className={`touch-manipulation relative flex h-[22px] w-[22px] items-center justify-center rounded transition-colors ${
                        popoverView === 'chat'
                          ? 'bg-black/10 text-[#222222] hover:bg-black/15'
                          : 'text-[#6b6b6b] hover:bg-black/5 hover:text-[#222222]'
                      }`}
                    >
                      <ChatBubbleIcon />
                      {hasUnreadChat && popoverView !== 'chat' && (
                        <span
                          aria-hidden="true"
                          className="absolute right-0.5 top-0.5 h-[5px] w-[5px] rounded-full bg-[#22c55e]"
                        />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
