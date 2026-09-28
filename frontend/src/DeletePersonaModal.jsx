import React, { useState } from 'react';
import { Trash2, X, AlertTriangle, Database, MessageSquare, Mic, Video } from 'lucide-react';
import { supabase } from './lib/supabase';
import { API } from './lib/config';
import styles from './DeletePersonaModal.module.css';

export default function DeletePersonaModal({ persona, isOpen, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !persona) return null;

  const handleDelete = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const res = await fetch(`${API}/api/personas/${persona.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to delete persona.');
      }

      onDeleted?.(persona.id);
      onClose?.();
    } catch (err) {
      console.error('Error deleting persona:', err);
      setError(err.message || 'An unexpected error occurred while deleting.');
    } finally {
      setLoading(false);
    }
  };

  const photo = persona.photo_url
    ? (persona.photo_url.startsWith('http') ? persona.photo_url : `${API}${persona.photo_url}`)
    : persona.image;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose?.(); }}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
        <button
          className={styles.closeBtn}
          onClick={onClose}
          disabled={loading}
          title="Close modal"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>

        <div className={styles.iconHeader}>
          <div className={styles.dangerIconWrapper}>
            <Trash2 size={24} />
          </div>
          <div className={styles.titleGroup}>
            <h2 id="delete-modal-title" className={styles.title}>Delete Digital Twin?</h2>
            <span className={styles.subtitle}>Permanent and irreversible action</span>
          </div>
        </div>

        {/* Persona Info Preview */}
        <div className={styles.personaPreview}>
          {photo ? (
            <img src={photo} alt={persona.name} className={styles.previewAvatar} />
          ) : (
            <div className={styles.previewAvatar}>👤</div>
          )}
          <div className={styles.previewInfo}>
            <span className={styles.previewName}>{persona.name}</span>
            <span className={styles.previewTag}>
              {persona.tone || 'Casual'} tone · {persona.language?.toUpperCase() || 'EN'}
            </span>
          </div>
        </div>

        {/* Breakdown of what gets purged */}
        <div className={styles.warningList}>
          <div className={styles.warningTitle}>Everything below will be permanently eradicated:</div>
          <ul className={styles.itemList}>
            <li className={styles.item}>
              <span className={styles.itemDot}>•</span>
              <span><strong>Persona Profile & Settings</strong> removed from database</span>
            </li>
            <li className={styles.item}>
              <span className={styles.itemDot}>•</span>
              <span><strong>Entire Chat History & Messages</strong> purged from database</span>
            </li>
            <li className={styles.item}>
              <span className={styles.itemDot}>•</span>
              <span><strong>Voice Samples & Cloned Audio</strong> deleted from local device storage</span>
            </li>
            <li className={styles.item}>
              <span className={styles.itemDot}>•</span>
              <span><strong>Generated 3D Avatar Videos</strong> and temporary files wiped from disk</span>
            </li>
          </ul>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className={styles.spinner} />
                <span>Deleting Everything...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Delete Permanently</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
