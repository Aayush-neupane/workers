import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Mail, MapPin, Phone } from "lucide-react";
import { Card, PageHero } from "../components/ui";
import { loadConsent } from "../lib/consent";

const EFFECTIVE = "15 October 2026";
const VERSION = "v1.0";

function ContactCard() {
  return (
    <Card className="mt-8 p-5">
      <p className="flex items-center gap-1.5 font-bold"><Mail size={15} aria-hidden="true" /> Contact us about this document</p>
      <ul className="mt-2 space-y-1 text-sm text-on-surface-variant">
        <li className="flex items-center gap-1.5"><MapPin size={13} aria-hidden="true" /> Sajilo Damak, Damak-5, Himal Chowk, Jhapa, Nepal</li>
        <li className="flex items-center gap-1.5"><Phone size={13} aria-hidden="true" /> 023-580000 (Sun–Sat)</li>
        <li>Or open a <Link to="/support" className="font-bold text-primary hover:underline">support ticket</Link> — legal and privacy queries are prioritized.</li>
      </ul>
    </Card>
  );
}

function Doc({
  eyebrow,
  title,
  intro,
  toc,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  toc: [string, string][];
  children: React.ReactNode;
}) {
  return (
    <div className="fade-up">
      <PageHero eyebrow={eyebrow} title={title} body={intro} />
      <div className="wrap py-8">
        <div className="grid items-start gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-24">
            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-widest text-on-surface-variant uppercase">
                <FileText size={13} aria-hidden="true" /> Contents
              </p>
              <ol className="mt-2 space-y-1 text-sm">
                {toc.map(([href, label], i) => (
                  <li key={href}>
                    <a href={href} className="font-semibold text-primary hover:underline">
                      {i + 1}. {label}
                    </a>
                  </li>
                ))}
              </ol>
              <dl className="mt-3 space-y-1 border-t border-outline pt-3 text-xs text-on-surface-variant">
                <div className="flex justify-between"><dt>Effective</dt><dd className="font-bold text-on-surface">{EFFECTIVE}</dd></div>
                <div className="flex justify-between"><dt>Version</dt><dd className="font-bold text-on-surface">{VERSION}</dd></div>
              </dl>
            </Card>
          </aside>
          <article className="max-w-3xl space-y-6 text-[15px] leading-relaxed">
            {children}
            <ContactCard />
          </article>
        </div>
      </div>
    </div>
  );
}

function H({ id, n, children }: { id: string; n: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display scroll-mt-28 text-xl font-semibold">
      <span className="mr-2 text-on-surface-variant">{n}</span>
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-on-surface-variant">{children}</p>;
}

export function Terms() {
  return (
    <Doc
      eyebrow="Legal · Terms of Service"
      title="Terms of Service"
      intro="The rules of the marketplace: what we promise, what you agree to, and how disputes are settled."
      toc={[["#parties", "Parties & scope"], ["#coverage", "Service coverage"], ["#accounts", "Accounts"], ["#booking", "Bookings & pricing"], ["#completion", "Completion codes"], ["#payments", "Payments & refunds"], ["#conduct", "Acceptable conduct"], ["#liability", "Liability"], ["#changes", "Changes & termination"]]}
    >
      <section>
        <H id="parties" n="1.">Parties & scope</H>
        <P>These Terms form a binding agreement between you and Sajilo Damak ("we", "the platform") for
          use of the Damak-only service marketplace at our websites and, in future, our mobile applications.
          By creating an account or placing a booking you accept these Terms and the documents they reference:
          the Privacy Policy, Cookie Policy, and Cancellation & Refunds policy.</P>
        <P>We operate a marketplace: we arrange, verify, dispatch, and support services. The services themselves
          are performed by independent verified professionals ("pros"). Account creation requires acceptance of
          these Terms via an explicit checkbox — accounts created without recorded acceptance are not valid.</P>
      </section>
      <section>
        <H id="coverage" n="2.">Service coverage</H>
        <P>At launch we serve <strong>Damak Municipality, Jhapa District, Koshi Province, Nepal (wards 1–10)</strong> only.
          Addresses outside the configured boundary are declined with an explanation. Coverage is configuration,
          not a promise of availability: individual wards may be temporarily closed, and new areas open only by
          explicit announcement — never silently.</P>
      </section>
      <section>
        <H id="accounts" n="3.">Accounts</H>
        <P><strong>Customers</strong> may register freely with name, phone, email, and password (minimum 8 characters).
          You are responsible for activity under your account and for keeping credentials confidential.</P>
        <P><strong>Professionals</strong> cannot self-register. Pro accounts are created by administrator invitation,
          followed by document submission, qualification review, and explicit activation. Any pro access obtained
          outside this process is unauthorized and will be revoked.</P>
        <P>We may suspend accounts for fraud, abuse, safety risks, or legal compliance, with audit-logged reasons
          reviewed by authorized staff.</P>
      </section>
      <section>
        <H id="booking" n="4.">Bookings & pricing</H>
        <P>Two booking modes exist: <strong>direct booking</strong> for standard services and <strong>quote requests</strong>
          for complex jobs. Fixed and starting prices shown in the catalog are estimates unless explicitly marked
          confirmed. The final amount is agreed with you before a job closes; scope changes require your approval.
          Appointment slots are confirmed on assignment — same-day windows depend on pro availability.</P>
      </section>
      <section>
        <H id="completion" n="5.">Completion codes</H>
        <P>Jobs close with a short-lived one-time code delivered only to you. Sharing the code confirms the work
          was performed — it is <strong>not</strong> a waiver of quality claims. Complaints and disputes remain
          available through support after completion, and completion records (including verification timestamps)
          are preserved for dispute resolution.</P>
      </section>
      <section>
        <H id="payments" n="6.">Payments & refunds</H>
        <P>Cash is paid directly on completion; online payments (eSewa, Khalti) apply where merchant configuration
          is active and are verified server-side — frontend success screens never constitute payment. Refunds follow
          the Cancellation & Refunds policy; reward points from refunded bookings are reversed automatically.</P>
      </section>
      <section>
        <H id="conduct" n="7.">Acceptable conduct</H>
        <P>You agree not to misuse the platform: no false bookings, no harassment of pros or staff, no attempts to
          bypass verification, coverage, payment, or review controls, and no submission of unlawful content.
          Reviews must reflect genuine completed jobs; fabricated or incentivized reviews are removed.</P>
      </section>
      <section>
        <H id="liability" n="8.">Liability</H>
        <P>We exercise professional diligence in verification, dispatch, and support, and we maintain the audit
          history needed to resolve disputes fairly. To the maximum extent permitted by applicable law, our liability
          for any single booking is limited to the amount paid for that booking. Nothing in these Terms limits
          liability that cannot be limited by law.</P>
      </section>
      <section>
        <H id="changes" n="9.">Changes & termination</H>
        <P>We may update these Terms with 15 days' notice in-app; continued use after the effective date constitutes
          acceptance of the updated version. You may stop using the platform and request eligible data deletion at any
          time via support. Provisions on payments, disputes, and liability survive termination.</P>
      </section>
    </Doc>
  );
}

export function Privacy() {
  return (
    <Doc
      eyebrow="Legal · Privacy Policy"
      title="Privacy Policy"
      intro="What we collect, why we need it, who can see it, and the rights you hold over your data."
      toc={[["#collect", "Data we collect"], ["#location", "Location handling"], ["#use", "How we use data"], ["#sharing", "Sharing & access"], ["#retention", "Retention"], ["#rights", "Your rights"], ["#cookies", "Cookies & consent"], ["#security", "Security"]]}
    >
      <section>
        <H id="collect" n="1.">Data we collect</H>
        <P><strong>Account data:</strong> name, email, phone, password hash. <strong>Service data:</strong> addresses,
          landmarks, ward, booking details, instructions, photos you attach to quote requests. <strong>Transaction data:</strong> payment
          references and amounts — we never store raw card or wallet credentials. <strong>Pro verification data:</strong> identity
          documents, qualifications, background-check outcomes, stored in private storage with narrowly scoped access.
          <strong> Platform data:</strong> reviews, support tickets, notification preferences, and optional analytics
          strictly where you have consented.</P>
      </section>
      <section>
        <H id="location" n="2.">Location handling</H>
        <P>We store the address text and ward you provide — that is sufficient for dispatch. Precise GPS is never
          required, browser coordinates are never trusted as proof of coverage, and we do not track your location
          outside active bookings.</P>
      </section>
      <section>
        <H id="use" n="3.">How we use data</H>
        <P>To create accounts, validate Damak coverage, dispatch verified pros, process payments and settlements,
          issue loyalty rewards, verify completion codes, resolve disputes, meet legal obligations, and — only with
          consent — improve the product through analytics. We practice data minimization: every field collected must
          justify itself against one of these purposes.</P>
      </section>
      <section>
        <H id="sharing" n="4.">Sharing & access</H>
        <P><strong>Assigned pros</strong> see the job address and contact details required for that job only.
          <strong> Unrelated pros</strong> browsing quote requests see the ward and job description — never your identity
          or exact address. <strong>Payment providers</strong> receive transaction references when you pay online.
          <strong> Staff</strong> access follows least privilege (support sees bookings, finance sees settlements,
          verifiers see documents) and sensitive access is audit-logged. We do not sell personal data.</P>
      </section>
      <section>
        <H id="retention" n="5.">Retention</H>
        <P>Bookings, financial records, and audit logs are retained for accounting and dispute resolution as required
          by law. Verification documents follow the retention rule published in platform settings. Support records are
          kept for 24 months after ticket closure. When retention expires, data is deleted or irreversibly anonymized.</P>
      </section>
      <section>
        <H id="rights" n="6.">Your rights</H>
        <P>You may request a copy of your data, correction of inaccuracies, deletion of eligible data, and withdrawal
          of optional consents at any time via a support ticket. Financial and dispute records that the law requires us
          to keep are exempt from deletion; we will explain any refusal with reasons.</P>
      </section>
      <section>
        <H id="cookies" n="7.">Cookies & consent</H>
        <P>Cookie rules live in the <Link to="/cookies" className="font-bold text-primary hover:underline">Cookie Policy</Link>.
          Consent is versioned and recorded; withdrawing consent stops future optional collection immediately but does not
          retroactively delete previously collected analytics — deletion requests cover that separately.</P>
      </section>
      <section>
        <H id="security" n="8.">Security</H>
        <P>Sessions use HttpOnly, Secure, host-only cookies; passwords are hashed with bcrypt; verification documents
          live in private storage; sensitive admin actions require re-authentication and are audit-logged. No system is
          perfect — if you suspect compromise, contact us immediately and we will freeze, investigate, and report back.</P>
      </section>
      <P>This policy describes implemented behavior. It is not legal certification; Nepalese privacy and
        electronic-transactions requirements are reviewed by counsel before launch, and material findings update this document.</P>
    </Doc>
  );
}

export function Cookies() {
  const [c, setC] = useState(() => (typeof window !== "undefined" ? loadConsent() : null));
  useEffect(() => {
    const onChange = () => setC(loadConsent());
    window.addEventListener("sajilo-consent", onChange);
    return () => window.removeEventListener("sajilo-consent", onChange);
  }, []);
  return (
    <Doc
      eyebrow="Legal · Cookie Policy"
      title="Cookie Policy"
      intro="Exactly which cookies and trackers we use, why each exists, and how you control them."
      toc={[["#what", "What these technologies are"], ["#inventory", "Our inventory"], ["#consent", "How consent works"], ["#current", "Your current choices"], ["#browser", "Browser controls"], ["#updates", "Policy updates"]]}
    >
      <section>
        <H id="what" n="1.">What these technologies are</H>
        <P>Cookies and equivalent storage let the platform remember your session, your choices, and — only with
          permission — aggregate usage patterns. Our consent manager separates <strong>strictly necessary</strong> technologies
          (the service cannot function without them) from <strong>optional categories</strong> (preferences, analytics,
          marketing), which remain off until you opt in. Displaying a banner is not consent; only your recorded choice counts.</P>
      </section>
      <section>
        <H id="inventory" n="2.">Our inventory</H>
        <P><strong>Strictly necessary — always on:</strong></P>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-on-surface-variant">
          <li><code className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-[13px]">sajilo_session</code> — authentication session. HttpOnly, host-only, SameSite=Lax, Secure in production, 7-day expiry. Purpose: keeping you signed in securely.</li>
          <li><code className="rounded bg-surface-container px-1.5 py-0.5 font-mono text-[13px]">sajilo-consent-v1</code> — your consent record (categories, policy version, timestamp). Local to your device. Purpose: remembering your choices.</li>
        </ul>
        <P><strong>Optional — off until you opt in:</strong></P>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-on-surface-variant">
          <li><strong>Preferences:</strong> language and display choices. No third parties receive this data.</li>
          <li><strong>Analytics:</strong> no analytics provider is currently wired in. If one is added, it initializes only after opt-in — and this inventory is updated first.</li>
          <li><strong>Marketing:</strong> no marketing pixels or attribution trackers are in use. Same rule: opt-in first, inventory updated first.</li>
        </ul>
        <P>We do not invent providers or durations: any technology added later appears here before it activates.</P>
      </section>
      <section>
        <H id="consent" n="3.">How consent works</H>
        <P>First visit shows three equal choices: <strong>Accept all</strong>, <strong>Reject optional</strong>, or
          <strong> Customize</strong> per category — no preselected boxes, no deceptive highlighting, no repeated
          nagging. Reopen the preference center anytime from the footer link; changes and withdrawals apply immediately
          to future activity. Material policy changes bump the policy version and re-prompt you.</P>
      </section>
      <section>
        <H id="current" n="4.">Your current choices</H>
        <P>{c
          ? `On this device: preferences ${c.preferences ? "on" : "off"} · analytics ${c.analytics ? "on" : "off"} · marketing ${c.marketing ? "on" : "off"} (policy ${c.policyVersion}, recorded ${new Date(c.ts).toLocaleDateString()}).`
          : "No choices recorded on this device yet — the banner appears on first visit."}</P>
      </section>
      <section>
        <H id="browser" n="5.">Browser controls</H>
        <P>Browser-level blocking is separate from our manager. Blocking strictly necessary cookies will sign you out
          and break bookings; our manager governs optional categories only. Private-mode sessions forget your choices
          when the window closes.</P>
      </section>
      <section>
        <H id="updates" n="6.">Policy updates</H>
        <P>Inventory changes are published here with a new version before activation. The consent record's retention
          policy: 24 months from last update, then the banner re-appears.</P>
      </section>
    </Doc>
  );
}

export function Cancellation() {
  return (
    <Doc
      eyebrow="Legal · Cancellation & Refunds"
      title="Cancellation & Refunds"
      intro="When cancellation is free, what late changes cost, and how refunds reach you."
      toc={[["#free", "Free cancellation"], ["#late", "Late changes"], ["#refunds", "Refunds"], ["#rewards", "Rewards on refunds"], ["#disputes", "Disputes"]]}
    >
      <section>
        <H id="free" n="1.">Free cancellation</H>
        <P>Cancel free of charge at any point before a pro confirms — from the tracking page, no questions asked.
          Quote requests can be withdrawn free while no proposal has been accepted.</P>
      </section>
      <section>
        <H id="late" n="2.">Late changes</H>
        <P>After confirmation, en-route and in-progress cancellations may carry the visit fee disclosed at checkout
          (pro travel and reserved time). Rescheduling to a nearby slot is always preferred over cancellation and carries no fee.</P>
      </section>
      <section>
        <H id="refunds" n="3.">Refunds</H>
        <P>Verified online payments refund to the original source within the provider's settlement window; cash jobs
          settle through admin reconciliation with a written record. Partial refunds apply where part of the work was
          completed and accepted. Refund decisions are audit-logged and never silently edit booking history.</P>
      </section>
      <section>
        <H id="rewards" n="4.">Rewards on refunds</H>
        <P>Points earned by a refunded booking are reversed automatically; redeemed discounts applied to refunded
          bookings are restored as points where the redemption itself is unaffected by the refund reason.</P>
      </section>
      <section>
        <H id="disputes" n="5.">Disputes</H>
        <P>Raise quality or conduct issues within 48 hours of completion. Settlement pauses while support reviews evidence
          from both sides. The completion code confirms work was done — it never waives your right to dispute quality.</P>
      </section>
    </Doc>
  );
}
