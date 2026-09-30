import React from 'react';
import styles from './RollingAnimation.module.css';

export default function RollingAnimation() {
  const inText = "Can you summarize yesterday's meeting?\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0What time is the sync tomorrow?\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Could you draft an email to the design team?\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0What were the key takeaways from the Q3 report?\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0How is the new campaign performing?\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0".repeat(30);
  const outText = "Summarizing meeting notes...\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Sync is scheduled for 2 PM tomorrow.\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Drafting email to the design team...\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0Q3 report shows a 15% engagement increase.\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0The new campaign is exceeding expectations.\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0".repeat(30);

  return (
    <div className={styles.rollingWrapper}>
      <div className={styles.container}>
        <svg
          viewBox="0 0 1920 220"
          className={styles.svgLayer}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Upper wave — enters upper-left, crests smoothly at Y=35 above 'YOUR PERSONAS', slopes into center capsule (960, 110) */}
            <path
              id="path-in"
              d="M -80 100 C 320 15, 680 60, 960 110"
            />
            {/* Lower wave — continues seamlessly from (960, 110) with matching tangent slope down to the lower right */}
            <path
              id="path-out"
              d="M 960 110 C 1240 155, 1600 185, 2060 205"
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

        {/* Transcriber pill at exact center (960, 110) */}
        <div className={styles.transcriberBox}>
          <svg width="28" height="18" viewBox="0 0 28 18" fill="none" stroke="#111218" strokeWidth="2.4" strokeLinecap="round">
            <path className={styles.waveBar} d="M 2 9 L 2 11" />
            <path className={styles.waveBar} d="M 6 6 L 6 13" />
            <path className={styles.waveBar} d="M 10 3 L 10 16" />
            <path className={styles.waveBar} d="M 14 1 L 14 18" />
            <path className={styles.waveBar} d="M 18 4 L 18 15" />
            <path className={styles.waveBar} d="M 22 6 L 22 13" />
            <path className={styles.waveBar} d="M 26 9 L 26 11" />
          </svg>
        </div>
      </div>
    </div>
  );
}
