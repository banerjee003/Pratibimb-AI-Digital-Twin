/**
 * PublicLandingPage.jsx
 *
 * PRATIBIMB — AWWWARDS CYBERPUNK / INDUSTRIAL HUD EXPERIENCE
 * Inspired by https://www.saifullah.dev/
 *
 * 1. Home Section: High-impact hero with brand lockup, system controls, live clock.
 * 2. Next Section (Story Theatre): Pinned 3-column stage matching reference image:
 *    - Left: Feature Heading, [ INFO_LOG ], Sublines
 *    - Middle: 3D Unfolding Quantum Vault (<UnfoldingBoxCanvas />)
 *    - Right: Feature Telemetry HUD, live progress bars, capabilities readout
 *    - Seamless scroll: As user scrolls, each feature takes the exact position of the previous one!
 * 3. Final Section: Deployment Initialization (CTA) connected to existing Supabase Auth.
 */

import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight,
  Brain,
  Volume2,
  UserCheck,
  Sparkles,
  ShieldCheck,
  Lock,
  Zap,
  Settings,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import UnfoldingBoxCanvas from './UnfoldingBoxCanvas';
import styles from './PublicLandingPage.module.css';

gsap.registerPlugin(ScrollTrigger);

const FEATURES = [
  {
    id: 'reflection',
    index: '01',
    sector: 'SECTOR_01',
    title1: 'THE',
    title2: 'REFLECTION',
    infoTag: '[ INFO_LOG · 01 ]',
    infoHeadline: 'WHAT IF YOUR PRESENCE COULD CONTINUE?',
    infoSub: 'A digital reflection carrying your reasoning, conversational instincts, and presence beyond biological limits.',
    hudTitle: 'PRESENCE_CONTINUUM',
    metric1Label: 'TIMEZONE_EXPANSION',
    metric1Val: '24/7 Global',
    metric1Pct: 100,
    metric2Label: 'FATIGUE_FACTOR',
    metric2Val: '0% Zero Exhaustion',
    metric2Pct: 100,
    terminals: [
      '> ENGINE: AUTONOMOUS_CONTINUITY',
      '> MULTI_THREADING: GLOBAL_INSTANCES',
      '> MEMORY_PERSISTENCE: 100% UNBROKEN',
      '> SYSTEM_PERF: [HIGH] 148 FPS @ 1.0 DPR'
    ]
  },
  {
    id: 'twin',
    index: '02',
    sector: 'SECTOR_02',
    title1: 'DIGITAL',
    title2: 'TWIN',
    infoTag: '[ INFO_LOG · 02 ]',
    infoHeadline: 'NOT A GENERIC BOT — A REFLECTION OF YOU.',
    infoSub: 'Constructed from the 4 convergence pillars: what you know, how you speak, who you are, and how you decide.',
    hudTitle: 'CONVERGENCE_MATRIX',
    metric1Label: 'PILLAR_INTEGRATION',
    metric1Val: '4 of 4 Vectors Active',
    metric1Pct: 100,
    metric2Label: 'IDENTITY_ALIGNMENT',
    metric2Val: '99.6% Coherence',
    metric2Pct: 99,
    terminals: [
      '> VECTORS: [KNOWLEDGE, VOICE, IDENTITY, CONTEXT]',
      '> GRAPH_MEMORY: ASSOCIATIVE_EMBEDDINGS',
      '> REASONING_CORE: MULTI_MODAL_CONTEXT',
      '> SYSTEM_PERF: [HIGH] 148 FPS @ 1.0 DPR'
    ]
  },
  {
    id: 'synthesis',
    index: '03',
    sector: 'SECTOR_03',
    title1: 'SYNTHESIS',
    title2: 'ENGINE',
    infoTag: '[ INFO_LOG · 03 ]',
    infoHeadline: 'WATCHING A DIGITAL TWIN FORM.',
    infoSub: 'Notes, papers, and conversational records stream into associative memory vectors and solidify into an acoustic chamber.',
    hudTitle: 'SYNTHESIS_PIPELINE',
    metric1Label: 'VECTOR_INGESTION',
    metric1Val: 'Realtime Streaming',
    metric1Pct: 100,
    metric2Label: 'LATTICE_DENSITY',
    metric2Val: 'High-Dimensional Graph',
    metric2Pct: 95,
    terminals: [
      '> PHASE_01: INGESTION_STREAMING',
      '> PHASE_02: NEURAL_LATTICE_SYNTHESIS',
      '> PHASE_03: ACOUSTIC_CHAMBER_ALIGNMENT',
      '> PHASE_04: CONSCIOUS_PRESENCE_LOCKED'
    ]
  },
  {
    id: 'voice',
    index: '04',
    sector: 'SECTOR_04',
    title1: 'NEURAL',
    title2: 'ACOUSTICS',
    infoTag: '[ INFO_LOG · 04 ]',
    infoHeadline: 'YOUR VOICE IS PART OF YOUR IDENTITY.',
    infoSub: 'Synthesized speech designed to match your unique warmth, cadence, pitch contours, and authentic human pauses.',
    hudTitle: 'ACOUSTIC_SPECTROGRAM',
    metric1Label: 'HARMONIC_FIDELITY',
    metric1Val: '24 kHz Studio HD',
    metric1Pct: 98,
    metric2Label: 'DIGITAL_ARTIFACTS',
    metric2Val: '0% Zero Cracking',
    metric2Pct: 100,
    terminals: [
      '> ENGINE: COQUI_XTTS_V2_LOCAL',
      '> SAMPLE_REQUIRED: 1–3_MINUTES_AUDIO',
      '> FORMANT_MATCHING: MULTI_BAND_RES',
      '> SYSTEM_PERF: [HIGH] 148 FPS @ 1.0 DPR'
    ]
  },
  {
    id: 'interaction',
    index: '05',
    sector: 'SECTOR_05',
    title1: 'INTERACTION',
    title2: 'LOOP',
    infoTag: '[ INFO_LOG · 05 ]',
    infoHeadline: 'FROM INQUIRY TO AUTHENTIC SPOKEN VOICE.',
    infoSub: 'Questions travel through personal reasoning heuristics and emerge as nuanced, articulate spoken responses.',
    hudTitle: 'REASONING_PIPELINE',
    metric1Label: 'CONTEXT_FILTER',
    metric1Val: 'Ingestion Tone Matched',
    metric1Pct: 100,
    metric2Label: 'RESPONSE_LATENCY',
    metric2Val: '<180ms Low Latency',
    metric2Pct: 94,
    terminals: [
      '> INGESTION_PACKET: USER_INQUIRY',
      '> FILTER: CONTEXT_&_PHILOSOPHY_GRAPH',
      '> SYNTHESIS: REASONED_TEXT_+_AUDIO',
      '> SYSTEM_PERF: [HIGH] 148 FPS @ 1.0 DPR'
    ]
  },
  {
    id: 'utility',
    index: '06',
    sector: 'SECTOR_06',
    title1: 'SYSTEM',
    title2: 'UTILITY',
    infoTag: '[ INFO_LOG · 06 ]',
    infoHeadline: 'SOLVING REAL HUMAN LIMITATIONS.',
    infoSub: 'Stay present across timezones, make accumulated knowledge interactive, scale expertise without burnout, and preserve legacy.',
    hudTitle: 'APPLICATION_SCOPE',
    metric1Label: 'TIME_LEVERAGE',
    metric1Val: '10x Multiplier',
    metric1Pct: 96,
    metric2Label: 'HERITAGE_ARCHIVE',
    metric2Val: 'Permanent Preservation',
    metric2Pct: 100,
    terminals: [
      '> USE_01: TIMEZONE_INDEPENDENT_MENTOR',
      '> USE_02: INTERACTIVE_EXPERTISE_BASE',
      '> USE_03: SCALE_RECURRING_ADVICE',
      '> USE_04: TIMELESS_FAMILY_LEGACY'
    ]
  },
  {
    id: 'production',
    index: '07',
    sector: 'SECTOR_07',
    title1: 'LIVE',
    title2: 'WORKSPACE',
    infoTag: '[ INFO_LOG · 07 ]',
    infoHeadline: 'EXPERIENCE THE ACTUAL PRATIBIMB WORKSPACE.',
    infoSub: 'Connect directly with live AI Personas, start voice chats, and manage custom digital twins.',
    hudTitle: 'PRODUCTION_ENV',
    metric1Label: 'PERSONA_GALLERY',
    metric1Val: 'Online & Voice-Ready',
    metric1Pct: 100,
    metric2Label: 'SECURITY_ENCRYPTION',
    metric2Val: 'End-to-End Encrypted',
    metric2Pct: 100,
    terminals: [
      '> DEMO_PERSONA: SARAH_EMPATHETIC_LISTENER',
      '> MODE: LIVE_VOICE_CONVERSATION',
      '> WORKSPACE_STATUS: AUTH_PROTECTED',
      '> SYSTEM_PERF: [HIGH] 148 FPS @ 1.0 DPR'
    ]
  }
];

export default function PublicLandingPage({
  onSignIn,
  onSignUp,
  onExploreWorkspace,
}) {
  const containerRef = useRef(null);

  // Hero refs
  const heroRef = useRef(null);
  const heroTitleRef = useRef(null);
  const heroInfoRef = useRef(null);
  const heroHudRef = useRef(null);

  // Theatre Pinned Stage ref
  const theatrePinRef = useRef(null);
  const theatreLeftRef = useRef(null);
  const theatreRightRef = useRef(null);

  // Interactive UI State
  const [menuOpen, setMenuOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [activeTheme, setActiveTheme] = useState('sapphire'); // sapphire, obsidian, acid, yellow, crimson
  const [perfTier, setPerfTier] = useState('high');
  const [audioActive, setAudioActive] = useState(false);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [currentTime, setCurrentTime] = useState('');
  const [activeFeatureIdx, setActiveFeatureIdx] = useState(0);

  // Live Clock updater
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.toUTCString().split(' ')[4] + ' UTC';
      setCurrentTime(utc);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Live Scroll Percentage updater
  useEffect(() => {
    const handleScroll = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const current = window.scrollY;
      const pct = Math.min(100, Math.max(0, Math.round((current / total) * 100)));
      setScrollPercent(pct);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // GSAP ScrollTrigger Timelines
  useEffect(() => {
    const ctx = gsap.context(() => {
      /* ─── SCENE 01: HERO ENTRANCE ─────────────────────────────────────── */
      if (heroTitleRef.current && heroInfoRef.current && heroHudRef.current) {
        const heroTl = gsap.timeline({ delay: 0.05 });
        heroTl
          .fromTo(heroTitleRef.current,
            { opacity: 0, y: 25, filter: 'blur(8px)' },
            { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'power3.out' }
          )
          .fromTo(heroInfoRef.current,
            { opacity: 0, x: -25 },
            { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' },
            '-=0.4'
          )
          .fromTo(heroHudRef.current,
            { opacity: 0, x: 25 },
            { opacity: 1, x: 0, duration: 0.5, ease: 'power2.out' },
            '-=0.4'
          );
      }

      /* ─── SCENE 02+: PINNED 3-COLUMN STORY THEATRE (MATCHING REFERENCE) ─── */
      if (theatrePinRef.current) {
        ScrollTrigger.create({
          trigger: theatrePinRef.current,
          start: 'top top',
          end: '+=420%',
          pin: true,
          pinSpacing: true,
          scrub: 0.6,
          anticipatePin: 0,
          fastScrollEnd: true,
          onUpdate: (self) => {
            const p = self.progress;
            const idx = Math.min(FEATURES.length - 1, Math.floor(p * FEATURES.length));
            setActiveFeatureIdx((prev) => {
              if (prev !== idx) {
                // Silky smooth micro-transition with ZERO blackout (opacity remains 100%)
                if (theatreLeftRef.current) {
                  gsap.fromTo(theatreLeftRef.current,
                    { y: 8 },
                    { y: 0, duration: 0.28, ease: 'power2.out' }
                  );
                }
                if (theatreRightRef.current) {
                  gsap.fromTo(theatreRightRef.current,
                    { y: -6 },
                    { y: 0, duration: 0.28, ease: 'power2.out' }
                  );
                }
                return idx;
              }
              return prev;
            });
          }
        });
      }

    }, containerRef);

    return () => ctx.revert();
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  const getThemeClass = () => {
    if (activeTheme === 'obsidian') return styles.themeObsidian;
    if (activeTheme === 'acid') return styles.themeAcid;
    if (activeTheme === 'yellow') return styles.themeYellow;
    if (activeTheme === 'crimson') return styles.themeCrimson;
    return styles.themeSapphire;
  };

  const getActiveHexColor = () => {
    if (activeTheme === 'obsidian') return '#ffffff';
    if (activeTheme === 'acid') return '#00ff9f';
    if (activeTheme === 'yellow') return '#fcee0a';
    if (activeTheme === 'crimson') return '#ff003c';
    return '#0077B6';
  };

  const curr = FEATURES[activeFeatureIdx] || FEATURES[0];

  return (
    <div
      ref={containerRef}
      className={`${styles.hudContainer} ${getThemeClass()}`}
      data-perf-tier={perfTier}
    >
      {/* Background Matrix Grid Noise & Scanline */}
      <div className={styles.noiseOverlay} aria-hidden="true" />
      <div className={styles.scanlineBeam} aria-hidden="true" />

      {/* ── Top-Left Official Brand Logo ──── */}
      <header className={styles.headerBrand}>
        <a
          href="/"
          className={styles.brandLockup}
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          title="Pratibimb"
        >
          <img
            src="/logo.png?v=5"
            alt="Pratibimb"
            className={styles.landingLogoImg}
          />
        </a>
      </header>

      {/* ── Top-Right Technical Controls ───────────────────────────────────── */}
      <div className={styles.headerControls}>
        {/* Navigation Dropdown Trigger */}
        <div className={styles.navMenuRoot}>
          <button
            type="button"
            className={styles.navToggleBtn}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
          >
            <span className={styles.tagBracket}>[01]</span>
            <span className={styles.navToggleLabel}>Navigation</span>
            <div className={styles.statusDotLive} />
          </button>

          {/* Directory Drawer Popup */}
          {menuOpen && (
            <div className={styles.navDrawer}>
              <div className={styles.drawerHeader}>
                <div className={styles.drawerTitleWrap}>
                  <h3 className={styles.drawerTitle}>Menu</h3>
                  <p className={styles.drawerSubtitle}>Directory Index</p>
                </div>
                <div className={styles.drawerBadge}><span>DIR</span></div>
              </div>

              <div className={styles.drawerContent}>
                <ul className={styles.drawerList}>
                  <li>
                    <button type="button" onClick={() => scrollTo('scene-hero')}>
                      <span className={styles.listIndex}>[01]</span>
                      <span>Overview</span>
                    </button>
                  </li>
                  {FEATURES.map((f, i) => (
                    <li key={f.id}>
                      <button type="button" onClick={() => scrollTo('story-theatre')}>
                        <span className={styles.listIndex}>[0{i + 2}]</span>
                        <span>{f.title1} {f.title2}</span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <button type="button" onClick={() => scrollTo('scene-final')}>
                      <span className={styles.listIndex}>[09]</span>
                      <span>Deployment</span>
                    </button>
                  </li>
                </ul>

                <div className={styles.drawerSocials}>
                  <span className={styles.socialLabel}>SYSTEM_LINKS</span>
                  {onExploreWorkspace && (
                    <button type="button" className={styles.demoLink} onClick={onExploreWorkspace}>
                      <span>Preview Workspace</span>
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Global System Config Trigger (Gear) */}
        <div className={styles.settingsRoot}>
          <button
            type="button"
            className={`${styles.settingsGearBtn} ${configOpen ? styles.gearActive : ''}`}
            onClick={() => setConfigOpen((prev) => !prev)}
            title="System Global Config"
          >
            <Settings size={15} className={configOpen ? styles.spinSlow : ''} />
          </button>

          {/* Settings Panel Popup */}
          {configOpen && (
            <div className={styles.settingsPanel}>
              <div className={styles.settingsHeader}>
                <div>
                  <h4 className={styles.settingsTitle}>System</h4>
                  <p className={styles.settingsSubtitle}>Global Config</p>
                </div>
                <div className={styles.settingsBadge}><span>SET</span></div>
              </div>

              <div className={styles.settingsBody}>
                {/* [01] Core Theme */}
                <div className={styles.configSection}>
                  <div className={styles.configHeader}>
                    <span><span className={styles.tagBracket}>[01]</span> Core Theme</span>
                    <span className={styles.verTag}>V_2.0</span>
                  </div>
                  <div className={styles.themeGrid}>
                    <button
                      type="button"
                      className={`${styles.colorDotBtn} ${activeTheme === 'sapphire' ? styles.colorActive : ''}`}
                      onClick={() => setActiveTheme('sapphire')}
                      title="Sapphire Navy (#03045E)"
                    >
                      <span className={styles.dotSapphire} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.colorDotBtn} ${activeTheme === 'obsidian' ? styles.colorActive : ''}`}
                      onClick={() => setActiveTheme('obsidian')}
                      title="Obsidian White"
                    >
                      <span className={styles.dotWhite} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.colorDotBtn} ${activeTheme === 'acid' ? styles.colorActive : ''}`}
                      onClick={() => setActiveTheme('acid')}
                      title="Acid Green"
                    >
                      <span className={styles.dotAcid} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.colorDotBtn} ${activeTheme === 'yellow' ? styles.colorActive : ''}`}
                      onClick={() => setActiveTheme('yellow')}
                      title="Cyber Yellow"
                    >
                      <span className={styles.dotYellow} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.colorDotBtn} ${activeTheme === 'crimson' ? styles.colorActive : ''}`}
                      onClick={() => setActiveTheme('crimson')}
                      title="Crimson"
                    >
                      <span className={styles.dotCrimson} />
                    </button>
                  </div>
                </div>

                {/* [02] Audio Engine */}
                <div className={styles.configSection}>
                  <div className={styles.configHeader}>
                    <span><span className={styles.tagBracket}>[02]</span> Audio Engine</span>
                    <span className={styles.verTag}>{audioActive ? 'ON' : 'IDLE'}</span>
                  </div>
                  <button
                    type="button"
                    className={`${styles.musicToggleBtn} ${audioActive ? styles.musicActive : ''}`}
                    onClick={() => setAudioActive((prev) => !prev)}
                  >
                    <div>
                      <p className={styles.musicName}>Coqui XTTS v2</p>
                      <p className={styles.musicDesc}>Local Harmonic Engine</p>
                    </div>
                    {audioActive && (
                      <div className={styles.hudVisualizer}>
                        <span /><span /><span />
                      </div>
                    )}
                  </button>
                </div>

                {/* [03] Performance Tier */}
                <div className={styles.configSection}>
                  <div className={styles.configHeader}>
                    <span><span className={styles.tagBracket}>[03]</span> Performance Tier</span>
                    <span className={styles.verTag}>SYS</span>
                  </div>
                  <div className={styles.perfList}>
                    {['high', 'med', 'saver'].map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        className={`${styles.perfBtn} ${perfTier === tier ? styles.perfActive : ''}`}
                        onClick={() => setPerfTier(tier)}
                      >
                        {tier.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.settingsFooter}>
                <div className={styles.statusDotLive} />
                <span className={styles.settingsStatusText}>System Active · 60 FPS</span>
              </div>
            </div>
          )}
        </div>

        {/* Technical Capsule Auth Buttons */}
        <button
          type="button"
          className={styles.hudSignBtn}
          onClick={onSignIn}
          id="hud-signin-btn"
        >
          <span className={styles.tagBracket}>[01]</span>
          <span>Sign In</span>
        </button>

        <button
          type="button"
          className={styles.hudPrimaryBtn}
          onClick={onSignUp}
          id="hud-signup-btn"
        >
          <span className={styles.tagBracket}>[02]</span>
          <span>Get Started</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SCENE 01: HERO SECTION (Confirmed Perfect by User)
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="scene-hero" ref={heroRef} className={styles.heroSection}>
        <div className={styles.heroContentGrid}>
          {/* Main Typography Column */}
          <div className={styles.heroMainCol}>
            <div className={styles.heroScanningWrap}>
              <h1 ref={heroTitleRef} className={styles.heroBigTitle}>
                <span className={styles.titleLine}>Bring Anyone</span>
                <span className={styles.titleLine}>Back to Life.</span>
              </h1>

              {/* Info Log Box */}
              <div ref={heroInfoRef} className={styles.infoLogBox}>
                <div className={styles.infoLine} />
                <div className={styles.infoContent}>
                  <div className={styles.infoTag}>[ INFO_LOG · 01 ]</div>
                  <p className={styles.infoText}>
                    Preserve the way they look, sound, and speak—and create a digital presence you can actually talk to.
                  </p>
                </div>
              </div>

              {/* Mobile Stats Supplement */}
              <div className={styles.mobileStatsRow}>
                <div className={styles.mobileStat}>
                  <span className={styles.mobileStatVal}>24kHz</span>
                  <span className={styles.mobileStatLabel}>Neural Audio</span>
                </div>
                <div className={styles.mobileStatDivider} />
                <div className={styles.mobileStat}>
                  <span className={styles.mobileStatVal}>24/7</span>
                  <span className={styles.mobileStatLabel}>Availability</span>
                </div>
              </div>

              {/* CTA Capsule Row */}
              <div className={styles.heroCtaRow}>
                <button
                  type="button"
                  className={styles.actionPillPrimary}
                  onClick={onSignUp}
                  id="hero-create-btn"
                >
                  <span className={styles.actionPillLabel}>Create Your Digital Twin</span>
                  <div className={styles.actionPillIcon}>
                    <ArrowRight size={14} />
                  </div>
                </button>
                <button
                  type="button"
                  className={styles.actionPillGhost}
                  onClick={onSignIn}
                  id="hero-workspace-btn"
                >
                  <span className={styles.actionPillLabel}>Sign In to Workspace</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right-Hand HUD Telemetry Panel */}
          <div ref={heroHudRef} className={styles.heroRightHud}>
            <div className={styles.hudHeader}>
              <span className={styles.hudTitle}>SYSTEM_TELEMETRY</span>
              <div className={styles.hudStatus}>
                <div className={styles.hudStatusDot} />
                <span>ONLINE</span>
              </div>
            </div>

            <div className={styles.hudMetrics}>
              <div className={styles.hudMetricItem}>
                <div className={styles.hudMetricLabel}>
                  <span>VOICE_FIDELITY</span>
                  <span className={styles.valHighlighted}>99.8%</span>
                </div>
                <div className={styles.hudProgressBar}>
                  <div className={styles.hudProgressInner} style={{ width: '99%' }} />
                </div>
              </div>

              <div className={styles.hudMetricItem}>
                <div className={styles.hudMetricLabel}>
                  <span>INFERENCE_LATENCY</span>
                  <span className={styles.valHighlighted}>&lt;180ms</span>
                </div>
                <div className={styles.hudProgressBar}>
                  <div className={styles.hudProgressInner} style={{ width: '92%' }} />
                </div>
              </div>

              <div className={styles.hudMetricItem}>
                <div className={styles.hudMetricLabel}>
                  <span>CONTEXT_ALIGNMENT</span>
                  <span className={styles.valHighlighted}>100%</span>
                </div>
                <div className={styles.hudProgressBar}>
                  <div className={styles.hudProgressInner} style={{ width: '100%' }} />
                </div>
              </div>
            </div>

            <div className={styles.hudFooter}>
              <div className={styles.hudTerminal}>
                <span>&gt; ACTIVE_STACK: COQUI_XTTS_V2_LOCAL</span>
                <span>&gt; PERSISTENCE: 24/7_TIMEZONE_READY</span>
                <span>&gt; STATUS: OPEN_FOR_INTERACTION</span>
                <span>&gt; SYSTEM_PERF: [HIGH] 60 FPS @ 1.0 DPR</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Metadata Bar */}
        <footer className={styles.heroBottomWrap}>
          <div className={styles.bottomCol}>
            <p className={styles.bottomMuted}>Wanna Say Hello?</p>
            <a href="mailto:hello@pratibimb.ai" className={styles.bottomLink}>hello@pratibimb.ai</a>
          </div>

          {/* Center Click-To-Enter / Scroll Prompt */}
          <div className={styles.enterWrapper} onClick={() => scrollTo('story-theatre')}>
            <div className={styles.enterGrid}>
              <span className={styles.enterLeft}>Scroll</span>
              <div className={styles.enterLaserLine} />
              <span className={styles.enterRight}>to explore</span>
            </div>
          </div>

          <div className={styles.bottomColRight}>
            <p className={styles.bottomMuted}>Local Time</p>
            <p className={styles.bottomVal}>{currentTime || '00:00:00 UTC'}</p>
          </div>
        </footer>
      </section>

      {/* ── Marquee Ticker 01 ────────────────────────────────────────────── */}
      <div className={styles.tickerBar}>
        <div className={styles.tickerTrack}>
          <span>PRATIBIMB AI // AUTONOMOUS DIGITAL REFLECTION // 24kHz NEURAL AUDIO // COQUI XTTS v2 // CONTEXT GRAPH // EMBODIED INTELLIGENCE // TIMELESS REASONING // </span>
          <span>PRATIBIMB AI // AUTONOMOUS DIGITAL REFLECTION // 24kHz NEURAL AUDIO // COQUI XTTS v2 // CONTEXT GRAPH // EMBODIED INTELLIGENCE // TIMELESS REASONING // </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SCENE 02+: PINNED 3-COLUMN STORY THEATRE (EXACT REFERENCE FORMAT)
          Left: Feature Title + [ INFO_LOG ] + Subheading
          Center: 3D Unfolding Quantum Vault (<UnfoldingBoxCanvas />)
          Right: Developer Stats / Feature Telemetry + Live Progress Bars
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="story-theatre" ref={theatrePinRef} className={styles.storyTheatreSection}>
        <div className={styles.theatreContainer}>

          {/* ── LEFT COLUMN: Feature Heading & Info Log ── */}
          <div ref={theatreLeftRef} className={styles.theatreLeftCol}>
            <div className={styles.theatreStepTracker}>
              <span className={styles.tagBracket}>[{curr.sector}]</span>
              <span className={styles.stepCounter}>{curr.index} / 07</span>
            </div>

            <h2 className={styles.theatreMainTitle}>
              <span className={styles.theatreTitleLine}>{curr.title1}</span>
              <span className={styles.theatreTitleLine}>{curr.title2}</span>
            </h2>

            <div className={styles.infoLogBoxTheatre}>
              <div className={styles.infoLine} />
              <div className={styles.infoContent}>
                <div className={styles.infoTag}>{curr.infoTag}</div>
                <p className={styles.infoText}>{curr.infoHeadline}</p>
                <p className={styles.infoSubTextTheatre}>{curr.infoSub}</p>
              </div>
            </div>
          </div>

          {/* ── CENTER COLUMN: 3D Unfolding Quantum Vault ── */}
          <div className={styles.theatreCenterCol}>
            <div className={styles.headCanvasWrap}>
              <UnfoldingBoxCanvas
                scrollProgress={activeFeatureIdx / (FEATURES.length - 1)}
                activeStep={activeFeatureIdx}
                activeColor={getActiveHexColor()}
              />
            </div>
          </div>

          {/* ── RIGHT COLUMN: Technical HUD Telemetry & Capability Readout ── */}
          <div ref={theatreRightRef} className={styles.theatreRightCol}>
            <div className={styles.hudHeader}>
              <span className={styles.hudTitle}>{curr.hudTitle}</span>
              <div className={styles.hudStatus}>
                <div className={styles.hudStatusDot} />
                <span>ACTIVE</span>
              </div>
            </div>

            <div className={styles.hudMetrics}>
              <div className={styles.hudMetricItem}>
                <div className={styles.hudMetricLabel}>
                  <span>{curr.metric1Label}</span>
                  <span className={styles.valHighlighted}>{curr.metric1Val}</span>
                </div>
                <div className={styles.hudProgressBar}>
                  <div
                    className={styles.hudProgressInner}
                    style={{
                      width: `${curr.metric1Pct}%`,
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>

              <div className={styles.hudMetricItem}>
                <div className={styles.hudMetricLabel}>
                  <span>{curr.metric2Label}</span>
                  <span className={styles.valHighlighted}>{curr.metric2Val}</span>
                </div>
                <div className={styles.hudProgressBar}>
                  <div
                    className={styles.hudProgressInner}
                    style={{
                      width: `${curr.metric2Pct}%`,
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>
            </div>

            <div className={styles.hudFooter}>
              <div className={styles.hudTerminal}>
                {curr.terminals.map((t, idx) => (
                  <span key={idx}>{t}</span>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Floating Sector Dots Indicator */}
        <div className={styles.theatreDotsNav}>
          {FEATURES.map((f, i) => (
            <span
              key={f.id}
              className={`${styles.theatreDot} ${activeFeatureIdx === i ? styles.theatreDotActive : ''}`}
              title={f.title1 + ' ' + f.title2}
            />
          ))}
        </div>
      </section>

      {/* ── Marquee Ticker 02 ────────────────────────────────────────────── */}
      <div className={styles.tickerBar}>
        <div className={styles.tickerTrack}>
          <span>TIMEZONE INDEPENDENCE // KNOWLEDGE ENCAPSULATION // EXPERTISE SCALING // HERITAGE & MEMOIRS // AUTONOMOUS REASONING // </span>
          <span>TIMEZONE INDEPENDENCE // KNOWLEDGE ENCAPSULATION // EXPERTISE SCALING // HERITAGE & MEMOIRS // AUTONOMOUS REASONING // </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FINAL SCENE: DEPLOYMENT INITIALIZATION (CTA)
      ══════════════════════════════════════════════════════════════════════ */}
      <section id="scene-final" className={styles.finalSection}>
        <div className={styles.finalBackdropGlow} aria-hidden="true" />

        <div className={styles.finalContainer}>
          <div className={styles.finalEyebrow}>
            <Sparkles size={13} />
            <span>[ SECTOR_08 · DEPLOYMENT_INITIALIZATION ]</span>
          </div>

          <h2 className={styles.finalBigHeadline}>
            <span className={styles.titleLine}>Create your</span>
            <span className={styles.titleLine}>digital reflection.</span>
          </h2>

          <p className={styles.finalSubtext}>
            Your knowledge. Your identity. Your voice. A new way to interact.
          </p>

          <div className={styles.finalCtaRow}>
            <button
              type="button"
              className={styles.actionPillPrimaryLg}
              onClick={onSignUp}
              id="final-getstarted-btn"
            >
              <span>Get Started</span>
              <ArrowRight size={15} />
            </button>
            <button
              type="button"
              className={styles.actionPillGhostLg}
              onClick={onSignIn}
              id="final-signin-btn"
            >
              <span>Sign In</span>
            </button>
          </div>

          <div className={styles.securityTelemetryRow}>
            <span className={styles.secTelemetryItem}>
              <ShieldCheck size={14} /> NO_CREDIT_CARD_REQUIRED
            </span>
            <span className={styles.secDivider}>/</span>
            <span className={styles.secTelemetryItem}>
              <Lock size={14} /> END_TO_END_ENCRYPTED
            </span>
            <span className={styles.secDivider}>/</span>
            <span className={styles.secTelemetryItem}>
              <Zap size={14} /> LOCAL_NEURAL_VOICE_CLONING
            </span>
          </div>
        </div>
      </section>

      {/* ── Minimalist Industrial Footer with Centered Progress Scrub ── */}
      <footer className={styles.hudFooterRow}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span className={styles.footerBlockBold}>PRATIBIMB AI</span>
            <span className={styles.footerDivider}>/</span>
            <span>2026</span>
            <span className={styles.footerDivider}>/</span>
            <span className={styles.footerMuted}>BUILT FOR HUMAN PRESENCE</span>
          </div>

          {/* Centered live scroll tracker inside footer bar */}
          <div className={styles.footerScrollTracker}>
            <span className={styles.scrollValTag}>{scrollPercent}%</span>
            <div className={styles.scrollTrack}>
              <div className={styles.scrollPointer} style={{ left: `${scrollPercent}%` }} />
            </div>
            <span className={styles.scrollValTag}>100%</span>
          </div>

          <div className={styles.footerLinks}>
            <button type="button" className={styles.footerLink} onClick={onSignIn}>[1] Sign In</button>
            <button type="button" className={styles.footerLink} onClick={onSignUp}>[2] Sign Up</button>
            {onExploreWorkspace && (
              <button type="button" className={styles.footerLink} onClick={onExploreWorkspace}>[3] Workspace</button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
