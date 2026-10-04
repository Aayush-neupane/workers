import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/layout";
import { Protected } from "./components/Protected";
import { CookieConsent } from "./components/CookieConsent";
import { AuthProvider } from "./lib/auth";
import Home from "./pages/Home";

const Services = lazy(() => import("./pages/Services"));
const ServiceDetail = lazy(() => import("./pages/ServiceDetail"));
const Signin = lazy(() => import("./pages/Signin"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Book = lazy(() => import("./pages/Book"));
const QuoteNew = lazy(() => import("./pages/QuoteNew"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Invite = lazy(() => import("./pages/Invite"));
const Track = lazy(() => import("./pages/Track"));
const Profile = lazy(() => import("./pages/Profile"));
const Worker = lazy(() => import("./pages/Worker"));
const Admin = lazy(() => import("./pages/Admin"));
const Support = lazy(() => import("./pages/Support"));
const LegalTerms = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Terms })));
const LegalPrivacy = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Privacy })));
const LegalCookies = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Cookies })));
const LegalCancellation = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Cancellation })));
const NotFound = lazy(() => import("./pages/NotFound"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Shell>
          <Suspense fallback={<p role="status" className="wrap py-16 text-center text-on-surface-variant">Loading…</p>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:id" element={<ServiceDetail />} />
              <Route path="/signin" element={<Signin mode="signin" />} />
              <Route path="/signup" element={<Signin mode="signup" />} />
              <Route path="/invite" element={<Invite />} />
              <Route path="/support" element={<Support />} />
              <Route path="/terms" element={<LegalTerms />} />
              <Route path="/privacy" element={<LegalPrivacy />} />
              <Route path="/cookies" element={<LegalCookies />} />
              <Route path="/cancellation" element={<LegalCancellation />} />
              <Route path="/book/:id" element={<Protected><Book /></Protected>} />
              <Route path="/quotes/new" element={<Protected><QuoteNew /></Protected>} />
              <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
              <Route path="/rewards" element={<Protected><Rewards /></Protected>} />
              <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
              <Route path="/track/:id" element={<Protected><Track /></Protected>} />
              <Route path="/profile" element={<Protected><Profile /></Protected>} />
              <Route path="/welcome" element={<Protected><Onboarding /></Protected>} />
              <Route path="/worker" element={<Protected roles={["worker", "admin"]}><Worker /></Protected>} />
              <Route path="/admin" element={<Protected roles={["admin"]}><Admin /></Protected>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Shell>
        <CookieConsent />
      </AuthProvider>
    </BrowserRouter>
  );
}
