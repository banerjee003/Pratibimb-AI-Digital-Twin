import React from 'react';
import styles from './RollingAnimation.module.css';

export default function RollingAnimation() {
  const inText = "Can you summarize yesterday's meeting?\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0What time is the sync tomorrow?\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Could you draft an email to the design team?\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0What were the key takeaways from the Q3 report?\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0How is the new campaign performing?\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0".repeat(30);
  const outText = "Summarizing meeting notes...\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Sync is scheduled for 2 PM tomorrow.\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Drafting email to the design team...\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Q3 report shows a 15% engagement increase.\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0The new campaign is exceeding expectations.\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0".repeat(30);

  /**
   * A tall vertical S-curve that bridges the hero section to the gallery.
   *
   * ViewBox: 0 0 1920 900
   *
   * The S is oriented vertically so the user's eye follows it DOWNWARD:
   *
   *   ① Grey text enters from top-left
   *   ② Upper belly sweeps to the RIGHT (eye moves right + down)
   *   ③ Transcriber box sits at center (960, 450)
   *   ④ Lower belly sweeps back to the LEFT (eye moves left + down)
   *   ⑤ Black ribbon exits at bottom, pointing toward gallery
   *
   * This creates a natural scanning motion: top-left → center → bottom
   * guiding the user's gaze from the hero headline down into the gallery.
   */
  return (
    <section className={styles.rollingSection}>
      <div className={styles.container}>

        <svg
          viewBox="0 0 1920 520"
          className={styles.svgLayer}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Upper S — starts top-left, curves smoothly into the center */}
            <path
              id="path-in"
              d="M -100 50 C 400 50, 600 260, 960 260"
            />
            {/* Lower S — starts at center, curves smoothly to bottom-right */}
            <path
              id="path-out"
              d="M 960 260 C 1320 260, 1520 470, 2020 470"
            />
          </defs>

          {/* Incoming grey text */}
          <text className={styles.textIn} dominantBaseline="middle">
            <textPath href="#path-in" startOffset="0%">
              {inText}
              <animate attributeName="startOffset" from="-1000%" to="0%" dur="220s" repeatCount="indefinite" />
            </textPath>
          </text>

          {/* Outgoing black ribbon — background */}
          <text className={styles.textOutBg} dominantBaseline="middle">
            <textPath href="#path-out" startOffset="0%">
              {outText}
              <animate attributeName="startOffset" from="-1000%" to="0%" dur="170s" repeatCount="indefinite" />
            </textPath>
          </text>

          {/* Outgoing white text on ribbon */}
          <text className={styles.textOutFg} dominantBaseline="middle">
            <textPath href="#path-out" startOffset="0%">
              {outText}
              <animate attributeName="startOffset" from="-1000%" to="0%" dur="170s" repeatCount="indefinite" />
            </textPath>
          </text>
        </svg>

        {/* Transcriber at SVG (960, 450) → left: 50%, top: 50% */}
        <div className={styles.transcriberBox}>
          <svg width="46" height="28" viewBox="0 0 46 28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path className={styles.waveBar} d="M 2 12 L 2 16" />
            <path className={styles.waveBar} d="M 7 10 L 7 18" />
            <path className={styles.waveBar} d="M 12 5 L 12 23" />
            <path className={styles.waveBar} d="M 17 9 L 17 19" />
            <path className={styles.waveBar} d="M 22 11 L 22 17" />
            <path className={styles.waveBar} d="M 27 7 L 27 21" />
            <path className={styles.waveBar} d="M 32 5 L 32 23" />
            <path className={styles.waveBar} d="M 37 9 L 37 19" />
            <path className={styles.waveBar} d="M 42 12 L 42 16" />
          </svg>
        </div>

      </div>
    </section>
  );
}
