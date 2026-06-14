import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { ToastProvider } from "./components/Toast.js";
import { BatchPage } from "./pages/Batch.js";
import { CreatePage } from "./pages/Create.js";
import { DashboardPage } from "./pages/Dashboard.js";
import { GalleryPage } from "./pages/Gallery.js";
import { SettingsPage } from "./pages/Settings.js";
import { TasksPage } from "./pages/Tasks.js";

export default function App() {
  return (
    <ToastProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/batch" element={<BatchPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </ToastProvider>
  );
}
