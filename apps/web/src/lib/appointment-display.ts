import type { AppointmentRecord } from "@/lib/exam-booking";
import type { ClientRecord } from "@/lib/clients";
import { isOrganizationClient } from "@/lib/client-types";
import { formatSubjectName } from "@/lib/subjects";

export type AppointmentParties = {
  /** Person being examined — primary label for calendars and ledgers. */
  primaryName: string;
  /** Organization or individual billing account when different from primaryName. */
  accountName?: string;
  subjectId?: number;
};

function asClientRecord(client: NonNullable<AppointmentRecord["client"]>): ClientRecord {
  return {
    id: client.id,
    name: client.name,
    client_type: client.client_type ?? "Individual",
    email: client.email ?? "",
    created_at: "",
    updated_at: "",
  };
}

export function resolveAppointmentParties(appointment: AppointmentRecord): AppointmentParties {
  const accountName = appointment.client?.name || `Client #${appointment.client_id}`;
  const examineeName = appointment.subject
    ? formatSubjectName(appointment.subject)
    : undefined;
  const isOrg = appointment.client
    ? isOrganizationClient(asClientRecord(appointment.client))
    : false;

  let primaryName = accountName;
  let billingAccount: string | undefined;

  if (isOrg && examineeName) {
    primaryName = examineeName;
    billingAccount = accountName;
  } else if (examineeName) {
    primaryName = examineeName;
  }

  return {
    primaryName,
    accountName: billingAccount,
    subjectId: appointment.subject?.id ?? appointment.subject_id,
  };
}
