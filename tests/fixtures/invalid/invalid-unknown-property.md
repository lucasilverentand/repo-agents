---
name: Unknown Property Agent
on:
  issues:
    types: [opened]
permissions:
  issues: write
outputs:
  add-comment: true
unknown_field: "This should not be allowed"
extra_property: 42
custom_config:
  nested: "values"
---

This agent has unknown properties in frontmatter, which should fail strict validation.
