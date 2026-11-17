import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function RequestDialog({
  children,
  onClose,
  busy,
  title = "Nouvelle demande de stock",
}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement,
      overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="supply-dialog"
      aria-labelledby="new-request-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose();
      }}
    >
      <header className="supply-dialog-heading">
        <div>
          <p className="eyebrow">Approvisionnement</p>
          <h2 id="new-request-title">{title}</h2>
        </div>
        <button
          type="button"
          className="supply-icon-button"
          aria-label={
            title === "Nouvelle demande de stock"
              ? "Fermer la nouvelle demande"
              : "Fermer la demande"
          }
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div className="supply-dialog-body">{children}</div>
    </dialog>
  );
}
