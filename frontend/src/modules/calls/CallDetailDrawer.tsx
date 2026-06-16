import { format } from "date-fns";
import { X, Phone, User, Clock, Calendar, FileText, Sparkles, StickyNote, Check, Pencil } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { StatusBadge } from "./CallsTable";
import type { Call } from "@/types/calls";
import { callsApi } from "@/services/api";

interface CallDetailDrawerProps {
  call: Call | null;
  onClose: () => void;
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <div className="text-sm font-medium text-foreground break-words">{value}</div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "Not available";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s} sec` : `${s} sec`;
}

export function CallDetailDrawer({ call, onClose }: CallDetailDrawerProps) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState("");
  const [displayedNotes, setDisplayedNotes] = useState<string | null | undefined>(undefined);
  const queryClient = useQueryClient();

  const notesMutation = useMutation({
    mutationFn: (notes: string | null) => callsApi.updateNotes(call!.id, notes),
    onSuccess: (updatedCall) => {
      setDisplayedNotes(updatedCall.notes);
      setIsEditingNotes(false);
      queryClient.invalidateQueries({ queryKey: ["calls"] });
    },
  });

  if (!call) return null;

  const currentNotes = displayedNotes !== undefined ? displayedNotes : call.notes;

  function handleEditNotes() {
    setNotesInput(currentNotes ?? "");
    setIsEditingNotes(true);
  }

  function handleSaveNotes() {
    notesMutation.mutate(notesInput.trim() || null);
  }

  function handleCancelNotes() {
    setIsEditingNotes(false);
    setNotesInput("");
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Call Details</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">#{call.id.slice(0, 8)}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
          <StatusBadge status={call.status} />
          {call.label && (
            <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border border-border bg-white text-foreground">
              {call.label}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <DetailRow
            icon={<Phone className="h-4 w-4" />}
            label="Phone Number"
            value={<span className="font-mono">{call.phone_number}</span>}
          />
          <DetailRow
            icon={<User className="h-4 w-4" />}
            label="Caller Name"
            value={call.caller_name ?? "Unknown"}
          />
          <DetailRow
            icon={<Clock className="h-4 w-4" />}
            label="Duration"
            value={formatDuration(call.duration_seconds)}
          />
          <DetailRow
            icon={<Calendar className="h-4 w-4" />}
            label="Started At"
            value={format(new Date(call.started_at), "PPpp")}
          />
          {call.ended_at && (
            <DetailRow
              icon={<Calendar className="h-4 w-4" />}
              label="Ended At"
              value={format(new Date(call.ended_at), "PPpp")}
            />
          )}

          {/* Task 1: Inline editable notes */}
          <div className="flex items-start gap-3 py-3 border-b border-border">
            <div className="mt-0.5 text-muted-foreground">
              <StickyNote className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-xs text-muted-foreground">Notes</p>
                {!isEditingNotes && (
                  <button
                    onClick={handleEditNotes}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
              </div>
              {isEditingNotes ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    className="w-full text-sm border border-border rounded-md p-2 resize-none focus:outline-none focus:ring-2 min-h-[80px]"
                    placeholder="Add notes about this call..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveNotes}
                      disabled={notesMutation.isPending}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded font-medium transition-colors"
                      style={{ backgroundColor: "#FDDF5C", color: "#4a3800" }}
                    >
                      <Check className="h-3 w-3" />
                      {notesMutation.isPending ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleCancelNotes}
                      className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    {notesMutation.isError && (
                      <span className="text-xs text-red-500">Failed to save — try again</span>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  onClick={handleEditNotes}
                  className="text-sm font-medium text-foreground cursor-pointer hover:bg-muted/40 rounded p-1 -ml-1 transition-colors min-h-[24px]"
                >
                  {currentNotes ? (
                    <span className="whitespace-pre-wrap">{currentNotes}</span>
                  ) : (
                    <span className="text-muted-foreground italic">Click to add notes...</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {call.summary && (
          <div className="px-6 py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4" style={{ color: "#FDDF5C" }} />
              <h3 className="text-sm font-semibold text-foreground">AI Summary</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{call.summary}</p>
          </div>
        )}

        {call.raw_transcript && (
          <div className="px-6 py-4 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Transcript</h3>
            </div>
            <div className="bg-muted rounded-lg p-3 max-h-48 overflow-y-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
                {call.raw_transcript}
              </pre>
            </div>
          </div>
        )}

        <div className="px-6 py-3 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            Created {format(new Date(call.created_at), "PPpp")}
          </p>
        </div>
      </aside>
    </>
  );
}