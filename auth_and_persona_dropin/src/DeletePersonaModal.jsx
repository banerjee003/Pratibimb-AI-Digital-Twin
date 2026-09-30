import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { API } from './lib/config';
import styles from './DeletePersonaModal.module.css';

export default function DeletePersonaModal({ persona, isOpen, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !persona) return null;

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError('');
      await onConfirm(persona);
      onClose();
    } catch (err) {
      console.error('Failed to delete persona:', err);
      setError(err?.message || 'Failed to delete persona. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const photo = persona.photo_url
    ? (persona.photo_url.startsWith('http') ? persona.photo_url : `${API}${persona.photo_url.startsWith('/') ? '' : '/'}${persona.photo_url}`)
    : (persona.image || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400');

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close" disabled={loading}>
          <X size={18} />
        </button>

        {/* Warning Icon Badge */}
        <div className={styles.warningIconWrapper}>
          <div className={styles.warningPulse} />
          <div className={styles.warningIcon}>
            <Trash2 size={24} />
          </div>
        </div>

        {/* Header */}
        <h3 className={styles.title}>Delete Persona</h3>
        <p className={styles.subtitle}>
          This action is permanent and cannot be reversed.
        </p>

        {/* Persona Preview Card */}
        <div className={styles.personaCard}>
          <img src={photo} alt={persona.name} className={styles.personaAvatar} />
          <div className={styles.personaInfo}>
            <span className={styles.personaName}>{persona.name}</span>
            <span className={styles.personaMeta}>
              {persona.tone || 'Casual'} tone · {(persona.language || 'en').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Warning message */}
        <div className={styles.warningBox}>
          <AlertTriangle size={16} className={styles.warningBoxIcon} />
          <span>
            Permanently removes this persona, including custom voice models, photo reference, and all conversation history.
          </span>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        {/* Actions */}
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
            className={styles.deleteConfirmBtn}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className={styles.spinning} />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Delete Persona</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
