import { useEffect, useState } from "react";
import { Button, Card, EmptyState, PageHero } from "../components/ui";
import { PushToggle } from "../components/PushToggle";
import { api, post } from "../lib/api";
import { formatDateTime } from "../lib/format";

interface Note {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

/** Full notification centre for every role: history, mark-all, push opt-in. */
export default function Notifications() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");

  function reload() {
    setLoadError("");
    api<{ notifications: Note[] }>("/api/notifications").then((d) => setNotes(d.notifications)).catch(() => setLoadError("Couldn't load notifications."));
  }
  useEffect(reload, []);

  async function markAll() {
    setActionError("");
    try {
      await post("/api/notifications/read-all", {});
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Could not mark all read.");
    }
  }

  async function markOne(id: string) {
    setActionError("");
    const prev = notes;
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await post(`/api/notifications/${id}/read`, {});
    } catch (e) {
      setNotes(prev);
      setActionError(e instanceof Error ? e.message : "Could not mark as read.");
    }
  }

  const unread = notes.filter((n) => !n.is_read).length;

  return (
    <div className="fade-up">
      <PageHero eyebrow="Inbox" title="Notifications" body="Booking updates, assignments, rewards and announcements — in-app always, push when you opt in." />
      <div className="wrap grid items-start gap-5 py-8 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit p-5 lg:sticky lg:top-24">
          <p className="font-bold">Push on this device</p>
          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
            Get booking updates even with the app closed. The completion code itself stays in-app — pushes only nudge.
          </p>
          <div className="mt-3"><PushToggle /></div>
          {unread > 0 && <Button variant="outline" className="mt-3 w-full" onClick={markAll}>Mark all read ({unread})</Button>}
        </Card>
        <div className="space-y-3">
          {loadError && (
            <p role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-error-container p-3.5 text-sm font-medium text-error">
              {loadError}
              <Button variant="outline" onClick={reload}>Retry</Button>
            </p>
          )}
          {actionError && (
            <p role="alert" className="rounded-md bg-error-container p-3.5 text-sm font-medium text-error">{actionError}</p>
          )}
          {notes.length === 0 && !loadError && <EmptyState title="No notifications" body="Assignment updates, codes and rewards land here." />}
          {notes.map((n) => (
            <button key={n.id} onClick={() => markOne(n.id)}
              className={`block w-full rounded-lg border p-4 text-left transition hover:border-pine-800 ${
                n.is_read ? "border-outline/60 bg-white" : "border-primary/50 bg-primary-container/40"
              }`}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-bold">{n.title}</span>
                {!n.is_read && <span aria-label="Unread" className="size-2.5 shrink-0 rounded-full bg-primary" />}
              </span>
              <span className="mt-0.5 block text-sm leading-relaxed">{n.body}</span>
              <span className="mt-1.5 block text-xs text-on-surface-variant">{formatDateTime(n.created_at)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
