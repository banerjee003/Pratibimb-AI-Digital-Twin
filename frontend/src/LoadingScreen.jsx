import React, { useState, useEffect, useRef } from 'react';
import styles from './LoadingScreen.module.css';
import loadingVideo from './assets/Loading video/Loading_video.mp4';

export default function LoadingScreen({ onComplete }) {
  const [isFading, setIsFading] = useState(false);
  const videoRef = useRef(null);

  const handleVideoEnd = () => {
    setIsFading(true);
    setTimeout(() => {
      onComplete();
    }, 500); // Wait for fade out transition
  };

  return (
    <div className={`${styles.loadingScreen} ${isFading ? styles.fadeOut : ''}`}>
      <video 
        ref={videoRef}
        className={styles.video} 
        src={loadingVideo} 
        autoPlay 
        muted 
        playsInline 
        onEnded={handleVideoEnd}
      />
    </div>
  );
}
