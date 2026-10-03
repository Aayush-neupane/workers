import { Wrench } from "lucide-react";

export default function App() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "32rem" }}>
        <Wrench size={40} aria-hidden="true" />
        <h1>Workers</h1>
        <p>Verified local services marketplace. Scaffold is live.</p>
      </div>
    </main>
  );
}
