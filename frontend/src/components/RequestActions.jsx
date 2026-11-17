import {
  ArrowUpRight,
  Pencil,
  Ban,
  ClipboardCheck,
  PackageCheck,
  Send,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import { requestActions } from "../domain/request-actions.js";
const icons = {
  edit: Pencil,
  cancel: Ban,
  review: ClipboardCheck,
  prepare: PackageCheck,
  dispatch: Send,
  receive: CheckCircle2,
  resolve: Wrench,
};

export default function RequestActions({
  request,
  role,
  saving,
  onAction,
  onOpen,
  details = true,
}) {
  return (
    <div className="supply-inline-actions">
      {requestActions(role, request.status).map(([action, label]) => {
        const Icon = icons[action];
        return (
          <button
            key={action}
            type="button"
            className={
              action === "receive"
                ? "supply-primary"
                : "secondary-button supply-row-action"
            }
            disabled={saving}
            onClick={() => onAction(action, request)}
          >
            <Icon size={15} />
            {label}
          </button>
        );
      })}
      {details && (
        <button
          type="button"
          className="secondary-button supply-row-action"
          disabled={saving}
          onClick={() => onOpen(request)}
        >
          <ArrowUpRight size={15} />
          Détails
        </button>
      )}
    </div>
  );
}
