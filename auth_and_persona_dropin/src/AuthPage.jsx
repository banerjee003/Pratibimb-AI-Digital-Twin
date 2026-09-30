import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
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
  const strengthColors = ['#EF4444', '#F59E0B', '#EAB308', '#10B981', '#0077B6'];

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
        <div className={styles.authCard}>
            {/* Close cross button on the right */}
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>

            {/* Header / Tabs */}
            <div className={styles.cardHeader}>
              <img
                src="/logo.png?v=5"
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
                {error && (
                  <div className={styles.errorBanner} role="alert">
                    <AlertCircle size={16} className={styles.errorIcon} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Sign up extra field: Full Name */}
                {mode === 'signup' && (
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Full Name</label>
                    <div className={styles.inputWrapper}>
                      <User size={18} className={styles.inputIcon} />
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
                    <Mail size={18} className={styles.inputIcon} />
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
                    <Lock size={18} className={styles.inputIcon} />
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
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
                      <ShieldCheck size={18} className={styles.inputIcon} />
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
                        {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
      </div>
    </div>
  );
}
