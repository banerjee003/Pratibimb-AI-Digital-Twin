import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, ChevronDown, ChevronUp, MessageSquare, LogOut, User as UserIcon, Plus } from 'lucide-react';
import SearchBar from './SearchBar';
import AuthPage from './AuthPage';
import CreatePersonaModal from './CreatePersonaModal';
import DeletePersonaModal from './DeletePersonaModal';
import RollingAnimation from './RollingAnimation';
import LoadingScreen from './LoadingScreen';
import ChatPage from './ChatPage';
import PublicLandingPage from './PublicLandingPage';
import PersonaScrollGallery from './PersonaScrollGallery';
import { supabase } from './lib/supabase';
import { API } from './lib/config';
import fullLogo4 from './assets/full logo4.png';
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
      'rgba(3,4,94,',       // deep sapphire
      'rgba(2,62,138,',     // rich navy sapphire
      'rgba(0,119,182,',    // sapphire ocean blue
      'rgba(0,150,199,',    // soft sapphire blue
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
        ctx.shadowBlur = 0;
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
        list.sort((a, b) => new Date(b.last_used_at || b.created_at || 0) - new Date(a.last_used_at || a.created_at || 0));
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

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showProductStory, setShowProductStory] = useState(false);
  const userMenuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  const getDisplayName = (u) => {
    if (!u) return 'USER';
    const fullName = u.user_metadata?.full_name || u.user_metadata?.name;
    if (fullName) return fullName.toUpperCase();
    const emailName = u.email ? u.email.split('@')[0] : 'USER';
    return emailName.replace(/[._-]/g, ' ').toUpperCase();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setPersonas([]);
    setUserMenuOpen(false);
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

  const handleEditPersona = async (personaToEdit) => {
    if (!session) {
      openAuth('signin');
      return;
    }
    setEditingPersona(personaToEdit);

    // Fetch the latest fresh state from the backend
    if (session?.access_token && personaToEdit?.id && !String(personaToEdit.id).startsWith('demo-')) {
      try {
        const res = await fetch(`${API}/api/personas/${personaToEdit.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const fresh = await res.json();
          setEditingPersona(fresh);
        }
      } catch (err) {
        console.warn('Could not refresh editing persona:', err);
      }
    }
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

      {(!user || showProductStory) ? (
        <PublicLandingPage
          onSignIn={() => { setShowProductStory(false); openAuth('signin'); }}
          onSignUp={() => { setShowProductStory(false); openAuth('signup'); }}
          onExploreWorkspace={() => setShowProductStory(false)}
        />
      ) : (
        <div className={styles.page}>
          {/* Background Visual Elements */}
          <ParticleCanvas />
          <div className={styles.blob1} aria-hidden="true" />
          <div className={styles.blob2} aria-hidden="true" />
          <div className={styles.blob3} aria-hidden="true" />
          {/* ── Navbar (52px transparent) ── */}
          <header className={styles.header}>
            <a
              href="/"
              className={styles.logo}
              onClick={(e) => {
                e.preventDefault();
                setShowProductStory(false);
                closeAuth();
              }}
            >
              <img
                src={fullLogo4}
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
              <button
                type="button"
                className={styles.productStoryBtn}
                onClick={() => setShowProductStory(true)}
              >
                <BookOpen size={14} />
                <span>Product Story</span>
              </button>

              <div className={styles.userMenuContainer} ref={userMenuRef}>
                <button
                  type="button"
                  className={`${styles.userDropdownTrigger} ${userMenuOpen ? styles.userDropdownTriggerActive : ''}`}
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <span>{getDisplayName(user)}</span>
                  {userMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {userMenuOpen && (
                  <div className={styles.userMenuDropdown} role="menu">
                    <div className={styles.userMenuHeader}>
                      <div className={styles.userMenuAvatar}>
                        <UserIcon size={18} />
                      </div>
                      <div className={styles.userMenuInfo}>
                        <span className={styles.userMenuName}>{getDisplayName(user)}</span>
                        <span className={styles.userMenuEmail} title={user.email || ''}>
                          {user.email || ''}
                        </span>
                      </div>
                    </div>

                    <div className={styles.userMenuDivider} />

                    <button
                      type="button"
                      className={styles.userMenuItem}
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        if (personas.length > 0) {
                          startChat(personas[0]);
                        } else {
                          startChat(DEMO_PERSONAS[0]);
                        }
                      }}
                    >
                      <MessageSquare size={15} />
                      <span>Go to Messages</span>
                    </button>

                    <button
                      type="button"
                      className={`${styles.userMenuItem} ${styles.userMenuItemSignOut}`}
                      role="menuitem"
                      onClick={() => {
                        setUserMenuOpen(false);
                        handleSignOut();
                      }}
                    >
                      <LogOut size={15} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </nav>
          </header>

          {/* ── Main Landing Hero ── */}
          <main className={styles.main}>
            <h1 className={styles.heading}>
              <span className={styles.headingLine}>Bring Anyone</span>
              <span className={styles.headingLine}>Back to Life.</span>
            </h1>

            <p className={styles.subheading}>
              Preserve the way they look, sound, and speak—and create a digital
              presence you can actually talk to.
            </p>

            <div className={styles.searchWrapper}>
              <div className={styles.searchScaler}>
                <SearchBar
                  onSubmit={handleSubmit}
                  onUploadClick={openCreateModal}
                  placeholder="Describe the persona or attach references..."
                />
              </div>
            </div>

            {/* Trust row */}
            <div className={styles.trustRow}>
              <span className={styles.trustItem}>
                <span className={styles.trustIconCheck}>✓</span>
                NO CREDIT CARD REQUIRED
              </span>
              <span className={styles.trustDivider}>·</span>
              <span className={styles.trustItem}>
                <span className={styles.trustIconLock}>🔒</span>
                END-TO-END ENCRYPTED
              </span>
              <span className={styles.trustDivider}>·</span>
              <span className={styles.trustItem}>
                <span className={styles.trustIconShield}>🛡</span>
                PRIVACY FIRST
              </span>
            </div>
          </main>

          {/* ── 3D Scroll Conveyor Persona Gallery ── */}
          <div className={styles.galleryWrapperHome}>
            <div className={styles.galleryHeaderHome}>
              <h2 className={styles.galleryTitleHome}>YOUR PERSONAS</h2>

              {/* Rolling Animation S-Curve sweeping across the header */}
              <RollingAnimation />

              <button className={styles.createModelBtn} onClick={openCreateModal}>
                <Plus size={15} />
                <span>Create Persona</span>
              </button>
            </div>

            <PersonaScrollGallery
              personas={personas.length > 0 ? personas : DEMO_PERSONAS}
              resolvePhotoUrl={(p) => {
                if (!p) return 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600';
                if (p.photo_url) {
                  return p.photo_url.startsWith('http') ? p.photo_url : `${API}${p.photo_url}`;
                }
                return p.image || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600';
              }}
              onChat={startChat}
              onEdit={handleEditPersona}
              onDelete={setDeletingPersona}
            />
          </div>
        </div>
      )}

        {/* ── Chat Page Override ── */}
        {activeChat && (
          <ChatPage
            persona={activeChat}
            onClose={handleCloseChat}
            onEditPersona={handleEditPersona}
          />
        )}

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
    </>
  );
}
