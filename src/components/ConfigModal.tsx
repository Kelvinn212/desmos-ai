import React, { useEffect, useId, useRef, useState } from 'react';
import { AppSettings, StoredImage } from '../types';
import {
  DEFAULT_DECOY_EQUATIONS,
  DEFAULT_SYSTEM_PROMPT,
} from '../services/storage';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (next: AppSettings) => void;
  images: StoredImage[];
  onAddImageFiles: (files: File[]) => Promise<number>;
  onDeleteImage: (id: string) => Promise<void>;
  onWipeAllImages: () => Promise<void>;
}

const ImageThumb: React.FC<{ item: StoredImage; onDelete: () => void }> = ({
  item,
  onDelete,
}) => {
  const [url, setUrl] = useState<string>('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(item.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [item.blob]);

  return (
    <div className="group relative h-[56px] w-[56px] shrink-0 overflow-hidden rounded-[4px] border border-[#d6d6d6] bg-[#f7f7f7]">
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Remove ${item.name}`}
        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded bg-black/65 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </div>
  );
};

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  images,
  onAddImageFiles,
  onDeleteImage,
  onWipeAllImages,
}) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();

  const [draft, setDraft] = useState<AppSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...settings,
        decoyEquations: [...settings.decoyEquations],
      });
      setConfirmWipe(false);
    }
  }, [isOpen, settings]);

  // Open/close native <dialog> via showModal() + Safari light-dismiss fallback per modern-web-guidance
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleNativeClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    dialog.addEventListener('close', handleNativeClose);

    // Fallback for browsers without <dialog closedby="any"> support (e.g. Safari)
    let cleanupBackdropFallback: (() => void) | undefined;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        if (e.target === dialog) {
          pressedOutside = outside(e);
        } else {
          pressedOutside = false;
        }
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && e.target === dialog && outside(e)) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);
      cleanupBackdropFallback = () => {
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleNativeClose);
      cleanupBackdropFallback?.();
    };
  }, [onClose]);

  const totalBytes = images.reduce((acc, item) => acc + item.blob.size, 0);
  const formattedSize =
    totalBytes < 1024 * 1024
      ? `${(totalBytes / 1024).toFixed(1)} KB`
      : `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedDecoys = draft.decoyEquations
      .map((eq) => eq.trim())
      .filter((eq) => eq.length > 0);

    onSaveSettings({
      ...draft,
      prefixChar: draft.prefixChar.trim() || '?',
      systemPrompt: draft.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
      decoyEquations:
        cleanedDecoys.length > 0 ? cleanedDecoys : [...DEFAULT_DECOY_EQUATIONS],
    });
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      aria-labelledby={titleId}
      className="m-auto w-[92vw] max-w-[520px] rounded-[6px] border border-[#c8c8c8] bg-white p-0 text-[#333333] shadow-[0_10px_32px_rgba(0,0,0,0.24)] outline-none open:flex open:flex-col max-h-[88vh]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e4e4e4] bg-[#f7f7f7] px-4 py-3">
        <h1 id={titleId} className="text-[14.5px] font-semibold text-[#2b2b2b]">
          Calculator Preferences
        </h1>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close preferences"
          className="flex h-6 w-6 items-center justify-center rounded text-[#888888] hover:bg-black/5 hover:text-[#222222]"
        >
          ×
        </button>
      </div>

      {/* Scrollable Body */}
      <form onSubmit={handleSave} className="desmos-scrollbar flex-1 overflow-y-auto px-4 py-3.5 space-y-4 text-[13px]">
        {/* Section 1: AI Provider & Credentials */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#666666]">
              Inline Evaluation Engine
            </h2>
            <div className="flex rounded-[4px] border border-[#d0d0d0] bg-[#f3f3f3] p-0.5 text-[12px]">
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    provider: 'gemini',
                    model:
                      d.provider === 'gemini' ? d.model : 'gemini-2.5-flash',
                  }))
                }
                className={`rounded-[3px] px-2.5 py-0.5 font-medium transition-colors ${
                  draft.provider === 'gemini'
                    ? 'bg-white text-[#222222] shadow-sm'
                    : 'text-[#666666] hover:text-[#222222]'
                }`}
              >
                Gemini API
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    provider: 'openai',
                    model: d.provider === 'openai' ? d.model : 'gpt-4o-mini',
                  }))
                }
                className={`rounded-[3px] px-2.5 py-0.5 font-medium transition-colors ${
                  draft.provider === 'openai'
                    ? 'bg-white text-[#222222] shadow-sm'
                    : 'text-[#666666] hover:text-[#222222]'
                }`}
              >
                OpenAI-Compatible
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[12px] font-medium text-[#555555]">
                API Key
              </label>
              <div className="relative flex items-center">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={draft.apiKey}
                  onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
                  placeholder={
                    draft.provider === 'gemini' ? 'AIzaSy... or AQ....' : 'sk-...'
                  }
                  autoFocus
                  className="h-[32px] w-full rounded-[4px] border border-[#cccccc] bg-white px-2.5 pr-14 font-mono text-[12.5px] text-[#222222] focus:border-[#4d88cc] outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((s) => !s)}
                  className="absolute right-2 text-[11px] font-medium text-[#666666] hover:text-[#222222]"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#555555]">
                Model Name
              </label>
              <input
                type="text"
                value={draft.model}
                onChange={(e) => setDraft((d) => ({ ...d, model: e.target.value }))}
                placeholder={
                  draft.provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini'
                }
                className="h-[32px] w-full rounded-[4px] border border-[#cccccc] bg-white px-2.5 font-mono text-[12.5px] text-[#222222] focus:border-[#4d88cc] outline-none"
              />
            </div>

            {draft.provider === 'openai' ? (
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#555555]">
                  Endpoint Base URL
                </label>
                <input
                  type="text"
                  value={draft.openaiBaseUrl}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, openaiBaseUrl: e.target.value }))
                  }
                  placeholder="https://api.openai.com/v1"
                  className="h-[32px] w-full rounded-[4px] border border-[#cccccc] bg-white px-2.5 font-mono text-[12px] text-[#222222] focus:border-[#4d88cc] outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#555555]">
                  Trigger Mode
                </label>
                <select
                  value={draft.triggerMode}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      triggerMode: e.target.value as 'auto' | 'prefix',
                    }))
                  }
                  className="h-[32px] w-full rounded-[4px] border border-[#cccccc] bg-white px-2 text-[12.5px] text-[#222222] focus:border-[#4d88cc] outline-none"
                >
                  <option value="auto">Auto-detect + Prefix ({draft.prefixChar || '?'})</option>
                  <option value="prefix">Explicit Prefix Only ({draft.prefixChar || '?'})</option>
                </select>
              </div>
            )}
          </div>

          {draft.provider === 'openai' && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#555555]">
                  Trigger Mode
                </label>
                <select
                  value={draft.triggerMode}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      triggerMode: e.target.value as 'auto' | 'prefix',
                    }))
                  }
                  className="h-[32px] w-full rounded-[4px] border border-[#cccccc] bg-white px-2 text-[12.5px] text-[#222222] focus:border-[#4d88cc] outline-none"
                >
                  <option value="auto">Auto-detect + Prefix ({draft.prefixChar || '?'})</option>
                  <option value="prefix">Explicit Prefix Only ({draft.prefixChar || '?'})</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#555555]">
                  Prefix Character
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={draft.prefixChar}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, prefixChar: e.target.value }))
                  }
                  className="h-[32px] w-full rounded-[4px] border border-[#cccccc] bg-white px-2.5 font-mono text-[12.5px] text-[#222222] focus:border-[#4d88cc] outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[12px] font-medium text-[#555555]">
                System Instruction
              </label>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({ ...d, systemPrompt: DEFAULT_SYSTEM_PROMPT }))
                }
                className="text-[11px] text-[#2d70b3] hover:underline"
              >
                Reset Default
              </button>
            </div>
            <textarea
              rows={2}
              value={draft.systemPrompt}
              onChange={(e) =>
                setDraft((d) => ({ ...d, systemPrompt: e.target.value }))
              }
              className="w-full rounded-[4px] border border-[#cccccc] bg-white p-2 text-[12px] leading-[1.4] text-[#222222] focus:border-[#4d88cc] outline-none"
            />
          </div>
        </section>

        <hr className="border-[#eaeaea]" />

        {/* Section 2: Pre-Saved Decoy Equations (Panic Mode) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#666666]">
                Decoy Equations (Double-Tap Shift / ?)
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    decoyEquations: [...DEFAULT_DECOY_EQUATIONS],
                  }))
                }
                className="text-[11px] text-[#666666] hover:text-[#222222]"
              >
                Restore Defaults
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    decoyEquations: [...d.decoyEquations, ''],
                  }))
                }
                className="rounded-[3px] border border-[#cccccc] bg-[#f7f7f7] px-2 py-0.5 text-[11.5px] font-medium text-[#333333] hover:bg-[#eeeeee]"
              >
                + Add
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {draft.decoyEquations.map((eq, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-5 text-right font-mono text-[11px] text-[#888888]">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={eq}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraft((d) => {
                      const next = [...d.decoyEquations];
                      next[idx] = val;
                      return { ...d, decoyEquations: next };
                    });
                  }}
                  placeholder="y = x^2"
                  className="h-[30px] flex-1 rounded-[4px] border border-[#cccccc] bg-white px-2.5 font-math text-[14.5px] text-[#222222] focus:border-[#4d88cc] outline-none"
                />
                <button
                  type="button"
                  disabled={draft.decoyEquations.length <= 1}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      decoyEquations: d.decoyEquations.filter((_, i) => i !== idx),
                    }))
                  }
                  aria-label={`Remove decoy equation ${idx + 1}`}
                  className="flex h-[28px] w-[28px] items-center justify-center rounded text-[#888888] enabled:hover:bg-black/5 enabled:hover:text-[#c74440] disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>

        <hr className="border-[#eaeaea]" />

        {/* Section 3: IndexedDB Image Storage Management */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#666666]">
              Local Image Cache ({images.length} stored · {formattedSize})
            </h2>

            <div className="flex items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length > 0) {
                    void onAddImageFiles(files);
                  }
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-[3px] border border-[#cccccc] bg-[#f7f7f7] px-2 py-0.5 text-[11.5px] font-medium text-[#333333] hover:bg-[#eeeeee]"
              >
                + Upload
              </button>

              {images.length > 0 && (
                confirmWipe ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmWipe(false)}
                      className="rounded-[3px] border border-[#cccccc] bg-white px-2 py-0.5 text-[11px] text-[#555555]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void onWipeAllImages();
                        setConfirmWipe(false);
                      }}
                      className="rounded-[3px] bg-[#c74440] px-2 py-0.5 text-[11px] font-medium text-white hover:bg-[#b33834]"
                    >
                      Confirm Wipe
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(true)}
                    className="rounded-[3px] border border-[#e3bcbc] bg-[#fdf4f4] px-2 py-0.5 text-[11.5px] font-medium text-[#c74440] hover:bg-[#fae6e6]"
                  >
                    Wipe All
                  </button>
                )
              )}
            </div>
          </div>

          {images.length > 0 ? (
            <div className="desmos-scrollbar flex items-center gap-2 overflow-x-auto py-1">
              {images.map((img) => (
                <ImageThumb
                  key={img.id}
                  item={img}
                  onDelete={() => void onDeleteImage(img.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-[#888888]">
              No images currently stored in IndexedDB. Use the Wrench popover or + Upload to add pages.
            </p>
          )}
        </section>

        <hr className="border-[#eaeaea]" />

        {/* Section 4: Supabase Realtime Chat Configuration */}
        <section className="space-y-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#666666]">
            Realtime Room Sync (Supabase)
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#555555]">
                Supabase URL
              </label>
              <input
                type="text"
                value={draft.supabaseUrl}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, supabaseUrl: e.target.value }))
                }
                placeholder="https://xyz.supabase.co"
                className="h-[30px] w-full rounded-[4px] border border-[#cccccc] bg-white px-2.5 font-mono text-[11.5px] text-[#222222] focus:border-[#4d88cc] outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[12px] font-medium text-[#555555]">
                Supabase Anon / Publishable Key
              </label>
              <input
                type="password"
                value={draft.supabaseAnonKey}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, supabaseAnonKey: e.target.value }))
                }
                placeholder="sb_publishable_..."
                className="h-[30px] w-full rounded-[4px] border border-[#cccccc] bg-white px-2.5 font-mono text-[11.5px] text-[#222222] focus:border-[#4d88cc] outline-none"
              />
            </div>
          </div>
        </section>

        {/* Footer Buttons */}
        <div className="flex items-center justify-end gap-2 border-t border-[#eaeaea] pt-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-[31px] rounded-[4px] border border-[#cccccc] bg-white px-3.5 text-[12.5px] font-medium text-[#444444] hover:bg-[#f5f5f5]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="h-[31px] rounded-[4px] bg-[#2f72dc] px-4 text-[12.5px] font-medium text-white hover:bg-[#3a7ce5]"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </dialog>
  );
};
