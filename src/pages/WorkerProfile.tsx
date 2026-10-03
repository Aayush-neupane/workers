import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, MapPin } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Price, Rating, VerifyBadge } from "../components/ui";
import { CATEGORIES, REVIEWS, SERVICES, WORKERS } from "../data/mock";
import { isEligibleWorker } from "../lib/booking";
import { formatDate } from "../lib/format";

export default function WorkerProfile() {
  const { id } = useParams();
  const worker = WORKERS.find((w) => w.id === id);

  if (!worker) {
    return (
      <div className="wrap py-12">
        <EmptyState
          title="Professional not found"
          body="This profile may have been removed."
          action={<Link to="/services"><Button>Browse services</Button></Link>}
        />
      </div>
    );
  }

  const eligible = isEligibleWorker(worker);
  const offered = SERVICES.filter((s) => worker.categoryIds.includes(s.categoryId)).slice(0, 6);
  const reviews = REVIEWS.filter((r) => r.workerId === worker.id);
  const cats = CATEGORIES.filter((c) => worker.categoryIds.includes(c.id));

  return (
    <div className="wrap fade-up py-10">
      <Link to="/services" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
        <ArrowLeft size={15} aria-hidden="true" /> Back to services
      </Link>

      <Card className="mt-4 p-6 md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={worker.name} hue={worker.avatarHue} size={84} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{worker.name}</h1>
              <VerifyBadge state={worker.verification} />
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {cats.map((c) => (
                <Badge key={c.id}>{c.name}</Badge>
              ))}
            </div>
            <p className="mt-3 max-w-2xl text-on-surface-variant">{worker.bio}</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <Briefcase size={14} aria-hidden="true" /> {worker.yearsExp} years experience
              </span>
              {worker.areas.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} aria-hidden="true" /> {worker.areas.join(", ")}
                </span>
              )}
              <span>Member since {formatDate(worker.joinedAt)}</span>
            </div>
          </div>
          <div className="text-center sm:text-right">
            {worker.jobsDone > 0 ? (
              <Rating value={worker.rating} count={worker.jobsDone} />
            ) : (
              <p className="text-sm text-on-surface-variant">No jobs yet</p>
            )}
          </div>
        </div>
        {!eligible && (
          <p className="mt-4 rounded-md bg-warning-container p-3 text-sm text-warning" role="note">
            This professional is not currently eligible for new assignments
            ({worker.verification}). Only verified, active pros receive bookings.
          </p>
        )}
      </Card>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-bold">Services offered</h2>
          <div className="mt-3 grid gap-3">
            {offered.map((s) => (
              <Link key={s.id} to={`/services/${s.id}`}>
                <Card className="flex items-center justify-between gap-3 p-4 transition hover:border-primary">
                  <span>
                    <span className="block font-bold">{s.name}</span>
                    <Rating value={s.rating} />
                  </span>
                  <Price paisa={s.basePricePaisa} prefix="from " />
                </Card>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold">Reviews ({reviews.length})</h2>
          {reviews.length === 0 ? (
            <p className="mt-3 text-sm text-on-surface-variant">No reviews yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {reviews.map((r) => (
                <Card key={r.id} className="p-4">
                  <Rating value={r.rating} />
                  <p className="mt-1 text-sm">“{r.text}”</p>
                  <p className="mt-1 text-xs text-on-surface-variant">Verified booking {r.bookingId}</p>
                </Card>
              ))}
            </ul>
          )}
          {eligible && offered[0] && (
            <div className="mt-4">
              <Link to={`/book/${offered[0].id}`}>
                <Button>Book {worker.name.split(" ")[0]}&apos;s service</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
