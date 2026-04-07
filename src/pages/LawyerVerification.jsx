import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { FileBadge2, UploadCloud } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import { apiFetch } from "../lib/api.js";

export default function LawyerVerification() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    enrollment_number: user?.enrollment_number || "",
    state_bar_council: user?.state_bar_council || "",
    practice_area: user?.practice_area || "",
    id_card_name: "",
    id_card_data_url: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const statusBadge = useMemo(() => {
    const status = user?.verification_status || "not_submitted";
    if (status === "approved") return "bg-emerald-100 text-emerald-700";
    if (status === "pending") return "bg-amber-100 text-amber-700";
    if (status === "rejected") return "bg-red-100 text-red-700";
    return "bg-slate-100 text-slate-700";
  }, [user?.verification_status]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin/verifications" replace />;
  if (user.verification_status === "approved") return <Navigate to="/LegalChatbot" replace />;

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        id_card_name: file.name,
        id_card_data_url: typeof reader.result === "string" ? reader.result : "",
      }));
    };
    reader.readAsDataURL(file);
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await apiFetch("/auth/verify-lawyer", {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verification submission failed");
      await refreshUser();
      setMessage("Verification submitted. Admin review is now pending.");
    } catch (err) {
      setError(err.message || "Verification submission failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <FileBadge2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Lawyer Verification</h1>
              <p className="text-sm text-slate-500">Submit your enrollment details once. Future logins stay simple.</p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadge}`}>
            {user.verification_status?.replace(/_/g, " ")}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <Field label="Full name">
            <input
              value={form.full_name}
              onChange={(e) => updateField("full_name", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </Field>

          <Field label="Enrollment number">
            <input
              value={form.enrollment_number}
              onChange={(e) => updateField("enrollment_number", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </Field>

          <Field label="State bar council">
            <input
              value={form.state_bar_council}
              onChange={(e) => updateField("state_bar_council", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="Telangana, Andhra Pradesh, Delhi..."
            />
          </Field>

          <Field label="Practice area">
            <input
              value={form.practice_area}
              onChange={(e) => updateField("practice_area", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
              placeholder="Criminal, Civil, Corporate..."
            />
          </Field>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-slate-700">Advocate ID / Bar Council proof</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              <UploadCloud className="h-5 w-5" />
              {form.id_card_name || "Upload image or PDF"}
              <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {error ? <p className="md:col-span-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {message ? <p className="md:col-span-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit for Admin Approval"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
