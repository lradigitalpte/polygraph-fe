"use client";

import * as React from "react";
import {
  fetchClient,
  fetchClientAppointments,
  fetchClientDocuments,
  type ClientDocumentRecord,
  type ClientRecord,
} from "@/lib/clients";
import type { AppointmentRecord } from "@/lib/exam-booking";

type ClientDetailContextValue = {
  clientId: number;
  client: ClientRecord | null;
  appointments: AppointmentRecord[];
  documents: ClientDocumentRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  refreshDocuments: () => Promise<void>;
  setClientRecord: (record: ClientRecord) => void;
};

const ClientDetailContext = React.createContext<ClientDetailContextValue | null>(null);

export function ClientDetailProvider({
  clientId,
  children,
}: {
  clientId: number;
  children: React.ReactNode;
}) {
  const [client, setClient] = React.useState<ClientRecord | null>(null);
  const [appointments, setAppointments] = React.useState<AppointmentRecord[]>([]);
  const [documents, setDocuments] = React.useState<ClientDocumentRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientData, appointmentData, documentData] = await Promise.all([
        fetchClient(clientId),
        fetchClientAppointments(clientId),
        fetchClientDocuments(clientId),
      ]);
      setClient(clientData);
      setAppointments(appointmentData);
      setDocuments(documentData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load client record";
      setError(message);
      setClient(null);
      setAppointments([]);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const setClientRecord = React.useCallback((record: ClientRecord) => {
    setClient(record);
  }, []);

  const refreshDocuments = React.useCallback(async () => {
    try {
      const documentData = await fetchClientDocuments(clientId);
      setDocuments(documentData);
    } catch {
      // keep existing list on silent refresh failure
    }
  }, [clientId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const value = React.useMemo(
    () => ({
      clientId,
      client,
      appointments,
      documents,
      loading,
      error,
      refresh: load,
      refreshDocuments,
      setClientRecord,
    }),
    [clientId, client, appointments, documents, loading, error, load, refreshDocuments, setClientRecord]
  );

  return (
    <ClientDetailContext.Provider value={value}>{children}</ClientDetailContext.Provider>
  );
}

export function useClientDetail() {
  const context = React.useContext(ClientDetailContext);
  if (!context) {
    throw new Error("useClientDetail must be used within ClientDetailProvider");
  }
  return context;
}
