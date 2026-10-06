import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api, post } from "../lib/api";

interface Note {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

/** Header bell for every signed-in role: unread count, recent items, mark-all. */
export function NoticeBell() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);

  function reload() {
    api<{ notifications: Note[] }>("/api/notifications").then((d) => setNotes(d.notifications)).catch(() => {});
  }

  useEffect(() => {
    reload();
    const t = window.setInterval(reload, 60000);
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  async function markAll() {
    try {
      await post("/api/notifications/read-all", {});
      reload();
    } catch {
      /* keep list */
    }
  }

  const unread = notes.filter((n) => !n.is_read);
  const recent = [...notes]
    .sort((a, b) => Number(a.is_read) - Number(b.is_read) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread.length > 0 ? `${unread.length} unread notifications` : "Notifications"}
        className="relative grid size-10 place-items-center rounded-full border border-outline bg-white transition hover:border-pine-800"
      >
        <Bell size={19} aria-hidden="true" />
        {unread.length > 0 && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-error px-1 text-[10px] font-extrabold text-white">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="elev-2 absolute right-0 z-50 mt-2 w-80 max-w-[85vw] overflow-hidden rounded-lg border border-outline bg-white">
            <div className="flex items-center justify-between border-b border-outline/60 px-4 py-2.5">
              <p className="text-sm font-extrabold">Notifications</p>
              {unread.length > 0 && (
                <button onClick={markAll} className="text-xs font-bold text-primary hover:underline">Mark all read</button>
              )}
            </div>
            <ul className="max-h-80 overflow-y-auto">
              {recent.length === 0 && <li className="px-4 py-5 text-center text-sm text-on-surface-variant">All caught up.</li>}
              {recent.map((n) => (
                <li key={n.id} className={`border-b border-outline/40 px-4 py-2.5 text-sm last:border-0 ${n.is_read ? "" : "bg-primary-container/40"}`}>
                  <p className="font-bold">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-on-surface-variant">{n.body}</p>
                </li>
              ))}
            </ul>
            <Link to="/notifications" onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-center text-sm font-bold text-primary hover:bg-surface-container">
              View all
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
