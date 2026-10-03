import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/layout";
import { AuthProvider } from "./lib/auth";
import { StoreProvider } from "./lib/store";
import Book from "./pages/Book";
import Confirm from "./pages/Confirm";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Rewards from "./pages/Rewards";
import ServiceDetail from "./pages/ServiceDetail";
import Services from "./pages/Services";
import Signin from "./pages/Signin";
import Track from "./pages/Track";
import Worker from "./pages/Worker";
import WorkerProfile from "./pages/WorkerProfile";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StoreProvider>
          <Shell>
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
              <Route path="/worker" element={<Worker />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Shell>
        </StoreProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
