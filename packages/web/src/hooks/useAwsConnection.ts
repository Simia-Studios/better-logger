import type { ConnectionInfo } from "@better-logger/common";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { api } from "../api";

const fallback: ConnectionInfo = {
  connected: false,
  persisted: false,
  profiles: [],
  region: "us-east-1",
};

export const useAwsConnection = (onConnected: () => void) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ["connection"], queryFn: api.connection, retry: false });
  const {
    mutate: connect,
    isPending: connecting,
    error: connectError,
  } = useMutation({
    mutationFn: api.connect,
    onSuccess: (connection) => {
      queryClient.setQueryData(["connection"], connection);
      queryClient.removeQueries({ queryKey: ["log-groups"] });
      queryClient.removeQueries({ queryKey: ["saved-queries"] });
      onConnected();
      setOpen(false);
    },
  });

  const close = useCallback(() => setOpen(false), []);
  const show = useCallback(() => setOpen(true), []);
  const connection = query.data ?? fallback;
  const connected = connection.connected;

  return {
    close,
    connect,
    connected,
    connecting,
    connection,
    error: connectError?.message ?? connection.error ?? query.error?.message,
    open: open || (!query.isLoading && !connected),
    show,
  };
};
