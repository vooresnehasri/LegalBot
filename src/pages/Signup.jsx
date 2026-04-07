import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(form);
      navigate("/login", {
        replace: true,
        state: { message: "Account created. Please log in and complete verification." },
      });
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lawyer Signup</h1>
            <p className="text-sm text-slate-500">Create your account once, then complete verification.</p>
          </div>
        </div>

        <label className="mb-2 block text-sm font-medium text-slate-700">Full name</label>
        <input
          value={form.full_name}
          onChange={(e) => handleChange("full_name", e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-3"
          placeholder="Advocate full name"
        />

        <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
        <input
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-3"
          placeholder="advocate@example.com"
        />

        <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
        <input
          value={form.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-3"
          placeholder="+91..."
        />

        <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          value={form.password}
          onChange={(e) => handleChange("password", e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-3"
          placeholder="Minimum 8 characters"
        />

        {error ? <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create account"}
        </button>

        <p className="mt-4 text-sm text-slate-600">
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}
