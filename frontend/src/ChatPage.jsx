import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, Mic, Video, LogOut, X, Play, Pause, Volume2, FileText, PenLine, Square } from 'lucide-react';
import { ThinkingOrb, CompactThinkingPill, VideoThinkingCard } from './ThinkingOrbs';
import { VoiceBeam } from 'voice-glow';
import SearchBar from './SearchBar';
import { supabase } from './lib/supabase';
import { API } from './lib/config';
import styles from './ChatPage.module.css';

const VIDEO_PHASES = [
  { stage: 'init', title: 'Starting Pipeline', desc: 'Analyzing context and persona tone...', orb: 'searching' },
  { stage: 'text', title: 'Composing Response', desc: 'Formulating authentic persona reply...', orb: 'solving' },
  { stage: 'audio', title: 'Synthesizing Voice', desc: 'Generating natural speech with voice cloning...', orb: 'weaving' },
  { stage: 'crop', title: 'Aligning Face Geometry', desc: 'Detecting facial landmarks & orientation...', orb: 'working' },
  { stage: 'coeff', title: 'Predicting 3D Motion', desc: 'Mapping audio phonemes to facial animation...', orb: 'composing' },
  { stage: 'render', title: 'Neural Face Rendering', desc: 'Synthesizing photorealistic lip-synced video...', orb: 'composing' },
  { stage: 'merge', title: 'Finalizing Video', desc: 'Merging audio and video streams...', orb: 'shaping' },
];

const PIPELINES = {
  text: [
    { orb: 'searching', label: 'Reading your message', title: 'Reading message', desc: 'Understanding conversation context...' },
    { orb: 'solving', label: 'Composing reply', title: 'Composing reply', desc: 'Formulating authentic response...' },
  ],
  audio: [
    { orb: 'listening', label: 'Processing message', title: 'Processing message', desc: 'Understanding conversation context...' },
    { orb: 'working', label: 'Generating response', title: 'Generating response', desc: 'Formulating persona reply...' },
    { orb: 'weaving', label: 'Synthesizing voice (XTTS)', title: 'Synthesizing voice', desc: 'Generating cloned voice audio...' },
  ],
  video: [
    { orb: 'searching', label: 'Processing request', title: 'Processing request', desc: 'Analyzing conversation context...' },
    { orb: 'working', label: 'Generating speech', title: 'Generating speech', desc: 'Formulating persona reply...' },
    { orb: 'weaving', label: 'Synthesizing voice', title: 'Synthesizing voice', desc: 'Creating cloned voice track...' },
    { orb: 'composing', label: 'Lip-syncing face (SadTalker)', title: 'Lip-syncing face', desc: 'Synthesizing 3D facial expressions...' },
    { orb: 'shaping', label: 'Finalizing avatar video', title: 'Finalizing video', desc: 'Encoding final MP4 clip...' },
  ],
};

let _id = 200;
const uid = () => ++_id;
const ts = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function ChatPage({ persona, onClose, onEditPersona }) {
  const [messages, setMessages] = useState([]);
  const [responseMode, setResponseMode] = useState('text');
  const [language, setLanguage] = useState(persona?.language || 'en');
  const [thinking, setThinking] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioPlayerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // Lock body scroll while chat page is open to prevent underlying page scrollbars and jitter
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  // Monitor user scroll position: if scrolled up > 100px from bottom, do NOT force scroll down
  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
    isNearBottomRef.current = distanceFromBottom < 100;
  };

  // Safe scroll to bottom: avoids redundant animations or scroll jumps while user is reading history
  const scrollToBottom = (instant = false, force = false) => {
    const el = messagesContainerRef.current;
    if (!el) {
      if (force || isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: instant ? 'auto' : 'smooth' });
      }
      return;
    }

    // If user has scrolled up to read past messages, do not yank them down
    if (!force && !isNearBottomRef.current) {
      return;
    }

    const targetTop = el.scrollHeight;
    const currentDistance = targetTop - (el.scrollTop + el.clientHeight);

    // If already at the bottom (within 4px), avoid triggering an unnecessary animation
    if (currentDistance <= 4) {
      return;
    }

    el.scrollTo({
      top: targetTop,
      behavior: instant ? 'auto' : 'smooth',
    });
  };

  useEffect(() => {
    scrollToBottom(false, false);
  }, [messages, thinking]);

  // Load chat history from backend if real persona
  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!persona?.id || persona.id.startsWith('demo-')) {
        // Fallback demo greeting
        const greeting = `Hello! I am ${persona?.name || 'your digital twin'}. How can I help you today?`;
        const initial = [
          { id: 1, role: 'persona', type: 'text', text: greeting, time: ts() }
        ];
        setMessages(initial);
        return;
      }

      try {
        const { data } = await supabase.auth.getSession();
        if (!data?.session) return;

        const res = await fetch(`${API}/api/personas/${persona.id}/messages`, {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });

        if (res.ok && !cancelled) {
          const history = await res.json();
          if (Array.isArray(history)) {
            const formatted = history.map((m) => ({
              id: m.id || uid(),
              role: m.role === 'assistant' ? 'persona' : 'user',
              type: 'text',
              text: m.content,
              time: m.created_at
                ? new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                : ts(),
            }));

            // Set unified chronological messages
            setMessages(formatted);
          }
        }
      } catch (err) {
        console.error('Error fetching chat history:', err);
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
      clearTimers();
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
    };
  }, [persona?.id]);

  const cancelledJobsRef = useRef(new Set());
  const playedVideosRef = useRef(new Set());

  const handleAudioTimeUpdate = () => {
    if (!audioPlayerRef.current) return;
    const cur = audioPlayerRef.current.currentTime || 0;
    const dur = audioPlayerRef.current.duration || 0;
    setAudioCurrentTime(cur);
    if (dur > 0 && isFinite(dur)) {
      setAudioDuration(dur);
      setAudioProgress(cur / dur);
    }
  };

  const handleAudioEnded = () => {
    setPlayingAudio(null);
    setAudioProgress(0);
    setAudioCurrentTime(0);
  };

  // Audio Playback Controller
  const playAudioUrl = useCallback((url) => {
    if (!url) return;
    if (audioPlayerRef.current) {
      if (playingAudio === url) {
        audioPlayerRef.current.pause();
        setPlayingAudio(null);
        setAudioProgress(0);
        setAudioCurrentTime(0);
      } else {
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play()
          .then(() => {
            setPlayingAudio(url);
            setAudioProgress(0);
            setAudioCurrentTime(0);
          })
          .catch(e => console.log('Audio autoplay prevented:', e));
      }
    }
  }, [playingAudio]);

  const handleSeekAudio = useCallback((url, pct) => {
    if (audioPlayerRef.current) {
      if (playingAudio !== url) {
        audioPlayerRef.current.src = url;
        setPlayingAudio(url);
      }
      const dur = audioPlayerRef.current.duration || audioDuration || 0;
      if (dur > 0 && isFinite(dur)) {
        const seekTo = dur * pct;
        audioPlayerRef.current.currentTime = seekTo;
        setAudioProgress(pct);
        setAudioCurrentTime(seekTo);
      }
      audioPlayerRef.current.play().catch(() => {});
    }
  }, [playingAudio, audioDuration]);

  // Video Cancellation Handler (Non-destructive: keeps voice and text intact)
  const handleCancelVideo = useCallback(async (msgId, jobId) => {
    if (msgId) cancelledJobsRef.current.add(msgId);
    if (jobId) cancelledJobsRef.current.add(jobId);

    // Immediately stop rendering progress card on this message
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, isVideoGenerating: false } : m))
    );

    if (jobId) {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;
        if (token) {
          await fetch(`${API}/api/jobs/${jobId}/cancel`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (err) {
        console.warn('Error cancelling video job on backend:', err);
      }
    }
  }, []);

  // Video Polling (up to 10 minutes)
  const pollAvatarJob = async (jobId, token) => {
    for (let i = 0; i < 300; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const res = await fetch(`${API}/api/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const job = await res.json();
          if (job.status === 'completed' && job.result_path) {
            const rel = job.result_path.replace(/\\/g, '/').split('/media/').pop();
            return `${API}/media/${rel}`;
          }
          if (job.status === 'completed' && job.video_url) {
            return job.video_url.startsWith('http') ? job.video_url : `${API}${job.video_url}`;
          }
          if (job.status === 'failed') {
            console.error('Video avatar job failed:', job.error);
            return null;
          }
        }
      } catch (e) {
        console.warn('Poll error:', e);
      }
    }
    return null;
  };

  const handleSend = useCallback(async ({ text, files }) => {
    let messageText = text?.trim() || '';
    let voiceBlobFile = files?.find(f => f.type?.startsWith('audio/'));

    if (!messageText && !voiceBlobFile) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    // If user provided a voice recording / audio file, transcribe it first
    if (voiceBlobFile && token && persona?.id && !persona.id.startsWith('demo-')) {
      try {
        setThinking({ orb: 'listening', label: 'Transcribing voice...', title: 'Transcribing voice', desc: 'Speech-to-text...', stageIdx: 0, total: 3 });
        const form = new FormData();
        form.append('persona_id', persona.id);
        form.append('audio', voiceBlobFile, 'user-input.webm');
        form.append('language', language || persona.language || 'en');

        const trRes = await fetch(`${API}/api/transcribe`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });

        if (trRes.ok) {
          const trData = await trRes.json();
          if (trData.text) messageText = trData.text;
        }
      } catch (err) {
        console.error('Transcription error:', err);
      }
    }

    if (!messageText) messageText = 'Hello!';

    const currentTime = ts();
    const userMsg = {
      id: uid(),
      role: 'user',
      type: 'text',
      text: messageText,
      time: currentTime,
    };

    // Add user message to unified stream
    setMessages(prev => [...prev, userMsg]);

    // Demo Mode handling
    if (!persona?.id || persona.id.startsWith('demo-') || !token) {
      const steps = PIPELINES[responseMode] || PIPELINES.text;
      setThinking({ orb: steps[0].orb, label: steps[0].label, title: steps[0].title, desc: steps[0].desc, stageIdx: 0, total: steps.length });
      setTimeout(() => {
        setThinking(null);
        const replyText = `I hear you clearly: "${messageText}". To enjoy persistent chat and custom voice cloning, sign in and create your custom persona!`;
        const personaMsg = {
          id: uid(),
          role: 'persona',
          type: responseMode === 'video' ? 'video' : responseMode === 'audio' ? 'audio' : 'text',
          text: replyText,
          transcription: replyText,
          time: ts(),
        };
        setMessages(prev => [...prev, personaMsg]);
      }, 1800);
      return;
    }

    // Real API Chat Workflow
    try {
      const steps = PIPELINES[responseMode] || PIPELINES.text;
      setThinking({
        orb: steps[0].orb,
        label: steps[0].label,
        title: steps[0].title,
        desc: steps[0].desc,
        stageIdx: 0,
        total: steps.length,
      });

      // 1. Call POST /api/chat with target language
      const chatRes = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          persona_id: persona.id,
          message: messageText,
          language: language || persona.language || 'en',
        }),
      });

      if (!chatRes.ok) {
        throw new Error('Chat API returned an error.');
      }

      const chatData = await chatRes.json();
      const reply = chatData.reply || '...';
      const audioUrl = chatData.audio_url ? `${API}${chatData.audio_url}` : null;
      const personaMsgId = uid();
      const isVideoRequest = responseMode === 'video' && Boolean(chatData.audio_url);

      const initialDur = chatData.duration ? formatAudioDuration(chatData.duration) : null;
      const personaMsg = {
        id: personaMsgId,
        role: 'persona',
        text: reply,
        transcription: reply,
        audioUrl: audioUrl,
        dur: initialDur,
        isVideoGenerating: isVideoRequest,
        videoJobId: null,
        videoStageIdx: 3,
        videoTitle: VIDEO_PHASES[3]?.title || 'Lip-syncing face (SadTalker)',
        videoDesc: VIDEO_PHASES[3]?.desc || 'Synthesizing 3D facial expressions...',
        videoUrl: null,
        time: ts(),
      };

      setMessages((prev) => [...prev, personaMsg]);
      setThinking(null);

      // 3. Autoplay speech if user is in Audio / Voice mode
      if (responseMode === 'audio' && audioUrl) {
        playAudioUrl(audioUrl);
      }

      // 4. If Video requested, run SadTalker video generation continuously in background
      if (isVideoRequest) {
        (async () => {
          try {
            const jobForm = new FormData();
            jobForm.append('persona_id', persona.id);
            jobForm.append('audio_path', chatData.audio_url);

            const jobRes = await fetch(`${API}/api/avatar-job`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: jobForm,
            });

            if (!jobRes.ok) {
              setMessages((prev) =>
                prev.map((m) => (m.id === personaMsgId ? { ...m, isVideoGenerating: false } : m))
              );
              return;
            }

            const jobData = await jobRes.json();
            const jobId = jobData.job_id;

            // Associate the job ID with the message
            setMessages((prev) =>
              prev.map((m) => (m.id === personaMsgId ? { ...m, videoJobId: jobId } : m))
            );

            // If user clicked stop before job ID returned
            if (cancelledJobsRef.current.has(personaMsgId)) {
              cancelledJobsRef.current.add(jobId);
              fetch(`${API}/api/jobs/${jobId}/cancel`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              }).catch(() => { });
              return;
            }

            // Poll background job while smoothly updating multi-stage progress dots
            for (let i = 0; i < 300; i++) {
              await new Promise((r) => setTimeout(r, 2000));

              // Check if user requested cancellation during delay
              if (cancelledJobsRef.current.has(personaMsgId) || cancelledJobsRef.current.has(jobId)) {
                return;
              }

              try {
                const res = await fetch(`${API}/api/jobs/${jobId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                  const job = await res.json();

                  if (job.status === 'cancelled' || cancelledJobsRef.current.has(jobId)) {
                    setMessages((prev) =>
                      prev.map((m) => (m.id === personaMsgId ? { ...m, isVideoGenerating: false } : m))
                    );
                    return;
                  }

                  const stageIndex = Math.min(3 + Math.floor(i / 6), 6);

                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id === personaMsgId && m.isVideoGenerating) {
                        return {
                          ...m,
                          videoStageIdx: stageIndex,
                          videoTitle: VIDEO_PHASES[stageIndex]?.title,
                          videoDesc: VIDEO_PHASES[stageIndex]?.desc,
                        };
                      }
                      return m;
                    })
                  );

                  if (job.status === 'completed') {
                    let finalVideoUrl = null;
                    if (job.result_path) {
                      const rel = job.result_path.replace(/\\/g, '/').split('/media/').pop();
                      finalVideoUrl = `${API}/media/${rel}`;
                    } else if (job.video_url) {
                      finalVideoUrl = job.video_url.startsWith('http')
                        ? job.video_url
                        : `${API}${job.video_url}`;
                    }
                    if (finalVideoUrl) {
                      setMessages((prev) =>
                        prev.map((m) =>
                          m.id === personaMsgId
                            ? {
                              ...m,
                              videoUrl: finalVideoUrl,
                              isVideoGenerating: false,
                              shouldAutoPlay: true,
                            }
                            : m
                        )
                      );
                      return;
                    }
                  }

                  if (job.status === 'failed') {
                    console.error('Video avatar job failed:', job.error);
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === personaMsgId
                          ? {
                            ...m,
                            isVideoGenerating: false,
                          }
                          : m
                      )
                    );
                    return;
                  }
                }
              } catch (pollErr) {
                console.warn('Poll error:', pollErr);
              }
            }
          } catch (err) {
            console.error('Background avatar generation error:', err);
            setMessages((prev) =>
              prev.map((m) => (m.id === personaMsgId ? { ...m, isVideoGenerating: false } : m))
            );
          }
        })();
      }
    } catch (err) {
      console.error('Chat error:', err);
      setThinking(null);
      const errorMsg = {
        id: uid(),
        role: 'persona',
        type: 'text',
        text: 'Sorry, I had a momentary connection hiccup. Please send your message again!',
        time: ts(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [responseMode, language, persona, playAudioUrl]);

  const handleTabClick = (mode) => {
    setResponseMode(mode);
  };

  const personaAvatarImg = persona?.photo_url ? (persona.photo_url.startsWith('http') ? persona.photo_url : `${API}${persona.photo_url}`) : persona?.image;

  return (
    <div className={styles.chatPage}>
      {/* Hidden audio element for speech playback */}
      <audio
        ref={audioPlayerRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
        onPause={() => {
          if (audioPlayerRef.current?.paused && !audioPlayerRef.current?.ended) {
            setPlayingAudio(null);
          }
        }}
      />

      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.sidebarBrand}><div className={styles.brandDot}></div></div>
          <button className={`${styles.iconBtn} ${responseMode === 'text' ? styles.active : ''}`} onClick={() => handleTabClick('text')} title="Reply as text"><MessageSquare size={20} /></button>
          <button className={`${styles.iconBtn} ${responseMode === 'audio' ? styles.active : ''}`} onClick={() => handleTabClick('audio')} title="Reply with voice"><Mic size={20} /></button>
          <button className={`${styles.iconBtn} ${responseMode === 'video' ? styles.active : ''}`} onClick={() => handleTabClick('video')} title="Reply with video avatar"><Video size={20} /></button>
        </div>
        <div className={styles.sidebarBottom}>
          <button className={styles.iconBtn} onClick={onClose} title="Exit Chat">
            <LogOut size={20} color="#ff4444" />
          </button>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <main className={styles.mainArea}>
        <header className={styles.header}>
          <div className={styles.userInfo}>
            <div className={styles.avatarPlaceholder}>
              {personaAvatarImg ? (
                <img src={personaAvatarImg} alt={persona?.name || 'Persona'} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>
              )}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 className={styles.name}>{persona?.name || 'Persona'}</h2>
                {onEditPersona && persona?.id && !persona.id.startsWith('demo-') && (
                  <button
                    type="button"
                    onClick={() => onEditPersona(persona)}
                    title="Edit Persona Details"
                    aria-label="Edit Persona Details"
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#a1a1aa',
                      padding: 0,
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                  >
                    <PenLine size={13} />
                  </button>
                )}
              </div>
              <span className={styles.modeTag}>
                {responseMode === 'text' && '💬 Text reply mode'}
                {responseMode === 'audio' && '🎙 Voice clone mode · XTTS v2'}
                {responseMode === 'video' && '🎥 Video avatar mode · SadTalker 3D lip-sync'}
                {language === 'bn' && ' · 🇧🇩 Bengali'}
                {language === 'hi' && ' · 🇮🇳 Hindi'}
                {language === 'en' && ' · 🌐 English'}
              </span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close Chat"><X size={24} /></button>
        </header>

        <div className={styles.contentArea}>
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className={`${styles.messagesContainer} ${thinking ? styles.thinkingGlow : ''}`}
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';

              /* 1. User message bubble */
              if (isUser) {
                return (
                  <div key={msg.id} className={`${styles.messageRow} ${styles.rowRight}`}>
                    <div className={`${styles.bubble} ${styles.userBubble}`}>
                      {msg.text}
                      <Timestamp time={msg.time} showTick={true} />
                    </div>
                  </div>
                );
              }

              /* 2. Persona message rendering based on active responseMode tab */

              /* ── TAB: TEXT MODE ── */
              if (responseMode === 'text') {
                return (
                  <div key={msg.id} className={`${styles.messageRow} ${styles.rowLeft}`}>
                    <PersonaAvatar avatarImg={personaAvatarImg} />
                    <div className={`${styles.bubble} ${styles.personaBubble}`}>
                      {msg.text || msg.transcription}
                      <Timestamp time={msg.time} />
                    </div>
                  </div>
                );
              }

              /* ── TAB: AUDIO MODE ── */
              if (responseMode === 'audio') {
                if (msg.audioUrl) {
                  const isPlayingThis = playingAudio && playingAudio === msg.audioUrl;
                  return (
                    <div key={msg.id} className={`${styles.messageRow} ${styles.rowLeft}`}>
                      <PersonaAvatar avatarImg={personaAvatarImg} />
                      <div className={`${styles.bubble} ${styles.personaBubble} ${styles.audioBubble}`}>
                        <div className={styles.audioPlayer}>
                          <button
                            type="button"
                            className={styles.playBtn}
                            onClick={() => playAudioUrl(msg.audioUrl)}
                            title={isPlayingThis ? 'Pause' : 'Play audio'}
                          >
                            {isPlayingThis ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                          </button>
                          <Waveform
                            isPlaying={isPlayingThis}
                            progress={isPlayingThis ? audioProgress : 0}
                            onSeek={(pct) => handleSeekAudio(msg.audioUrl, pct)}
                          />
                          <span className={styles.duration}>
                            <AudioDurationBadge
                              audioUrl={msg.audioUrl}
                              fallbackDur={msg.dur}
                              isPlaying={isPlayingThis}
                              currentTime={audioCurrentTime}
                            />
                          </span>
                        </div>
                        {(msg.text || msg.transcription) && (
                          <div className={styles.replyTranscription}>
                            <FileText size={11} className={styles.transcriptIcon} />
                            <span>{msg.text || msg.transcription}</span>
                          </div>
                        )}
                        <Timestamp time={msg.time} />
                      </div>
                    </div>
                  );
                }

                // Fallback to text bubble if no audio exists for this message
                return (
                  <div key={msg.id} className={`${styles.messageRow} ${styles.rowLeft}`}>
                    <PersonaAvatar avatarImg={personaAvatarImg} />
                    <div className={`${styles.bubble} ${styles.personaBubble}`}>
                      {msg.text || msg.transcription}
                      <Timestamp time={msg.time} />
                    </div>
                  </div>
                );
              }

              /* ── TAB: VIDEO MODE ── */
              if (responseMode === 'video') {
                // If video is currently generating in the background
                if (msg.isVideoGenerating) {
                  const stageIdx = msg.videoStageIdx ?? 0;
                  const phaseData = VIDEO_PHASES[stageIdx] || VIDEO_PHASES[0];
                  const isPlayingPreview = playingAudio && playingAudio === msg.audioUrl;

                  return (
                    <div key={msg.id} className={`${styles.messageRow} ${styles.rowLeft} ${styles.orbRow}`}>
                      <PersonaAvatar avatarImg={personaAvatarImg} size="lg" />
                      <VideoThinkingCard
                        stageIdx={stageIdx}
                        title={msg.videoTitle || phaseData.title}
                        desc={msg.videoDesc || phaseData.desc}
                        audioUrl={msg.audioUrl}
                        isPlayingAudio={isPlayingPreview}
                        onPlayAudio={(url) => playAudioUrl(url)}
                        onCancel={() => handleCancelVideo(msg.id, msg.videoJobId)}
                      />
                    </div>
                  );
                }

                // If video generation finished with video URL
                if (msg.videoUrl) {
                  const canAutoPlayThis = Boolean(msg.shouldAutoPlay && !playedVideosRef.current.has(msg.id));

                  return (
                    <div key={msg.id} className={`${styles.messageRow} ${styles.rowLeft}`}>
                      <PersonaAvatar avatarImg={personaAvatarImg} size="lg" />
                      <div className={`${styles.videoBubbleCard} ${styles.personaBubble}`}>
                        <div className={styles.videoFrame}>
                          <video
                            key={msg.videoUrl}
                            src={msg.videoUrl}
                            controls
                            autoPlay={canAutoPlayThis}
                            playsInline
                            preload="metadata"
                            className={styles.videoThumb}
                            onPlay={() => {
                              playedVideosRef.current.add(msg.id);
                            }}
                            onCanPlay={(e) => {
                              if (canAutoPlayThis) {
                                playedVideosRef.current.add(msg.id);
                                const playPromise = e.currentTarget.play();
                                if (playPromise !== undefined) {
                                  playPromise.catch(() => { });
                                }
                              }
                            }}
                          />
                        </div>
                        {(msg.text || msg.transcription) && (
                          <div className={styles.videoTranscription}>
                            <FileText size={12} className={styles.transcriptIcon} />
                            <p>{msg.text || msg.transcription}</p>
                          </div>
                        )}
                        <Timestamp time={msg.time} />
                      </div>
                    </div>
                  );
                }

                // If audio is available (e.g. sent in audio mode or video fallback)
                if (msg.audioUrl) {
                  const isPlayingThis = playingAudio && playingAudio === msg.audioUrl;
                  return (
                    <div key={msg.id} className={`${styles.messageRow} ${styles.rowLeft}`}>
                      <PersonaAvatar avatarImg={personaAvatarImg} size="lg" />
                      <div className={`${styles.videoBubbleCard} ${styles.personaBubble}`}>
                        <div className={styles.videoFrame}>
                          {personaAvatarImg ? (
                            <img src={personaAvatarImg} alt="persona" className={styles.videoThumb} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1c1c1f', fontSize: '3rem' }}>👤</div>
                          )}
                          <div className={styles.videoTopBar}>
                            <div className={styles.liveDot} />
                            <span className={styles.liveLabel}>
                              <AudioDurationBadge audioUrl={msg.audioUrl} fallbackDur={msg.dur} prefix="Avatar Audio · " />
                            </span>
                          </div>
                          <div className={styles.videoOverlay}>
                            <button
                              type="button"
                              className={styles.videoPlayBtn}
                              onClick={() => playAudioUrl(msg.audioUrl)}
                              title="Play voice"
                            >
                              {isPlayingThis ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
                            </button>
                          </div>
                        </div>
                        {(msg.text || msg.transcription) && (
                          <div className={styles.videoTranscription}>
                            <FileText size={12} className={styles.transcriptIcon} />
                            <p>{msg.text || msg.transcription}</p>
                          </div>
                        )}
                        <Timestamp time={msg.time} />
                      </div>
                    </div>
                  );
                }

                // Fallback to text bubble
                return (
                  <div key={msg.id} className={`${styles.messageRow} ${styles.rowLeft}`}>
                    <PersonaAvatar avatarImg={personaAvatarImg} />
                    <div className={`${styles.bubble} ${styles.personaBubble}`}>
                      {msg.text || msg.transcription}
                      <Timestamp time={msg.time} />
                    </div>
                  </div>
                );
              }

              return null;
            })}

            {/* ── Initial Thinking Orb (Before initial text reply is received) ── */}
            {thinking && !messages.some(m => m.isVideoGenerating) && (
              <div className={`${styles.messageRow} ${styles.rowLeft} ${styles.orbRow}`}>
                <PersonaAvatar avatarImg={personaAvatarImg} size={responseMode === 'video' ? 'lg' : 'sm'} />

                {responseMode === 'video' ? (
                  <VideoThinkingCard
                    stageIdx={thinking.stageIdx || 0}
                    title={thinking.title || VIDEO_PHASES[thinking.stageIdx || 0]?.title}
                    desc={thinking.desc || VIDEO_PHASES[thinking.stageIdx || 0]?.desc}
                    orb={thinking.orb}
                  />
                ) : (
                  <CompactThinkingPill
                    orb={thinking.orb || (responseMode === 'audio' ? 'listening' : 'searching')}
                    label={thinking.title || thinking.label || 'Generating response...'}
                    desc={thinking.desc}
                  />
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className={styles.inputArea}>
          <div className={styles.searchScaler}>
            <SearchBar
              placeholder={
                responseMode === 'text' ? 'Write a message…' :
                  responseMode === 'audio' ? 'Type or record your voice question…' :
                    'Ask a question to receive a lip-synced video…'
              }
              hideUpload={true}
              responseMode={responseMode}
              onResponseModeChange={setResponseMode}
              showResponseModeSelector={true}
              language={language}
              onLanguageChange={setLanguage}
              showLanguageSelector={true}
              onSubmit={handleSend}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ── */
function PersonaAvatar({ avatarImg, size = 'sm' }) {
  return (
    <div className={size === 'lg' ? styles.personaAvatarLg : styles.personaAvatar}>
      {avatarImg ? <img src={avatarImg} alt="" /> : '👤'}
    </div>
  );
}

function Timestamp({ time, showTick }) {
  return (
    <span className={styles.timestamp}>
      {time}
      {showTick && (
        <svg viewBox="0 0 16 11" width="14" height="11" className={styles.doubleCheck}>
          <path d="M11.8 1.6L5.4 8l-2.4-2.4-1.2 1.2 3.6 3.6 7.6-7.6zM15.8 1.6L9.4 8 8.2 6.8 7 8l2.4 2.4 7.6-7.6z" fill="currentColor" />
        </svg>
      )}
    </span>
  );
}

function Waveform({ isPlaying, progress = 0, onSeek }) {
  // 36 static bar heights providing a natural speech frequency curve
  const barHeights = [
    28, 45, 70, 35, 60, 85, 40, 65, 90, 50,
    75, 95, 60, 80, 55, 70, 45, 80, 65, 50,
    75, 90, 60, 40, 70, 85, 55, 35, 65, 50,
    40, 60, 45, 30, 50, 35
  ];

  const handleClick = (e) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(pct);
  };

  return (
    <div
      className={styles.waveform}
      onClick={handleClick}
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      title="Click to seek"
    >
      {barHeights.map((h, i) => {
        const barPct = (i + 1) / barHeights.length;
        const isActive = progress >= barPct;
        return (
          <div
            key={i}
            className={`${styles.waveBar} ${isActive ? styles.waveBarActive : ''} ${isPlaying ? styles.waveBarPlaying : ''}`}
            style={{
              height: `${h}%`,
              animationDelay: isPlaying ? `${(i * 0.045) % 0.6}s` : '0s',
            }}
          />
        );
      })}
    </div>
  );
}

function formatAudioDuration(sec) {
  if (!sec || isNaN(sec) || !isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.round(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function AudioDurationBadge({ audioUrl, fallbackDur, prefix = '', isPlaying = false, currentTime = 0 }) {
  const [dur, setDur] = useState(() => {
    if (fallbackDur && fallbackDur !== '0:18' && fallbackDur !== '0:00') {
      return fallbackDur;
    }
    return null;
  });

  useEffect(() => {
    if (fallbackDur && fallbackDur !== '0:18' && fallbackDur !== '0:00') {
      setDur(fallbackDur);
    }
  }, [fallbackDur]);

  useEffect(() => {
    if (!audioUrl) return;
    const a = new Audio();
    a.preload = 'metadata';

    const handleLoaded = () => {
      if (a.duration && isFinite(a.duration) && a.duration > 0) {
        setDur(formatAudioDuration(a.duration));
      }
    };

    a.addEventListener('loadedmetadata', handleLoaded);
    a.addEventListener('durationchange', handleLoaded);
    a.src = audioUrl;
    a.load();

    return () => {
      a.removeEventListener('loadedmetadata', handleLoaded);
      a.removeEventListener('durationchange', handleLoaded);
    };
  }, [audioUrl]);

  let display = dur || (fallbackDur && fallbackDur !== '0:18' ? fallbackDur : 'Voice');
  if (isPlaying && dur) {
    display = `${formatAudioDuration(currentTime)} / ${dur}`;
  }

  return <span>{prefix ? `${prefix}${display}` : display}</span>;
}
