"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Search,
  Plus,
  Trash2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Wrench,
  MapPin,
  X,
  ChevronRight,
  Clipboard,
  Info,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  type InventoryItem,
} from "@/lib/inventory";

export default function InventoryPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();

  React.useEffect(() => {
    if (!userLoading && !can("user:view")) {
      toast.error("You don't have permission to access this page.");
      router.replace("/dashboard");
    }
  }, [userLoading, can, router]);

  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("All");
  const [selectedStatus, setSelectedStatus] = React.useState("All");

  // Selected item detail view
  const [selectedItem, setSelectedItem] = React.useState<InventoryItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);

  // Form states
  const [isNewOpen, setIsNewOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [form, setForm] = React.useState({
    name: "",
    serial_number: "",
    category: "Equipment",
    status: "Active",
    quantity: 1,
    location: "",
    purchase_date: "",
    warranty_expiry: "",
    calibration_due: "",
    expiration_date: "",
    notes: "",
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchInventoryItems({
        search,
        category: selectedCategory === "All" ? "" : selectedCategory,
        status: selectedStatus === "All" ? "" : selectedStatus,
      });
      setItems(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadData();
  }, [search, selectedCategory, selectedStatus]);

  const handleOpenNew = () => {
    setForm({
      name: "",
      serial_number: "",
      category: "Equipment",
      status: "Active",
      quantity: 1,
      location: "",
      purchase_date: "",
      warranty_expiry: "",
      calibration_due: "",
      expiration_date: "",
      notes: "",
    });
    setIsNewOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setForm({
      name: item.name,
      serial_number: item.serial_number || "",
      category: item.category || "Equipment",
      status: item.status || "Active",
      quantity: item.quantity,
      location: item.location || "",
      purchase_date: item.purchase_date ? item.purchase_date.split("T")[0] : "",
      warranty_expiry: item.warranty_expiry ? item.warranty_expiry.split("T")[0] : "",
      calibration_due: item.calibration_due ? item.calibration_due.split("T")[0] : "",
      expiration_date: item.expiration_date ? item.expiration_date.split("T")[0] : "",
      notes: item.notes || "",
    });
    setIsEditOpen(true);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      await createInventoryItem({
        name: form.name.trim(),
        serial_number: form.serial_number.trim(),
        category: form.category,
        status: form.status,
        quantity: form.quantity,
        location: form.location.trim(),
        purchase_date: form.purchase_date ? new Date(form.purchase_date).toISOString() : undefined,
        warranty_expiry: form.warranty_expiry ? new Date(form.warranty_expiry).toISOString() : undefined,
        calibration_due: form.calibration_due ? new Date(form.calibration_due).toISOString() : undefined,
        expiration_date: form.expiration_date ? new Date(form.expiration_date).toISOString() : undefined,
        notes: form.notes.trim(),
      });
      toast.success("Inventory item created");
      setIsNewOpen(false);
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create item");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedItem) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateInventoryItem(selectedItem.id, {
        name: form.name.trim(),
        serial_number: form.serial_number.trim(),
        category: form.category,
        status: form.status,
        quantity: form.quantity,
        location: form.location.trim(),
        purchase_date: form.purchase_date ? new Date(form.purchase_date).toISOString() : undefined,
        warranty_expiry: form.warranty_expiry ? new Date(form.warranty_expiry).toISOString() : undefined,
        calibration_due: form.calibration_due ? new Date(form.calibration_due).toISOString() : undefined,
        expiration_date: form.expiration_date ? new Date(form.expiration_date).toISOString() : undefined,
        notes: form.notes.trim(),
      });
      toast.success("Inventory item updated");
      setIsEditOpen(false);
      if (selectedItem?.id === updated.id) {
        setSelectedItem(updated);
      }
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this item?")) return;
    try {
      await deleteInventoryItem(id);
      toast.success("Item deleted");
      setIsDetailOpen(false);
      setSelectedItem(null);
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    }
  };

  const handleQuickCalibration = async (item: InventoryItem) => {
    try {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const updated = await updateInventoryItem(item.id, {
        name: item.name,
        calibration_due: nextYear.toISOString(),
      });
      toast.success("Calibration updated (due 1 year from today)");
      setSelectedItem(updated);
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update calibration");
    }
  };

  const handleQuickStatus = async (item: InventoryItem, newStatus: string) => {
    try {
      const updated = await updateInventoryItem(item.id, {
        name: item.name,
        status: newStatus,
      });
      toast.success(`Item status updated to ${newStatus}`);
      setSelectedItem(updated);
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  // Helper date logic
  const getExpiryDetails = (dateStr?: string) => {
    if (!dateStr) return { status: "none", label: "N/A" };
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const formattedDate = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    if (diffDays < 0) {
      return { status: "critical", label: `Expired (${formattedDate})`, days: diffDays };
    } else if (diffDays <= 30) {
      return { status: "warning", label: `Expiring soon (${diffDays}d left)`, days: diffDays };
    }
    return { status: "good", label: formattedDate, days: diffDays };
  };

  const getCalibrationDetails = (dateStr?: string) => {
    if (!dateStr) return { status: "none", label: "N/A" };
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const formattedDate = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    if (diffDays < 0) {
      return { status: "critical", label: `Overdue (${formattedDate})`, days: diffDays };
    } else if (diffDays <= 30) {
      return { status: "warning", label: `Due in ${diffDays}d`, days: diffDays };
    }
    return { status: "good", label: formattedDate, days: diffDays };
  };

  // Aggregate stats
  const stats = React.useMemo(() => {
    let totalItems = 0;
    let calibrationPending = 0;
    let expiredSupplies = 0;
    let maintenanceCount = 0;

    for (const item of items) {
      totalItems += item.quantity;
      if (item.status === "Maintenance") {
        maintenanceCount += item.quantity;
      }

      if (item.calibration_due) {
        const cal = getCalibrationDetails(item.calibration_due);
        if (cal.status === "critical" || cal.status === "warning") {
          calibrationPending += item.quantity;
        }
      }

      if (item.expiration_date) {
        const exp = getExpiryDetails(item.expiration_date);
        if (exp.status === "critical" || exp.status === "warning") {
          expiredSupplies += item.quantity;
        }
      }
    }

    return { totalItems, calibrationPending, expiredSupplies, maintenanceCount };
  }, [items]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Decorative background gradients */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4" />
      </div>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-[2.5rem] bg-card/40 border border-border/50 backdrop-blur-xl shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Package className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Inventory & Assets</h1>
          </div>
          <p className="text-muted-foreground text-sm font-bold opacity-70 uppercase tracking-widest text-[10px] pl-1 pt-1">
            Clinical Tools, Equipment & Supplies Expiration Tracking
          </p>
          <p className="text-xs text-muted-foreground pl-1 pt-2 max-w-xl">
            Keep track of polygraph sensors calibration cycles, warranties, software licenses, and clinical consumable supplies expiration dates.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <Button
            onClick={handleOpenNew}
            className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Statistics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Assets", value: stats.totalItems, icon: Package, color: "bg-primary/10 text-primary" },
          {
            label: "Calibrations Due",
            value: stats.calibrationPending,
            icon: Clipboard,
            color: stats.calibrationPending > 0 ? "bg-amber-500/10 text-amber-500 animate-pulse" : "bg-emerald-500/10 text-emerald-500",
          },
          {
            label: "Expiring Supplies",
            value: stats.expiredSupplies,
            icon: AlertTriangle,
            color: stats.expiredSupplies > 0 ? "bg-rose-500/10 text-rose-500 animate-pulse" : "bg-emerald-500/10 text-emerald-500",
          },
          { label: "In Maintenance", value: stats.maintenanceCount, icon: Wrench, color: "bg-blue-500/10 text-blue-500" },
        ].map((stat, i) => (
          <Card key={i} className="border-border/40 bg-card/30 backdrop-blur-md shadow-xl overflow-hidden group hover:border-primary/30 transition-all hover:scale-[1.02]">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className={cn("p-2.5 rounded-xl shadow-inner", stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60">{stat.label}</p>
              </div>
              <p className="text-3xl font-black tracking-tighter">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table section */}
      <div className="space-y-6">
        {/* Search and filter controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="relative w-full sm:w-80 group">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-all" />
            <Input
              placeholder="Search assets or serial numbers..."
              className="h-12 pl-12 rounded-2xl bg-card border-border/50 focus:border-primary/50 transition-all shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-1/2 sm:w-44">
              <Select value={selectedCategory} onValueChange={(val) => setSelectedCategory(val as string)}>
                <SelectTrigger className="h-12 rounded-2xl bg-card border-border/50">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Categories</SelectItem>
                  <SelectItem value="Equipment">Equipment</SelectItem>
                  <SelectItem value="Supply">Supply</SelectItem>
                  <SelectItem value="Sensor">Sensor</SelectItem>
                  <SelectItem value="Computer">Computer</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-1/2 sm:w-44">
              <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val as string)}>
                <SelectTrigger className="h-12 rounded-2xl bg-card border-border/50">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Status</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Maintenance">Maintenance</SelectItem>
                  <SelectItem value="Expired">Expired</SelectItem>
                  <SelectItem value="Retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Database records list */}
        <div className="rounded-[2.5rem] border border-border/40 bg-card/20 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Asset Details</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Location</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Expiry / Calibration Status</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                      Loading asset catalog...
                    </td>
                  </tr>
                ) : items.length > 0 ? (
                  items.map((item) => {
                    const cal = getCalibrationDetails(item.calibration_due);
                    const exp = getExpiryDetails(item.expiration_date);

                    return (
                      <tr key={item.id} className="hover:bg-primary/[0.03] transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-base leading-none text-foreground">{item.name}</span>
                            <span className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-primary uppercase tracking-[0.1em]">{item.category}</span>
                              {item.serial_number && (
                                <span className="text-[9px] text-muted-foreground/80 font-normal">S/N: {item.serial_number}</span>
                              )}
                              <span className="text-[9px] text-muted-foreground/80 font-normal">• Qty: {item.quantity}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-4 w-4 shrink-0 text-primary/70" />
                            <span className="font-semibold text-xs">{item.location || "Not set"}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1 font-black uppercase tracking-widest text-[9px] border-none shadow-sm",
                              item.status === "Active" ? "bg-emerald-500/10 text-emerald-600" :
                              item.status === "Maintenance" ? "bg-amber-500/10 text-amber-600" :
                              item.status === "Expired" ? "bg-rose-500/10 text-rose-600 animate-pulse" :
                              "bg-muted text-muted-foreground"
                            )}
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-8 py-6 space-y-1.5">
                          {item.calibration_due && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider w-20">Calibration:</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[9px] font-semibold border-none shadow-sm",
                                  cal.status === "good" ? "bg-emerald-500/10 text-emerald-600" :
                                  cal.status === "warning" ? "bg-amber-500/10 text-amber-600" :
                                  "bg-rose-500/10 text-rose-600 animate-pulse"
                                )}
                              >
                                {cal.label}
                              </Badge>
                            </div>
                          )}
                          {item.expiration_date && (
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider w-20">Shelf Life:</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded px-1.5 py-0.5 text-[9px] font-semibold border-none shadow-sm",
                                  exp.status === "good" ? "bg-emerald-500/10 text-emerald-600" :
                                  exp.status === "warning" ? "bg-amber-500/10 text-amber-600 animate-pulse" :
                                  "bg-rose-500/10 text-rose-600 animate-pulse"
                                )}
                              >
                                {exp.label}
                              </Badge>
                            </div>
                          )}
                          {!item.calibration_due && !item.expiration_date && (
                            <span className="text-xs text-muted-foreground font-semibold italic">No Expirations Tracked</span>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all group-hover:translate-x-1"
                            onClick={() => {
                              setSelectedItem(item);
                              setIsDetailOpen(true);
                            }}
                          >
                            <ChevronRight className="h-6 w-6" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                      No matching assets found in the catalog.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Asset details slideover sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="sm:max-w-md bg-card/95 backdrop-blur-3xl border-l border-border/50 shadow-2xl p-0 overflow-hidden">
          {selectedItem && (
            <div className="h-full flex flex-col">
              <div className="h-60 flex flex-col justify-end p-10 text-white relative">
                <div className="absolute inset-0 bg-neutral-950 z-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent z-10" />
                <div className="absolute inset-0 opacity-10 z-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />

                <div className="relative z-20 space-y-4">
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 backdrop-blur-xl">
                    {selectedItem.category}
                  </Badge>
                  <div className="space-y-1">
                    <h2 className="text-3xl font-black tracking-tighter leading-none">{selectedItem.name}</h2>
                    {selectedItem.serial_number && (
                      <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] pl-1">S/N: {selectedItem.serial_number}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-background">
                {/* Information cards */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Item Status & Location</p>
                  <div className="grid grid-cols-2 gap-4 border border-border/50 p-6 rounded-[2rem] bg-muted/10 shadow-inner">
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                      <Badge className="capitalize font-black text-xs">{selectedItem.status}</Badge>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Location</p>
                      <p className="text-sm font-black tracking-tight">{selectedItem.location || "Not set"}</p>
                    </div>
                  </div>
                </div>

                {/* Expirations checklist */}
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Expiration Tracking</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-4 border border-border/30 rounded-2xl bg-card shadow-sm">
                      <span className="text-xs font-black text-foreground/80 uppercase tracking-tight">Calibration Due</span>
                      <span className="text-sm font-black text-foreground">
                        {getCalibrationDetails(selectedItem.calibration_due).label}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 border border-border/30 rounded-2xl bg-card shadow-sm">
                      <span className="text-xs font-black text-foreground/80 uppercase tracking-tight">Shelf Life Expiry</span>
                      <span className="text-sm font-black text-foreground">
                        {getExpiryDetails(selectedItem.expiration_date).label}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 border border-border/30 rounded-2xl bg-card shadow-sm">
                      <span className="text-xs font-black text-foreground/80 uppercase tracking-tight">Warranty End</span>
                      <span className="text-sm font-black text-foreground font-mono text-xs">
                        {selectedItem.warranty_expiry
                          ? new Date(selectedItem.warranty_expiry).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes box */}
                {selectedItem.notes && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Asset Notes</p>
                    <div className="border border-border/50 p-6 rounded-[2rem] bg-muted/10 shadow-inner text-xs text-muted-foreground whitespace-pre-wrap">
                      {selectedItem.notes}
                    </div>
                  </div>
                )}

                {/* Quick actions panel */}
                <div className="pt-10 flex flex-col gap-4">
                  {selectedItem.calibration_due && (
                    <Button
                      onClick={() => void handleQuickCalibration(selectedItem)}
                      className="w-full h-16 rounded-[2rem] font-black text-sm shadow-2xl shadow-primary/30 bg-primary text-primary-foreground hover:scale-[1.03] transition-all"
                    >
                      Log Calibration Completed
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border-border/50 hover:bg-muted/20"
                      onClick={() => handleOpenEdit(selectedItem)}
                    >
                      Edit details
                    </Button>
                    {selectedItem.status !== "Maintenance" ? (
                      <Button
                        variant="outline"
                        className="h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border-amber-500/25 bg-amber-500/5 text-amber-500 hover:bg-amber-500/10"
                        onClick={() => void handleQuickStatus(selectedItem, "Maintenance")}
                      >
                        Send to Service
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border-emerald-500/25 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500/10"
                        onClick={() => void handleQuickStatus(selectedItem, "Active")}
                      >
                        Mark Active
                      </Button>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border/40">
                    <Button
                      variant="destructive"
                      className="w-full h-12 rounded-2xl font-black text-[10px] uppercase tracking-widest gap-2"
                      onClick={() => void handleDelete(selectedItem.id)}
                    >
                      <Trash2 className="h-4 w-4" /> Delete Asset record
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* New Asset Dialog */}
      <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden border-border/50 shadow-2xl">
          <div className="p-8 space-y-6 bg-background max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">Add Asset</h2>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Inventory Management Catalog</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="new-name">Asset Name *</Label>
                <Input
                  id="new-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Lafayette Polygraph System LX6"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-serial">Serial Number</Label>
                  <Input
                    id="new-serial"
                    value={form.serial_number}
                    onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                    placeholder="e.g. SN-98741-A"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-quantity">Quantity</Label>
                  <Input
                    id="new-quantity"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-category">Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(val) => setForm((f) => ({ ...f, category: val as string }))}
                  >
                    <SelectTrigger id="new-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                      <SelectItem value="Supply">Supply</SelectItem>
                      <SelectItem value="Sensor">Sensor</SelectItem>
                      <SelectItem value="Computer">Computer</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-location">Storage Location</Label>
                  <Input
                    id="new-location"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Cabinet A, Room 102"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-purchase-date">Purchase Date</Label>
                  <Input
                    id="new-purchase-date"
                    type="date"
                    value={form.purchase_date}
                    onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-warranty">Warranty Expiry</Label>
                  <Input
                    id="new-warranty"
                    type="date"
                    value={form.warranty_expiry}
                    onChange={(e) => setForm((f) => ({ ...f, warranty_expiry: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="new-calibration">Calibration Due</Label>
                  <Input
                    id="new-calibration"
                    type="date"
                    value={form.calibration_due}
                    onChange={(e) => setForm((f) => ({ ...f, calibration_due: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-expiry">Expiration Date (Shelf Life)</Label>
                  <Input
                    id="new-expiry"
                    type="date"
                    value={form.expiration_date}
                    onChange={(e) => setForm((f) => ({ ...f, expiration_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="new-notes">Internal Notes</Label>
                <Textarea
                  id="new-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Purchase notes, service contacts, or detail specs..."
                />
              </div>
            </div>

            <Button
              className="w-full h-13 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
              onClick={() => void handleCreate()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Add to Catalog"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Asset Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden border-border/50 shadow-2xl">
          <div className="p-8 space-y-6 bg-background max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">Edit Asset</h2>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Inventory Management Catalog</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Asset Name *</Label>
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-serial">Serial Number</Label>
                  <Input
                    id="edit-serial"
                    value={form.serial_number}
                    onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-quantity">Quantity</Label>
                  <Input
                    id="edit-quantity"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(val) => setForm((f) => ({ ...f, category: val as string }))}
                  >
                    <SelectTrigger id="edit-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Equipment">Equipment</SelectItem>
                      <SelectItem value="Supply">Supply</SelectItem>
                      <SelectItem value="Sensor">Sensor</SelectItem>
                      <SelectItem value="Computer">Computer</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-location">Storage Location</Label>
                  <Input
                    id="edit-location"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(val) => setForm((f) => ({ ...f, status: val as string }))}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Maintenance">Maintenance</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-purchase-date">Purchase Date</Label>
                  <Input
                    id="edit-purchase-date"
                    type="date"
                    value={form.purchase_date}
                    onChange={(e) => setForm((f) => ({ ...f, purchase_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-warranty">Warranty Expiry</Label>
                  <Input
                    id="edit-warranty"
                    type="date"
                    value={form.warranty_expiry}
                    onChange={(e) => setForm((f) => ({ ...f, warranty_expiry: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-calibration">Calibration Due</Label>
                  <Input
                    id="edit-calibration"
                    type="date"
                    value={form.calibration_due}
                    onChange={(e) => setForm((f) => ({ ...f, calibration_due: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-expiry">Expiration Date (Shelf Life)</Label>
                <Input
                  id="edit-expiry"
                  type="date"
                  value={form.expiration_date}
                  onChange={(e) => setForm((f) => ({ ...f, expiration_date: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-notes">Internal Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <Button
              className="w-full h-13 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
              onClick={() => void handleUpdate()}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
