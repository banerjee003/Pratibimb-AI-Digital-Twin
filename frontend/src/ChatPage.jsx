import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, Mic, Video, LogOut, X, Play, Pause, Volume2, FileText, PenLine, Square } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
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
  const audioPlayerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinking]);

  // Screen scrolling: forward wheel events anywhere in mainArea to messagesContainer
  const handleMainWheel = (e) => {
    if (messagesContainerRef.current && !messagesContainerRef.current.contains(e.target)) {
      messagesContainerRef.current.scrollBy({
        top: e.deltaY,
        behavior: 'auto',
      });
    }
  };

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

  // Audio Playback Controller
  const playAudioUrl = useCallback((url) => {
    if (!url) return;
    if (audioPlayerRef.current) {
      if (playingAudio === url) {
        audioPlayerRef.current.pause();
        setPlayingAudio(null);
      } else {
        audioPlayerRef.current.src = url;
        audioPlayerRef.current.play()
          .then(() => setPlayingAudio(url))
          .catch(e => console.log('Audio autoplay prevented:', e));
      }
    }
  }, [playingAudio]);

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

      // 2. Immediately emit persona message so Text and Voice tabs display it instantly!
      const personaMsg = {
        id: personaMsgId,
        role: 'persona',
        text: reply,
        transcription: reply,
        audioUrl: audioUrl,
        dur: '0:18',
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
        onEnded={() => setPlayingAudio(null)}
        onPause={() => setPlayingAudio(null)}
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

      {/* ── Main with Wheel Event Forwarding ── */}
      <main className={styles.mainArea} onWheel={handleMainWheel}>
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
                      borderRadius: '50%',
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
          <div ref={messagesContainerRef} className={`${styles.messagesContainer} ${thinking ? styles.thinkingGlow : ''}`}>
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
                          <Waveform isPlaying={isPlayingThis} />
                          <span className={styles.duration}>{msg.dur || 'Voice'}</span>
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
                      <div className={styles.conicCardWrapper}>
                        <div className={styles.conicCardInner}>
                          <div className={styles.stageHeader}>
                            <div className={styles.stepPill}>
                              <span className={styles.stepPillDot} />
                              <span>Step {stageIdx + 1} of 7</span>
                            </div>
                            <span className={styles.stageTitle}>
                              {msg.videoTitle || phaseData.title}
                            </span>
                          </div>

                          <div className={styles.orbCanvasContainer}>
                            <ThinkingOrb
                              state={phaseData.orb || 'composing'}
                              size={64}
                              speed={1.25}
                            />
                          </div>

                          <p className={styles.stageDesc}>
                            {msg.videoDesc || phaseData.desc}
                          </p>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', margin: '4px 0' }}>
                            {msg.audioUrl && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', fontSize: '11.5px', color: '#a1a1aa' }}>
                                <button
                                  type="button"
                                  onClick={() => playAudioUrl(msg.audioUrl)}
                                  style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', padding: 0, font: 'inherit', fontWeight: 600 }}
                                >
                                  {isPlayingPreview ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
                                  {isPlayingPreview ? 'Pause Voice Preview' : 'Listen to Voice Preview'}
                                </button>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCancelVideo(msg.id, msg.videoJobId)}
                              title="Stop video generation and keep voice/text reply"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 12px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                borderRadius: '999px',
                                color: '#f87171',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.28)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                                e.currentTarget.style.color = '#f87171';
                              }}
                            >
                              <Square size={11} fill="currentColor" />
                              Stop Video
                            </button>
                          </div>

                          <div className={styles.stageDotsContainer}>
                            {VIDEO_PHASES.map((st, i) => {
                              const isDone = i < stageIdx;
                              const isActive = i === stageIdx;
                              return (
                                <div
                                  key={st.stage}
                                  className={`${styles.stageDot} ${isDone ? styles.stageDotDone : ''} ${isActive ? styles.stageDotActive : ''}`}
                                  title={`Step ${i + 1}: ${st.title}`}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
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
                            <span className={styles.liveLabel}>Avatar Audio · {msg.dur || 'Voice'}</span>
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
                  <div className={styles.conicCardWrapper}>
                    <div className={styles.conicCardInner}>
                      <div className={styles.stageHeader}>
                        <div className={styles.stepPill}>
                          <span className={styles.stepPillDot} />
                          <span>Step {(thinking.stageIdx || 0) + 1} of {thinking.total || 7}</span>
                        </div>
                        <span className={styles.stageTitle}>
                          {thinking.title || VIDEO_PHASES[thinking.stageIdx || 0]?.title || 'Processing'}
                        </span>
                      </div>

                      <div className={styles.orbCanvasContainer}>
                        <ThinkingOrb
                          state={thinking.orb || 'composing'}
                          size={64}
                          speed={1.25}
                        />
                      </div>

                      <p className={styles.stageDesc}>
                        {thinking.desc || VIDEO_PHASES[thinking.stageIdx || 0]?.desc || 'Synthesizing avatar...'}
                      </p>

                      <div className={styles.stageDotsContainer}>
                        {VIDEO_PHASES.map((st, i) => {
                          const currentIdx = thinking.stageIdx || 0;
                          const isDone = i < currentIdx;
                          const isActive = i === currentIdx;
                          return (
                            <div
                              key={st.stage}
                              className={`${styles.stageDot} ${isDone ? styles.stageDotDone : ''} ${isActive ? styles.stageDotActive : ''}`}
                              title={`Step ${i + 1}: ${st.title}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.orbCardCompact}>
                    <ThinkingOrb
                      state={thinking.orb || 'working'}
                      size={20}
                      speed={1.2}
                    />
                    <div className={styles.compactTextGroup}>
                      <span className={styles.compactTitle}>
                        {thinking.title || thinking.label || 'Generating response...'}
                      </span>
                      {thinking.desc && (
                        <span className={styles.compactDesc}>{thinking.desc}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className={styles.inputArea}>
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

function Waveform({ isPlaying }) {
  return (
    <div className={styles.waveform}>
      {Array.from({ length: 26 }).map((_, i) => (
        <div
          key={i}
          className={styles.waveBar}
          style={{
            height: `${8 + Math.abs(Math.sin(i * 0.65)) * 12 + (i % 3) * 3}px`,
            opacity: isPlaying ? 1 : 0.6,
            animation: isPlaying ? `wavePulse 0.8s ease-in-out infinite alternate ${i * 0.05}s` : 'none',
          }}
        />
      ))}
    </div>
  );
}
