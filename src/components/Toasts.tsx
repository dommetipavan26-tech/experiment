import { Check, CircleAlert, Info, X } from "lucide-react";
import { useRelay } from "../lib/store";

export function Toasts() {
  const { toasts, dismissToast } = useRelay();
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => {
        const Icon =
          toast.tone === "success" ? Check : toast.tone === "error" ? CircleAlert : Info;
        return (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            <span className="toast-icon"><Icon size={15} strokeWidth={2.1} /></span>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.detail && <span>{toast.detail}</span>}
            </div>
            <button className="toast-close" onClick={() => dismissToast(toast.id)} aria-label="Dismiss">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
