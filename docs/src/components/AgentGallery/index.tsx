import React, { useState, useMemo } from 'react';
import { agents, categories } from '../../data/agents';
import type { Agent } from '../../data/agents';
import { SearchInput } from './SearchInput';
import { FilterBar } from './FilterBar';
import { AgentCard } from './AgentCard';
import { AgentDetailModal } from './AgentDetailModal';

export function AgentGallery() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showPlanned, setShowPlanned] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      // Filter by status
      if (!showPlanned && agent.status === 'planned') {
        return false;
      }

      // Filter by category
      if (selectedCategory !== 'All' && agent.category !== selectedCategory) {
        return false;
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = agent.name.toLowerCase().includes(query);
        const matchesDescription = agent.description.toLowerCase().includes(query);
        const matchesUseCases = agent.useCases.some((useCase) =>
          useCase.toLowerCase().includes(query)
        );
        const matchesCategory = agent.category.toLowerCase().includes(query);

        if (!matchesName && !matchesDescription && !matchesUseCases && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, selectedCategory, showPlanned]);

  return (
    <div className="agent-gallery-container">
      <SearchInput value={searchQuery} onChange={setSearchQuery} />

      <FilterBar
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        showPlanned={showPlanned}
        onShowPlannedChange={setShowPlanned}
      />

      {filteredAgents.length === 0 ? (
        <div className="no-results">
          <p>No agents found matching your criteria.</p>
          <p className="no-results-hint">
            Try adjusting your filters or search query.
          </p>
        </div>
      ) : (
        <div className="agent-grid">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onShowDetails={setSelectedAgent}
            />
          ))}
        </div>
      )}

      <AgentDetailModal
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
}
