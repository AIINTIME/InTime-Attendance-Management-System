import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Context/AuthContext";
import { useToast } from "../../Context/ToastContext";
import { extractErrorMessage } from "../../Utils/validation";
import { DEMO_CREDENTIALS } from "../../Utils/constants";
import "../../Styles/Login.css";

export default function EmployeeLogin() {
  const [theme, setTheme] = useState("dark");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const toast = useToast();
  const { user, isLoading: authLoading, loginAsEmployee, loginAsAdmin } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      if (user.role === "admin" || user.role === "manager") {
        navigate("/admin/dashboard", { replace: true });
      } else {
        navigate("/employee/home", { replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  // Sync theme with document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      // Try employee login first
      try {
        await loginAsEmployee(email.trim(), password);
        toast.success("Welcome back!");
        navigate("/employee/home", { replace: true });
        return;
      } catch (empErr) {
        // If employee login failed, attempt admin login
        try {
          await loginAsAdmin(email.trim(), password);
          toast.success("Welcome back, Admin!");
          navigate("/admin/dashboard", { replace: true });
          return;
        } catch (adminErr) {
          setError(
            extractErrorMessage(
              empErr,
              "Login failed. Please check your email and password."
            )
          );
        }
      }
    } catch (err) {
      setError("Cannot connect to server. Make sure the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const logoSrc =
    theme === "dark"
      ? "/Logos/Dark Mode Logo.png"
      : "/Logos/Light Mode Logo.png";

  const desktopIllustrationSrc =
    theme === "dark"
      ? "/Login/Login desktop (Dark Mode)/login-illustration-dark.png"
      : "/Login/Login Desktop (Light Mode)/login-illustration-light.png";

  const mobileHeroBannerSrc =
    theme === "dark"
      ? "/Login/mobile_hero_dark_clean.png"
      : "/Login/mobile_hero_light_clean.png";

  const mobileSkylineSrc =
    theme === "dark"
      ? "/Login/city_skyline_dark_transparent.png"
      : "/Login/city_skyline_light_transparent.png";

  return (
    <div className={`login-container theme-${theme}`}>
      {/* ==================================================================
         DESKTOP ONLY: Left Hero Artwork Section (Original Layout)
         ================================================================== */}
      <section className="login-hero-section" aria-label="Illustration and Branding">
        <div className="login-hero-artwork-wrapper">
          <img
            src={desktopIllustrationSrc}
            alt={theme === "dark" ? "InTime Attendance Management System Dark" : "InTime Attendance Management System Light"}
            className="login-hero-illustration"
          />
        </div>
      </section>

      {/* ==================================================================
         Right Section on Desktop / Full Screen Container on Mobile
         ================================================================== */}
      <section className="login-form-section" aria-label="Sign In Section">
        {/* Top Bar with Theme Toggle Button */}
        <div className="login-top-bar">
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
          >
            {theme === "dark" ? (
              <>
                <svg className="theme-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                <span>Light Mode</span>
              </>
            ) : (
              <>
                <svg className="theme-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <span>Dark Mode</span>
              </>
            )}
          </button>
        </div>

        {/* ==================================================================
           MOBILE ONLY: Full Uncut Hero Banner (Exact Smartphone Mockup)
           ================================================================== */}
        <div className="mobile-mockup-hero" aria-hidden="true">
          <img
            src={mobileHeroBannerSrc}
            alt="InTime - Welcome back! Sign in to continue to your account"
            className="mobile-hero-full-banner"
          />
        </div>

        {/* ==================================================================
           Central Sign-in Card (Desktop Original + Mobile Mockup Bottom Sheet)
           ================================================================== */}
        <div className="login-card">
          {/* Desktop Brand Logo (Hidden on Mobile) */}
          <div className="login-brand-logo-container desktop-only">
            <img src={logoSrc} alt="InTime Logo" className="login-brand-logo" />
          </div>

          {/* Desktop Heading (Hidden on Mobile) */}
          <header className="login-header desktop-only">
            <h1 className="login-title">Welcome back!</h1>
            <p className="login-subtitle">Sign in to continue to your account</p>
          </header>

          {/* Error Message */}
          {error && (
            <div className="login-error-banner" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {/* Email Address */}
            <div className="form-group">
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <div className="input-wrapper">
                <span className="input-icon-left" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  id="email"
                  type="email"
                  className="input-field"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  autoComplete="username"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="input-wrapper">
                <span className="input-icon-left" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2.5" ry="2.5" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="input-field has-eye"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="input-toggle-pwd"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="login-options-row">
              <label className="remember-me-label" htmlFor="remember-me">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="checkbox-custom"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <a
                href="#forgot-password"
                className="forgot-password-link"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info("Please contact your administrator to reset your password.");
                }}
              >
                Forgot Password?
              </a>
            </div>

            {/* Sign In Button */}
            <button type="submit" className="btn-submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="demo-credentials-hint">
            <span className="demo-hint-title">Demo Accounts</span>
            <div className="demo-hint-row">
              <button
                type="button"
                className="demo-fill-btn"
                onClick={() => {
                  setEmail(DEMO_CREDENTIALS.admin.email);
                  setPassword(DEMO_CREDENTIALS.admin.password);
                  setError("");
                }}
              >
                👑 Admin
              </button>
              <button
                type="button"
                className="demo-fill-btn"
                onClick={() => {
                  setEmail(DEMO_CREDENTIALS.employee.email);
                  setPassword(DEMO_CREDENTIALS.employee.password);
                  setError("");
                }}
              >
                👤 Employee
              </button>
            </div>
          </div>

          {/* Social Divider */}
          <div className="divider-container">
            <div className="divider-line" />
            <span className="divider-text">or continue with</span>
            <div className="divider-line" />
          </div>

          {/* Google Sign-in */}
          <button
            type="button"
            className="btn-google"
            onClick={() => {
              toast.info("Google Sign-In is managed through your organization domain.");
            }}
          >
            <svg className="google-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.97 0 12s.45 3.84 1.24 5.42l4.04-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          {/* Contact Administrator */}
          <p className="login-footer-action">
            Don't have an account?{" "}
            <a
              href="#contact-admin"
              className="admin-contact-link"
              onClick={(e) => {
                e.preventDefault();
                toast.info("Please reach out to your HR / Admin department to create an account.");
              }}
            >
              Contact Administrator
            </a>
          </p>

          {/* Desktop Copyright (Hidden on Mobile) */}
          <p className="desktop-copyright desktop-only">
            &copy; {new Date().getFullYear()} InTime. All rights reserved.
          </p>

          {/* MOBILE ONLY: City Skyline Silhouette Footer (Mockup Design) */}
          <div className="mobile-city-skyline" aria-hidden="true">
            <img src={mobileSkylineSrc} alt="" className="mobile-skyline-img" />
          </div>
        </div>
      </section>
    </div>
  );
}
