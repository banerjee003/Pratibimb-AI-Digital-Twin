import React, { useRef, useState, useCallback, useEffect } from 'react';
import { BorderBeam } from 'border-beam';
import { VoiceBeam, useMicrophone } from 'voice-glow';
import { Search, Paperclip, Mic, MicOff, ArrowUp, X } from 'lucide-react';
import styles from './SearchBar.module.css';

export default function SearchBar({
  onSubmit,
  onFilesSelected,
  onUploadClick,
  hideUpload = false,
  placeholder = 'Describe the persona or attach references...',
}) {
  const [value, setValue]             = useState('');
  const [attachments, setAttachments] = useState([]);
  const fileInputRef      = useRef(null);
  const mediaRecorderRef  = useRef(null);
  const audioChunksRef    = useRef([]);
  const textareaRef       = useRef(null);

  /* ── voice-glow microphone hook ─────────────────── */
  const mic = useMicrophone();
  const isRecording = mic.state === 'live';

  /* When mic goes live → start MediaRecorder on the same stream */
  useEffect(() => {
    if (mic.state === 'live' && mic.stream) {
      const recorder = new MediaRecorder(mic.stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `Voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setAttachments(prev => [...prev, file]);
        onFilesSelected?.([file]);
        mic.stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    }

    if (mic.state === 'idle' && mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [mic.state, mic.stream]);

  const hasContent = value.trim().length > 0 || attachments.length > 0;

  /* Determines which border effect to show:
     - Recording  → VoiceBeam (reactive glow)
     - Idle empty → BorderBeam (ambient animation)
     - Has text   → no border effect              */
  const beamMode = isRecording ? 'voice' : hasContent ? 'none' : 'border';

  /* ── auto-resize textarea ───────────────────────── */
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '24px';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, []);

  /* ── file attach ────────────────────────────────── */
  const handleFileClick  = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachments(prev => [...prev, ...files]);
    onFilesSelected?.(files);
    e.target.value = '';
  };
  const removeAttachment = (i) =>
    setAttachments(prev => prev.filter((_, idx) => idx !== i));

  /* ── mic toggle (delegates to voice-glow hook) ──── */
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
    /* Stop recording if still going when user hits send */
    if (mic.state === 'live') mic.stop();
  };

  const fileIcon = (file) => {
    if (file.type.startsWith('image/'))
      return <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>;
    if (file.type.startsWith('audio/'))
      return <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>;
    return <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></>;
  };

  /* ── The form itself ─────────────────────────────── */
  const formEl = (
    <form className={styles.bar} onSubmit={handleSubmit} noValidate>

      {/* top row: search icon + textarea */}
      <div className={styles.top}>
        {isRecording
          ? <span className={styles.recordingDot} />
          : <Search size={18} className={styles.searchIcon} />
        }
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={value}
          rows={1}
          placeholder={isRecording ? 'Recording…' : placeholder}
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

      {/* bottom row: attach | spacer | mic | send */}
      <div className={styles.bottom}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,video/*"
          multiple
          hidden
          onChange={handleFileChange}
        />

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

  /* ── Render with correct beam wrapper ────────────── */
  return (
    <div className={styles.wrapper}>
      {beamMode === 'voice' && (
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
        >
          {formEl}
        </VoiceBeam>
      )}

      {beamMode === 'border' && (
        <BorderBeam
          size="md"
          colorVariant="colorful"
          strength={0.75}
          active={true}
          theme="dark"
        >
          {formEl}
        </BorderBeam>
      )}

      {beamMode === 'none' && formEl}
    </div>
  );
}
