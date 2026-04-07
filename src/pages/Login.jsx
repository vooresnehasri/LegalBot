import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(emailOrPhone, password);
      const nextPath =
        user.role === "admin"
          ? "/admin/verifications"
          : user.verification_status === "approved"
          ? location.state?.from || "/LegalChatbot"
          : "/verify-lawyer";
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center px-6 py-12">
      <form onSubmit={handleSubmit} className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Lawyer Login</h1>
            <p className="text-sm text-slate-500">Access is limited to approved legal professionals.</p>
          </div>
        </div>

        <label className="mb-2 block text-sm font-medium text-slate-700">Email or phone</label>
        <input
          value={emailOrPhone}
          onChange={(e) => setEmailOrPhone(e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-3"
          placeholder="advocate@example.com or phone"
        />

        <label className="mb-2 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-3"
          placeholder="Enter your password"
        />

        {error ? <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Login"}
        </button>

        <p className="mt-4 text-sm text-slate-600">
          New lawyer account?{" "}
          <Link to="/signup" className="font-semibold text-blue-600 hover:underline">
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
}
