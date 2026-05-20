"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Filter,
  LayoutGrid,
  List,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fetchClients, type ClientRecord } from "@/lib/clients";

type ClientView = {
  id: number;
  code: string;
  name: string;
  email: string;
  phone: string;
  clientType: string;
  status: "Active" | "Pending";
  updatedLabel: string;
  avatar: string;
  color: string;
};

function formatClientCode(id: number): string {
  return `CL-${String(id).padStart(3, "0")}`;
}

function toRelativeTime(iso?: string): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function colorForType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("corporate")) return "bg-blue-500/10 text-blue-600";
  if (t.includes("law")) return "bg-amber-500/10 text-amber-600";
  return "bg-emerald-500/10 text-emerald-600";
}

function toViewModel(client: ClientRecord): ClientView {
  return {
    id: client.id,
    code: formatClientCode(client.id),
    name: client.name,
    email: client.email,
    phone: client.phone || "N/A",
    clientType: client.client_type || "Individual",
    status: client.email ? "Active" : "Pending",
    updatedLabel: toRelativeTime(client.updated_at),
    avatar: getInitials(client.name),
    color: colorForType(client.client_type || ""),
  };
}

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [clients, setClients] = React.useState<ClientView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchClients();
        if (!mounted) return;
        setClients(data.map(toViewModel));
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : "Failed to load clients";
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredClients = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) =>
      client.name.toLowerCase().includes(q) ||
      client.code.toLowerCase().includes(q) ||
      client.email.toLowerCase().includes(q),
    );
  }, [clients, searchQuery]);

  const activeCount = clients.filter((c) => c.status === "Active").length;
  const pendingCount = clients.length - activeCount;

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Clients</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Subject database and forensic history management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-10 px-4 rounded-xl border-border/50 hover:bg-muted/50 transition-all font-semibold">
            <Download className="mr-2 h-4 w-4 text-muted-foreground" />
            Export CSV
          </Button>
          <Button
            className="h-10 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 transition-all"
            render={<Link href="/dashboard/clients/new" />}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Client
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Clients", value: String(clients.length), icon: Users, color: "text-blue-500" },
          { label: "Active Records", value: String(activeCount), icon: UserCheck, color: "text-emerald-500" },
          { label: "Pending Records", value: String(pendingCount), icon: UserX, color: "text-amber-500" },
          { label: "Data Health", value: clients.length > 0 ? "100%" : "0%", icon: ShieldCheck, color: "text-purple-500" },
        ].map((stat, i) => (
          <Card key={i} className="border-border/40 shadow-sm bg-card/50 backdrop-blur-sm overflow-hidden group hover:border-primary/30 transition-all">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-2.5 rounded-xl bg-background border border-border shadow-inner group-hover:scale-110 transition-transform", stat.color)}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-extrabold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96 group">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search by name, ID or email..."
              className="h-11 pl-10 pr-4 rounded-xl bg-card border-border/50 focus:border-primary/50 focus:ring-primary/10 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" className="h-11 px-4 rounded-xl border-border/50 bg-card hover:bg-muted/50 gap-2 flex-1 sm:flex-none" disabled>
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Advanced Filters</span>
            </Button>
            <div className="flex border border-border/50 rounded-xl bg-card p-1 shadow-sm">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg bg-muted text-primary">
                <List className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-muted-foreground" disabled>
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card/30 backdrop-blur-md overflow-hidden shadow-xl shadow-foreground/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                    <div className="flex items-center gap-2">
                      Subject Detail
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Contact Information</th>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">
                    <div className="flex items-center gap-2">
                      Forensic History
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </div>
                  </th>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Status</th>
                  <th className="px-6 py-4 font-bold text-muted-foreground uppercase tracking-wider text-[10px] text-right">Options</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {loading ? (
                  <tr>
                    <td className="px-6 py-8 text-muted-foreground" colSpan={5}>
                      Loading clients...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td className="px-6 py-8 text-destructive" colSpan={5}>
                      {error}
                    </td>
                  </tr>
                ) : filteredClients.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-muted-foreground" colSpan={5}>
                      No clients found.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => (
                    <tr key={client.id} className="hover:bg-primary/[0.02] transition-colors group relative">
                      <td className="px-6 py-5">
                        <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-4">
                          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm ring-1 ring-inset ring-foreground/5", client.color)}>
                            {client.avatar}
                          </div>
                          <div>
                            <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                              {client.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-tight">ID: {client.code}</div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                            <Mail className="h-3.5 w-3.5 text-primary/60" />
                            <span className="text-xs font-medium">{client.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                            <Phone className="h-3.5 w-3.5 text-primary/60" />
                            <span className="text-xs font-medium">{client.phone}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 font-bold text-foreground">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span>{client.clientType}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Updated {client.updatedLabel}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <Badge
                          variant={client.status === "Active" ? "success" : "warning"}
                          className="rounded-lg px-2 py-0.5 font-bold uppercase tracking-wider text-[9px] shadow-sm"
                        >
                          {client.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-6 py-5 bg-muted/10 border-t border-border/50">
            <div className="flex items-center gap-4">
              <p className="text-xs font-medium text-muted-foreground">
                Showing <span className="text-foreground font-bold">{filteredClients.length === 0 ? 0 : 1}</span> to <span className="text-foreground font-bold">{filteredClients.length}</span> of <span className="text-foreground font-bold">{clients.length}</span> entries
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/50 hover:bg-muted/50 transition-all" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="default"
                className="h-9 w-9 rounded-xl font-bold text-xs bg-primary text-primary-foreground shadow-md shadow-primary/20"
              >
                1
              </Button>
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/50 hover:bg-muted/50 transition-all" disabled>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
