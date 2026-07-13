import type { ConnectionInfo } from "@better-logger/common";
import { Activity, Cloud, RefreshCw, Settings2 } from "lucide-react";
import { memo, type FC } from "react";

type HeaderProps = {
  connected: boolean;
  range: number;
  onRangeChange: (range: number) => void;
  onRefresh: () => void;
  onSettings: () => void;
};

export const AppHeader: FC<HeaderProps> = memo((props) => {
  const { connected, range, onRangeChange, onRefresh, onSettings } = props;
  return (
    <header className="app-header">
      <div className="wordmark">
        <Activity size={15} /> BETTER<span>/LOGGER</span>
      </div>
      <div className={`environment${connected ? "" : " offline"}`}>
        <span className="live-dot" /> {connected ? "CONNECTED" : "OFFLINE"}
      </div>
      <div className="header-spacer" />
      <label className="range-control">
        RANGE
        <select value={range} onChange={(event) => onRangeChange(Number(event.target.value))}>
          <option value={900}>15 minutes</option>
          <option value={3600}>1 hour</option>
          <option value={10800}>3 hours</option>
          <option value={43200}>12 hours</option>
          <option value={86400}>24 hours</option>
          <option value={604800}>7 days</option>
        </select>
      </label>
      <button
        className="header-button"
        type="button"
        onClick={onRefresh}
        title="Refresh log groups"
      >
        <RefreshCw size={13} /> Refresh
      </button>
      <button
        className="icon-button header-icon"
        type="button"
        aria-label="AWS connection settings"
        title="AWS connection settings"
        onClick={onSettings}
      >
        <Settings2 size={14} />
      </button>
    </header>
  );
});

type StatusProps = {
  connection: ConnectionInfo;
  groupCount: number;
  selectedCount: number;
};

export const StatusBar: FC<StatusProps> = memo((props) => {
  const { connection, groupCount, selectedCount } = props;
  return (
    <footer className="status-bar">
      <span>
        <Cloud size={11} /> AWS CLOUDWATCH
      </span>
      <span>{connection.region}</span>
      <span>{connection.profile ?? "default chain"}</span>
      {connection.accountId ? <span>acct {connection.accountId}</span> : null}
      <span>{selectedCount} sources</span>
      <span className="status-spacer" />
      <span>{groupCount} groups loaded</span>
      <span>UTF-8</span>
    </footer>
  );
});
