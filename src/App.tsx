import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import MyChildPage from "./pages/MyChildPage";
import PerformancePage from "./pages/PerformancePage";
import AttendancePage from "./pages/AttendancePage";
import AssignmentsPage from "./pages/AssignmentsPage";
import TestsPage from "./pages/TestsPage";
import ConceptStrengthsPage from "./pages/ConceptStrengthsPage";
import BehaviourPage from "./pages/BehaviourPage";
import TeacherNotesPage from "./pages/TeacherNotesPage";
import MessagesPage from "./pages/MessagesPage";
import AlertsPage from "./pages/AlertsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/my-child" element={<MyChildPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/tests" element={<TestsPage />} />
          <Route path="/concepts" element={<ConceptStrengthsPage />} />
          <Route path="/behaviour" element={<BehaviourPage />} />
          <Route path="/teacher-notes" element={<TeacherNotesPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
