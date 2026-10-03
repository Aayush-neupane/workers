import { Shell } from "./components/layout";
import { Badge, Button, Card, Rating, SectionHead, StatusBadge, VerifyBadge } from "./components/ui";

export default function App() {
  return (
    <Shell>
      <div className="wrap fade-up py-12">
        <SectionHead
          eyebrow="Design system"
          title="Workers marketplace is under construction"
          body="Full experience lands over the next commits. The primitives below already work."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <h3 className="font-bold">Actions</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold">Status</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status="in-progress" />
              <VerifyBadge state="verified" />
              <Badge tone="info">eSewa</Badge>
            </div>
            <div className="mt-3">
              <Rating value={4.8} count={1240} />
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold">Routing</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              Home, directory, booking flow and dashboards arrive next.
            </p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
