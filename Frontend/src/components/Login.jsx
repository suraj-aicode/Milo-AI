import React, { useState, useEffect } from "react";
import { authApi } from "../services/api";

export default function Login({ onLogin, isDarkMode, toggleDarkMode }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      const bg = document.querySelector(".liquid-gradient-bg");
      if (bg) {
        bg.style.background = `
          radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(111, 168, 255, 0.12) 0%, transparent 35%),
          radial-gradient(circle at ${100 - x * 100}% ${100 - y * 100}%, rgba(203, 190, 255, 0.15) 0%, transparent 35%)
        `;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);

    try {
      const data = isRegister
        ? await authApi.register(email.trim(), password.trim())
        : await authApi.login(email.trim(), password.trim());

      const { access_token, user } = data;
      onLogin({
        ...user,
        token: access_token,
      });
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.detail ||
        (isRegister
          ? "Registration failed. Please check details."
          : "Login failed. Invalid email or password.");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col items-center justify-center p-4 relative bg-[#f8f9ff] dark:bg-[#242423] transition-colors duration-300">
      {/* Dark mode toggle top right */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={toggleDarkMode}
          className="p-2.5 rounded-full glass-surface text-on-surface hover:scale-105 transition-all cursor-pointer shadow-md flex items-center gap-2 text-xs font-semibold"
          title="Toggle Dark Mode"
        >
          <span className="material-symbols-outlined text-sm">
            {isDarkMode ? "light_mode" : "dark_mode"}
          </span>
          <span>{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>

      {/* Atmospheric Background Elements */}
      <div className="fixed inset-0 liquid-gradient-bg z-[-2]"></div>
      <div
        className="glass-circle w-[400px] h-[400px] -top-20 -left-20"
        style={{ animationDelay: "0s" }}
      ></div>
      <div
        className="glass-circle w-[600px] h-[600px] -bottom-40 -right-40"
        style={{ animationDelay: "-5s" }}
      ></div>
      <div
        className="glass-circle w-[300px] h-[300px] top-1/2 left-1/3 opacity-40"
        style={{ animationDelay: "-2s" }}
      ></div>

      {/* Main Container */}
      <main className="w-full max-w-[420px] z-10 my-auto flex flex-col items-center">
        {/* Brand Identity */}
        <div className="flex flex-col items-center mb-4 space-y-1">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center transform transition-transform hover:scale-105">
            <img src="/logo.svg" alt="MILO Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-headline-md text-[22px] font-bold text-on-surface tracking-tight">
            MILO AI
          </h1>
        </div>

        {/* Login/Register Card */}
        <div className="w-full glass-surface rounded-[24px] p-6 transition-all duration-500 shadow-xl">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-on-surface mb-1">
              {isRegister ? "Create account" : "Welcome back"}
            </h2>
            <p className="text-xs text-on-surface-variant">
              {isRegister
                ? "Enter your credentials to create your workspace."
                : "Enter your credentials to access your workspace."}
            </p>
          </div>

          {error && (
            <div className="mb-3 p-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Form */}
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label
                className="text-xs font-semibold text-on-surface-variant block px-1"
                htmlFor="email"
              >
                Email Address
              </label>
              <div className="relative flex items-center input-focus-effect transition-all duration-300 border border-outline-variant/60 bg-white/30 dark:bg-white/5 rounded-xl px-3 h-[46px]">
                <span className="material-symbols-outlined text-outline text-lg mr-2">
                  mail
                </span>
                <input
                  className="bg-transparent border-none focus:ring-0 w-full text-xs text-on-surface placeholder:text-outline-variant outline-none"
                  id="email"
                  name="email"
                  placeholder="name@company.com"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center px-1">
                <label
                  className="text-xs font-semibold text-on-surface-variant"
                  htmlFor="password"
                >
                  Password
                </label>
                {!isRegister && (
                  <a
                    className="text-xs font-semibold text-primary hover:underline transition-all"
                    href="#forgot"
                    onClick={(e) => e.preventDefault()}
                  >
                    Forgot?
                  </a>
                )}
              </div>
              <div className="relative flex items-center input-focus-effect transition-all duration-300 border border-outline-variant/60 bg-white/30 dark:bg-white/5 rounded-xl px-3 h-[46px]">
                <span className="material-symbols-outlined text-outline text-lg mr-2">
                  lock
                </span>
                <input
                  className="bg-transparent border-none focus:ring-0 w-full text-xs text-on-surface placeholder:text-outline-variant outline-none"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              disabled={loading}
              className="w-full h-[46px] bg-primary text-white font-semibold text-xs rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              type="submit"
            >
              {loading
                ? isRegister
                  ? "Creating Account..."
                  : "Logging in..."
                : isRegister
                ? "Register Account"
                : "Continue"}
              <span className="material-symbols-outlined text-base">
                arrow_forward
              </span>
            </button>
          </form>

          {/* Toggle Login/Register */}
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              className="text-xs font-semibold text-primary hover:underline cursor-pointer"
            >
              {isRegister
                ? "Already have an account? Sign in"
                : "Don't have an account? Create one"}
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-3 flex items-center">
            <div className="flex-grow border-t border-outline-variant/30"></div>
            <span className="mx-3 text-[10px] text-outline-variant uppercase tracking-widest font-bold">
              or
            </span>
            <div className="flex-grow border-t border-outline-variant/30"></div>
          </div>

          {/* Social Logins */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail("demo@google.com");
                setPassword("demo1234");
              }}
              className="flex items-center justify-center h-[42px] rounded-xl border border-outline-variant/60 bg-white/20 dark:bg-white/5 hover:bg-white/40 transition-all active:scale-[0.98] cursor-pointer"
            >
              <div className="w-4 h-4 mr-2 flex items-center justify-center overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  ></path>
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  ></path>
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  ></path>
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  ></path>
                </svg>
              </div>
              <span className="text-xs font-medium text-on-surface">
                Demo Auto-fill
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              className="flex items-center justify-center h-[42px] rounded-xl border border-outline-variant/60 bg-white/20 dark:bg-white/5 hover:bg-white/40 transition-all active:scale-[0.98] cursor-pointer"
            >
              <span className="text-xs font-medium text-on-surface">
                {isRegister ? "Sign In" : "Register"}
              </span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
