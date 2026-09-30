import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  X, 
  Image as ImageIcon, 
  Mic, 
  UploadCloud, 
  CheckCircle2, 
  ChevronDown, 
  FileAudio, 
  Trash2,
  Sliders,
  Globe,
  FolderUp,
  Upload,
  ArrowRight,
  Camera,
  AlertCircle,
  Play,
  Pause
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { API } from './lib/config';
import { blobToWavBlob } from './utils/wavEncoder';
import styles from './CreatePersonaModal.module.css';

const LANGUAGE_MAP = {
  '🇬🇧 English': 'en',
  '🇮🇳 Hindi (हिन्दी)': 'hi',
  '🇮🇳 Bengali (বাংলা)': 'bn',
  '🇪🇸 Spanish (Español)': 'es',
  '🇫🇷 French (Français)': 'fr',
  '🇩🇪 German (Deutsch)': 'de',
  '🇯🇵 Japanese (日本語)': 'ja',
};

export default function CreatePersonaModal({ isOpen, onClose, onCreated, editingPersona = null, onDelete = null }) {
  // Form States
  const [personaName, setPersonaName] = useState('');
  const [conversationalTone, setConversationalTone] = useState('Casual & Relaxed');
  const [communicationStyle, setCommunicationStyle] = useState('friendly, direct, concise');
  const [humorLevel, setHumorLevel] = useState('Light (Subtle wit)');
  const [primaryLanguage, setPrimaryLanguage] = useState('🇬🇧 English');
  const [personalityDetails, setPersonalityDetails] = useState('');

  // Upload States
  const [portraitFile, setPortraitFile] = useState(null);
  const [portraitPreview, setPortraitPreview] = useState(null);
  const [voiceFile, setVoiceFile] = useState(null);
  const [voiceFileName, setVoiceFileName] = useState('');
  const [voicePreviewUrl, setVoicePreviewUrl] = useState(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceDuration, setVoiceDuration] = useState(0);

  // Voice Fine-Tuning & Mastering States
  const [showVoiceTuning, setShowVoiceTuning] = useState(false);
  const [voiceGender, setVoiceGender] = useState('auto'); // 'auto', 'male', 'female'
  const [pitchSemitones, setPitchSemitones] = useState(0); // -3.0 to +3.0
  const [speakingSpeed, setSpeakingSpeed] = useState(1.0); // 0.85 to 1.25
  const [voiceWarmth, setVoiceWarmth] = useState(0.8); // 0.0 to 3.0

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [createdPersona, setCreatedPersona] = useState(null);
  const [error, setError] = useState('');

  const portraitInputRef = useRef(null);
  const voiceInputRef = useRef(null);
  const voiceAudioRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  // Hydrate form when editingPersona changes
  useEffect(() => {
    if (editingPersona) {
      setPersonaName(editingPersona.name || '');

      const toneLower = (editingPersona.tone || '').toLowerCase();
      if (toneLower.includes('casual')) setConversationalTone('Casual & Relaxed');
      else if (toneLower.includes('professional') || toneLower.includes('formal')) setConversationalTone('Professional & Formal');
      else if (toneLower.includes('empathetic') || toneLower.includes('warm')) setConversationalTone('Empathetic & Warm');
      else if (toneLower.includes('enthusiastic') || toneLower.includes('energetic')) setConversationalTone('Enthusiastic & Energetic');
      else if (toneLower.includes('philosophical') || toneLower.includes('thoughtful')) setConversationalTone('Philosophical & Thoughtful');
      else if (toneLower.includes('humorous') || toneLower.includes('playful')) setConversationalTone('Humorous & Playful');
      else setConversationalTone(editingPersona.tone || 'Casual & Relaxed');

      setCommunicationStyle(editingPersona.style || 'friendly, direct, concise');

      const humorLower = (editingPersona.humor || '').toLowerCase();
      if (humorLower.includes('light')) setHumorLevel('Light (Subtle wit)');
      else if (humorLower.includes('none') || humorLower.includes('serious')) setHumorLevel('None (Strictly Serious)');
      else if (humorLower.includes('moderate')) setHumorLevel('Moderate (Balanced humor)');
      else if (humorLower.includes('high') || humorLower.includes('witty')) setHumorLevel('High (Witty & Entertaining)');
      else setHumorLevel(editingPersona.humor || 'Light (Subtle wit)');

      const lang = editingPersona.language || 'en';
      if (lang === 'hi') setPrimaryLanguage('🇮🇳 Hindi (हिन्दी)');
      else if (lang === 'bn') setPrimaryLanguage('🇮🇳 Bengali (বাংলা)');
      else if (lang === 'es') setPrimaryLanguage('🇪🇸 Spanish (Español)');
      else if (lang === 'fr') setPrimaryLanguage('🇫🇷 French (Français)');
      else if (lang === 'de') setPrimaryLanguage('🇩🇪 German (Deutsch)');
      else if (lang === 'ja') setPrimaryLanguage('🇯🇵 Japanese (日本語)');
      else setPrimaryLanguage('🇬🇧 English');

      setPersonalityDetails(editingPersona.notes || '');

      const photoUrl = editingPersona.photo_url
        ? (editingPersona.photo_url.startsWith('http') ? editingPersona.photo_url : `${API}${editingPersona.photo_url}`)
        : (editingPersona.image || null);
      setPortraitPreview(photoUrl);

      let vUrl = null;
      if (editingPersona.voice_url) {
        vUrl = editingPersona.voice_url.startsWith('http')
          ? editingPersona.voice_url
          : `${API}${editingPersona.voice_url.startsWith('/') ? '' : '/'}${editingPersona.voice_url}`;
      } else if (editingPersona.voice_path) {
        const match = editingPersona.voice_path.match(/users[\\/].*$/i) || editingPersona.voice_path.match(/media[\\/].*$/i);
        if (match) {
          const cleanRel = match[0].replace(/\\/g, '/');
          const prefix = cleanRel.startsWith('media/') ? '' : 'media/';
          vUrl = `${API}/${prefix}${cleanRel}`;
        }
      }

      if (vUrl || editingPersona.voice_path) {
        setVoiceFileName('Current voice reference saved');
        setVoicePreviewUrl(vUrl);
      } else {
        setVoiceFileName('');
        setVoicePreviewUrl(null);
      }

      // Proactively fetch latest persona details from backend to ensure voice_url is active
      if (editingPersona.id && !String(editingPersona.id).startsWith('demo-')) {
        (async () => {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            const res = await fetch(`${API}/api/personas/${editingPersona.id}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (res.ok) {
              const fresh = await res.json();
              if (fresh.voice_url) {
                const freshVUrl = fresh.voice_url.startsWith('http')
                  ? fresh.voice_url
                  : `${API}${fresh.voice_url.startsWith('/') ? '' : '/'}${fresh.voice_url}`;
                setVoicePreviewUrl(freshVUrl);
                setVoiceFileName('Current voice reference saved');
              }
              if (fresh.photo_url) {
                const freshPUrl = fresh.photo_url.startsWith('http')
                  ? fresh.photo_url
                  : `${API}${fresh.photo_url.startsWith('/') ? '' : '/'}${fresh.photo_url}`;
                setPortraitPreview(freshPUrl);
              }
              if (fresh.voice_profile) {
                const vp = fresh.voice_profile;
                setVoiceGender(vp.voice_gender || 'auto');
                setPitchSemitones(vp.pitch_semitones !== undefined ? vp.pitch_semitones : 0);
                setSpeakingSpeed(vp.speed !== undefined ? vp.speed : 1.0);
                setVoiceWarmth(vp.warmth_boost !== undefined ? vp.warmth_boost : 1.5);
              }
            }
          } catch (err) {
            console.warn('Could not refresh editing persona details:', err);
          }
        })();
      }

      if (editingPersona.voice_profile) {
        const vp = editingPersona.voice_profile;
        setVoiceGender(vp.voice_gender || 'auto');
        setPitchSemitones(vp.pitch_semitones !== undefined ? vp.pitch_semitones : 0);
        setSpeakingSpeed(vp.speed !== undefined ? vp.speed : 1.0);
        setVoiceWarmth(vp.warmth_boost !== undefined ? vp.warmth_boost : 1.5);
      }

      setPortraitFile(null);
      setVoiceFile(null);
      setIsPlayingVoice(false);
      setSubmitted(false);
      setError('');
    } else {
      setPersonaName('');
      setConversationalTone('Casual & Relaxed');
      setCommunicationStyle('friendly, direct, concise');
      setHumorLevel('Light (Subtle wit)');
      setPrimaryLanguage('🇬🇧 English');
      setPersonalityDetails('');
      setVoiceGender('auto');
      setPitchSemitones(0);
      setSpeakingSpeed(1.0);
      setVoiceWarmth(1.5);
      setShowVoiceTuning(false);
      setPortraitFile(null);
      setPortraitPreview(null);
      setVoiceFile(null);
      setVoiceFileName('');
      setVoicePreviewUrl(null);
      setVoiceDuration(0);
      setIsPlayingVoice(false);
      setSubmitted(false);
      setError('');
    }
  }, [editingPersona, isOpen]);

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        try {
          const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const wavBlob = await blobToWavBlob(rawBlob);
          const file = new File([wavBlob], 'voice-sample.wav', { type: 'audio/wav' });
          setVoiceFile(file);
          setVoiceFileName('voice-sample.wav');
          if (voicePreviewUrl && voicePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(voicePreviewUrl);
          }
          setVoicePreviewUrl(URL.createObjectURL(wavBlob));
          setIsPlayingVoice(false);
        } catch (convErr) {
          console.warn('WAV conversion fallback:', convErr);
          const rawBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
          const file = new File([rawBlob], 'voice-sample.wav', { type: 'audio/wav' });
          setVoiceFile(file);
          setVoiceFileName('voice-sample.wav');
          if (voicePreviewUrl && voicePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(voicePreviewUrl);
          }
          setVoicePreviewUrl(URL.createObjectURL(rawBlob));
          setIsPlayingVoice(false);
        } finally {
          streamRef.current?.getTracks().forEach(t => t.stop());
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (err) {
      console.error('Microphone error:', err);
      setError('Could not access microphone. Please check permissions or upload an audio file.');
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    let interval;
    if (isRecording) {
      if (recordingTime >= 30) {
        handleStopRecording();
      } else {
        interval = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      }
    }
    return () => clearInterval(interval);
  }, [isRecording, recordingTime]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [isOpen, onClose]);

  // Portrait file handler
  const handlePortraitChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPortraitFile(file);
      const url = URL.createObjectURL(file);
      setPortraitPreview(url);
    }
    e.target.value = '';
  };

  const removePortrait = () => {
    setPortraitFile(null);
    if (portraitPreview) URL.revokeObjectURL(portraitPreview);
    setPortraitPreview(null);
  };

  // Voice file handler
  const handleVoiceChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.toLowerCase().endsWith('.wav')) {
        setVoiceFile(file);
        setVoiceFileName(file.name);
        if (voicePreviewUrl && voicePreviewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(voicePreviewUrl);
        }
        setVoicePreviewUrl(URL.createObjectURL(file));
        setIsPlayingVoice(false);
      } else {
        try {
          const wavBlob = await blobToWavBlob(file);
          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const wavFile = new File([wavBlob], `${baseName}.wav`, { type: 'audio/wav' });
          setVoiceFile(wavFile);
          setVoiceFileName(`${baseName}.wav`);
          if (voicePreviewUrl && voicePreviewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(voicePreviewUrl);
          }
          setVoicePreviewUrl(URL.createObjectURL(wavBlob));
          setIsPlayingVoice(false);
        } catch (err) {
          console.warn('Audio transcode to WAV fallback:', err);
          setVoiceFile(file);
          setVoiceFileName(file.name);
          setVoicePreviewUrl(URL.createObjectURL(file));
          setIsPlayingVoice(false);
        }
      }
    }
    e.target.value = '';
  };

  // Keep audio element synced whenever preview URL updates
  useEffect(() => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      setIsPlayingVoice(false);
      if (voicePreviewUrl) {
        voiceAudioRef.current.src = voicePreviewUrl;
        voiceAudioRef.current.load();
      }
    }
  }, [voicePreviewUrl]);

  const toggleVoicePlayback = () => {
    if (!voiceAudioRef.current) return;
    if (!voicePreviewUrl) {
      console.warn('No voice preview URL available to play');
      return;
    }

    if (isPlayingVoice) {
      voiceAudioRef.current.pause();
      setIsPlayingVoice(false);
    } else {
      if (voiceAudioRef.current.ended) {
        voiceAudioRef.current.currentTime = 0;
      }
      voiceAudioRef.current.play().then(() => {
        setIsPlayingVoice(true);
      }).catch(err => {
        console.error('Audio playback error:', err);
        setIsPlayingVoice(false);
      });
    }
  };

  const removeVoice = () => {
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
    }
    if (voicePreviewUrl && voicePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(voicePreviewUrl);
    }
    setIsPlayingVoice(false);
    setVoiceFile(null);
    setVoiceFileName('');
    setVoicePreviewUrl(null);
    setVoiceDuration(0);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setPortraitFile(file);
      const url = URL.createObjectURL(file);
      setPortraitPreview(url);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!personaName.trim()) {
      setError('Please enter a Persona Name.');
      return;
    }

    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        setError('Please sign in before creating a persona.');
        setLoading(false);
        return;
      }

      const token = sessionData.session.access_token;
      const form = new FormData();
      form.append('name', personaName.trim());
      form.append('tone', conversationalTone.toLowerCase());
      form.append('style', communicationStyle.trim());
      form.append('humor', humorLevel.toLowerCase());
      form.append('notes', personalityDetails.trim());
      form.append('language', LANGUAGE_MAP[primaryLanguage] || 'en');

      if (portraitFile) {
        form.append('photo', portraitFile);
      }
      if (voiceFile) {
        form.append('voice', voiceFile);
      }

      // Voice Fine-Tuning and Studio Mastering Profile
      const voiceProfilePayload = {
        voice_gender: voiceGender,
        pitch_semitones: Number(pitchSemitones),
        speed: Number(speakingSpeed),
        warmth_boost: Number(voiceWarmth),
        temperature: 0.72,
        split_sentences: false,
        repetition_penalty: 2.0,
      };
      form.append('voice_profile', JSON.stringify(voiceProfilePayload));

      const endpoint = editingPersona ? `${API}/api/personas/${editingPersona.id}` : `${API}/api/personas`;
      const method = editingPersona ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: form
      });

      if (!res.ok) {
        const errDetail = await res.text();
        let errMsg = editingPersona ? 'Failed to update persona.' : 'Failed to create persona.';
        try {
          const parsed = JSON.parse(errDetail);
          errMsg = parsed.detail || errMsg;
        } catch (_) {
          if (errDetail) errMsg = errDetail;
        }
        throw new Error(errMsg);
      }

      const updatedPersona = await res.json();
      const photoUrl = updatedPersona.photo_url
        ? (updatedPersona.photo_url.startsWith('http') ? updatedPersona.photo_url : `${API}${updatedPersona.photo_url.startsWith('/') ? '' : '/'}${updatedPersona.photo_url}`)
        : (portraitPreview || updatedPersona.image);

      const resolvedPersona = {
        ...updatedPersona,
        photo_url: photoUrl,
        image: photoUrl
      };

      setCreatedPersona(resolvedPersona);
      setSubmitted(true);
      if (onCreated) {
        onCreated(resolvedPersona);
      }
    } catch (err) {
      console.error('Persona submission error:', err);
      setError(err?.message || (editingPersona ? 'Failed to update persona.' : 'Failed to create persona.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    if (createdPersona && onCreated) {
      onCreated(createdPersona);
    }
    setSubmitted(false);
    setCreatedPersona(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.cardWrapper} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalCard}>
            {/* Top Close Button */}
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className={styles.header}>
              <div className={styles.titleRow}>
                <div>
                  <h2 className={styles.title}>{editingPersona ? 'Edit Your Persona' : 'Create Your Persona'}</h2>
                  <p className={styles.subtitle}>
                    {editingPersona
                      ? "Update your synthetic avatar's identity traits, speaking style, photo, or voice reference."
                      : "Configure your synthetic avatar's identity, speaking style, photo, and voice."}
                  </p>
                </div>
              </div>
            </div>

            {submitted ? (
              <div className={styles.successBox}>
                <div className={styles.successAvatarWrapper}>
                  {portraitPreview ? (
                    <img src={portraitPreview} alt={personaName} className={styles.successAvatar} />
                  ) : (
                    <div className={styles.successAvatarDefault}>👤</div>
                  )}
                  <div className={styles.successAvatarBadge}>
                    <CheckCircle2 size={18} />
                  </div>
                </div>
                <h3>{editingPersona ? 'Persona Updated Successfully!' : 'Persona Created Successfully!'}</h3>
                <p>
                  <strong>{personaName}</strong> is configured with customized identity traits, talking head animations, and voice synthesis.
                </p>
                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={handleResetAndClose}
                >
                  Start Conversation with {personaName}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                {error && (
                  <div className={styles.errorBanner} role="alert">
                    <AlertCircle size={18} className={styles.errorIcon} />
                    <span>{error}</span>
                  </div>
                )}

                {/* Persona Profile Picture Section at Top of Form */}
                <div 
                  className={styles.profilePictureSection}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                >
                  <div
                    className={`${styles.profileAvatarFrame} ${portraitPreview ? styles.hasPhoto : ''}`}
                    onClick={() => portraitInputRef.current?.click()}
                    title={portraitPreview ? "Click or drop to change persona profile picture" : "Click or drop to upload persona profile picture"}
                  >
                    {portraitPreview ? (
                      <>
                        <img src={portraitPreview} alt="Persona Profile" className={styles.profileAvatarImg} />
                        <div className={styles.profileAvatarOverlay}>
                          <Camera size={18} />
                          <span>Change</span>
                        </div>
                      </>
                    ) : (
                      <div className={styles.profileAvatarPlaceholder}>
                        <Camera size={26} className={styles.placeholderIcon} />
                        <span className={styles.placeholderText}>Add Photo</span>
                      </div>
                    )}
                  </div>

                  <div className={styles.profileMeta}>
                    <div className={styles.profileTitleRow}>
                      <span className={styles.profileTitle}>Persona Profile Picture</span>
                      {portraitPreview ? (
                        <span className={styles.profileBadgeReady}>
                          <span className={styles.profileBadgeReadyDot} />
                          Face photo ready
                        </span>
                      ) : (
                        <span className={styles.profileBadgePrompt}>Required for animation</span>
                      )}
                    </div>
                    <p className={styles.profileDesc}>
                      {portraitPreview
                        ? `${portraitFile?.name || (editingPersona?.name ? `${editingPersona.name}.jpg` : 'Uploaded face photo')} ${portraitFile?.size ? `· ${(portraitFile.size / (1024 * 1024)).toFixed(2)} MB` : ''}`
                        : 'Choose a clear portrait photo for lip-sync animation and profile picture.'}
                    </p>
                    <div className={styles.profileActions}>
                      <button
                        type="button"
                        className={styles.profileUploadBtn}
                        onClick={() => portraitInputRef.current?.click()}
                      >
                        <Upload size={13} />
                        <span>{portraitPreview ? 'Change Photo' : 'Upload Profile Picture'}</span>
                      </button>
                      {portraitPreview && (
                        <button
                          type="button"
                          className={styles.profileRemoveBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            removePortrait();
                          }}
                          title="Remove profile picture"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    ref={portraitInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handlePortraitChange}
                  />
                </div>

                {/* Row 1: Persona Name & Conversational Tone */}
                <div className={styles.row}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                      Persona Name <span className={styles.required}>*</span>
                    </label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="e.g. Hrithik Roshan, Marcus Aurelius"
                      value={personaName}
                      onChange={(e) => setPersonaName(e.target.value)}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Conversational Tone</label>
                    <div className={styles.selectWrapper}>
                      <select
                        className={styles.select}
                        value={conversationalTone}
                        onChange={(e) => setConversationalTone(e.target.value)}
                      >
                        <option value="Casual & Relaxed">Casual & Relaxed</option>
                        <option value="Professional & Formal">Professional & Formal</option>
                        <option value="Empathetic & Warm">Empathetic & Warm</option>
                        <option value="Enthusiastic & Energetic">Enthusiastic & Energetic</option>
                        <option value="Philosophical & Thoughtful">Philosophical & Thoughtful</option>
                        <option value="Humorous & Playful">Humorous & Playful</option>
                      </select>
                      <ChevronDown size={15} className={styles.selectArrow} />
                    </div>
                  </div>
                </div>

                {/* Row 2: Communication Style & Humor Level */}
                <div className={styles.row}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Communication Style</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="friendly, direct, concise"
                      value={communicationStyle}
                      onChange={(e) => setCommunicationStyle(e.target.value)}
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Humor Level</label>
                    <div className={styles.selectWrapper}>
                      <select
                        className={styles.select}
                        value={humorLevel}
                        onChange={(e) => setHumorLevel(e.target.value)}
                      >
                        <option value="Light (Subtle wit)">Light (Subtle wit)</option>
                        <option value="None (Strictly Serious)">None (Strictly Serious)</option>
                        <option value="Moderate (Balanced humor)">Moderate (Balanced humor)</option>
                        <option value="High (Witty & Entertaining)">High (Witty & Entertaining)</option>
                      </select>
                      <ChevronDown size={15} className={styles.selectArrow} />
                    </div>
                  </div>
                </div>

                {/* Row 3: Primary Language */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Primary Language</label>
                  <div className={styles.selectWrapper}>
                    <select
                      className={styles.select}
                      value={primaryLanguage}
                      onChange={(e) => setPrimaryLanguage(e.target.value)}
                    >
                      <option value="🇬🇧 English">🇬🇧 English</option>
                      <option value="🇮🇳 Hindi (हिन्दी)">🇮🇳 Hindi (हिन्दी)</option>
                      <option value="🇮🇳 Bengali (বাংলা)">🇮🇳 Bengali (বাংলা)</option>
                      <option value="🇪🇸 Spanish (Español)">🇪🇸 Spanish (Español)</option>
                      <option value="🇫🇷 French (Français)">🇫🇷 French (Français)</option>
                      <option value="🇩🇪 German (Deutsch)">🇩🇪 German (Deutsch)</option>
                      <option value="🇯🇵 Japanese (日本語)">🇯🇵 Japanese (日本語)</option>
                    </select>
                    <ChevronDown size={15} className={styles.selectArrow} />
                  </div>
                  <span className={styles.helperText}>
                    The avatar can also speak in Hindi or Bengali using native Indian acoustic voice cloning.
                  </span>
                </div>

                {/* Row 4: Personality Details & Guidelines */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Personality Details & Guidelines</label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    placeholder="Add background story, traits, speaking habits, or specific knowledge instructions..."
                    value={personalityDetails}
                    onChange={(e) => setPersonalityDetails(e.target.value)}
                  />
                </div>

                {/* Row 5: Voice Reference Sample (Dual Cards or Active Audio Card) */}
                <div className={styles.dropzoneSection}>
                  <h3 className={styles.dropzoneTitle}>
                    {(voiceFile || voiceFileName) ? 'Voice reference sample' : 'Capture audio or upload audio'}
                  </h3>
                  <p className={styles.dropzoneSubtitle}>
                    {(voiceFile || voiceFileName)
                      ? 'Reference audio sample ready for voice synthesis cloning (up to 30 seconds).'
                      : "Provide a reference sample for your persona's voice (up to 30 seconds)."}
                  </p>

                  {/* Hidden Input for voice file */}
                  <input
                    ref={voiceInputRef}
                    type="file"
                    accept="audio/wav,.wav,audio/*"
                    hidden
                    onChange={handleVoiceChange}
                  />

                  {/* Audio Player for previewing the voice sample */}
                  <audio
                    ref={voiceAudioRef}
                    src={voicePreviewUrl || ''}
                    preload="auto"
                    onLoadedMetadata={(e) => {
                      if (e.target.duration && !isNaN(e.target.duration)) {
                        setVoiceDuration(e.target.duration);
                      }
                    }}
                    onEnded={() => setIsPlayingVoice(false)}
                    onPause={() => setIsPlayingVoice(false)}
                    onError={(e) => {
                      console.error('Audio element playback error:', e);
                      setIsPlayingVoice(false);
                    }}
                  />

                  {isRecording ? (
                    <div className={styles.recordingInterface}>
                      <div className={styles.recordingHeader}>
                        <span className={styles.recordingTimeActive}>{formatTime(recordingTime)}</span>
                        <span className={styles.recordingTimeMax}>00:30</span>
                      </div>
                      
                      <div className={styles.waveformContainer}>
                        {[...Array(40)].map((_, i) => (
                          <div
                            key={i}
                            className={styles.waveformBar}
                            style={{
                              animationDelay: `${(i * 0.08) % 1.2}s`,
                              animationDuration: `${0.4 + (i * 0.037) % 0.7}s`,
                            }}
                          />
                        ))}
                      </div>

                      <button 
                        type="button" 
                        className={styles.stopRecordingBtn} 
                        onClick={handleStopRecording} 
                        title="Stop Recording"
                      >
                        <div className={styles.stopIconSquare}></div>
                      </button>
                    </div>
                  ) : (voiceFile || voiceFileName) ? (
                    /* Captured / Uploaded Audio Card takes the place of the dual cards */
                    <div className={styles.audioSelectedCard}>
                      <div className={styles.audioSelectedLeft}>
                        <button
                          type="button"
                          className={`${styles.audioPlayToggleBtn} ${isPlayingVoice ? styles.isPlaying : ''}`}
                          onClick={toggleVoicePlayback}
                          disabled={!voicePreviewUrl}
                          title={!voicePreviewUrl ? 'Loading voice...' : (isPlayingVoice ? 'Pause audio' : 'Play audio preview')}
                        >
                          {isPlayingVoice ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
                        </button>

                        <div className={styles.audioSelectedInfo}>
                          <span className={styles.audioSelectedName}>
                            {voiceFileName || (voiceFile?.name || 'voice.wav')}
                          </span>
                          <span className={styles.audioSelectedSub}>
                            {isPlayingVoice
                              ? '▶ Playing audio...'
                              : !voicePreviewUrl
                                ? 'Connecting voice preview...'
                                : voiceDuration > 30
                                  ? `${voiceFile?.size ? `${(voiceFile.size / 1024).toFixed(1)} KB · ` : ''}${Math.round(voiceDuration)}s (first 30s used for cloning)`
                                  : voiceDuration > 0
                                    ? `${voiceFile?.size ? `${(voiceFile.size / 1024).toFixed(1)} KB · ` : ''}${Math.round(voiceDuration)}s voice sample ready`
                                    : voiceFile?.size
                                      ? `${(voiceFile.size / 1024).toFixed(1)} KB · Voice sample ready (up to 30s)`
                                      : 'Saved voice reference · Ready to play'}
                          </span>
                        </div>
                      </div>

                      <div className={styles.audioSelectedActions}>
                        <button
                          type="button"
                          className={styles.audioRemoveBtn}
                          onClick={removeVoice}
                          title="Remove voice sample"
                        >
                          <Trash2 size={15} />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Dual cards appear when no audio is uploaded/captured */
                    <div className={styles.audioCardsGrid}>
                      {/* Left Card: Live Sampling (Yellow) */}
                      <div className={styles.audioCardYellow} onClick={startRecording}>
                        <div className={styles.audioCardIconWrapper}>
                          <Mic size={22} className={styles.audioCardIcon} />
                        </div>
                        <div className={styles.audioCardBottom}>
                          <span className={styles.audioCardText}>Capture audio</span>
                        </div>
                      </div>

                      {/* Right Card: Upload Audio (Purple) */}
                      <div 
                        className={styles.audioCardPurple}
                        onClick={() => voiceInputRef.current?.click()}
                      >
                        <div className={styles.audioBadge}>New</div>
                        <div className={styles.audioCardIconWrapper}>
                          <Upload size={22} className={styles.audioCardIcon} />
                        </div>
                        <div className={styles.audioCardBottom}>
                          <span className={styles.audioCardText}>Upload audio</span>
                          <ArrowRight size={18} className={styles.audioCardArrow} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Voice Fine-Tuning & Mastering */}
                <div className={styles.tuningSection}>
                  <div
                    className={styles.tuningHeader}
                    onClick={() => setShowVoiceTuning(!showVoiceTuning)}
                  >
                    <div className={styles.tuningTitleWrap}>
                      <Sliders size={16} color="#4F46E5" />
                      <h4 className={styles.tuningTitle}>Voice Fine-Tuning & Mastering</h4>
                      <span className={styles.tuningBadge}>
                        {voiceGender === 'male' ? 'Masculine' : voiceGender === 'female' ? 'Feminine' : 'Adaptive'}
                      </span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`${styles.tuningChevron} ${showVoiceTuning ? styles.tuningChevronOpen : ''}`}
                    />
                  </div>

                  {showVoiceTuning && (
                    <div className={styles.tuningBody}>
                      {/* Gender / Acoustic Profile Selector */}
                      <div className={styles.profileTabs}>
                        <button
                          type="button"
                          className={`${styles.profileTab} ${voiceGender === 'auto' ? styles.profileTabActive : ''}`}
                          onClick={() => setVoiceGender('auto')}
                        >
                          <span className={styles.profileTabLabel}>⚡ Auto-Detect</span>
                          <span className={styles.profileTabDesc}>Learns from voice sample</span>
                        </button>

                        <button
                          type="button"
                          className={`${styles.profileTab} ${voiceGender === 'male' ? styles.profileTabActive : ''}`}
                          onClick={() => setVoiceGender('male')}
                        >
                          <span className={styles.profileTabLabel}>👨 Deep / Male</span>
                          <span className={styles.profileTabDesc}>Chest warmth & authority</span>
                        </button>

                        <button
                          type="button"
                          className={`${styles.profileTab} ${voiceGender === 'female' ? styles.profileTabActive : ''}`}
                          onClick={() => setVoiceGender('female')}
                        >
                          <span className={styles.profileTabLabel}>👩 Bright / Female</span>
                          <span className={styles.profileTabDesc}>Clear feminine tone & de-ess</span>
                        </button>
                      </div>

                      {/* Pitch Fine-Tuning Slider */}
                      <div className={styles.sliderRow}>
                        <div className={styles.sliderHeader}>
                          <label className={styles.sliderLabel}>Pitch Fine-Tuning</label>
                          <span className={styles.sliderValueBadge}>
                            {pitchSemitones === 0
                              ? '0 (Exact Reference Match)'
                              : pitchSemitones > 0
                              ? `+${pitchSemitones.toFixed(1)} st (Higher/Brighter)`
                              : `${pitchSemitones.toFixed(1)} st (Deeper/Warmer)`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-3.0"
                          max="3.0"
                          step="0.5"
                          className={styles.sliderInput}
                          value={pitchSemitones}
                          onChange={(e) => setPitchSemitones(parseFloat(e.target.value))}
                        />
                        <div className={styles.sliderScale}>
                          <span>-3.0 st (Deep)</span>
                          <button
                            type="button"
                            className={styles.sliderResetBtn}
                            onClick={() => setPitchSemitones(0)}
                          >
                            Reset
                          </button>
                          <span>+3.0 st (High)</span>
                        </div>
                      </div>

                      {/* Speaking Pace / Speed */}
                      <div className={styles.sliderRow}>
                        <div className={styles.sliderHeader}>
                          <label className={styles.sliderLabel}>Speaking Pace</label>
                          <span className={styles.sliderValueBadge}>
                            {speakingSpeed === 1.0
                              ? '1.0x (Natural Conversational)'
                              : `${speakingSpeed.toFixed(2)}x`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.85"
                          max="1.25"
                          step="0.05"
                          className={styles.sliderInput}
                          value={speakingSpeed}
                          onChange={(e) => setSpeakingSpeed(parseFloat(e.target.value))}
                        />
                        <div className={styles.sliderScale}>
                          <span>0.85x (Relaxed)</span>
                          <button
                            type="button"
                            className={styles.sliderResetBtn}
                            onClick={() => setSpeakingSpeed(1.0)}
                          >
                            Reset
                          </button>
                          <span>1.25x (Energetic)</span>
                        </div>
                      </div>

                      {/* Studio Warmth */}
                      <div className={styles.sliderRow}>
                        <div className={styles.sliderHeader}>
                          <label className={styles.sliderLabel}>Vocal Warmth & Resonance</label>
                          <span className={styles.sliderValueBadge}>+{voiceWarmth.toFixed(1)} dB</span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="3.0"
                          step="0.5"
                          className={styles.sliderInput}
                          value={voiceWarmth}
                          onChange={(e) => setVoiceWarmth(parseFloat(e.target.value))}
                        />
                        <div className={styles.sliderScale}>
                          <span>Clean / Crisp (0 dB)</span>
                          <span>Studio Warm (+1.5 dB)</span>
                          <span>Deep Warmth (+3 dB)</span>
                        </div>
                      </div>

                      {/* Realistic Tip Card */}
                      <div className={styles.tuningTip}>
                        <span>💡</span>
                        <span>
                          <strong>Real-Person Acoustic Engine:</strong> PersonaTwin synthesizes with human-like breathing pauses and expressive intonation, exactly cloning the timbre of your voice sample.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action CTA */}
                <div className={styles.actionButtonGroup}>
                  {editingPersona && onDelete && !String(editingPersona.id || '').startsWith('demo-') && (
                    <button
                      type="button"
                      className={styles.deleteModalBtn}
                      onClick={() => onDelete(editingPersona)}
                      disabled={loading}
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </button>
                  )}
                  <button type="submit" className={styles.submitBtn} disabled={loading}>
                    {loading ? (
                      <span className={styles.spinner} />
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>{editingPersona ? 'Save Changes' : 'Create Persona'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
      </div>
    </div>
  );
}
