import React, { useState, useEffect, useRef } from 'react';
import { Filter, LayoutGrid, Star, User, Briefcase, Sparkles, Plus, PenLine, LogOut, Trash2 } from 'lucide-react';
import SearchBar from './SearchBar';
import AuthPage from './AuthPage';
import CreatePersonaModal from './CreatePersonaModal';
import DeletePersonaModal from './DeletePersonaModal';
import RollingAnimation from './RollingAnimation';
import LoadingScreen from './LoadingScreen';
import ChatPage from './ChatPage';
import { supabase } from './lib/supabase';
import { API } from './lib/config';
import styles from './App.module.css';

/* ── Particle canvas background ─────────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    let W, H;
    const PARTICLE_COUNT = 55;
    const particles = [];

    function resize() {
      if (!canvas) return;
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    }

    function randomBetween(a, b) { return a + Math.random() * (b - a); }

    const COLORS = [
      'rgba(0,229,255,',       // electric cyan
      'rgba(22,139,255,',      // neon blue
      'rgba(124,61,255,',      // electric violet
      'rgba(168,85,247,',      // soft violet
    ];

    function spawnParticle() {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      return {
        x: randomBetween(0, W),
        y: randomBetween(0, H),
        r: randomBetween(1, 2.4),
        dx: randomBetween(-0.18, 0.18),
        dy: randomBetween(-0.28, -0.08),   // always drift upward gently
        alpha: randomBetween(0.08, 0.38),
        color,
        life: 0,
        maxLife: randomBetween(220, 520),
      };
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = spawnParticle();
      p.life = randomBetween(0, p.maxLife); // stagger births
      particles.push(p);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.life += 1;

        const t = p.life / p.maxLife;
        const fade = t < 0.15 ? t / 0.15
          : t > 0.80 ? (1 - t) / 0.20
            : 1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + (p.alpha * fade).toFixed(3) + ')';
        ctx.shadowColor = p.color + '0.6)';
        ctx.shadowBlur = 6;
        ctx.fill();

        if (p.life >= p.maxLife) {
          particles[i] = spawnParticle(); // respawn
        }
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.particles} aria-hidden="true" />;
}

const DEMO_PERSONAS = [
  {
    id: 'demo-sarah',
    name: 'Sarah (Empathetic Listener)',
    notes: 'A supportive friend ready to listen and give thoughtful, warm advice on any topic.',
    photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400',
    tone: 'Empathetic & Warm',
    language: 'en'
  },
  {
    id: 'demo-marcus',
    name: 'Marcus (Tech Mentor)',
    notes: 'An experienced senior developer who helps debug code and explains architecture.',
    photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400',
    tone: 'Professional & Formal',
    language: 'en'
  },
  {
    id: 'demo-elena',
    name: 'Elena (Language Tutor)',
    notes: 'A strict but patient Spanish teacher who corrects your grammar in real-time.',
    photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
    tone: 'Enthusiastic & Energetic',
    language: 'es'
  }
];

/* ── App ─────────────────────────────────────────────────────── */
export default function App() {
  const getInitialModal = () => {
    const hash = window.location.hash.toLowerCase();
    if (hash === '#signup' || hash === '#register' || hash === '#create-account') return 'signup';
    if (hash === '#signin' || hash === '#login') return 'signin';
    return null;
  };

  const [authModal, setAuthModal] = useState(getInitialModal);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [deletingPersona, setDeletingPersona] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChat, setActiveChat] = useState(null);

  // Real Auth & Backend Personas
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [personas, setPersonas] = useState([]);
  const [loadingPersonas, setLoadingPersonas] = useState(false);

  const startChat = (persona, initialText = null) => {
    if (!persona) return;
    const photoUrl = persona.photo_url
      ? (persona.photo_url.startsWith('http') ? persona.photo_url : `${API}${persona.photo_url}`)
      : (persona.image || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400');

    setActiveChat({
      ...persona,
      image: photoUrl,
      initialMessage: initialText
    });

    try {
      localStorage.setItem('active_persona_id', String(persona.id));
      const url = new URL(window.location);
      url.searchParams.set('chat', String(persona.id));
      window.history.replaceState(null, '', url);
    } catch (e) {
      console.warn('Could not save active chat:', e);
    }
  };

  const handleCloseChat = () => {
    setActiveChat(null);
    try {
      localStorage.removeItem('active_persona_id');
      const url = new URL(window.location);
      url.searchParams.delete('chat');
      window.history.replaceState(null, '', url);
    } catch (e) {
      console.warn('Could not clear active chat:', e);
    }
  };

  const restoreActiveChat = (personaList) => {
    try {
      const params = new URLSearchParams(window.location.search);
      const targetChatId = params.get('chat') || localStorage.getItem('active_persona_id');
      if (!targetChatId) return;

      if (targetChatId.startsWith('demo-')) {
        const demo = DEMO_PERSONAS.find((p) => p.id === targetChatId);
        if (demo) startChat(demo);
        return;
      }

      if (Array.isArray(personaList) && personaList.length > 0) {
        const matched = personaList.find((p) => String(p.id) === String(targetChatId));
        if (matched) {
          startChat(matched);
        }
      }
    } catch (e) {
      console.warn('Error restoring active chat:', e);
    }
  };

  const fetchPersonas = async (token) => {
    try {
      setLoadingPersonas(true);
      const res = await fetch(`${API}/api/personas`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        list.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
        setPersonas(list);
        restoreActiveChat(list);
      }
    } catch (err) {
      console.error('Failed to load personas:', err);
    } finally {
      setLoadingPersonas(false);
    }
  };

  useEffect(() => {
    // Check initial demo chat restore before auth loads
    const params = new URLSearchParams(window.location.search);
    const targetChatId = params.get('chat') || localStorage.getItem('active_persona_id');
    if (targetChatId && targetChatId.startsWith('demo-')) {
      const demo = DEMO_PERSONAS.find((p) => p.id === targetChatId);
      if (demo) startChat(demo);
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.access_token) {
        fetchPersonas(data.session.access_token);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.access_token) {
        fetchPersonas(newSession.access_token);
      } else {
        setPersonas([]);
      }
    });

    const handleHashChange = () => {
      setAuthModal(getInitialModal());
    };
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      authListener?.subscription?.unsubscribe();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const openAuth = (mode) => {
    setAuthModal(mode);
    window.location.hash = `#${mode}`;
  };

  const closeAuth = () => {
    setAuthModal(null);
    window.history.pushState(null, '', window.location.pathname);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setPersonas([]);
    handleCloseChat();
  };

  const openCreateModal = () => {
    if (!session) {
      openAuth('signin');
      return;
    }
    setIsPersonaModalOpen(true);
  };

  const handleSubmit = ({ text, files }) => {
    if (!session) {
      openAuth('signin');
      return;
    }
    if (personas.length > 0) {
      startChat(personas[0], text);
    } else {
      setIsPersonaModalOpen(true);
    }
  };

  const handleEditPersona = (personaToEdit) => {
    if (!session) {
      openAuth('signin');
      return;
    }
    setEditingPersona(personaToEdit);
  };

  const handlePersonaSaved = (personaData) => {
    if (session?.access_token) {
      fetchPersonas(session.access_token);
    }
    if (personaData) {
      setActiveChat((prev) => {
        if (prev && prev.id === personaData.id) {
          const photoUrl = personaData.photo_url
            ? (personaData.photo_url.startsWith('http') ? personaData.photo_url : `${API}${personaData.photo_url}`)
            : prev.image;
          return {
            ...prev,
            ...personaData,
            image: photoUrl,
          };
        }
        return prev;
      });
      if (!editingPersona) {
        startChat(personaData);
      }
    }
    setEditingPersona(null);
    setIsPersonaModalOpen(false);
  };

  const handlePersonaDeleted = (deletedId) => {
    setPersonas((prev) => prev.filter((p) => p.id !== deletedId));
    setActiveChat((prev) => {
      if (prev?.id === deletedId) {
        handleCloseChat();
        return null;
      }
      return prev;
    });
    setEditingPersona((prev) => (prev?.id === deletedId ? null : prev));
    setDeletingPersona(null);
  };

  return (
    <>
      {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}

      <div className={styles.page}>
        {/* Background Visual Elements */}
        <ParticleCanvas />
        <div className={styles.blob1} aria-hidden="true" />
        <div className={styles.blob2} aria-hidden="true" />
        <div className={styles.blob3} aria-hidden="true" />
        <div className={styles.grid} aria-hidden="true" />

        {/* ── Floating Rolling Animation ── */}
        <RollingAnimation />

        {/* ── Navbar (52px transparent) ── */}
        <header className={styles.header}>
          <a
            href="/"
            className={styles.logo}
            onClick={(e) => {
              e.preventDefault();
              closeAuth();
            }}
          >
            <img
              src="/logo.png?v=4"
              alt="Pratibimb"
              className={styles.logoImg}
              onError={(e) => {
                e.target.style.display = 'none';
                const span = document.createElement('span');
                span.textContent = 'Pratibimb';
                span.className = styles.logoFallback;
                e.target.parentNode.appendChild(span);
              }}
            />
          </a>

          <nav className={styles.nav}>
            {user ? (
              <>
                <div className={styles.userBadge}>
                  <span className={styles.userAvatarDot} />
                  <span>{user.email?.split('@')[0]}</span>
                </div>
                <button className={styles.signOutBtn} onClick={handleSignOut} title="Sign Out">
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  className={`${styles.signInBtn} ${authModal === 'signin' ? styles.btnActive : ''}`}
                  onClick={() => openAuth('signin')}
                >
                  Sign In
                </button>
                <button
                  className={`${styles.createBtn} ${authModal === 'signup' ? styles.btnActiveGlow : ''}`}
                  onClick={() => openAuth('signup')}
                >
                  Create Account
                </button>
              </>
            )}
          </nav>
        </header>

        {/* ── Main Landing Hero ── */}
        <main className={styles.main}>
          <h1 className={styles.heading}>Bring Anyone<br />Back to Life.</h1>

          <p className={styles.subheading}>
            Preserve the way they look, sound, and speak—and create a digital
            presence you can actually talk to.
          </p>

          <div className={styles.searchWrapper}>
            <SearchBar
              onSubmit={handleSubmit}
              onUploadClick={openCreateModal}
              placeholder="Describe the persona or attach references..."
            />
          </div>

          {/* Trust row */}
          <div className={styles.trustRow}>
            <span className={styles.trustItem}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              No credit card required
            </span>
            <span className={styles.trustDivider}>·</span>
            <span className={styles.trustItem}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              End-to-end encrypted
            </span>
            <span className={styles.trustDivider}>·</span>
            <span className={styles.trustItem}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Privacy first
            </span>
          </div>
        </main>

        {/* ── Gallery Section ── */}
        <section className={styles.gallerySection}>
          <div className={styles.galleryHeader}>
            <h2 className={styles.galleryTitle}>{user ? 'Your Personas' : 'Gallery'}</h2>
          </div>

          <div className={styles.filterScroll}>
            <div className={styles.filterGroupLeft}>
              <button className={styles.filterBtn}>
                <Filter size={14} /> Filter <span className={styles.filterChevron}>▼</span>
              </button>
              <button className={`${styles.filterBtn} ${styles.filterActive}`}>
                <LayoutGrid size={14} /> All
              </button>
              <button className={styles.filterBtn}>
                <Star size={14} /> Featured
              </button>
              <button className={styles.filterBtn}>
                <User size={14} /> Character
              </button>
              <button className={styles.filterBtn}>
                <Briefcase size={14} /> Professional
              </button>
              <button className={styles.filterBtn}>
                <Sparkles size={14} /> Entertainment
              </button>
            </div>
            <button className={styles.createModelBtn} onClick={openCreateModal}>
              <Plus size={14} /> Create Persona
            </button>
          </div>

          <div className={styles.galleryGrid}>
            {user && personas.length === 0 && !loadingPersonas && (
              <div className={styles.emptyGalleryPrompt}>
                <Sparkles size={32} color="#6366f1" />
                <p>You haven't created any AI Personas yet.</p>
                <button className={styles.createModelBtn} onClick={openCreateModal}>
                  <Plus size={14} /> Create Your First Persona
                </button>
              </div>
            )}

            {(user && personas.length > 0 ? personas : (user ? [] : DEMO_PERSONAS)).map((p) => {
              const photo = p.photo_url
                ? (p.photo_url.startsWith('http') ? p.photo_url : `${API}${p.photo_url}`)
                : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400';

              return (
                <div key={p.id} className={styles.galleryCard}>
                  <img src={photo} alt={p.name} className={styles.galleryCardBg} />
                  <div className={styles.galleryCardContent}>
                    <h4 className={styles.personaName}>{p.name}</h4>
                    <p className={styles.personaDesc}>
                      {p.notes || `${p.tone || 'Casual'} tone · ${p.language?.toUpperCase() || 'EN'}`}
                    </p>
                    <div className={styles.cardActions}>
                      <button className={styles.resumeBtn} onClick={() => startChat(p)}>
                        Resume Chat
                      </button>
                      <button
                        className={styles.editBtn}
                        title="Edit Persona"
                        aria-label="Edit Persona"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPersona(p);
                        }}
                      >
                        <PenLine size={16} />
                      </button>
                      {user && !p.id.startsWith('demo-') && (
                        <button
                          className={styles.deleteBtn}
                          title="Delete Persona"
                          aria-label="Delete Persona"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingPersona(p);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Auth Modal Popup with Backdrop Blur Overlay ── */}
        {authModal && (
          <AuthPage
            initialMode={authModal}
            onClose={closeAuth}
            onModeChange={(newMode) => {
              setAuthModal(newMode);
              window.location.hash = `#${newMode}`;
            }}
          />
        )}

        {/* ── Create / Edit Persona Modal Popup ── */}
        <CreatePersonaModal
          isOpen={isPersonaModalOpen || !!editingPersona}
          editingPersona={editingPersona}
          onClose={() => {
            setIsPersonaModalOpen(false);
            setEditingPersona(null);
          }}
          onCreated={handlePersonaSaved}
          onDelete={(p) => setDeletingPersona(p)}
        />

        {/* ── Delete Persona Confirmation Modal ── */}
        <DeletePersonaModal
          isOpen={!!deletingPersona}
          persona={deletingPersona}
          onClose={() => setDeletingPersona(null)}
          onDeleted={handlePersonaDeleted}
        />

        {/* ── Chat Page Override ── */}
        {activeChat && (
          <ChatPage
            persona={activeChat}
            onClose={handleCloseChat}
            onEditPersona={handleEditPersona}
          />
        )}
      </div>
    </>
  );
}
