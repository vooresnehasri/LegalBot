import { Routes, Route } from "react-router-dom";
import Layout from "./Layout.jsx";
import ProtectedRoute from "./auth/ProtectedRoute.jsx";

import Home from "./pages/Home.jsx";
import DocumentGenerator from "./pages/DocumentGenerator.jsx";
import LegalChatbot from "./pages/LegalChatbot.jsx";
import DocumentAnalyzer from "./pages/DocumentAnalyzer.jsx";
import CaseLibrary from "./pages/CaseLibrary.jsx";
import Analytics from "./pages/Analytics.jsx";
import DocumentSummarizer from "./pages/DocumentSummarizer.jsx";
import Translator from "./pages/Translator.jsx";
import VoiceAssistant from "./pages/VoiceAssistant.jsx";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import LawyerVerification from "./pages/LawyerVerification.jsx";
import AdminVerifications from "./pages/AdminVerifications.jsx";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-lawyer" element={<LawyerVerification />} />
        <Route
          path="/admin/verifications"
          element={
            <ProtectedRoute requireAdmin>
              <AdminVerifications />
            </ProtectedRoute>
          }
        />
        <Route path="/DocumentGenerator" element={<ProtectedRoute><DocumentGenerator /></ProtectedRoute>} />
        <Route path="/LegalChatbot" element={<ProtectedRoute><LegalChatbot /></ProtectedRoute>} />
        <Route path="/DocumentAnalyzer" element={<ProtectedRoute><DocumentAnalyzer /></ProtectedRoute>} />
        <Route path="/CaseLibrary" element={<ProtectedRoute><CaseLibrary /></ProtectedRoute>} />
        <Route path="/Analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/DocumentSummarizer" element={<ProtectedRoute><DocumentSummarizer /></ProtectedRoute>} />
        <Route path="/Translator" element={<ProtectedRoute><Translator /></ProtectedRoute>} />
        <Route path="/VoiceAssistant" element={<ProtectedRoute><VoiceAssistant /></ProtectedRoute>} />
      </Routes>
    </Layout>
  );
}

export default App;
