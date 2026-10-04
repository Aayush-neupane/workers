export function formatNPR(paisa: number): string {
  return `Rs ${(paisa / 100).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
}

export function formatSlot(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
