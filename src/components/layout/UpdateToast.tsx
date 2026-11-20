import { AnimatePresence, motion } from "framer-motion";
import { Download, Loader2, X } from "lucide-react";
import { useUpdates } from "@/store/updates";
import { IconButton } from "@/components/ui/IconButton";

/** Bottom-right card above the player. Closing it ignores this version for good (Settings can still install it). */
export function UpdateToast() {
  const { toast, available, status, progress, error } = useUpdates();
  const { install, dismiss } = useUpdates.getState();
  const downloading = status === "downloading";
  return (
    <AnimatePresence>
      {toast && available && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-[104px] right-5 z-50 w-[360px] rounded-xl bg-raised/95 p-4 shadow-[0_20px_50px_rgb(0_0_0/0.55)] ring-1 ring-line backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Download className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold">Mise à jour disponible</div>
              <div className="text-[12px] text-muted">Korz {available.version}</div>
            </div>
            {!downloading && (
              <IconButton label="Ignorer cette version" onClick={dismiss} className="-mr-1 -mt-1 size-7">
                <X className="size-4" />
              </IconButton>
            )}
          </div>
          <p className="mt-3 line-clamp-5 whitespace-pre-line text-[13px] leading-relaxed text-muted">{available.notes}</p>
          {downloading && (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10" aria-label="Progression du téléchargement">
              <div
                className={progress === null ? "h-full w-1/3 animate-pulse rounded-full bg-accent" : "h-full rounded-full bg-accent transition-[width] duration-200"}
                style={progress === null ? undefined : { width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
          {status === "error" && error && <p className="mt-2 text-[12px] text-red-300">{error}</p>}
          <button
            type="button"
            onClick={() => void install()}
            disabled={downloading}
            className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-full bg-accent text-[13px] font-semibold text-bg transition hover:brightness-105 active:scale-[0.98] disabled:opacity-70"
          >
            {downloading ? <Loader2 className="size-4 animate-spin" /> : null}
            {downloading ? "Installation…" : "Installer maintenant"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
