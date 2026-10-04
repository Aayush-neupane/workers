import { Link } from "react-router-dom";
import { PageHero } from "../components/ui";
import { loadConsent } from "../lib/consent";

function Doc({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="fade-up">
      <PageHero eyebrow={eyebrow} title={title} body="Plain language first. Last updated October 2026." />
      <div className="wrap prose-sm max-w-3xl space-y-4 py-8 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export function Terms() {
  return (
    <Doc eyebrow="Legal" title="Terms of Service">
      <h2 className="font-bold">1. What Sajilo Damak is</h2>
      <p>A marketplace connecting customers in Damak Municipality with administrator-verified service
        professionals. We arrange, verify and support services — pros perform them at your home, office or business.</p>
      <h2 className="font-bold">2. Coverage</h2>
      <p>Launch coverage is Damak Municipality, wards 1–10. Bookings outside the configured boundary are
        declined. New areas open only by explicit admin announcement.</p>
      <h2 className="font-bold">3. Bookings & prices</h2>
      <p>Fixed and starting prices are estimates unless marked confirmed. Final amounts are agreed with you
        before a job closes. Cancellation is free before pro confirmation; later stages follow the policy
        shown at checkout (see <Link to="/cancellation" className="font-bold text-primary">Cancellation</Link>).</p>
      <h2 className="font-bold">4. Completion codes</h2>
      <p>Jobs close with a one-time code sent to you. Sharing it confirms the work was done — it is not a
        waiver of your right to complain through support.</p>
      <h2 className="font-bold">5. Contact</h2>
      <p>Damak-5, Himal Chowk · 023-580000.</p>
    </Doc>
  );
}

export function Privacy() {
  return (
    <Doc eyebrow="Legal" title="Privacy Policy">
      <h2 className="font-bold">1. What we collect</h2>
      <p>Account details (name, email, phone), service addresses and landmarks, booking and payment
        references (never raw card data), verification documents for pros (private storage, narrow access),
        reviews, support records, and optional analytics only with your consent.</p>
      <h2 className="font-bold">2. Location handling</h2>
      <p>We store the address text and ward you provide. Precise GPS is never required and browser
        coordinates are never trusted as proof of coverage.</p>
      <h2 className="font-bold">3. Who sees what</h2>
      <p>Assigned pros see the job address and contact needed for that job — never your full history.
        Unrelated pros browsing quote requests see the ward and description only. Admin access to personal
        data follows least privilege and is audit-logged.</p>
      <h2 className="font-bold">4. Retention</h2>
      <p>Bookings and financial records are kept for accounting and dispute resolution. Verification
        documents follow the retention rule in settings. You may request export or deletion of eligible
        account data via support.</p>
      <h2 className="font-bold">5. Cookies & consent</h2>
      <p>See the <Link to="/cookies" className="font-bold text-primary">Cookie Policy</Link>. Change or
        withdraw consent anytime from the preference center (Cookie preferences link in the footer).</p>
      <h2 className="font-bold">6. Contact</h2>
      <p>Privacy questions: support ticket or 023-580000. This policy describes implemented behavior — it is
        not legal certification; Nepalese requirements are reviewed before launch.</p>
    </Doc>
  );
}

export function Cookies() {
  const c = typeof window !== "undefined" ? loadConsent() : null;
  return (
    <Doc eyebrow="Legal" title="Cookie Policy">
      <h2 className="font-bold">1. What cookies are</h2>
      <p>Small pieces of data stored by your browser. Our consent manager distinguishes strictly necessary
        cookies from optional categories — and optional tech never runs without your opt-in.</p>
      <h2 className="font-bold">2. Categories we actually use</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li><strong>Strictly necessary (always on):</strong> <code>sajilo_session</code> — sign-in session,
          HttpOnly, host-only, 7 days. Consent record <code>sajilo-consent-v1</code> — your choices, local only.</li>
        <li><strong>Preferences (optional):</strong> language and display choices. Off by default.</li>
        <li><strong>Analytics (optional):</strong> currently no analytics provider is wired in. If one is added,
          it initializes only after you opt in — and this policy is updated first.</li>
        <li><strong>Marketing (optional):</strong> no marketing pixels are in use. Same rule: opt-in first, policy updated first.</li>
      </ul>
      <h2 className="font-bold">3. Your choices</h2>
      <p>Accept all, reject optional, or customize per category from the banner. Reopen the preference center
        anytime via the footer link; withdrawing consent takes effect immediately for future activity.</p>
      <h2 className="font-bold">4. Your current choices</h2>
      <p>{c
        ? `Preferences ${c.preferences ? "on" : "off"} · Analytics ${c.analytics ? "on" : "off"} · Marketing ${c.marketing ? "on" : "off"} (policy ${c.policyVersion}).`
        : "No choices recorded on this device yet — the banner appears on first visit."}</p>
      <h2 className="font-bold">5. Browser controls</h2>
      <p>Browser-level blocking is separate from our manager: blocking strictly necessary cookies will sign
        you out and break bookings, while our manager only governs optional categories.</p>
    </Doc>
  );
}

export function Cancellation() {
  return (
    <Doc eyebrow="Legal" title="Cancellation & Refunds">
      <h2 className="font-bold">1. Free cancellation</h2>
      <p>Always free before a pro confirms. Cancel from the tracking page.</p>
      <h2 className="font-bold">2. After confirmation</h2>
      <p>En-route and in-progress cancellations may carry the disclosed visit fee. Completed jobs are closed
        by code; post-completion issues go through disputes and support, not silent edits.</p>
      <h2 className="font-bold">3. Refunds</h2>
      <p>Verified online payments refund to source; cash jobs settle through admin reconciliation. Reward
        points from refunded bookings are reversed automatically.</p>
    </Doc>
  );
}
