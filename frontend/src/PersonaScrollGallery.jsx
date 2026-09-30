/**
 * PersonaScrollGallery.jsx
 *
 * A24-style scroll-driven diagonal conveyor gallery:
 *
 * 1. RECTANGULAR CARDS:
 *    - Premium rectangular portrait Persona Cards (NOT CDs, discs, or circles).
 *    - Dark obsidian surface with subtle rim highlight and rich drop shadow.
 *
 * 2. ENHANCED "START VOICE CHAT" CTA:
 *    - Holographic floating glass pill with animated audio equalizer wave bars,
 *      expanding pulse aura ring, and hover shimmer sweep.
 *
 * 3. A24 EDITORIAL LAYOUT & COLOR HARMONY:
 *    - Minimalist dark background (#0b0c13).
 *    - Editorial serif typography ('Playfair Display' / 'Cinzel') for titles and quotes.
 *    - Pinned dossier with hairline divider rows.
 *    - 5-star gold ratings (★★★★★) with side-by-side editorial quotes.
 *    - Minimalist monospace counter (01 / 03).
 *
 * 4. CONTINUOUS A24 CONVEYOR TRAJECTORY:
 *    - Upward-sloping diagonal conveyor (~28° inclination) from upper-right to lower-left.
 *    - Continuous scroll scrub with 3D perspective orientation.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MessageSquare, PenLine, Trash2, Star } from 'lucide-react';
import styles from './PersonaScrollGallery.module.css';

gsap.registerPlugin(ScrollTrigger);

/* ─── Editorial quote generator ─────────────────────────────────────────── */
function getPersonaQuotes(persona) {
  if (!persona) return null;
  if (persona.id === 'demo-sarah') {
    return {
      leftTag: 'COMMUNICATION STYLE',
      leftQuote: '“Warm, supportive, and deeply attentive to every nuance in your voice.”',
      rightTag: 'SPEECH DYNAMICS',
      rightQuote: '“Gentle inflection with natural pauses and emotional resonance.”',
    };
  }
  if (persona.id === 'demo-marcus') {
    return {
      leftTag: 'MENTORSHIP APPROACH',
      leftQuote: '“Structured explanations that transform complex ideas into actionable clarity.”',
      rightTag: 'VOICE CHARACTER',
      rightQuote: '“Calm, authoritative tone with crystal-clear precision.”',
    };
  }
  if (persona.id === 'demo-elena') {
    return {
      leftTag: 'PEDAGOGICAL ENERGY',
      leftQuote: '“High conversational warmth with real-time pronunciation feedback.”',
      rightTag: 'BILINGUAL FLUENCY',
      rightQuote: '“Expressive native Spanish cadence with natural musicality.”',
    };
  }
  const tone = persona.tone || 'Neural & Adaptive';
  const notes = persona.notes || 'Conversational neural intelligence with emotional memory.';
  return {
    leftTag: 'VOICE ARCHETYPE',
    leftQuote: `“Fine-tuned for ${tone.toLowerCase()} dialogue with zero digital cracking.”`,
    rightTag: 'CORE DIRECTIVE',
    rightQuote: notes.length > 85 ? `“${notes.slice(0, 82)}...”` : `“${notes}”`,
  };
}

/* ─── Top-Left Editorial Info Panel (A24 experience_info) ────────────────── */
function InfoPanel({ persona, onChat, onEdit, onDelete }) {
  if (!persona) return null;
  const isDemo = String(persona.id).startsWith('demo-');

  return (
    <div className={styles.infoPanel}>
      <div className={styles.infoSuper}>AI PERSONA DOSSIER</div>
      <h2 className={styles.infoTitle}>{persona.name}</h2>

      <div className={styles.infoMetaTable}>
        {persona.tone && (
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>VOICE & TONE</span>
            <span className={styles.metaValue}>{persona.tone}</span>
          </div>
        )}
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>LANGUAGE</span>
          <span className={styles.metaValue}>{(persona.language || 'EN').toUpperCase()}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>STATUS</span>
          <span className={styles.metaValueHighlight}>
            <span className={styles.statusDot} /> ACTIVE · NEURAL READY
          </span>
        </div>
        {persona.notes && (
          <div className={styles.metaBioRow}>
            <span className={styles.metaLabel}>PERSONALITY NOTES</span>
            <p className={styles.metaBioText}>{persona.notes}</p>
          </div>
        )}
      </div>

      <div className={styles.infoActions}>
        <button
          className={styles.primaryChatBtn}
          onClick={() => onChat(persona)}
          aria-label={`Start chat with ${persona.name}`}
        >
          <MessageSquare size={16} />
          <span>Start Chat</span>
        </button>
        <button
          className={styles.secondaryIconBtn}
          onClick={() => onEdit(persona)}
          title="Edit Persona"
          aria-label="Edit Persona"
        >
          <PenLine size={15} />
        </button>
        {!isDemo && (
          <button
            className={`${styles.secondaryIconBtn} ${styles.dangerIconBtn}`}
            onClick={() => onDelete(persona)}
            title="Delete Persona"
            aria-label="Delete Persona"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Bottom Editorial Reviews Section ───────────────────────────────────── */
function EditorialReviews({ persona }) {
  const quotes = useMemo(() => getPersonaQuotes(persona), [persona]);
  if (!quotes) return null;

  return (
    <div className={styles.reviewsWrapper}>
      <div className={styles.reviewCol}>
        <div className={styles.starRating}>
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={11} className={styles.starIcon} fill="currentColor" />
          ))}
        </div>
        <div className={styles.reviewSource}>{quotes.leftTag}</div>
        <blockquote className={styles.reviewQuote}>{quotes.leftQuote}</blockquote>
      </div>

      <div className={styles.reviewCol}>
        <div className={styles.starRating}>
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={11} className={styles.starIcon} fill="currentColor" />
          ))}
        </div>
        <div className={styles.reviewSource}>{quotes.rightTag}</div>
        <blockquote className={styles.reviewQuote}>{quotes.rightQuote}</blockquote>
      </div>
    </div>
  );
}

/* ─── Main Gallery Component ─────────────────────────────────────────────── */
export default function PersonaScrollGallery({
  personas = [],
  resolvePhotoUrl,
  onChat,
  onEdit,
  onDelete,
}) {
  const sectionRef   = useRef(null);
  const stickyRef    = useRef(null);
  const cardRefs     = useRef([]);
  const triggerRef   = useRef(null);
  const activeIdxRef = useRef(0);

  const [activeIdx, setActiveIdx] = useState(0);
  const [mounted, setMounted]     = useState(false);

  const count = personas.length;

  /**
   * Computes position, scale, 3D rotation, and opacity along the A24 diagonal trajectory:
   *   d = -2: exiting bottom-left  (x: -8vw,  y: 84vh, scale: 0.54)
   *   d = -1: previous left        (x: 20vw,  y: 67vh, scale: 0.74)
   *   d =  0: CENTER ACTIVE        (x: 53vw,  y: 50vh, scale: 1.00)
   *   d = +1: incoming right       (x: 85vw,  y: 33vh, scale: 0.78)
   *   d = +2: entering far-right   (x: 114vw, y: 16vh, scale: 0.56)
   */
  const computeSlotTransform = useCallback((d, VW, VH) => {
    const isMobile = VW < 768;

    const centerX = isMobile ? 0.50 * VW : 0.53 * VW;
    const centerY = isMobile ? 0.46 * VH : 0.50 * VH;

    const deltaX = isMobile ? 0.38 * VW : 0.315 * VW;
    const deltaY = isMobile ? 0.12 * VH : 0.170 * VH;

    const x = centerX + d * deltaX;
    const y = centerY - d * deltaY;

    // Scale curve
    const scale = Math.max(0.42, 1.0 - Math.abs(d) * (isMobile ? 0.22 : 0.24));

    // 3D Perspective rotation
    const rotateY = isMobile ? 0 : Math.max(-12, Math.min(12, -d * 7));
    const rotateX = isMobile ? 0 : Math.max(-6,  Math.min(6,   d * 3.5));
    const rotateZ = isMobile ? 0 : Math.max(-5,  Math.min(5,  -d * 2.5));

    // Smooth opacity fade
    let opacity = 1;
    const absD = Math.abs(d);
    if (absD > 1.6) {
      opacity = Math.max(0, 1 - (absD - 1.6) / 0.8);
    }

    const zIndex = Math.round(50 - absD * 15);
    const brightness = Math.max(0.65, 1 - absD * 0.28);

    return { x, y, scale, rotateY, rotateX, rotateZ, opacity, zIndex, brightness };
  }, []);

  const applyTransforms = useCallback((scrollStep) => {
    const VW = window.innerWidth;
    const VH = window.innerHeight;

    cardRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = i - scrollStep;
      const t = computeSlotTransform(d, VW, VH);

      if (t.opacity <= 0.01) {
        el.style.visibility = 'hidden';
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        return;
      }

      el.style.visibility = 'visible';
      el.style.opacity = String(t.opacity);
      el.style.zIndex = String(t.zIndex);
      el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) translate(-50%, -50%) scale(${t.scale}) rotateY(${t.rotateY}deg) rotateX(${t.rotateX}deg) rotateZ(${t.rotateZ}deg)`;
      el.style.filter = `brightness(${t.brightness})`;
      el.style.pointerEvents = Math.abs(d) < 1.5 ? 'auto' : 'none';
    });
  }, [computeSlotTransform]);

  const scrollToPersona = useCallback((targetIndex) => {
    if (!triggerRef.current || count <= 1) return;
    const st = triggerRef.current;
    const targetProgress = targetIndex / (count - 1);
    const targetScrollY = st.start + targetProgress * (st.end - st.start);
    window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
  }, [count]);

  useEffect(() => {
    if (count === 0) return;

    const section = sectionRef.current;
    const sticky  = stickyRef.current;
    if (!section || !sticky) return;

    ScrollTrigger.getById('a24-persona-conveyor')?.kill();

    const VH = window.innerHeight;
    const SCROLL_DISTANCE = Math.max(VH * 1.25 * (count - 1), 100);

    applyTransforms(0);

    const scrollProxy = { step: 0 };

    if (count > 1) {
      triggerRef.current = ScrollTrigger.create({
        id:         'a24-persona-conveyor',
        trigger:    section,
        start:      'top top',
        end:        `+=${SCROLL_DISTANCE}`,
        pin:        sticky,
        pinSpacing: true,
        scrub:      0.5,
        onUpdate: (self) => {
          const currentStep = self.progress * (count - 1);
          scrollProxy.step = currentStep;
          applyTransforms(currentStep);

          const nearestIdx = Math.min(Math.round(currentStep), count - 1);
          if (nearestIdx !== activeIdxRef.current) {
            activeIdxRef.current = nearestIdx;
            setActiveIdx(nearestIdx);
          }
        },
      });
    }

    const handleResize = () => {
      applyTransforms(scrollProxy.step);
    };

    window.addEventListener('resize', handleResize);
    setMounted(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      triggerRef.current?.kill();
    };
  }, [count, applyTransforms]);

  if (count === 0) return null;

  const currentPersona = personas[activeIdx] || personas[0];

  return (
    <div
      ref={sectionRef}
      className={`${styles.section} ${mounted ? styles.sectionMounted : ''}`}
      aria-label="Persona Gallery"
    >
      <div ref={stickyRef} className={styles.sticky}>

        {/* Ambient background glow accents */}
        <div className={styles.ambientConveyorTrack} aria-hidden="true" />
        <div className={styles.ambientCenterGlow} aria-hidden="true" />

        {/* Top-Left Info Panel (A24 experience_info) */}
        <InfoPanel
          persona={currentPersona}
          onChat={onChat}
          onEdit={onEdit}
          onDelete={onDelete}
        />

        {/* 3D Diagonal Conveyor Stage */}
        <div className={styles.stage}>
          {personas.map((p, i) => {
            const photo = resolvePhotoUrl(p);
            const isActive = i === activeIdx;

            return (
              <div
                key={p.id}
                ref={(el) => { cardRefs.current[i] = el; }}
                className={`${styles.cardWrapper} ${isActive ? styles.cardWrapperActive : ''}`}
                onClick={() => {
                  if (isActive) {
                    onChat(p);
                  } else {
                    scrollToPersona(i);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Persona ${p.name}`}
              >
                <div className={styles.card}>
                  {/* Subtle rim highlight */}
                  <div className={styles.cardRim} />

                  <img
                    src={photo}
                    alt={p.name}
                    className={styles.cardImg}
                    draggable={false}
                    loading={i < 4 ? 'eager' : 'lazy'}
                  />

                  {/* Elegant bottom gradient & details */}
                  <div className={styles.cardGradient} />

                  <div className={`${styles.cardFooter} ${isActive ? styles.cardFooterWithCta : ''}`}>
                    <div className={styles.cardIndexTag}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <h3 className={styles.cardName}>{p.name}</h3>
                    {p.tone && <p className={styles.cardTone}>{p.tone}</p>}
                  </div>

                  {/* Enhanced Interactive Voice Chat CTA on Active Card */}
                  {isActive && (
                    <div className={styles.activeChatCta}>
                      <div className={styles.activeChatPill}>
                        <span className={styles.pulseAura} />
                        <div className={styles.soundWave} aria-hidden="true">
                          <span className={styles.soundBar} />
                          <span className={styles.soundBar} />
                          <span className={styles.soundBar} />
                          <span className={styles.soundBar} />
                        </div>
                        <span className={styles.chatBtnLabel}>Start Voice Chat</span>
                        <span className={styles.chatBtnArrow}>→</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Editorial Reviews (Mirrors A24 quote columns) */}
        <EditorialReviews persona={currentPersona} />

        {/* Bottom-Right Minimalist Counter */}
        <div className={styles.counter} aria-label={`Persona ${activeIdx + 1} of ${count}`}>
          <div className={styles.counterNumbers}>
            <span className={styles.counterCurrent}>
              {String(activeIdx + 1).padStart(2, '0')}
            </span>
            <span className={styles.counterDivider}>/</span>
            <span className={styles.counterTotal}>
              {String(count).padStart(2, '0')}
            </span>
          </div>

          {/* Quick jump dot indicators */}
          {count > 1 && (
            <div className={styles.counterDots}>
              {personas.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`${styles.counterDot} ${idx === activeIdx ? styles.counterDotActive : ''}`}
                  onClick={() => scrollToPersona(idx)}
                  title={`Jump to ${personas[idx].name}`}
                  aria-label={`Jump to persona ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
