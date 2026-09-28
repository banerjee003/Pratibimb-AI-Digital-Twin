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
  Play,
  Pause,
  Volume2,
  RotateCcw
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { API } from './lib/config';
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Audio Playback States
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [voiceCurrentTime, setVoiceCurrentTime] = useState(0);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);

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

  // Existing voice reference from DB if editing
  const existingVoiceUrl = editingPersona?.voice_url
    ? (editingPersona.voice_url.startsWith('http') ? editingPersona.voice_url : `${API}${editingPersona.voice_url}`)
    : null;

  const activeAudioUrl = voicePreviewUrl || existingVoiceUrl;

  // Manage voicePreviewUrl when a new voiceFile is chosen
  useEffect(() => {
    if (voiceFile) {
      const url = URL.createObjectURL(voiceFile);
      setVoicePreviewUrl(url);
      setIsPlayingVoice(false);
      setVoiceCurrentTime(0);
      setVoiceDuration(0);
      setAudioError(false);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setVoicePreviewUrl(null);
      setIsPlayingVoice(false);
      setVoiceCurrentTime(0);
      setVoiceDuration(0);
      setAudioError(false);
    }
  }, [voiceFile]);

  // Pause audio when modal is closed
  useEffect(() => {
    if (!isOpen && voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current.currentTime = 0;
      setIsPlayingVoice(false);
      setVoiceCurrentTime(0);
    }
  }, [isOpen]);

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

      if (editingPersona.voice_url || editingPersona.voice_path) {
        setVoiceFileName('Current voice reference saved');
      } else {
        setVoiceFileName('');
      }

      setPortraitFile(null);
      setVoiceFile(null);
      setIsPlayingVoice(false);
      setVoiceCurrentTime(0);
      setSubmitted(false);
      setError('');
    } else {
      setPersonaName('');
      setConversationalTone('Casual & Relaxed');
      setCommunicationStyle('friendly, direct, concise');
      setHumorLevel('Light (Subtle wit)');
      setPrimaryLanguage('🇬🇧 English');
      setPersonalityDetails('');
      setPortraitFile(null);
      setPortraitPreview(null);
      setVoiceFile(null);
      setVoiceFileName('');
      setIsPlayingVoice(false);
      setVoiceCurrentTime(0);
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
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `voice-sample.${ext}`, { type: mimeType });
        setVoiceFile(file);
        setVoiceFileName(`voice-sample.${ext}`);
        streamRef.current?.getTracks().forEach(t => t.stop());
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
      if (recordingTime >= 15) {
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

  if (!isOpen) return null;

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
  const handleVoiceChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setVoiceFile(file);
      setVoiceFileName(file.name);
    }
    e.target.value = '';
  };

  const removeVoice = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current.currentTime = 0;
    }
    setIsPlayingVoice(false);
    setVoiceCurrentTime(0);
    setVoiceFile(null);
    setVoiceFileName(existingVoiceUrl ? 'Current voice reference saved' : '');
  };

  const togglePlayVoice = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!voiceAudioRef.current || !activeAudioUrl) return;

    if (isPlayingVoice) {
      voiceAudioRef.current.pause();
      setIsPlayingVoice(false);
    } else {
      setAudioError(false);
      if (voiceAudioRef.current.ended) {
        voiceAudioRef.current.currentTime = 0;
      }
      voiceAudioRef.current.play().then(() => {
        setIsPlayingVoice(true);
      }).catch((err) => {
        console.error('Audio playback error:', err);
        setIsPlayingVoice(false);
        setAudioError(true);
      });
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
      setCreatedPersona(updatedPersona);
      setSubmitted(true);
      if (onCreated) {
        onCreated(updatedPersona);
      }
    } catch (err) {
      console.error('Persona submission error:', err);
      setError(err?.message || (editingPersona ? 'Failed to update persona.' : 'Failed to create persona.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSubmitted(false);
    setCreatedPersona(null);
    onClose();
  };

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
              <CheckCircle2 size={44} className={styles.successIcon} />
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
              {error && <div className={styles.errorBanner}>{error}</div>}

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

              {/* Row 5: Portrait Photo (Avatar Face) */}
              <div className={styles.dropzoneSection}>
                <h3 className={styles.dropzoneTitle}>Upload your profile image</h3>
                <p className={styles.dropzoneSubtitle}>Choose an image that will appear everywhere in our app.</p>

                <span className={styles.dropzoneLabel}>Upload new image:</span>

                <div
                  className={styles.dropzoneBox}
                  onClick={() => portraitInputRef.current?.click()}
                >
                  <input
                    ref={portraitInputRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handlePortraitChange}
                  />
                  {portraitPreview ? (
                    <div className={styles.dropzonePreviewContainer}>
                      <img src={portraitPreview} alt="Preview" className={styles.dropzonePreviewImg} />
                      <button
                        type="button"
                        className={styles.dropzoneRemoveBtn}
                        onClick={(e) => { e.stopPropagation(); removePortrait(); }}
                        title="Remove photo"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className={styles.dropzoneContent}>
                      <FolderUp size={28} strokeWidth={1.5} className={styles.dropzoneIcon} />
                      <span className={styles.dropzonePrimaryText}>Click or drag and drop to upload your file</span>
                      <span className={styles.dropzoneSecondaryText}>PNG, JPG, PDF, GIF, SVG (Max 5 MB)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 6: Voice Reference Sample */}
              <div className={styles.dropzoneSection}>
                <h3 className={styles.dropzoneTitle}>Voice Reference</h3>
                <p className={styles.dropzoneSubtitle}>
                  {editingPersona
                    ? "Listen to your persona's saved voice reference in the database or record/upload a replacement sample."
                    : "Provide a reference sample for your persona's voice (max 15 seconds)."}
                </p>

                {/* Hidden Audio element for voice playback */}
                <audio
                  ref={voiceAudioRef}
                  src={activeAudioUrl || undefined}
                  preload="metadata"
                  onTimeUpdate={() => {
                    if (voiceAudioRef.current) {
                      setVoiceCurrentTime(voiceAudioRef.current.currentTime || 0);
                    }
                  }}
                  onLoadedMetadata={() => {
                    if (voiceAudioRef.current) {
                      setVoiceDuration(voiceAudioRef.current.duration || 0);
                      setAudioError(false);
                    }
                  }}
                  onEnded={() => {
                    setIsPlayingVoice(false);
                    setVoiceCurrentTime(0);
                  }}
                  onError={() => {
                    setIsPlayingVoice(false);
                    if (activeAudioUrl) setAudioError(true);
                  }}
                />

                {/* Voice Preview Player Card (Database reference or Newly selected sample) */}
                {activeAudioUrl && !isRecording && (
                  <div className={styles.voicePlayerCard}>
                    <div className={styles.voicePlayerTop}>
                      <div className={styles.voicePlayerLeft}>
                        <button
                          type="button"
                          className={`${styles.voicePlayBtn} ${isPlayingVoice ? styles.voicePlayBtnActive : ''}`}
                          onClick={togglePlayVoice}
                          title={isPlayingVoice ? "Pause voice preview" : "Hear voice reference"}
                          aria-label={isPlayingVoice ? "Pause voice preview" : "Hear voice reference"}
                        >
                          {isPlayingVoice ? <Pause size={18} /> : <Play size={18} className={styles.playIconOffset} />}
                        </button>

                        <div className={styles.voiceInfo}>
                          <div className={styles.voiceTitleRow}>
                            <Volume2 size={15} className={isPlayingVoice ? styles.voiceWaveIconActive : styles.voiceWaveIcon} />
                            <span className={styles.voicePlayerTitle}>
                              {voiceFile ? (voiceFileName || 'New Voice Sample') : (editingPersona?.name ? `${editingPersona.name}'s Voice` : 'Uploaded Voice Reference')}
                            </span>
                            <span className={voiceFile ? styles.voiceBadgeNew : styles.voiceBadgeSaved}>
                              {voiceFile ? 'New Audio' : 'Saved in Database'}
                            </span>
                          </div>

                          <div className={styles.voicePlayerMeta}>
                            <span className={styles.voiceTimer}>
                              {formatTime(voiceCurrentTime)} / {voiceDuration > 0 ? formatTime(voiceDuration) : '00:15'}
                            </span>
                            {isPlayingVoice && (
                              <div className={styles.miniWaveform}>
                                <span className={styles.miniBar}></span>
                                <span className={styles.miniBar}></span>
                                <span className={styles.miniBar}></span>
                                <span className={styles.miniBar}></span>
                                <span className={styles.miniBar}></span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {voiceFile && (
                        <button
                          type="button"
                          className={styles.removeFileBtn}
                          onClick={removeVoice}
                          title={existingVoiceUrl ? "Revert to saved voice" : "Remove new audio"}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    {/* Interactive Progress Track */}
                    <div
                      className={styles.voiceProgressTrack}
                      onClick={(e) => {
                        if (!voiceAudioRef.current || !voiceDuration) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const clickX = e.clientX - rect.left;
                        const pct = Math.max(0, Math.min(1, clickX / rect.width));
                        voiceAudioRef.current.currentTime = pct * voiceDuration;
                        setVoiceCurrentTime(pct * voiceDuration);
                      }}
                      title="Seek audio position"
                    >
                      <div
                        className={styles.voiceProgressBar}
                        style={{
                          width: `${voiceDuration > 0 ? Math.min(100, (voiceCurrentTime / voiceDuration) * 100) : 0}%`
                        }}
                      />
                    </div>
                  </div>
                )}

                {audioError && activeAudioUrl && (
                  <div className={styles.voiceErrorNotice}>
                    Could not play audio reference. The audio file might not be found on server or format is unsupported.
                  </div>
                )}

                <div className={styles.audioCardsGrid}>
                  {isRecording ? (
                    <div className={styles.recordingInterface}>
                      <div className={styles.recordingHeader}>
                        <span className={styles.recordingTimeActive}>{formatTime(recordingTime)}</span>
                        <span className={styles.recordingTimeMax}>00:15</span>
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
                  ) : (
                    <>
                      {/* Left Card: Live Sampling (Yellow) */}
                      <div className={styles.audioCardYellow} onClick={startRecording}>
                        <div className={styles.audioCardIconWrapper}>
                          <Mic size={22} className={styles.audioCardIcon} />
                        </div>
                        <div className={styles.audioCardBottom}>
                          <span className={styles.audioCardText}>
                            {activeAudioUrl ? 'Record new' : 'Capture audio'}
                          </span>
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
                          <span className={styles.audioCardText}>
                            {activeAudioUrl ? 'Upload new' : 'Upload audio'}
                          </span>
                          <ArrowRight size={18} className={styles.audioCardArrow} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Hidden Input for voice file */}
              <input
                ref={voiceInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.webm"
                hidden
                onChange={handleVoiceChange}
              />

              {/* Action CTA */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {editingPersona && onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      onDelete?.(editingPersona);
                    }}
                    style={{
                      padding: '13px 18px',
                      borderRadius: '12px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#ef4444',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
                  >
                    <Trash2 size={16} />
                    <span>Delete Persona</span>
                  </button>
                )}
                <button type="submit" className={styles.submitBtn} disabled={loading} style={{ flex: 1 }}>
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
