# Persona Section Scroll-Driven 3D Conveyor Animation
> **Drop-in recreation package for your second module**

This package contains the exact components and styles responsible for the **A24-style 3D scroll-driven diagonal conveyor gallery** used in the persona section of the home page.

---

## 1. Files Included
1. **`src/PersonaScrollGallery.jsx`**: The core component that implements:
   - Sticky viewport pinning (`position: sticky; height: 100vh`).
   - The mathematical 3D conveyor transform engine (`computeSlotTransform`).
   - GSAP ScrollTrigger scroll proxy with continuous scrubbing (`scrub: 0.5`).
   - Synchronized Top-Left Dossier (`InfoPanel`), 4-bar dynamic audio equalizer soundwave CTA (`activeChatPill`), Bottom Editorial Reviews (`EditorialReviews`), and Bottom-Right Monospace Counter (`counter`).
2. **`src/PersonaScrollGallery.module.css`**: The stylesheet with:
   - 3D perspective stage (`perspective: 1400px; transform-style: preserve-3d`).
   - Rectangular portrait card geometry (3:4 aspect ratio, rounded corners, obsidian glass rim).
   - Equalizer bar dance animations and hover shimmer sweeps.
   - Mobile responsive overrides.

---

## 2. Required NPM Dependencies
In your target project, install `gsap` and `lucide-react`:
```bash
npm install gsap lucide-react
```

---

## 3. Required Google Fonts in `index.html`
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
```

---

## 4. How the Scrolling Animation Works (The Core Engine)

### A. The 3D Trajectory Formula (`computeSlotTransform`)
For every card `i`, its relative distance to the current scroll progress is:
```javascript
const d = i - scrollStep;
```
- When `d = 0`: Card is in the **center active position** (`scale: 1.0`, zero tilt).
- When `d > 0`: Card is **incoming from the upper-right** (`scale < 1.0`, tilted toward center).
- When `d < 0`: Card is **exiting toward the lower-left** (`scale < 1.0`, tilted away).

```javascript
const computeSlotTransform = (d, VW, VH) => {
  const isMobile = VW < 768;

  // Center focal point
  const centerX = isMobile ? 0.50 * VW : 0.53 * VW;
  const centerY = isMobile ? 0.46 * VH : 0.50 * VH;

  // Diagonal slope (~28 degree incline)
  const deltaX = isMobile ? 0.38 * VW : 0.315 * VW;
  const deltaY = isMobile ? 0.12 * VH : 0.170 * VH;

  const x = centerX + d * deltaX;
  const y = centerY - d * deltaY;

  // Parabolic scale curve (center is 1.0, edge cards scale down smoothly)
  const scale = Math.max(0.42, 1.0 - Math.abs(d) * (isMobile ? 0.22 : 0.24));

  // 3D perspective Euler rotations
  const rotateY = isMobile ? 0 : Math.max(-12, Math.min(12, -d * 7));
  const rotateX = isMobile ? 0 : Math.max(-6,  Math.min(6,   d * 3.5));
  const rotateZ = isMobile ? 0 : Math.max(-5,  Math.min(5,  -d * 2.5));

  // Opacity fade for cards leaving the stage
  let opacity = 1;
  const absD = Math.abs(d);
  if (absD > 1.6) {
    opacity = Math.max(0, 1 - (absD - 1.6) / 0.8);
  }

  const zIndex = Math.round(50 - absD * 15);
  const brightness = Math.max(0.65, 1 - absD * 0.28);

  return { x, y, scale, rotateY, rotateX, rotateZ, opacity, zIndex, brightness };
};
```

### B. The GSAP Scroll Proxy Pattern
Rather than separate individual scroll triggers, one continuous `ScrollTrigger` proxies scroll distance directly into continuous 3D transforms:
```javascript
const SCROLL_DISTANCE = Math.max(VH * 1.25 * (count - 1), 100);

triggerRef.current = ScrollTrigger.create({
  id: 'a24-persona-conveyor',
  trigger: sectionRef.current,
  start: 'top top',
  end: `+=${SCROLL_DISTANCE}`,
  pin: stickyRef.current,
  pinSpacing: true,
  scrub: 0.5,
  onUpdate: (self) => {
    const currentStep = self.progress * (count - 1);
    applyTransforms(currentStep);

    const nearestIdx = Math.min(Math.round(currentStep), count - 1);
    if (nearestIdx !== activeIdxRef.current) {
      activeIdxRef.current = nearestIdx;
      setActiveIdx(nearestIdx);
    }
  },
});
```

---

## 5. Drop-In Code Example (How to Use in Any Page)

```jsx
import React from 'react';
import PersonaScrollGallery from './PersonaScrollGallery';

// Sample persona data to test immediately
const SAMPLE_PERSONAS = [
  {
    id: 'demo-sarah',
    name: 'Sarah (Empathetic Listener)',
    notes: 'A supportive friend ready to listen and give thoughtful, warm advice on any topic.',
    photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=600',
    tone: 'Empathetic & Warm',
    language: 'en'
  },
  {
    id: 'demo-marcus',
    name: 'Marcus (Tech Mentor)',
    notes: 'An experienced senior developer who helps debug code and explains architecture.',
    photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=600',
    tone: 'Professional & Formal',
    language: 'en'
  },
  {
    id: 'demo-elena',
    name: 'Elena (Language Tutor)',
    notes: 'A strict but patient Spanish teacher who corrects your grammar in real-time.',
    photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=600',
    tone: 'Enthusiastic & Energetic',
    language: 'es'
  }
];

export default function MyHomePage() {
  const handleChat = (persona) => {
    console.log('Start chat with:', persona.name);
  };

  const handleEdit = (persona) => {
    console.log('Edit persona:', persona.name);
  };

  const handleDelete = (persona) => {
    console.log('Delete persona:', persona.name);
  };

  return (
    <div style={{ background: '#0b0c13', minHeight: '100vh' }}>
      {/* 1. Header or search bar above gallery */}
      <div style={{ padding: '60px 32px 20px', textAlign: 'center' }}>
        <h1 style={{ color: '#fff', fontFamily: 'Syne, sans-serif' }}>Your Personas</h1>
        <p style={{ color: '#888', fontFamily: 'Space Grotesk, sans-serif' }}>
          Scroll down to browse through your AI companions.
        </p>
      </div>

      {/* 2. Scroll-Driven Persona Conveyor Gallery */}
      <PersonaScrollGallery
        personas={SAMPLE_PERSONAS}
        resolvePhotoUrl={(p) => p.photo_url || p.image}
        onChat={handleChat}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
```
