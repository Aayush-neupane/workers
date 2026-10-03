import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/layout";
import { ScrollToTop } from "./components/ScrollToTop";
import { AuthProvider } from "./lib/auth";
import { StoreProvider } from "./lib/store";
import Home from "./pages/Home";

const Services = lazy(() => import("./pages/Services"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail"));
const WorkerProfile = lazy(() => import("./pages/WorkerProfile"));
const Book = lazy(() => import("./pages/Book"));
const Confirm = lazy(() => import("./pages/Confirm"));
const Signin = lazy(() => import("./pages/Signin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Track = lazy(() => import("./pages/Track"));
const Profile = lazy(() => import("./pages/Profile"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Worker = lazy(() => import("./pages/Worker"));
const Admin = lazy(() => import("./pages/Admin"));
const Support = lazy(() => import("./pages/Support"));
const LegalTerms = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Terms })));
const LegalPrivacy = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Privacy })));
const LegalCancellation = lazy(() =>
  import("./pages/Legal").then((m) => ({ default: m.Cancellation })),
);
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <StoreProvider>
          <Shell>
            <Suspense
              fallback={
                <p role="status" className="wrap py-16 text-center text-on-surface-variant">
                  Loading…
                </p>
              }
            >
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/services" element={<Services />} />
                <Route path="/services/:id" element={<ServiceDetail />} />
                <Route path="/workers/:id" element={<WorkerProfile />} />
                <Route path="/book/:id" element={<Book />} />
                <Route path="/book/confirm/:id" element={<Confirm />} />
                <Route path="/signin" element={<Signin mode="signin" />} />
                <Route path="/signup" element={<Signin mode="signup" />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/track/:id" element={<Track />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/rewards" element={<Rewards />} />
                <Route path="/worker" element={<Worker />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/support" element={<Support />} />
                <Route path="/terms" element={<LegalTerms />} />
                <Route path="/privacy" element={<LegalPrivacy />} />
                <Route path="/cancellation" element={<LegalCancellation />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Shell>
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
