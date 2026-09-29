import React, { useState, useEffect, useRef } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import { X, Play, Pause } from 'lucide-react';
import styles from './ThinkingOrbs.module.css';

export const TEXT_PIPELINES = {
  text: [
    { orb: 'searching', label: 'Reading your message', ms: 1200 },
    { orb: 'solving', label: 'Composing reply', ms: 1400 },
  ],
  audio: [
    { orb: 'listening', label: 'Processing message', ms: 1200 },
    { orb: 'working', label: 'Generating response', ms: 1500 },
    { orb: 'weaving', label: 'Synthesizing voice (XTTS)', ms: 2000 },
  ],
};

export const VIDEO_PHASES = [
  { id: 'understanding', orb: 'searching', label: 'Understanding your request', color: '#38bdf8', pctRange: [0, 14] },
  { id: 'generating', orb: 'solving', label: 'Generating AI response', color: '#a78bfa', pctRange: [14, 25] },
  { id: 'voice', orb: 'weaving', label: 'Synthesizing voice (XTTS)', color: '#34d399', pctRange: [25, 40] },
  { id: 'face', orb: 'working', label: 'Extracting 3D face structure', color: '#fb923c', pctRange: [40, 55] },
  { id: 'expression', orb: 'connecting', label: 'Generating facial expressions', color: '#f472b6', pctRange: [55, 70] },
  { id: 'lipsync', orb: 'composing', label: 'Lip-syncing with SadTalker', color: '#818cf8', pctRange: [70, 88] },
  { id: 'finalizing', orb: 'shaping', label: 'Finalizing photorealistic video', color: '#fbbf24', pctRange: [88, 100] },
];

export function getVideoPhase(pct) {
  for (const phase of VIDEO_PHASES) {
    if (pct >= phase.pctRange[0] && pct < phase.pctRange[1]) return phase;
  }
  return VIDEO_PHASES[VIDEO_PHASES.length - 1];
}

/**
 * Compact Thinking Pill (For Text and Audio chat modes)
 */
export function CompactThinkingPill({ orb = 'searching', label = 'Thinking...', desc = null }) {
  return (
    <div className={styles.orbCard}>
      <ThinkingOrb state={orb} size={20} theme="dark" speed={1.2} />
      <span className={styles.orbBubbleLabel}>{label}</span>
    </div>
  );
}

/**
 * Multi-Phase Video Thinking Card (For SadTalker Video Avatar generation)
 */
export function VideoThinkingCard({
  progress = 0,
  stageIdx = null,
  phaseId = null,
  orb = null,
  title = null,
  desc = null,
  audioUrl = null,
  isPlayingAudio = false,
  onPlayAudio = null,
  onCancel = null,
}) {
  let phase;
  if (phaseId) {
    phase = VIDEO_PHASES.find((p) => p.id === phaseId) || VIDEO_PHASES[0];
  } else if (stageIdx !== null && stageIdx !== undefined && VIDEO_PHASES[stageIdx]) {
    phase = VIDEO_PHASES[stageIdx];
  } else {
    const pct = Math.min(100, Math.max(0, Math.round(progress)));
    phase = getVideoPhase(pct);
  }

  const orbState = orb || phase.orb;
  const pct = Math.min(100, Math.max(0, Math.round(progress || (stageIdx !== null ? ((stageIdx + 1) / 7) * 100 : 0))));

  const [displayPhase, setDisplayPhase] = useState(phase);
  const [fading, setFading] = useState(false);
  const prevPhaseId = useRef(phase.id);

  useEffect(() => {
    if (phase.id !== prevPhaseId.current) {
      setFading(true);
      const timer = setTimeout(() => {
        setDisplayPhase(phase);
        prevPhaseId.current = phase.id;
        setFading(false);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setDisplayPhase(phase);
    }
  }, [phase.id]);

  const currentPhaseIndex = VIDEO_PHASES.findIndex((p) => p.id === displayPhase.id);
  const displayTitle = title || displayPhase.label;

  return (
    <div className={styles.videoThinkingWrapper}>
      {/* 7 Phase Stepper Dots */}
      <div className={styles.phaseStepRow}>
        {VIDEO_PHASES.map((p, idx) => (
          <div
            key={p.id}
            className={styles.phaseStepDot}
            style={{
              background:
                idx < currentPhaseIndex
                  ? 'rgba(255, 255, 255, 0.45)'
                  : idx === currentPhaseIndex
                  ? displayPhase.color
                  : 'rgba(255, 255, 255, 0.1)',
              boxShadow: idx === currentPhaseIndex ? `0 0 8px ${displayPhase.color}88` : 'none',
              transform: idx === currentPhaseIndex ? 'scale(1.35)' : 'scale(1)',
            }}
            title={`Step ${idx + 1}: ${p.label}`}
          />
        ))}
      </div>

      {/* Main Square Glow Box */}
      <div
        className={styles.videoThinkingBox}
        style={{
          boxShadow: `0 16px 36px rgba(0,0,0,0.5), 0 0 36px ${displayPhase.color}22`,
        }}
      >
        {/* Continuous Spinning Border Tint */}
        <div
          className={styles.videoThinkingBorder}
          style={{
            background: `conic-gradient(from 0deg, ${displayPhase.color}55, transparent 40%, ${displayPhase.color}33 80%, transparent 100%)`,
            animation: 'spinBorder 4s linear infinite',
          }}
        />

        {/* Scaled Orb with Smooth Opacity Crossfade */}
        <div
          className={styles.orbScaler}
          style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.2s ease' }}
        >
          <ThinkingOrb
            state={orbState}
            size={64}
            theme="dark"
            speed={1.3}
            color={displayPhase.color}
          />
        </div>

        {/* Progress Percent Pill */}
        <div
          className={styles.videoProgressPercent}
          style={{ borderColor: `${displayPhase.color}44` }}
        >
          {pct}%
        </div>
      </div>

      {/* Active Phase Label */}
      <div className={styles.videoPhaseStatus}>
        <span
          className={styles.videoPhaseLabel}
          style={{ color: displayPhase.color }}
          key={displayPhase.id}
        >
          {displayTitle}
        </span>
      </div>

      {/* Action Buttons (Voice Preview + Stop Generation) */}
      {(audioUrl || onCancel) && (
        <div className={styles.actionStrip}>
          {audioUrl && onPlayAudio && (
            <button
              type="button"
              onClick={() => onPlayAudio(audioUrl)}
              className={styles.voicePreviewBtn}
              title={isPlayingAudio ? 'Pause Voice Preview' : 'Listen to Voice Preview'}
            >
              {isPlayingAudio ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
              <span>{isPlayingAudio ? 'Pause Voice' : 'Voice Preview'}</span>
            </button>
          )}

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={styles.cancelBtn}
              title="Stop video generation"
            >
              <X size={13} />
              <span>Stop</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { ThinkingOrb };
export default ThinkingOrb;
