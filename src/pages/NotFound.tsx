import { Link } from "react-router-dom";
import { Button, PageHero } from "../components/ui";

export default function NotFound() {
  return (
    <div className="fade-up">
      <PageHero
        eyebrow="404"
        title="This page is still on the truck"
        body="The marketplace is built task by task — this section either moved or hasn't landed yet."
      >
        <Link to="/">
          <Button variant="marigold">Back home</Button>
        </Link>
      </PageHero>
    </div>
  );
}
