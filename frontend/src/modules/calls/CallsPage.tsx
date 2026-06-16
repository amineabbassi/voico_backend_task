import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Phone, X, ChevronUp, ChevronDown } from "lucide-react";
import { callsApi } from "@/services/api";
import type { Call, CallStatus } from "@/types/calls";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CallsTable } from "./CallsTable";
import { CallDetailDrawer } from "./CallDetailDrawer";

type TabValue = "all" | CallStatus;

const TABS: { label: string; value: TabValue }[] = [
  { label: "All", value: "all" },
  { label: "In Progress", value: "in_progress" },
  { label: "Success", value: "success" },
  { label: "Failed", value: "failed" },
];

const PAGE_SIZE = 20;

interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

export function CallsPage() {
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  // Task 2: filter state
  const [callerName, setCallerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [label, setLabel] = useState("");
  const [minDuration, setMinDuration] = useState("");
  const [maxDuration, setMaxDuration] = useState("");
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const statusFilter = activeTab === "all" ? undefined : activeTab;

  const activeFilters: ActiveFilter[] = [
    ...(callerName ? [{ key: "callerName", label: "Caller", value: callerName }] : []),
    ...(phoneNumber ? [{ key: "phoneNumber", label: "Phone", value: phoneNumber }] : []),
    ...(label ? [{ key: "label", label: "Label", value: label }] : []),
    ...(minDuration ? [{ key: "minDuration", label: "Min duration", value: `${minDuration}s` }] : []),
    ...(maxDuration ? [{ key: "maxDuration", label: "Max duration", value: `${maxDuration}s` }] : []),
    ...(sortBy ? [{ key: "sort", label: "Sort", value: `${sortBy} ${sortOrder}` }] : []),
  ];

  function removeFilter(key: string) {
    if (key === "callerName") setCallerName("");
    if (key === "phoneNumber") setPhoneNumber("");
    if (key === "label") setLabel("");
    if (key === "minDuration") setMinDuration("");
    if (key === "maxDuration") setMaxDuration("");
    if (key === "sort") { setSortBy(undefined); setSortOrder("desc"); }
    setPage(1);
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  }

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["calls", statusFilter, page, PAGE_SIZE, callerName, phoneNumber, label, minDuration, maxDuration, sortBy, sortOrder],
    queryFn: () =>
      callsApi.list({
        status: statusFilter,
        page,
        page_size: PAGE_SIZE,
        caller_name: callerName || undefined,
        phone_number: phoneNumber || undefined,
        label: label || undefined,
        min_duration: minDuration ? Number(minDuration) : undefined,
        max_duration: maxDuration ? Number(maxDuration) : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      }),
    refetchInterval: 5000,
  });

  function handleTabChange(tab: TabValue) {
    setActiveTab(tab);
    setPage(1);
  }

  function handleApplyFilters(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    refetch();
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b-2 shadow-sm" style={{ borderBottomColor: "#FDDF5C" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base shadow"
                style={{ backgroundColor: "#FDDF5C" }}
              >
                <span style={{ color: "#7A6000" }}>V</span>
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900">VOICO</span>
              <span className="hidden sm:block text-sm text-gray-400 font-normal pl-3 border-l border-gray-200">
                Calls Dashboard
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${isFetching ? "animate-pulse" : ""}`}
                  style={{ backgroundColor: isFetching ? "#FDDF5C" : "#86efac" }}
                />
                {isFetching ? "Syncing..." : "Live"}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-700"
                onClick={() => refetch()}
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total Calls", value: data.total },
              { label: "In Progress", value: data.counts?.in_progress ?? "—" },
              { label: "Successful", value: data.counts?.success ?? "—" },
              { label: "Failed", value: data.counts?.failed ?? "—" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-white p-4 shadow-sm">
                <p className="text-xs text-muted-foreground mb-1 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Task 2: Filter panel */}
        <Card className="bg-white mb-4">
          <form onSubmit={handleApplyFilters} className="px-6 py-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Filters</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="Caller name"
                value={callerName}
                onChange={(e) => setCallerName(e.target.value)}
                className="text-sm border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1"
                style={{ "--tw-ring-color": "#FDDF5C" } as React.CSSProperties}
              />
              <input
                type="text"
                placeholder="Phone number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="text-sm border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1"
              />
              <select
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="text-sm border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 text-muted-foreground"
              >
                <option value="">All labels</option>
                {["Sales inquiry", "Support", "Complaint", "Appointment", "Follow-up", "Other"].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Min duration (s)"
                value={minDuration}
                onChange={(e) => setMinDuration(e.target.value)}
                className="text-sm border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1"
              />
              <input
                type="number"
                placeholder="Max duration (s)"
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value)}
                className="text-sm border border-border rounded-md px-3 py-1.5 focus:outline-none focus:ring-1"
              />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <Button type="submit" size="sm" style={{ backgroundColor: "#FDDF5C", color: "#4a3800" }}>
                Apply Filters
              </Button>
              {activeFilters.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCallerName(""); setPhoneNumber(""); setLabel("");
                    setMinDuration(""); setMaxDuration("");
                    setSortBy(undefined); setSortOrder("desc");
                    setPage(1);
                  }}
                >
                  Clear all
                </Button>
              )}
            </div>

            {/* Active filter chips */}
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {activeFilters.map((f) => (
                  <span
                    key={f.key}
                    className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 font-medium border border-border bg-muted"
                  >
                    <span className="text-muted-foreground">{f.label}:</span> {f.value}
                    <button
                      type="button"
                      onClick={() => removeFilter(f.key)}
                      className="text-muted-foreground hover:text-foreground ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </form>
        </Card>

        <Card className="bg-white">
          <div className="flex items-center px-6 pt-5 pb-4 border-b border-border">
            <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => handleTabChange(tab.value)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={
                    activeTab === tab.value
                      ? { backgroundColor: "#FDDF5C", color: "#4a3800", boxShadow: "0 1px 3px rgba(0,0,0,0.10)" }
                      : { color: "var(--muted-foreground)" }
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort controls */}
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <span>Sort by:</span>
              {["started_at", "duration_seconds", "caller_name"].map((col) => (
                <button
                  key={col}
                  onClick={() => handleSort(col)}
                  className={`flex items-center gap-0.5 px-2 py-1 rounded hover:bg-muted transition-colors ${sortBy === col ? "font-semibold text-foreground" : ""}`}
                >
                  {col.replace("_", " ")}
                  {sortBy === col ? (
                    sortOrder === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <CardContent className="p-0">
            {isError ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                  <Phone className="h-5 w-5 text-red-500" />
                </div>
                <p className="text-sm font-medium text-foreground">Failed to load calls</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Make sure the backend is running at localhost:8000
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
                  Retry
                </Button>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CallsTable calls={data?.data ?? []} onRowClick={setSelectedCall} />
            )}
          </CardContent>

          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Page {data.page} of {data.total_pages}{" "}
                <span className="opacity-60">({data.total} total)</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={page === data.total_pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>

      <CallDetailDrawer call={selectedCall} onClose={() => setSelectedCall(null)} />
    </div>
  );
}
