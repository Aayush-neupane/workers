import { Card, SectionHead } from "../components/ui";

function Page({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="wrap fade-up max-w-3xl py-10">
      <SectionHead eyebrow={eyebrow} title={title} />
      <Card className="prose-sm mt-6 space-y-4 p-6 text-sm leading-relaxed md:p-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:pt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
      </Card>
      <p className="mt-4 text-xs text-on-surface-variant">Last updated 1 Oct 2026 · Draft for review — have local counsel confirm before launch.</p>
    </div>
  );
}

export function Terms() {
  return (
    <Page eyebrow="Legal" title="Terms of service">
      <h2>1. The marketplace</h2>
      <p>Workers connects customers with verified independent professionals. Workers is a managed marketplace: it assigns jobs, sets commission rules and handles support, but the service itself is performed by the professional.</p>
      <h2>2. Accounts</h2>
      <ul>
        <li>Customers register freely and are responsible for accurate contact details.</li>
        <li>Worker accounts are created by administrators only, after verification.</li>
        <li>One account per person; sharing credentials is prohibited.</li>
      </ul>
      <h2>3. Bookings & prices</h2>
      <ul>
        <li>Displayed prices are estimates unless marked fixed. Final amounts require customer confirmation.</li>
        <li>Workers may not change an agreed price without recorded customer approval.</li>
        <li>Valid status transitions are enforced; backdating or skipping states is not permitted.</li>
      </ul>
      <h2>4. Payments</h2>
      <ul>
        <li>Cash is collected by the worker per policy and receipted in-app.</li>
        <li>Online payments are verified provider-side; frontend confirmations are never proof of payment.</li>
        <li>Platform commission is deducted before worker payout; cash commissions remain owed until settlement.</li>
      </ul>
      <h2>5. Reviews</h2>
      <p>Only completed bookings can be reviewed, once each. Fake, incentivized or duplicate reviews are removed and may suspend the account.</p>
      <h2>6. Liability</h2>
      <p>Workers carries warranty obligations stated per service. Consequential damages are limited to the booking value unless caused by gross negligence.</p>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page eyebrow="Legal" title="Privacy policy">
      <h2>1. What we collect</h2>
      <ul>
        <li>Contact details, addresses and booking history needed to run the service.</li>
        <li>Worker verification documents, stored privately with restricted access.</li>
        <li>Support messages and audit logs for safety and dispute resolution.</li>
      </ul>
      <h2>2. What we never do</h2>
      <ul>
        <li>Never sell personal data. Never expose worker documents to customers.</li>
        <li>Never store payment passwords or card numbers — payments go straight to licensed gateways.</li>
      </ul>
      <h2>3. Access & retention</h2>
      <p>Customers see only their own records; workers see only assigned jobs; admins see what their role requires. Financial and booking history is retained for reconciliation; verification documents follow a documented retention schedule.</p>
      <h2>4. Your rights</h2>
      <p>Request export or deletion of your data via support. Deletion honors legal retention for financial records, which are anonymized where possible.</p>
    </Page>
  );
}

export function Cancellation() {
  return (
    <Page eyebrow="Legal" title="Cancellation & refunds">
      <h2>1. Customer cancellation</h2>
      <ul>
        <li>Before worker confirmation: free, instant, automatic.</li>
        <li>After confirmation, 4+ hours before slot: free.</li>
        <li>Inside 4 hours or after dispatch: visit charge up to Rs 500 may apply; the remainder is refunded.</li>
        <li>No-show by customer after pro arrival: visit charge applies.</li>
      </ul>
      <h2>2. Worker / platform cancellation</h2>
      <ul>
        <li>If no eligible pro is available or the pro fails to arrive, you choose: free reschedule or full refund.</li>
        <li>Prepaid online amounts return to the source wallet within the gateway&apos;s settlement window.</li>
      </ul>
      <h2>3. Rescheduling</h2>
      <p>One free reschedule per booking up to 4 hours before the slot. Further changes go through support.</p>
      <h2>4. Disputes</h2>
      <p>Raise within 48 hours of completion. Settlement pauses while support reviews evidence from both sides. Chargebacks follow gateway rules; reward points from refunded bookings are reversed.</p>
      <h2>5. Rewards on refunds</h2>
      <p>Points earned by a refunded booking are reversed. Redeemed discounts on refunded bookings return as points, never cash.</p>
    </Page>
  );
}
