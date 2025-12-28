import React, { useState } from 'react';
import type { Agent } from '../../data/agents';

interface AgentCardProps {
  agent: Agent;
  onShowDetails: (agent: Agent) => void;
}

export function AgentCard({ agent, onShowDetails }: AgentCardProps) {
  const statusColors = {
    available: 'var(--sl-color-green)',
    planned: 'var(--sl-color-orange)',
  };

  const statusLabels = {
    available: 'Available',
    planned: 'Planned',
  };

  return (
    <div className="agent-card" data-status={agent.status}>
      <div className="agent-card-header">
        <h3>{agent.name}</h3>
        <span
          className="agent-status-badge"
          style={{ backgroundColor: statusColors[agent.status] }}
        >
          {statusLabels[agent.status]}
        </span>
      </div>

      <p className="agent-description">{agent.description}</p>

      <div className="agent-meta">
        <div className="agent-category">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1H3v10.5a.5.5 0 0 1-1 0v-11zm12 11V3h-2.5a.5.5 0 0 1 0-1h3a.5.5 0 0 1 .5.5v11a.5.5 0 0 1-1 0z"/>
          </svg>
          <span>{agent.category}</span>
        </div>

        <div className="agent-triggers">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/>
          </svg>
          <span>{agent.triggers.length} trigger{agent.triggers.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="agent-outputs">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
          </svg>
          <span>{agent.outputs.length} output{agent.outputs.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="agent-actions">
        <button
          className="agent-details-btn"
          onClick={() => onShowDetails(agent)}
        >
          View Details
        </button>
        {agent.exampleUrl && (
          <a
            href={agent.exampleUrl}
            className="agent-example-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            See Example →
          </a>
        )}
      </div>
    </div>
  );
}
