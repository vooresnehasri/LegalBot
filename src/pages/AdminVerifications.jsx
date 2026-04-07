import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX } from "lucide-react";
import { apiFetch } from "../lib/api.js";

export default function AdminVerifications() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/admin/verifications");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load verification requests");
      setRecords(data.verifications || []);
    } catch (err) {
      setError(err.message || "Failed to load verification requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleReview = async (id, action) => {
    const rejection_reason =
      action === "reject" ? window.prompt("Reason for rejection", "Details could not be verified") || "" : "";
    const response = await apiFetch(`/admin/verifications/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action, rejection_reason }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Review failed");
    await loadRecords();
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Admin Verification Queue</h1>
        <p className="text-slate-500">Approve or reject lawyer access requests from one place.</p>
      </div>

      {loading ? <p className="text-slate-500">Loading requests...</p> : null}
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {!loading && !records.length ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
          No pending verification requests.
        </div>
      ) : null}

      <div className="grid gap-6">
        {records.map((record) => (
          <div key={record.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <Info label="Full name" value={record.full_name} />
              <Info label="Email" value={record.email || "Not provided"} />
              <Info label="Phone" value={record.phone || "Not provided"} />
              <Info label="Enrollment number" value={record.enrollment_number} />
              <Info label="State bar council" value={record.state_bar_council} />
              <Info label="Practice area" value={record.practice_area} />
            </div>

            {record.id_card_data_url ? (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-slate-700">Uploaded proof</p>
                <a
                  href={record.id_card_data_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Open {record.id_card_name || "uploaded document"}
                </a>
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => handleReview(record.id, "approve")}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
              >
                <ShieldCheck className="h-4 w-4" />
                Approve
              </button>
              <button
                onClick={() => handleReview(record.id, "reject")}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-700"
              >
                <ShieldX className="h-4 w-4" />
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-900">{value}</p>
    </div>
  );
}
