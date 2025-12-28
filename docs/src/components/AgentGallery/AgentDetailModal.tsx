import React, { useEffect } from 'react';
import type { Agent } from '../../data/agents';

interface AgentDetailModalProps {
  agent: Agent | null;
  onClose: () => void;
}

export function AgentDetailModal({ agent, onClose }: AgentDetailModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (agent) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [agent, onClose]);

  if (!agent) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          ×
        </button>

        <div className="modal-header">
          <h2>{agent.name}</h2>
          <span className={`status-badge status-${agent.status}`}>
            {agent.status === 'available' ? 'Available' : 'Planned'}
          </span>
        </div>

        <p className="modal-description">{agent.description}</p>

        <div className="modal-section">
          <h3>Category</h3>
          <p>{agent.category}</p>
        </div>

        <div className="modal-section">
          <h3>Triggers</h3>
          <ul>
            {agent.triggers.map((trigger, i) => (
              <li key={i}>
                <code>{trigger}</code>
              </li>
            ))}
          </ul>
        </div>

        <div className="modal-section">
          <h3>Outputs</h3>
          <ul>
            {agent.outputs.map((output, i) => (
              <li key={i}>
                <code>{output}</code>
              </li>
            ))}
          </ul>
        </div>

        <div className="modal-section">
          <h3>Use Cases</h3>
          <ul>
            {agent.useCases.map((useCase, i) => (
              <li key={i}>{useCase}</li>
            ))}
          </ul>
        </div>

        {agent.code && (
          <div className="modal-section">
            <h3>Example Configuration</h3>
            <pre>
              <code>{agent.code}</code>
            </pre>
          </div>
        )}

        <div className="modal-actions">
          {agent.exampleUrl && (
            <a
              href={agent.exampleUrl}
              className="modal-btn modal-btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Complete Example →
            </a>
          )}
          <button className="modal-btn modal-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
