import { describe, expect, test } from "bun:test";
import type {
  ApiDocumentationConfig,
  ChangelogConfig,
  DocumentationConfig,
  DriftDetectionConfig,
} from "@repo-agents/types";
import {
  type ChangelogEntry,
  formatKeepAChangelog,
  generateApiDocExtractionScript,
  generateChangelogScript,
  generateDocumentationContext,
  generateDriftDetectionScript,
  generateReadmeSectionContent,
} from "./documentation";

describe("generateApiDocExtractionScript", () => {
  test("should generate script for API doc extraction", () => {
    const config: ApiDocumentationConfig = {
      sources: ["src/**/*.ts"],
      output: "docs/api/",
      format: "markdown",
    };

    const script = generateApiDocExtractionScript(config);

    expect(script).toContain("src/**/*.ts");
    expect(script).toContain("docs/api/");
    expect(script).toContain("mkdir -p");
    expect(script).toContain("API_DOC_ENTRIES");
  });

  test("should handle multiple source patterns", () => {
    const config: ApiDocumentationConfig = {
      sources: ["src/**/*.ts", "lib/**/*.ts"],
      output: "docs/api/",
    };

    const script = generateApiDocExtractionScript(config);

    expect(script).toContain("src/**/*.ts lib/**/*.ts");
  });

  test("should respect include_private option", () => {
    const configWithPrivate: ApiDocumentationConfig = {
      sources: ["src/**/*.ts"],
      output: "docs/",
      include_private: true,
    };

    const configWithoutPrivate: ApiDocumentationConfig = {
      sources: ["src/**/*.ts"],
      output: "docs/",
      include_private: false,
    };

    const scriptWith = generateApiDocExtractionScript(configWithPrivate);
    const scriptWithout = generateApiDocExtractionScript(configWithoutPrivate);

    expect(scriptWith).toContain('"true"');
    expect(scriptWithout).toContain('"false"');
  });
});

describe("generateDriftDetectionScript", () => {
  test("should generate script when enabled", () => {
    const config: DriftDetectionConfig = {
      enabled: true,
      pairs: [
        {
          code: "src/api/**/*.ts",
          docs: "docs/api/**/*.md",
          threshold: 7,
        },
      ],
    };

    const script = generateDriftDetectionScript(config);

    expect(script).toContain("DRIFT_DETECTED=false");
    expect(script).toContain("src/api/**/*.ts");
    expect(script).toContain("docs/api/**/*.md");
    expect(script).toContain("DRIFT_DETECTED=true");
  });

  test("should return disabled message when not enabled", () => {
    const config: DriftDetectionConfig = {
      enabled: false,
      pairs: [],
    };

    const script = generateDriftDetectionScript(config);

    expect(script).toBe("echo 'Drift detection disabled'");
  });

  test("should handle multiple pairs", () => {
    const config: DriftDetectionConfig = {
      enabled: true,
      pairs: [
        { code: "src/api/**", docs: "docs/api/**" },
        { code: "src/cli/**", docs: "docs/cli/**", threshold: 14 },
      ],
    };

    const script = generateDriftDetectionScript(config);

    expect(script).toContain("pair 1");
    expect(script).toContain("pair 2");
    expect(script).toContain("src/api/**");
    expect(script).toContain("src/cli/**");
  });

  test("should use default threshold of 7 days", () => {
    const config: DriftDetectionConfig = {
      enabled: true,
      pairs: [{ code: "src/**", docs: "docs/**" }],
    };

    const script = generateDriftDetectionScript(config);

    expect(script).toContain("threshold: 7 days");
  });
});

describe("generateChangelogScript", () => {
  test("should generate script for changelog from PRs", () => {
    const config: ChangelogConfig = {
      path: "CHANGELOG.md",
      format: "keep-a-changelog",
      include_prs: true,
    };

    const script = generateChangelogScript(config);

    expect(script).toContain("gh pr list");
    expect(script).toContain("--state merged");
    expect(script).toContain("CHANGELOG_ENTRIES");
  });

  test("should include commits when configured", () => {
    const config: ChangelogConfig = {
      include_commits: true,
    };

    const script = generateChangelogScript(config);

    expect(script).toContain("git log");
  });

  test("should exclude labels when configured", () => {
    const config: ChangelogConfig = {
      exclude_labels: ["skip-changelog", "internal"],
    };

    const script = generateChangelogScript(config);

    expect(script).toContain("-label:-skip-changelog");
    expect(script).toContain("-label:-internal");
  });

  test("should filter by since date when provided", () => {
    const config: ChangelogConfig = {};
    const script = generateChangelogScript(config, "2024-01-01");

    expect(script).toContain("merged:>2024-01-01");
  });
});

describe("generateReadmeSectionContent", () => {
  test("should generate installation section", () => {
    const content = generateReadmeSectionContent("installation");

    expect(content).toContain("package.json");
    expect(content).toContain("## Installation");
    expect(content).toContain("bun.lockb");
    expect(content).toContain("pnpm-lock.yaml");
    expect(content).toContain("yarn.lock");
  });

  test("should generate usage section", () => {
    const content = generateReadmeSectionContent("usage");

    expect(content).toContain("## Usage");
    expect(content).toContain("examples");
  });

  test("should generate usage section with custom source", () => {
    const content = generateReadmeSectionContent("usage", "demos");

    expect(content).toContain("demos");
  });

  test("should generate api section", () => {
    const content = generateReadmeSectionContent("api");

    expect(content).toContain("## API");
    expect(content).toContain("docs/api");
  });

  test("should generate license section", () => {
    const content = generateReadmeSectionContent("license");

    expect(content).toContain("## License");
    expect(content).toContain("LICENSE");
  });

  test("should handle unknown sections", () => {
    const content = generateReadmeSectionContent("unknown-section");

    expect(content).toContain("Unknown section: unknown-section");
  });
});

describe("formatKeepAChangelog", () => {
  test("should format entries by category", () => {
    const entries: ChangelogEntry[] = [
      { date: "2024-01-01", category: "Added", description: "New feature" },
      { date: "2024-01-01", category: "Fixed", description: "Bug fix" },
      { date: "2024-01-01", category: "Added", description: "Another feature" },
    ];

    const output = formatKeepAChangelog(entries);

    expect(output).toContain("## [Unreleased]");
    expect(output).toContain("### Added");
    expect(output).toContain("### Fixed");
    expect(output).toContain("- New feature");
    expect(output).toContain("- Another feature");
    expect(output).toContain("- Bug fix");
  });

  test("should include version and date when provided", () => {
    const entries: ChangelogEntry[] = [
      { date: "2024-01-01", category: "Added", description: "Feature" },
    ];

    const output = formatKeepAChangelog(entries, "1.0.0", "2024-01-15");

    expect(output).toContain("## [1.0.0] - 2024-01-15");
  });

  test("should include PR numbers and authors", () => {
    const entries: ChangelogEntry[] = [
      {
        date: "2024-01-01",
        category: "Added",
        description: "New feature",
        pr_number: 123,
        author: "octocat",
      },
    ];

    const output = formatKeepAChangelog(entries);

    expect(output).toContain("(#123)");
    expect(output).toContain("@octocat");
  });

  test("should maintain category order", () => {
    const entries: ChangelogEntry[] = [
      { date: "2024-01-01", category: "Security", description: "Security fix" },
      { date: "2024-01-01", category: "Added", description: "Feature" },
      { date: "2024-01-01", category: "Deprecated", description: "Old API" },
    ];

    const output = formatKeepAChangelog(entries);

    const addedIndex = output.indexOf("### Added");
    const deprecatedIndex = output.indexOf("### Deprecated");
    const securityIndex = output.indexOf("### Security");

    // Order should be: Added, Deprecated, Security
    expect(addedIndex).toBeLessThan(deprecatedIndex);
    expect(deprecatedIndex).toBeLessThan(securityIndex);
  });

  test("should skip empty categories", () => {
    const entries: ChangelogEntry[] = [
      { date: "2024-01-01", category: "Added", description: "Feature" },
    ];

    const output = formatKeepAChangelog(entries);

    expect(output).toContain("### Added");
    expect(output).not.toContain("### Changed");
    expect(output).not.toContain("### Fixed");
  });
});

describe("generateDocumentationContext", () => {
  test("should generate context for all documentation types", () => {
    const config: DocumentationConfig = {
      api: {
        sources: ["src/**/*.ts"],
        output: "docs/api/",
        format: "markdown",
      },
      readme: {
        path: "README.md",
        sections: [{ section: "installation" }, { section: "usage" }],
      },
      changelog: {
        path: "CHANGELOG.md",
        format: "keep-a-changelog",
      },
      drift_detection: {
        enabled: true,
        pairs: [{ code: "src/**", docs: "docs/**", threshold: 7 }],
      },
    };

    const context = generateDocumentationContext(config);

    expect(context).toContain("# Documentation Context");
    expect(context).toContain("## API Documentation Config");
    expect(context).toContain("src/**/*.ts");
    expect(context).toContain("## README Maintenance Config");
    expect(context).toContain("installation, usage");
    expect(context).toContain("## Changelog Config");
    expect(context).toContain("keep-a-changelog");
    expect(context).toContain("## Drift Detection Config");
    expect(context).toContain("Enabled: true");
  });

  test("should handle partial configuration", () => {
    const config: DocumentationConfig = {
      api: {
        sources: ["src/**/*.ts"],
        output: "docs/",
      },
    };

    const context = generateDocumentationContext(config);

    expect(context).toContain("## API Documentation Config");
    expect(context).not.toContain("## README Maintenance Config");
    expect(context).not.toContain("## Changelog Config");
    expect(context).not.toContain("## Drift Detection Config");
  });

  test("should handle empty configuration", () => {
    const config: DocumentationConfig = {};

    const context = generateDocumentationContext(config);

    expect(context).toContain("# Documentation Context");
    expect(context).not.toContain("## API Documentation Config");
  });
});
