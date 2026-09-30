# Landing Page Drop-In Bundle

This folder contains all files directly connected to the Pratibimb Public Landing Page. You can copy the contents of `src/` and `public/` directly into your other module.

## Files Included:
1. `src/PublicLandingPage.jsx`: The primary landing page component (Hero, GSAP Pinned Story Theatre, Deployment CTA, System Config).
2. `src/PublicLandingPage.module.css`: Complete styling with the Midnight Sapphire `#03045E` palette, dynamic themes, and industrial HUD layout.
3. `src/UnfoldingBoxCanvas.jsx`: 3D procedural Three.js quantum vault that unlatches and unfolds across the 7 story sections.
4. `src/AuthPage.jsx`: The Authentication Modal triggered when users click "Sign In" or "Get Started" from the landing page.
5. `src/AuthPage.module.css`: Auth modal styling.
6. `src/lib/supabase.js`: Supabase auth client setup.
7. `src/lib/config.js`: Backend API config.
8. `public/logo.png`, `public/logo_img.png`, `public/favicon.png`: Brand assets.

## Required Dependencies in Target Module:
```bash
npm install three gsap lucide-react border-beam @supabase/supabase-js
```

## Google Fonts to Add in `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
```

## Drop-In Integration (`App.jsx`):
```jsx
import React, { useState } from 'react';
import PublicLandingPage from './PublicLandingPage';
import AuthPage from './AuthPage';

export default function App() {
  const [authModal, setAuthModal] = useState(null); // 'signin' | 'signup' | null

  return (
    <>
      <PublicLandingPage
        onSignIn={() => setAuthModal('signin')}
        onSignUp={() => setAuthModal('signup')}
        onExploreWorkspace={() => {
          // Navigation to workspace or app
        }}
      />

      {authModal && (
        <AuthPage
          initialMode={authModal}
          onClose={() => setAuthModal(null)}
          onModeChange={(newMode) => setAuthModal(newMode)}
        />
      )}
    </>
  );
}
```
