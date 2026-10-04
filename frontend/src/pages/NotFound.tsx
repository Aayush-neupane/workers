import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export default function NotFound() {
  return (
    <div className="wrap py-16 text-center">
      <p className="font-display text-5xl font-semibold">404</p>
      <p className="mt-2 text-on-surface-variant">This corner of Damak doesn't exist.</p>
      <Link to="/" className="mt-6 inline-block"><Button>Back home</Button></Link>
    </div>
  );
}
