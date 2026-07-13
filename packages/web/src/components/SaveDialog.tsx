import { X } from "lucide-react";
import { useState, type FC, type FormEvent } from "react";

type Props = {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
};

export const SaveDialog: FC<Props> = (props) => {
  const { open, saving, onClose, onSave } = props;
  const [name, setName] = useState("");
  if (!open) return null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSave(name.trim());
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="save-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-title"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <span id="save-title">SAVE TO CLOUDWATCH</span>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close save dialog"
          >
            <X size={14} />
          </button>
        </div>
        <label htmlFor="query-name">Query name</label>
        <input
          id="query-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. API / recent errors"
        />
        <div className="dialog-actions">
          <button className="text-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="run-button" disabled={!name.trim() || saving} type="submit">
            {saving ? "Saving…" : "Save query"}
          </button>
        </div>
      </form>
    </div>
  );
};
