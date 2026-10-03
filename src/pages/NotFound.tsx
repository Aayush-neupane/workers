import { Link } from "react-router-dom";
import { Button } from "../components/ui";

export default function NotFound() {
  return (
    <div className="wrap py-20 text-center">
      <h1 className="text-3xl font-bold">Page in progress</h1>
      <p className="mx-auto mt-2 max-w-md text-on-surface-variant">
        This section lands in an upcoming commit. The marketplace is being built task by task.
      </p>
      <div className="mt-6">
        <Link to="/">
          <Button>Back home</Button>
        </Link>
      </div>
    </div>
  );
}
