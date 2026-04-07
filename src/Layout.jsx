import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Scale,
  House,
  FileText,
  MessageSquare,
  Shield,
  BookOpen,
  BarChart3,
  FileSearch,
  Languages,
  LogOut,
  UserRound,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "./auth/AuthContext.jsx";

const navItems = [
  { name: "Home", path: "/", icon: House },
  { name: "Documents", path: "/DocumentGenerator", icon: FileText },
  { name: "Chatbot", path: "/LegalChatbot", icon: MessageSquare },
  { name: "Analyzer", path: "/DocumentAnalyzer", icon: Shield },
  { name: "Cases", path: "/CaseLibrary", icon: BookOpen },
  { name: "Workspace", path: "/Analytics", icon: BarChart3 },
  { name: "Summarizer", path: "/DocumentSummarizer", icon: FileSearch },
  { name: "Translator", path: "/Translator", icon: Languages },
];

export default function Layout({ children }) {
  const location = useLocation();
  const { user, isApprovedLawyer, isAdmin, logout } = useAuth();
  const isHome = location.pathname === "/";
  const visibleNavItems = isApprovedLawyer ? navItems : navItems.filter((item) => item.path === "/");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const userInitials = user?.full_name
    ? user.full_name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("")
    : "U";

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#e7ecf3] p-2 sm:p-3">
      <div className="overflow-hidden rounded-2xl border border-slate-300/90 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
        <header className="z-50 border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 py-5 lg:px-6">
            <Link to="/" className="flex min-w-[250px] shrink-0 items-center gap-3 xl:min-w-[280px]">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-500 text-white shadow-md">
                <Scale className="h-7 w-7" />
              </div>
              <div className="min-w-0">
                <p className="truncate bg-gradient-to-r from-blue-600 to-violet-500 bg-clip-text text-4xl font-extrabold leading-none text-transparent">
                  LexIntel
                </p>
                <p className="truncate text-[14px] font-medium text-slate-500">Legal AI Platform</p>
              </div>
            </Link>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex xl:gap-2">
              {visibleNavItems.map((item) => {
                const active = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-3 text-sm font-medium transition xl:px-3 ${
                      active
                        ? "bg-blue-100 text-blue-600"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}

              {isAdmin ? (
                <Link
                  to="/admin/verifications"
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium transition xl:px-4 ${
                      location.pathname === "/admin/verifications"
                        ? "bg-blue-100 text-blue-600"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Shield className="h-5 w-5" />
                  Admin
                </Link>
              ) : null}

              {user ? (
                <div ref={menuRef} className="relative ml-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    className="flex w-[200px] items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700">
                      {userInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-900">{user.full_name}</span>
                      <span className="mt-0.5 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">
                        {user.role}
                      </span>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition ${menuOpen ? "rotate-180" : ""}`} />
                  </button>

                  {menuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_16px_32px_rgba(15,23,42,0.14)]">
                      <div className="mb-2 rounded-xl bg-slate-50 px-3 py-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
                        <p className="truncate text-xs text-slate-500">{user.email || user.phone || "Verified account"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          logout();
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <LogOut className="h-4 w-4" />
                        Logout
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 xl:px-4"
                  >
                    <UserRound className="h-5 w-5" />
                    Login
                  </Link>
                  <Link
                    to="/signup"
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-medium text-white hover:bg-blue-700 xl:px-4"
                  >
                    Signup
                  </Link>
                </>
              )}
            </nav>
          </div>
        </header>

        <main className={isHome ? "" : "mx-auto w-full max-w-7xl px-6 py-12"}>{children}</main>
      </div>
    </div>
  );
}
