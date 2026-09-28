import React, { useState, useEffect } from 'react';
import { BorderBeam } from 'border-beam';
import { 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  X, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { supabase } from './lib/supabase';
import styles from './AuthPage.module.css';

export default function AuthPage({ initialMode = 'signin', onClose, onModeChange }) {
  const [mode, setMode] = useState(initialMode); // 'signin' | 'signup'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMode(initialMode);
    setError('');
    setSubmitted(false);
  }, [initialMode]);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSwitchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSubmitted(false);
    if (onModeChange) onModeChange(newMode);
  };

  // Password strength calculator
  const calculateStrength = (pass) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score;
  };

  const strength = calculateStrength(password);
  const strengthLabels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const strengthColors = ['#EF4444', '#F59E0B', '#EAB308', '#10B981', '#00E5FF'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (mode === 'signup') {
      if (!fullName) {
        setError('Please enter your full name.');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!agreeTerms) {
        setError('Please agree to the Terms of Service & Privacy Policy.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        });
        if (signUpError) throw signUpError;
        setSubmitted(true);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        setSubmitted(true);
        setTimeout(() => {
          if (onClose) onClose();
        }, 700);
      }
    } catch (err) {
      setError(err?.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      {/* Main Auth Card (Stop propagation to avoid closing when clicking inside) */}
      <div className={styles.cardWrapper} onClick={(e) => e.stopPropagation()}>
        <BorderBeam size="sm" colorVariant="sunset" strength={0.8} active={true}>
          <div className={styles.authCard}>
            {/* Close cross button on the right */}
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={15} />
            </button>

            {/* Header / Tabs */}
            <div className={styles.cardHeader}>
              <img
                src="/wordmark.png"
                alt="Pratibimb"
                className={styles.cardLogo}
              />
              <h2 className={styles.title}>
                {mode === 'signin' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className={styles.subtitle}>
                {mode === 'signin'
                  ? 'Access your digital twins and AI personas'
                  : 'Start creating your personalized AI twin'}
              </p>

              {/* Mode Switcher Tabs */}
              <div className={styles.tabGroup}>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${mode === 'signin' ? styles.tabActive : ''}`}
                  onClick={() => handleSwitchMode('signin')}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`${styles.tabBtn} ${mode === 'signup' ? styles.tabActive : ''}`}
                  onClick={() => handleSwitchMode('signup')}
                >
                  Create Account
                </button>
              </div>
            </div>

            {/* Social Logins */}
            <div className={styles.socialRow}>
              <button type="button" className={styles.socialBtn} title="Continue with Google">
                <svg width="15" height="15" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.4 8.8 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.6 6.4C.6 8.4 0 10.6 0 13s.6 4.6 1.6 6.6l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.2 0-5.8-2.4-6.7-5.3L1.6 16C3.5 19.8 7.4 23 12 23z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button type="button" className={styles.socialBtn} title="Continue with GitHub">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>GitHub</span>
              </button>
            </div>

            <div className={styles.divider}>
              <span>or continue with email</span>
            </div>

            {/* Success state */}
            {submitted ? (
              <div className={styles.successBox}>
                <CheckCircle2 size={32} className={styles.successIcon} />
                <h3>{mode === 'signin' ? 'Welcome Back!' : 'Account Created!'}</h3>
                <p>
                  {mode === 'signin'
                    ? 'You have successfully signed in.'
                    : 'Your account is ready. Welcome to Pratibimb!'}
                </p>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={onClose}
                >
                  Continue to Workspace
                </button>
              </div>
            ) : (
              /* Form */
              <form onSubmit={handleSubmit} className={styles.form}>
                {error && <div className={styles.errorBanner}>{error}</div>}

                {/* Sign up extra field: Full Name */}
                {mode === 'signup' && (
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Full Name</label>
                    <div className={styles.inputWrapper}>
                      <User size={15} className={styles.inputIcon} />
                      <input
                        type="text"
                        placeholder="Ankit Sharma"
                        className={styles.input}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                  </div>
                )}

                {/* Email */}
                <div className={styles.inputGroup}>
                  <label className={styles.label}>Email address</label>
                  <div className={styles.inputWrapper}>
                    <Mail size={15} className={styles.inputIcon} />
                    <input
                      type="email"
                      placeholder="name@example.com"
                      className={styles.input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className={styles.inputGroup}>
                  <div className={styles.labelRow}>
                    <label className={styles.label}>Password</label>
                    {mode === 'signin' && (
                      <a href="#forgot" className={styles.forgotLink} onClick={(e) => { e.preventDefault(); alert('Password reset link sent to your email.'); }}>
                        Forgot password?
                      </a>
                    )}
                  </div>
                  <div className={styles.inputWrapper}>
                    <Lock size={15} className={styles.inputIcon} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      className={styles.input}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    />
                    <button
                      type="button"
                      className={styles.eyeBtn}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Password Strength Meter (Sign Up only) */}
                  {mode === 'signup' && password.length > 0 && (
                    <div className={styles.strengthMeter}>
                      <div className={styles.strengthBars}>
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={styles.strengthBar}
                            style={{
                              backgroundColor:
                                strength >= step ? strengthColors[strength] : 'rgba(255,255,255,0.08)',
                            }}
                          />
                        ))}
                      </div>
                      <span
                        className={styles.strengthText}
                        style={{ color: strengthColors[strength] }}
                      >
                        {strengthLabels[strength]}
                      </span>
                    </div>
                  )}
                </div>

                {/* Confirm Password (Sign up only) */}
                {mode === 'signup' && (
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Confirm Password</label>
                    <div className={styles.inputWrapper}>
                      <ShieldCheck size={15} className={styles.inputIcon} />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        className={styles.input}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className={styles.eyeBtn}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label="Toggle confirm password visibility"
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Checkboxes */}
                {mode === 'signin' ? (
                  <div className={styles.checkboxRow}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className={styles.checkbox}
                      />
                      <span>Remember this device for 30 days</span>
                    </label>
                  </div>
                ) : (
                  <div className={styles.checkboxRow}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        className={styles.checkbox}
                      />
                      <span>
                        I agree to the{' '}
                        <a href="#terms" className={styles.inlineLink} onClick={(e) => e.preventDefault()}>
                          Terms
                        </a>{' '}
                        and{' '}
                        <a href="#privacy" className={styles.inlineLink} onClick={(e) => e.preventDefault()}>
                          Privacy
                        </a>
                      </span>
                    </label>
                  </div>
                )}

                {/* Submit CTA */}
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? (
                    <span className={styles.spinner} />
                  ) : mode === 'signin' ? (
                    'Sign In to Pratibimb'
                  ) : (
                    'Create Free Account'
                  )}
                </button>

                {/* Footer switch prompt */}
                <div className={styles.cardFooter}>
                  {mode === 'signin' ? (
                    <p>
                      Don't have an account?{' '}
                      <button
                        type="button"
                        className={styles.switchLink}
                        onClick={() => handleSwitchMode('signup')}
                      >
                        Create an account
                      </button>
                    </p>
                  ) : (
                    <p>
                      Already have an account?{' '}
                      <button
                        type="button"
                        className={styles.switchLink}
                        onClick={() => handleSwitchMode('signin')}
                      >
                        Sign in
                      </button>
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </BorderBeam>
      </div>
    </div>
  );
}
