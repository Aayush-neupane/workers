import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Shell } from "./components/layout";
import { StoreProvider } from "./lib/store";
import Book from "./pages/Book";
import Confirm from "./pages/Confirm";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import ServiceDetail from "./pages/ServiceDetail";
import Services from "./pages/Services";
import WorkerProfile from "./pages/WorkerProfile";

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Shell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/services/:id" element={<ServiceDetail />} />
            <Route path="/workers/:id" element={<WorkerProfile />} />
            <Route path="/book/:id" element={<Book />} />
            <Route path="/book/confirm/:id" element={<Confirm />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Shell>
      </StoreProvider>
    </BrowserRouter>
  );
}
