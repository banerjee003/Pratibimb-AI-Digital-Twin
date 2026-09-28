import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, Mic, Video, LogOut, X, Play, Pause, Volume2, FileText, PenLine } from 'lucide-react';
import { ThinkingOrb } from 'thinking-orbs';
import { VoiceBeam } from 'voice-glow';
import SearchBar from './SearchBar';
import { supabase } from './lib/supabase';
import { API } from './lib/config';
import styles from './ChatPage.module.css';

const PIPELINES = {
  text: [
    { orb: 'searching', label: 'Reading your message',    ms: 1200 },
    { orb: 'solving',   label: 'Composing reply',         ms: 1400 },
  ],
  audio: [
    { orb: 'listening', label: 'Processing message',      ms: 1200 },
    { orb: 'working',   label: 'Generating response',     ms: 1500 },
    { orb: 'weaving',   label: 'Synthesizing voice (XTTS)', ms: 2000 },
  ],
  video: [
    { orb: 'searching', label: 'Processing request',      ms: 1200 },
    { orb: 'working',   label: 'Generating speech',       ms: 1800 },
    { orb: 'weaving',   label: 'Synthesizing voice',      ms: 2000 },
    { orb: 'composing', label: 'Lip-syncing face (SadTalker)', ms: 3000 },
    { orb: 'shaping',   label: 'Finalizing avatar video', ms: 2000 },
  ],
};

let _id = 200;
const uid = () => ++_id;
const ts = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

export default function ChatPage({ persona, onClose, onEditPersona }) {
  const [messages, setMessages] = useState({ text: [], audio: [], video: [] });
  const [activeTab, setActiveTab] = useState('text');
  const [thinking,  setThinking]  = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const audioPlayerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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
        setMessages({ text: initial, audio: initial, video: initial });
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

            // Keep history messages as text
            setMessages({
              text: formatted,
              audio: formatted,
              video: formatted,
            });
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

  // Audio Playback Controller
  const playAudioUrl = (url) => {
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
  };

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
        setThinking({ orb: 'listening', label: 'Transcribing voice...', stageIdx: 0, total: 3 });
        const form = new FormData();
        form.append('persona_id', persona.id);
        form.append('audio', voiceBlobFile, 'user-input.webm');
        form.append('language', persona.language || 'auto');

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

    // Add user message to active tab
    setMessages(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], userMsg],
    }));

    // Demo Mode handling
    if (!persona?.id || persona.id.startsWith('demo-') || !token) {
      const steps = PIPELINES[activeTab];
      setThinking({ orb: steps[0].orb, label: steps[0].label, stageIdx: 0, total: steps.length });
      setTimeout(() => {
        setThinking(null);
        const replyText = `I hear you clearly: "${messageText}". To enjoy persistent chat and custom voice cloning, sign in and create your custom persona!`;
        const personaMsg = {
          id: uid(),
          role: 'persona',
          type: activeTab === 'video' ? 'video' : activeTab === 'audio' ? 'audio' : 'text',
          text: replyText,
          transcription: replyText,
          time: ts(),
        };
        setMessages(prev => ({
          ...prev,
          [activeTab]: [...prev[activeTab], personaMsg],
        }));
      }, 1800);
      return;
    }

    // Real API Chat Workflow
    try {
      const steps = PIPELINES[activeTab];
      setThinking({ orb: steps[0].orb, label: steps[0].label, stageIdx: 0, total: steps.length });

      // 1. Call POST /api/chat
      const chatRes = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          persona_id: persona.id,
          message: messageText,
          language: persona.language || 'en',
        }),
      });

      if (!chatRes.ok) {
        throw new Error('Chat API returned an error.');
      }

      const chatData = await chatRes.json();
      const reply = chatData.reply || '...';
      const audioUrl = chatData.audio_url ? `${API}${chatData.audio_url}` : null;

      // 2. Tab Specific Presentation
      if (activeTab === 'text') {
        setThinking(null);
        const personaMsg = {
          id: uid(),
          role: 'persona',
          type: 'text',
          text: reply,
          time: ts(),
        };
        setMessages(prev => ({ ...prev, text: [...prev.text, personaMsg] }));
      } else if (activeTab === 'audio') {
        setThinking(null);
        const personaMsg = {
          id: uid(),
          role: 'persona',
          type: 'audio',
          audioUrl: audioUrl,
          dur: '0:18',
          transcription: reply,
          time: ts(),
        };
        setMessages(prev => ({ ...prev, audio: [...prev.audio, personaMsg] }));
        if (audioUrl) {
          playAudioUrl(audioUrl);
        }
      } else if (activeTab === 'video') {
        if (chatData.audio_url) {
          // Trigger SadTalker video job
          setThinking({ orb: 'composing', label: 'Lip-syncing face (SadTalker)...', stageIdx: 3, total: 5 });

          const jobForm = new FormData();
          jobForm.append('persona_id', persona.id);
          jobForm.append('audio_path', chatData.audio_url);

          const jobRes = await fetch(`${API}/api/avatar-job`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: jobForm,
          });

          if (jobRes.ok) {
            const jobData = await jobRes.json();
            const videoUrl = await pollAvatarJob(jobData.job_id, token);
            setThinking(null);
            const personaMsg = {
              id: uid(),
              role: 'persona',
              type: videoUrl ? 'video' : 'text',
              videoUrl: videoUrl,
              audioUrl: audioUrl,
              dur: '0:15',
              transcription: reply,
              text: reply,
              time: ts(),
            };
            setMessages(prev => ({ ...prev, video: [...prev.video, personaMsg] }));
          } else {
            setThinking(null);
            const personaMsg = {
              id: uid(),
              role: 'persona',
              type: 'text',
              text: reply,
              time: ts(),
            };
            setMessages(prev => ({ ...prev, video: [...prev.video, personaMsg] }));
          }
        } else {
          setThinking(null);
          const personaMsg = {
            id: uid(),
            role: 'persona',
            type: 'text',
            text: reply,
            time: ts(),
          };
          setMessages(prev => ({ ...prev, video: [...prev.video, personaMsg] }));
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
      setThinking(null);
      const errorMsg = {
        id: uid(),
        role: 'persona',
        type: 'text',
        text: 'Sorry, I encountered an issue replying. Please check your backend connection.',
        time: ts(),
      };
      setMessages(prev => ({
        ...prev,
        [activeTab]: [...prev[activeTab], errorMsg],
      }));
    }
  }, [activeTab, persona, playAudioUrl]);

  const handleTabClick = (tab) => {
    clearTimers();
    setThinking(null);
    setActiveTab(tab);
  };

  const currentMsgs = messages[activeTab] || [];

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
          <button className={`${styles.iconBtn} ${activeTab === 'text'  ? styles.active : ''}`} onClick={() => handleTabClick('text')}  title="Chat as messages"><MessageSquare size={20} /></button>
          <button className={`${styles.iconBtn} ${activeTab === 'audio' ? styles.active : ''}`} onClick={() => handleTabClick('audio')} title="Chat with voice"><Mic size={20} /></button>
          <button className={`${styles.iconBtn} ${activeTab === 'video' ? styles.active : ''}`} onClick={() => handleTabClick('video')} title="Chat with video"><Video size={20} /></button>
        </div>
        <div className={styles.sidebarBottom}>
          <button className={styles.iconBtn} onClick={onClose} title="Exit Chat">
            <LogOut size={20} color="#ff4444" />
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.mainArea}>
        <header className={styles.header}>
          <div className={styles.userInfo}>
            <div className={styles.avatarPlaceholder}>
              {persona?.image ? (
                <img src={persona.image} alt={persona.name} />
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
                {activeTab === 'text'  && '💬 Message mode'}
                {activeTab === 'audio' && '🎙 Voice mode · XTTS v2 acoustic cloning'}
                {activeTab === 'video' && '🎥 Video mode · SadTalker avatar lip-sync'}
              </span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close Chat"><X size={24} /></button>
        </header>

        <div className={styles.contentArea}>
          <div className={`${styles.messagesContainer} ${thinking ? styles.thinkingGlow : ''}`}>
            {currentMsgs.map((msg) => {
              const isUser = msg.role === 'user';

              /* ── Text bubble ── */
              if (msg.type === 'text') return (
                <div key={msg.id} className={`${styles.messageRow} ${isUser ? styles.rowRight : styles.rowLeft}`}>
                  {!isUser && <PersonaAvatar persona={persona} />}
                  <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.personaBubble}`}>
                    {msg.text}
                    <Timestamp time={msg.time} showTick={isUser} />
                  </div>
                </div>
              );

              /* ── Audio bubble ── */
              if (msg.type === 'audio') {
                const isPlayingThis = playingAudio && playingAudio === msg.audioUrl;
                return (
                  <div key={msg.id} className={`${styles.messageRow} ${isUser ? styles.rowRight : styles.rowLeft}`}>
                    {!isUser && <PersonaAvatar persona={persona} />}
                    <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.personaBubble} ${styles.audioBubble}`}>
                      {/* Waveform player */}
                      <div className={styles.audioPlayer}>
                        <button
                          type="button"
                          className={styles.playBtn}
                          onClick={() => msg.audioUrl && playAudioUrl(msg.audioUrl)}
                          title={isPlayingThis ? 'Pause' : 'Play audio'}
                        >
                          {isPlayingThis ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                        </button>
                        <Waveform isPlaying={isPlayingThis} />
                        <span className={styles.duration}>{msg.dur || 'Voice'}</span>
                      </div>
                      {/* User message transcription */}
                      {msg.text && <div className={styles.transcription}>"{msg.text}"</div>}
                      {/* Persona reply transcription */}
                      {msg.transcription && (
                        <div className={styles.replyTranscription}>
                          <FileText size={11} className={styles.transcriptIcon} />
                          {msg.transcription}
                        </div>
                      )}
                      <Timestamp time={msg.time} showTick={isUser} />
                    </div>
                  </div>
                );
              }

              /* ── Video bubble ── */
              if (msg.type === 'video') return (
                <div key={msg.id} className={`${styles.messageRow} ${isUser ? styles.rowRight : styles.rowLeft}`}>
                  {!isUser && <PersonaAvatar persona={persona} size="lg" />}
                  <div className={`${styles.videoBubbleCard} ${isUser ? styles.userBubble : styles.personaBubble}`}>
                    <div className={styles.videoFrame}>
                      {msg.videoUrl ? (
                        <video
                          key={msg.videoUrl}
                          src={msg.videoUrl}
                          controls
                          autoPlay
                          playsInline
                          preload="auto"
                          className={styles.videoThumb}
                          onCanPlay={(e) => {
                            const playPromise = e.currentTarget.play();
                            if (playPromise !== undefined) {
                              playPromise.catch(() => {});
                            }
                          }}
                        />
                      ) : (
                        <>
                          {persona?.image && <img src={persona.image} alt="persona" className={styles.videoThumb} />}
                          <div className={styles.videoTopBar}>
                            <div className={styles.liveDot} />
                            <span className={styles.liveLabel}>Avatar Audio · {msg.dur || 'Voice'}</span>
                          </div>
                          {msg.audioUrl && (
                            <div className={styles.videoOverlay}>
                              <button
                                type="button"
                                className={styles.videoPlayBtn}
                                onClick={() => playAudioUrl(msg.audioUrl)}
                                title="Play voice"
                              >
                                {playingAudio === msg.audioUrl ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {/* Transcription below the video */}
                    {msg.transcription && (
                      <div className={styles.videoTranscription}>
                        <FileText size={12} className={styles.transcriptIcon} />
                        <p>{msg.transcription}</p>
                      </div>
                    )}
                    <Timestamp time={msg.time} showTick={isUser} />
                  </div>
                </div>
              );

              return null;
            })}

            {/* ── Thinking Orb bubble ── */}
            {thinking && (
              <div className={`${styles.messageRow} ${styles.rowLeft} ${styles.orbRow}`}>
                <PersonaAvatar persona={persona} />
                <div className={`${styles.orbCard} ${activeTab === 'video' ? styles.orbCardVideo : ''}`}>
                  {activeTab === 'video' && (
                    <div className={styles.stageDots}>
                      {PIPELINES.video.map((_, i) => (
                        <div key={i} className={`${styles.stageDot}
                          ${i < (thinking.stageIdx || 0) ? styles.stageDotDone : ''}
                          ${i === (thinking.stageIdx || 0) ? styles.stageDotActive : ''}`}
                        />
                      ))}
                    </div>
                  )}
                  <ThinkingOrb state={thinking.orb || 'searching'} size={activeTab === 'video' ? 64 : 20} dark speed={1.2} />
                  <span className={`${styles.orbBubbleLabel} ${activeTab === 'video' ? styles.orbLabelVideo : ''}`}>
                    {thinking.label}
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className={styles.inputArea}>
          <SearchBar
            placeholder={
              activeTab === 'text'  ? 'Write a message…' :
              activeTab === 'audio' ? 'Type or record your voice question…' :
                                     'Ask a question to receive a lip-synced video…'
            }
            hideUpload={true}
            onSubmit={handleSend}
          />
        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ── */
function PersonaAvatar({ persona, size = 'sm' }) {
  return (
    <div className={size === 'lg' ? styles.personaAvatarLg : styles.personaAvatar}>
      {persona?.image ? <img src={persona.image} alt="" /> : '👤'}
    </div>
  );
}

function Timestamp({ time, showTick }) {
  return (
    <span className={styles.timestamp}>
      {time}
      {showTick && (
        <svg viewBox="0 0 16 11" width="14" height="11" className={styles.doubleCheck}>
          <path d="M11.8 1.6L5.4 8l-2.4-2.4-1.2 1.2 3.6 3.6 7.6-7.6zM15.8 1.6L9.4 8 8.2 6.8 7 8l2.4 2.4 7.6-7.6z" fill="currentColor"/>
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

