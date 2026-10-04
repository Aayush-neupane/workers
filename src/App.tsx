import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/layout";
import { Protected } from "./components/Protected";
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
const Invite = lazy(() => import("./pages/Invite"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Track = lazy(() => import("./pages/Track"));
const Profile = lazy(() => import("./pages/Profile"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Worker = lazy(() => import("./pages/Worker"));
const AdminOverview = lazy(() => import("./pages/admin/Overview"));
const AdminBookings = lazy(() => import("./pages/admin/Bookings"));
const AdminVerify = lazy(() => import("./pages/admin/Verify"));
const AdminPeople = lazy(() => import("./pages/admin/People"));
const AdminServices = lazy(() => import("./pages/admin/Services"));
const AdminFinance = lazy(() => import("./pages/admin/Finance"));
const AdminRewards = lazy(() => import("./pages/admin/Rewards"));
const AdminSupport = lazy(() => import("./pages/admin/Support"));
const AdminAudit = lazy(() => import("./pages/admin/Audit"));
const AdminShell = lazy(() => import("./components/AdminNav").then((m) => ({ default: m.AdminShell })));
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
                <Route path="/signin" element={<Signin mode="signin" />} />
                <Route path="/signup" element={<Signin mode="signup" />} />
                <Route path="/invite" element={<Invite />} />
                <Route path="/support" element={<Support />} />
                <Route path="/terms" element={<LegalTerms />} />
                <Route path="/privacy" element={<LegalPrivacy />} />
                <Route path="/cancellation" element={<LegalCancellation />} />
                <Route
                  path="/book/:id"
                  element={<Protected><Book /></Protected>}
                />
                <Route
                  path="/book/confirm/:id"
                  element={<Protected><Confirm /></Protected>}
                />
                <Route
                  path="/dashboard"
                  element={<Protected><Dashboard /></Protected>}
                />
                <Route
                  path="/track/:id"
                  element={<Protected><Track /></Protected>}
                />
                <Route
                  path="/profile"
                  element={<Protected><Profile /></Protected>}
                />
                <Route
                  path="/rewards"
                  element={<Protected><Rewards /></Protected>}
                />
                <Route
                  path="/worker"
                  element={<Protected roles={["worker", "admin"]}><Worker /></Protected>}
                />
                <Route
                  path="/admin"
                  element={<Protected roles={["admin"]}><AdminShell><AdminOverview /></AdminShell></Protected>}
                />
                <Route
                  path="/admin/bookings"
                  element={<Protected roles={["admin"]}><AdminShell><AdminBookings /></AdminShell></Protected>}
                />
                <Route
                  path="/admin/verify"
                  element={<Protected roles={["admin"]}><AdminShell><AdminVerify /></AdminShell></Protected>}
                />
                <Route
                  path="/admin/people"
                  element={<Protected roles={["admin"]}><AdminShell><AdminPeople /></AdminShell></Protected>}
                />
                <Route
                  path="/admin/services"
                  element={<Protected roles={["admin"]}><AdminShell><AdminServices /></AdminShell></Protected>}
                />
                <Route
                  path="/admin/finance"
                  element={<Protected roles={["admin"]}><AdminShell><AdminFinance /></AdminShell></Protected>}
                />
                <Route
                  path="/admin/rewards"
                  element={<Protected roles={["admin"]}><AdminShell><AdminRewards /></AdminShell></Protected>}
                />
                <Route
                  path="/admin/support"
                  element={<Protected roles={["admin"]}><AdminShell><AdminSupport /></AdminShell></Protected>}
                />
                <Route
                  path="/admin/audit"
                  element={<Protected roles={["admin"]}><AdminShell><AdminAudit /></AdminShell></Protected>}
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Shell>
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
