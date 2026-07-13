import type { ConnectionInfo, ConnectionSettings } from "@better-logger/common";
import { Check, Cloud, HardDrive, X } from "lucide-react";
import { useState, type FC, type FormEvent } from "react";

const regions = [
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "ca-central-1",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
  "ap-northeast-1",
  "ap-northeast-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-south-1",
  "sa-east-1",
];

type Props = {
  connection: ConnectionInfo;
  connecting: boolean;
  error?: string;
  dismissable: boolean;
  onClose: () => void;
  onConnect: (settings: ConnectionSettings) => void;
};

export const ConnectionDialog: FC<Props> = (props) => {
  const { connection, connecting, error, dismissable, onClose, onConnect } = props;
  const [profile, setProfile] = useState(connection.profile ?? "");
  const [region, setRegion] = useState(connection.region);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onConnect({ region: region.trim(), profile: profile.trim() || undefined });
  };

  return (
    <div className="dialog-backdrop connection-backdrop" role="presentation">
      <form
        className="connection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-title"
        onSubmit={submit}
      >
        <div className="connection-titlebar">
          <div className="connection-mark">
            <Cloud size={16} />
            <span>AWS</span>
          </div>
          {dismissable ? (
            <button
              className="icon-button"
              type="button"
              onClick={onClose}
              aria-label="Close connection settings"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
        <div className="connection-copy">
          <span className="eyebrow" id="connection-title">
            CLOUDWATCH CONNECTION
          </span>
          <h1>{connection.connected ? "Switch connection" : "Connect your AWS account"}</h1>
          <p>
            Choose an AWS CLI profile and region. Better Logger validates access before changing
            your active session.
          </p>
        </div>
        <div className="connection-fields">
          <label htmlFor="aws-profile">AWS profile</label>
          <input
            id="aws-profile"
            list="aws-profile-list"
            value={profile}
            onChange={(event) => setProfile(event.target.value)}
            placeholder="Default credential chain"
            autoComplete="off"
            spellCheck={false}
          />
          <datalist id="aws-profile-list">
            {connection.profiles.map((name) => (
              <option value={name} key={name} />
            ))}
          </datalist>
          <span className="field-help">Discovered from ~/.aws/config and ~/.aws/credentials</span>
          <label htmlFor="aws-region">AWS region</label>
          <input
            id="aws-region"
            list="aws-region-list"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            required
            autoComplete="off"
            spellCheck={false}
          />
          <datalist id="aws-region-list">
            {regions.map((name) => (
              <option value={name} key={name} />
            ))}
          </datalist>
        </div>
        {error ? (
          <div className="connection-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="connection-storage">
          <HardDrive size={13} />
          <span>
            Profile and region persist to <strong>~/.better-logger/connection.json</strong>.
            Credentials stay in AWS files.
          </span>
        </div>
        {connection.connected ? (
          <div className="current-connection">
            <Check size={13} />
            <span>Connected as {connection.arn}</span>
          </div>
        ) : null}
        <div className="dialog-actions connection-actions">
          {dismissable ? (
            <button className="text-button" type="button" onClick={onClose}>
              Cancel
            </button>
          ) : null}
          <button
            className="run-button connect-button"
            disabled={!region.trim() || connecting}
            type="submit"
          >
            {connecting
              ? "Validating…"
              : connection.connected
                ? "Switch connection"
                : "Connect to CloudWatch"}
          </button>
        </div>
      </form>
    </div>
  );
};
