import React from 'react';
import type { Category } from '../../data/agents';

interface FilterBarProps {
  categories: readonly string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  showPlanned: boolean;
  onShowPlannedChange: (show: boolean) => void;
}

export function FilterBar({
  categories,
  selectedCategory,
  onCategoryChange,
  showPlanned,
  onShowPlannedChange,
}: FilterBarProps) {
  return (
    <div className="filter-bar">
      <div className="category-filters">
        {categories.map((category) => (
          <button
            key={category}
            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => onCategoryChange(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <label className="status-toggle">
        <input
          type="checkbox"
          checked={showPlanned}
          onChange={(e) => onShowPlannedChange(e.target.checked)}
        />
        <span>Show planned agents</span>
      </label>
    </div>
  );
}
