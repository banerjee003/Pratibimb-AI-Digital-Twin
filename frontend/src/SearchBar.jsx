import React, { useRef, useState, useCallback, useEffect } from 'react';
import { BorderBeam } from 'border-beam';
import { VoiceBeam, useMicrophone } from 'voice-glow';
import {
  Search,
  Paperclip,
  Mic,
  MicOff,
  ArrowUp,
  X,
  MessageSquare,
  Video,
  Globe,
  ChevronDown,
  Check,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { API } from './lib/config';
import styles from './SearchBar.module.css';

const getSpeechRecognitionLang = (lang) => {
  const map = {
    en: 'en-US',
    hi: 'hi-IN',
    bn: 'bn-IN',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    ja: 'ja-JP',
  };
  return map[lang] || 'en-US';
};

export default function SearchBar({
  onSubmit,
  onFilesSelected,
  onUploadClick,
  hideUpload = false,
  placeholder = 'Describe the persona or attach references...',
  responseMode = 'text',
  onResponseModeChange,
  showResponseModeSelector = false,
  language = 'en',
  onLanguageChange,
  showLanguageSelector = false,
}) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);
  const langDropdownRef = useRef(null);
  const recognitionRef = useRef(null);
  const valueBeforeRecordRef = useRef('');
  const didTranscribeViaWebSpeechRef = useRef(false);

  /* ── auto-resize textarea ───────────────────────── */
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '24px';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, []);

  /* ── Close dropdowns on click outside ────────────── */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
        setLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ── voice-glow microphone hook ─────────────────── */
  const mic = useMicrophone();
  const isRecording = mic.state === 'live';

  /* When mic goes live → Transcribe voice directly into text instead of attaching temp audio file */
  useEffect(() => {
    if (mic.state === 'live' && mic.stream) {
      valueBeforeRecordRef.current = value;
      didTranscribeViaWebSpeechRef.current = false;

      // 1. Primary: Browser Speech Recognition (Instant live speech-to-text)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = getSpeechRecognitionLang(language);

          let finalTranscript = '';
          recognition.onresult = (event) => {
            didTranscribeViaWebSpeechRef.current = true;
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const res = event.results[i];
              if (res.isFinal) {
                finalTranscript += res[0].transcript + ' ';
              } else {
                interim += res[0].transcript;
              }
            }
            const base = valueBeforeRecordRef.current ? valueBeforeRecordRef.current.trim() + ' ' : '';
            const combined = (base + finalTranscript + interim).trim();
            setValue(combined);
            autoResize();
          };

          recognition.onerror = (e) => {
            console.warn('SpeechRecognition notice:', e.error);
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (err) {
          console.warn('SpeechRecognition init error:', err);
        }
      }

      // 2. Background MediaRecorder for fallback in browsers without Web Speech
      try {
        const recorder = new MediaRecorder(mic.stream);
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          // If Web Speech already populated the text, skip backend transcription
          if (!didTranscribeViaWebSpeechRef.current && audioChunksRef.current.length > 0) {
            try {
              setIsTranscribing(true);
              const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
              const { data: sessionData } = await supabase.auth.getSession();
              const token = sessionData?.session?.access_token;
              if (token) {
                const form = new FormData();
                form.append('audio', blob, 'user-speech.webm');
                form.append('language', language || 'en');

                const res = await fetch(`${API}/api/transcribe`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                  body: form,
                });

                if (res.ok) {
                  const data = await res.json();
                  if (data.text) {
                    const base = valueBeforeRecordRef.current ? valueBeforeRecordRef.current.trim() + ' ' : '';
                    setValue((base + data.text).trim());
                    autoResize();
                  }
                }
              }
            } catch (err) {
              console.warn('Transcription fallback notice:', err);
            } finally {
              setIsTranscribing(false);
            }
          }
          mic.stream?.getTracks().forEach(t => t.stop());
          setTimeout(() => {
            textareaRef.current?.focus();
            autoResize();
          }, 60);
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
      } catch (err) {
        console.warn('MediaRecorder error:', err);
      }
    }

    if (mic.state === 'idle') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setTimeout(() => {
        textareaRef.current?.focus();
        autoResize();
      }, 60);
    }
  }, [mic.state, mic.stream, language, autoResize]);

  const hasContent = value.trim().length > 0 || attachments.length > 0;

  /* ── file attach ────────────────────────────────── */
  const handleFileClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachments(prev => [...prev, ...files]);
    onFilesSelected?.(files);
    e.target.value = '';
  };
  const removeAttachment = (i) =>
    setAttachments(prev => prev.filter((_, idx) => idx !== i));

  /* ── mic toggle ─────────────────────────────────── */
  const toggleRecording = async () => {
    if (mic.state === 'live') {
      mic.stop();
    } else {
      try {
        await mic.start();
      } catch (err) {
        console.error('Mic access denied:', err);
      }
    }
  };

  /* ── submit ─────────────────────────────────────── */
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hasContent) return;
    onSubmit?.({ text: value.trim(), files: attachments });
    setValue('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = '24px';
    if (mic.state === 'live') mic.stop();
  };

  const fileIcon = (file) => {
    if (file.type.startsWith('image/'))
      return <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></>;
    if (file.type.startsWith('audio/'))
      return <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>;
    return <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></>;
  };

  /* ── The form element ────────────────────────────── */
  const formEl = (
    <form className={styles.bar} onSubmit={handleSubmit} noValidate>
      {/* top row: search icon + textarea */}
      <div className={styles.top}>
        {isRecording ? (
          <span className={styles.recordingDot} />
        ) : (
          <Search size={18} className={styles.searchIcon} />
        )}
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={value}
          rows={1}
          placeholder={isRecording ? 'Listening… Speak now' : (isTranscribing ? 'Transcribing speech…' : placeholder)}
          onChange={(e) => { setValue(e.target.value); autoResize(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
          }}
        />
      </div>

      {/* attachment chips */}
      {attachments.length > 0 && (
        <div className={styles.chips}>
          {attachments.map((file, i) => (
            <span key={i} className={styles.chip}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {fileIcon(file)}
              </svg>
              <span className={styles.chipName}>
                {file.name.length > 22 ? file.name.slice(0, 22) + '…' : file.name}
              </span>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => removeAttachment(i)}
                aria-label={`Remove ${file.name}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* bottom row: format dropdown | lang dropdown | upload | spacer | mic | send */}
      <div className={styles.bottom}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,video/*"
          multiple
          hidden
          onChange={handleFileChange}
        />

        {/* Reply Format Selector Dropdown */}
        {showResponseModeSelector && (
          <div className={styles.dropdownContainer} ref={dropdownRef}>
            <button
              type="button"
              className={styles.modeDropdownBtn}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              title="Change reply format"
            >
              {responseMode === 'video' ? (
                <Video size={14} className={styles.modeIcon} />
              ) : responseMode === 'audio' ? (
                <Mic size={14} className={styles.modeIcon} />
              ) : (
                <MessageSquare size={14} className={styles.modeIcon} />
              )}
              <span className={styles.modeBtnText}>
                {responseMode === 'video' ? 'Audio + video' : responseMode === 'audio' ? 'Audio only' : 'Text only'}
              </span>
              <ChevronDown size={13} className={`${styles.chevron} ${dropdownOpen ? styles.chevronOpen : ''}`} />
            </button>

            {dropdownOpen && (
              <div className={styles.dropdownMenu} role="listbox">
                <div className={styles.dropdownHeader}>Reply Format</div>
                <button
                  type="button"
                  className={`${styles.dropdownItem} ${responseMode === 'text' ? styles.dropdownItemActive : ''}`}
                  onClick={() => { onResponseModeChange?.('text'); setDropdownOpen(false); }}
                >
                  <MessageSquare size={16} className={styles.itemIcon} />
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>Text only</div>
                    <div className={styles.itemDesc}>Instant text response</div>
                  </div>
                  {responseMode === 'text' && <Check size={14} className={styles.itemCheck} />}
                </button>

                <button
                  type="button"
                  className={`${styles.dropdownItem} ${responseMode === 'audio' ? styles.dropdownItemActive : ''}`}
                  onClick={() => { onResponseModeChange?.('audio'); setDropdownOpen(false); }}
                >
                  <Mic size={16} className={styles.itemIcon} />
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>Audio only</div>
                    <div className={styles.itemDesc}>Voice audio response (XTTS)</div>
                  </div>
                  {responseMode === 'audio' && <Check size={14} className={styles.itemCheck} />}
                </button>

                <button
                  type="button"
                  className={`${styles.dropdownItem} ${responseMode === 'video' ? styles.dropdownItemActive : ''}`}
                  onClick={() => { onResponseModeChange?.('video'); setDropdownOpen(false); }}
                >
                  <Video size={16} className={styles.itemIcon} />
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>Audio + video</div>
                    <div className={styles.itemDesc}>Talking head video (SadTalker)</div>
                  </div>
                  {responseMode === 'video' && <Check size={14} className={styles.itemCheck} />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Language Selector Dropdown */}
        {showLanguageSelector && (
          <div className={styles.dropdownContainer} ref={langDropdownRef}>
            <button
              type="button"
              className={styles.modeDropdownBtn}
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              aria-haspopup="listbox"
              aria-expanded={langDropdownOpen}
              title="Change conversation language"
            >
              <Globe size={14} className={styles.langIcon} />
              <span className={styles.modeBtnText}>
                {language === 'bn' ? 'Bengali' : language === 'hi' ? 'Hindi' : 'English'}
              </span>
              <ChevronDown size={13} className={`${styles.chevron} ${langDropdownOpen ? styles.chevronOpen : ''}`} />
            </button>

            {langDropdownOpen && (
              <div className={styles.dropdownMenu} role="listbox">
                <div className={styles.dropdownHeader}>Language</div>
                <button
                  type="button"
                  className={`${styles.dropdownItem} ${language === 'en' ? styles.dropdownItemActive : ''}`}
                  onClick={() => { onLanguageChange?.('en'); setLangDropdownOpen(false); }}
                >
                  <Globe size={16} className={styles.itemIcon} />
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>English</div>
                    <div className={styles.itemDesc}>English speech & text</div>
                  </div>
                  {language === 'en' && <Check size={14} className={styles.itemCheck} />}
                </button>

                <button
                  type="button"
                  className={`${styles.dropdownItem} ${language === 'hi' ? styles.dropdownItemActive : ''}`}
                  onClick={() => { onLanguageChange?.('hi'); setLangDropdownOpen(false); }}
                >
                  <Globe size={16} className={styles.itemIcon} />
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>Hindi</div>
                    <div className={styles.itemDesc}>हिन्दी बोलचाल और आवाज़</div>
                  </div>
                  {language === 'hi' && <Check size={14} className={styles.itemCheck} />}
                </button>

                <button
                  type="button"
                  className={`${styles.dropdownItem} ${language === 'bn' ? styles.dropdownItemActive : ''}`}
                  onClick={() => { onLanguageChange?.('bn'); setLangDropdownOpen(false); }}
                >
                  <Globe size={16} className={styles.itemIcon} />
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>Bengali</div>
                    <div className={styles.itemDesc}>বাংলা কথপোকথন ও কণ্ঠ</div>
                  </div>
                  {language === 'bn' && <Check size={14} className={styles.itemCheck} />}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Upload (hidden in chat page) */}
        {!hideUpload && (
          <button
            type="button"
            className={styles.pillBtn}
            onClick={onUploadClick || handleFileClick}
            aria-label="Upload files & configure persona"
          >
            <Paperclip size={13} />
            Upload
          </button>
        )}

        <div className={styles.spacer} />

        {/* Mic — glows red while recording */}
        <button
          type="button"
          className={`${styles.iconBtn} ${isRecording ? styles.recording : ''}`}
          onClick={toggleRecording}
          aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
          title={isRecording ? 'Stop recording' : 'Voice input'}
        >
          {isRecording ? <MicOff size={17} /> : <Mic size={17} />}
        </button>

        {/* Send */}
        <button
          type="submit"
          disabled={!hasContent}
          className={`${styles.sendBtn} ${hasContent ? styles.sendReady : ''}`}
          aria-label="Generate"
        >
          <ArrowUp size={16} />
        </button>
      </div>
    </form>
  );

  /* ── Permanent Stable Nesting to Prevent Textarea Focus Drops ── */
  return (
    <div className={styles.wrapper}>
      <VoiceBeam
        stream={mic.stream}
        type="default"
        colors={['#22c55e', '#0ea5e9', '#a855f7', '#ec4899']}
        theme="dark"
        strength={0.9}
        reach={1.4}
        spread={1.2}
        sensitivity={1.6}
        attack={0.1}
        release={0.6}
        bend={1.5}
        idle={0.4}
        scale={1.2}
        borderRadius={20}
        active={isRecording}
      >
        <BorderBeam
          size="md"
          borderRadius={20}
          colorVariant="colorful"
          strength={0.75}
          active={!hasContent && !isRecording}
          theme="dark"
        >
          {formEl}
        </BorderBeam>
      </VoiceBeam>
    </div>
  );
}

