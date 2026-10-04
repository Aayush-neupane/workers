import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { Button } from "./ui";
import { useAuth } from "../lib/auth";
import { disablePush, enablePush, pushStatus, sendTestPing, type PushState } from "../lib/push";

/** Opt-in push toggle. Works for every role — audience follows the session role. */
export function PushToggle() {
  const { role } = useAuth();
  const [state, setState] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    pushStatus().then(setState).catch(() => {});
  }, []);

  async function toggle() {
    if (!role) return;
    setBusy(true);
    setMsg("");
    try {
      if (state === "on") {
        setState(await disablePush());
        setMsg("Push off on this device. In-app notifications still work.");
      } else {
        const next = await enablePush(role);
        setState(next);
        if (next === "on") {
          const sent = await sendTestPing().catch(() => 0);
          setMsg(sent > 0 ? "Push on — a test buzz is on its way." : "Subscribed, but the test buzz didn't arrive.");
        } else if (next === "denied") {
          setMsg("Browser permission denied — allow notifications in site settings to retry.");
        } else if (next === "unconfigured") {
          setMsg("Push isn't configured on the server yet — in-app notifications still work.");
        }
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : "";
      if (reason === "dismissed") {
        setMsg("Permission dismissed — tap again to retry the browser prompt.");
      } else if (reason === "service-unreachable") {
        setMsg("Couldn't reach the push service — check your connection and retry.");
      } else {
        setMsg("Couldn't change push setting — try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported") {
    return <p className="text-xs text-on-surface-variant">This browser doesn't support push — in-app notifications still work.</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={state === "on" ? "primary" : "outline"} onClick={toggle} disabled={busy}>
        {state === "on" ? <BellRing size={15} aria-hidden="true" /> : <BellOff size={15} aria-hidden="true" />}
        {busy ? "…" : state === "on" ? "Push on" : "Turn on push"}
      </Button>
      {msg && <p role="status" className="w-full text-xs text-on-surface-variant">{msg}</p>}
    </div>
  );
}
