# Pratibimb — Auth & Persona Management Drop-in Package

This drop-in bundle provides ready-to-use authentication and persona creation/editing components with obsidian styling, `Space Grotesk` typography, and complete backend/Supabase integration.

---

## 📁 Package Structure

```text
auth_and_persona_dropin/
├── README.md                          <-- This integration guide
├── public/
│   ├── logo.png                       <-- Pratibimb horizontal brand logo
│   └── logo_img.png                   <-- Pratibimb avatar icon
└── src/
    ├── AuthPage.jsx                   <-- Authentication Modal (Sign In & Sign Up)
    ├── AuthPage.module.css            <-- Styles with 1.2x Space Grotesk typography
    ├── CreatePersonaModal.jsx         <-- Persona Creation & Editing Modal
    ├── CreatePersonaModal.module.css  <-- Create/Edit Persona Modal Styles
    ├── DeletePersonaModal.jsx         <-- Companion Persona Deletion Confirmation Modal
    ├── DeletePersonaModal.module.css  <-- Deletion Modal Styles
    ├── lib/
    │   ├── config.js                  <-- Backend API endpoint configuration
    │   └── supabase.js                <-- Supabase client initialization
    └── utils/
        └── wavEncoder.js              <-- 16-bit PCM WAV audio encoder for voice recording
```

---

## 📦 Required NPM Dependencies

In your target project, ensure the following packages are installed:

```bash
npm install lucide-react @supabase/supabase-js
```

---

## 🔑 Environment Variables (`.env`)

Add the following variables to your project's `.env` file:

```env
# Backend API Base URL
VITE_API_URL=http://127.0.0.1:8001

# Supabase Auth Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

*(If you already have Supabase initialized in your project, you can simply update `src/lib/supabase.js` to point to your existing client).*

---

## 🚀 How to Use the Components

### 1. Authentication Modal (`AuthPage.jsx`)

Provides both **Sign In** and **Create Account** modes in a single modal with form validation, password strength meter, password visibility toggles, and session handling.

#### Props:
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `initialMode` | `'signin' \| 'signup'` | `'signin'` | Which tab opens initially |
| `onClose` | `() => void` | `undefined` | Callback fired when the user closes the modal or signs in |
| `onModeChange` | `(mode: 'signin' \| 'signup') => void` | `undefined` | Optional callback when switching tabs |

#### Usage:
```jsx
import React, { useState } from 'react';
import AuthPage from './src/AuthPage';

export default function MyComponent() {
  const [authMode, setAuthMode] = useState(null); // 'signin' | 'signup' | null

  return (
    <div>
      <button onClick={() => setAuthMode('signin')}>Sign In</button>
      <button onClick={() => setAuthMode('signup')}>Create Account</button>

      {authMode && (
        <AuthPage
          initialMode={authMode}
          onClose={() => setAuthMode(null)}
          onModeChange={(mode) => setAuthMode(mode)}
        />
      )}
    </div>
  );
}
```

---

### 2. Edit & Create Persona Modal (`CreatePersonaModal.jsx`)

Handles both **creating** a brand new persona and **editing** an existing one.

- **To Create**: Pass `editingPersona={null}`.
- **To Edit**: Pass the persona object into `editingPersona={persona}`. The form automatically pre-fills with existing tone, humor, language, personality notes, portrait image, and recorded voice.

#### Features Included:
- **Portrait Upload**: Drag-and-drop or file selector with instant image preview.
- **Voice Cloning & Recording**: Live microphone recording with interactive waveform timer, audio playback, file drag-and-drop (`.mp3`, `.wav`, `.m4a`), and client-side WAV encoding.
- **Voice Fine-Tuning**: Pitch semitones (-3.0 to +3.0), speaking speed (0.85x to 1.25x), voice warmth, and gender selection.
- **Personality Customization**: Tone presets, communication style presets, humor levels, multilingual selection (English, Hindi, Bengali, Spanish, French, German, Japanese), and custom prompt notes.
- **Backend Sync**: Dispatches `POST /api/personas` (create) or `PUT /api/personas/{id}` (edit) with `FormData` to the FastAPI backend.

#### Props:
| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `isOpen` | `boolean` | `false` | Controls modal visibility |
| `editingPersona` | `object \| null` | `null` | Pass a persona object to edit, or `null` to create a new one |
| `onClose` | `() => void` | required | Fired on cancel or clicking backdrop/close button |
| `onCreated` | `(persona: object) => void` | required | Fired after successful creation or update |
| `onDelete` | `(persona: object) => void` | `null` | Optional callback to open the deletion confirmation modal |

#### Usage:
```jsx
import React, { useState } from 'react';
import CreatePersonaModal from './src/CreatePersonaModal';
import DeletePersonaModal from './src/DeletePersonaModal';

export default function PersonaManager() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState(null);
  const [personaToDelete, setPersonaToDelete] = useState(null);

  // Open modal to create a new persona
  const handleOpenCreate = () => {
    setEditingPersona(null);
    setIsModalOpen(true);
  };

  // Open modal to edit an existing persona
  const handleOpenEdit = (persona) => {
    setEditingPersona(persona);
    setIsModalOpen(true);
  };

  const handleSaved = (savedPersona) => {
    console.log('Persona saved:', savedPersona);
    setIsModalOpen(false);
    setEditingPersona(null);
  };

  const handleDelete = (persona) => {
    setIsModalOpen(false);
    setEditingPersona(null);
    setPersonaToDelete(persona);
  };

  return (
    <div>
      <button onClick={handleOpenCreate}>+ Create Persona</button>
      <button onClick={() => handleOpenEdit(existingPersona)}>Edit Persona</button>

      {/* Create / Edit Modal */}
      <CreatePersonaModal
        isOpen={isModalOpen}
        editingPersona={editingPersona}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPersona(null);
        }}
        onCreated={handleSaved}
        onDelete={handleDelete}
      />

      {/* Delete Confirmation Modal */}
      <DeletePersonaModal
        isOpen={!!personaToDelete}
        persona={personaToDelete}
        onClose={() => setPersonaToDelete(null)}
        onConfirm={async (p) => {
          // Perform backend deletion
          await fetch(`${API}/api/personas/${p.id}`, { method: 'DELETE' });
          setPersonaToDelete(null);
        }}
      />
    </div>
  );
}
```

---

## 🎨 Typography & Fonts

Both components are designed using the Google Font **Space Grotesk** and **Syne**.

Add this line into your `index.html` `<head>` if not already present:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
```
