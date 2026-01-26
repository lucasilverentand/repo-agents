# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0](https://github.com/lucasilverentand/repo-agents/compare/v1.7.0...v1.8.0) (2026-01-26)


### Features

* **blueprints:** add agent blueprint system for reusable templates ([#303](https://github.com/lucasilverentand/repo-agents/issues/303)) ([ed0f596](https://github.com/lucasilverentand/repo-agents/commit/ed0f596271fdb2c770e30f64e70d7d2b86cae87d)), closes [#242](https://github.com/lucasilverentand/repo-agents/issues/242)
* **deduplication:** add smart deduplication to prevent redundant agent actions ([#301](https://github.com/lucasilverentand/repo-agents/issues/301)) ([e87a0ad](https://github.com/lucasilverentand/repo-agents/commit/e87a0ad62968c489f1a9cc071692753e44e34e17)), closes [#238](https://github.com/lucasilverentand/repo-agents/issues/238)
* **docs:** add documentation generation system ([#304](https://github.com/lucasilverentand/repo-agents/issues/304)) ([4d29516](https://github.com/lucasilverentand/repo-agents/commit/4d2951689335c8b5ee4e6c411ef90f89963558a7)), closes [#253](https://github.com/lucasilverentand/repo-agents/issues/253)
* **github:** add AI agent instructions to issue templates ([9a5c956](https://github.com/lucasilverentand/repo-agents/commit/9a5c956ba3c2130888a489450b68101067100de6))
* **github:** add bug report template and issue config ([14ba7ad](https://github.com/lucasilverentand/repo-agents/commit/14ba7adc5b02c541f4e316d0486026a8d1ea7947))
* **issue-quality:** add scheduled processing for unchecked issues ([0ec5558](https://github.com/lucasilverentand/repo-agents/commit/0ec5558d343f891a9530cb176dfbe76a8c30db3f))
* **outputs:** add edit-issue handler ([f4f22b7](https://github.com/lucasilverentand/repo-agents/commit/f4f22b75def07600c304ce0ee4a15ca2ac23de54))
* **tracing:** add execution tracing for detailed agent action logs ([#302](https://github.com/lucasilverentand/repo-agents/issues/302)) ([3e84891](https://github.com/lucasilverentand/repo-agents/commit/3e84891adca713fb766e60dcda5d97d190639e15)), closes [#241](https://github.com/lucasilverentand/repo-agents/issues/241)
* **validation:** add exclude_bot_issues option to skip bot-authored issues ([ad2ca88](https://github.com/lucasilverentand/repo-agents/commit/ad2ca8849e00f460d70ffeb3088619f282a1ffd6))
* **validation:** add skip_labels to prevent agents from processing certain issues ([f47cb97](https://github.com/lucasilverentand/repo-agents/commit/f47cb97d457377a91dc0e43b6c5ca4dc7dedafb8)), closes [#296](https://github.com/lucasilverentand/repo-agents/issues/296)


### Bug Fixes

* **agent:** remove add-comment max constraint for batch mode ([02a271b](https://github.com/lucasilverentand/repo-agents/commit/02a271b66b0efd161f45fb35301e95a930f87c41))
* **concurrency:** prevent bot-triggered events from cancelling running agents ([ba54544](https://github.com/lucasilverentand/repo-agents/commit/ba545440e09084ab57ecdef4754bc58dcfc8bcd2))
* **generator:** skip bot-triggered events to prevent self-cancellation ([ff533a5](https://github.com/lucasilverentand/repo-agents/commit/ff533a579705005cf77e197fdcf62bff78fca34d))
* **issue-quality:** use 365d lookback for scheduled batch processing ([8b24bfe](https://github.com/lucasilverentand/repo-agents/commit/8b24bfe3a3ae5f9ce950f81632def95dfafd14c9))
* **outputs:** support issue_number in batch mode for add-comment, add-label, remove-label ([804aefb](https://github.com/lucasilverentand/repo-agents/commit/804aefbc18f3df0530243d8dbdb7fc259b6d8b06))
* **runtime:** add bot actor check to prevent recursive agent loops ([014de18](https://github.com/lucasilverentand/repo-agents/commit/014de1865d2097d34bad2152e4545136727b4f2e))
* **runtime:** replace heredoc with echo pipe for Bun shell compatibility ([56b1066](https://github.com/lucasilverentand/repo-agents/commit/56b1066d36323ffb6a505f8794c1cc7fec18f26d))
* **tests:** isolate contract tests to prevent repo pollution ([13fc830](https://github.com/lucasilverentand/repo-agents/commit/13fc83029e38890e7f9a07d1529571254b975f90))

## [1.7.0](https://github.com/lucasilverentand/repo-agents/compare/v1.6.0...v1.7.0) (2026-01-24)


### Features

* add blocked-labels support to add-label output handler ([dd11fd5](https://github.com/lucasilverentand/repo-agents/commit/dd11fd544af7d931150af6a8244d6c386e1c9c51))
* add bot actor detection to prevent recursive loops ([b4f3905](https://github.com/lucasilverentand/repo-agents/commit/b4f39059fe8656dec4e2433eca4764c539130222))
* add concurrency support to debounce rapid events ([17a7734](https://github.com/lucasilverentand/repo-agents/commit/17a7734a1816048848252da00e4fecf2a936d9d6))
* add GitHub Projects and label management output types ([#272](https://github.com/lucasilverentand/repo-agents/issues/272)) ([0408096](https://github.com/lucasilverentand/repo-agents/commit/040809627f5c556107a1cb6c39b6cff8d60e6734))
* add GitHub Projects v2 context collection ([#276](https://github.com/lucasilverentand/repo-agents/issues/276)) ([ea13588](https://github.com/lucasilverentand/repo-agents/commit/ea13588e66d422395785fd701cad317f86bde5d8))
* enhance audit report with comprehensive markdown summary ([dd38843](https://github.com/lucasilverentand/repo-agents/commit/dd38843d9240f508209c1df5959ac5427895cb83))
* implement audit system for agent execution tracking ([93626f7](https://github.com/lucasilverentand/repo-agents/commit/93626f7ec0f3a68ab0040c6c6c88a7baff567797))
* **invocations:** add comment-triggered agent execution ([#230](https://github.com/lucasilverentand/repo-agents/issues/230)) ([#280](https://github.com/lucasilverentand/repo-agents/issues/280)) ([c0d93aa](https://github.com/lucasilverentand/repo-agents/commit/c0d93aa6d1290574039858efc02faab660d85472))
* **timeout:** add configurable execution timeouts ([#232](https://github.com/lucasilverentand/repo-agents/issues/232)) ([#279](https://github.com/lucasilverentand/repo-agents/issues/279)) ([7cdf26a](https://github.com/lucasilverentand/repo-agents/commit/7cdf26acd7874363b3c83e5b23379823896c0409))


### Bug Fixes

* add dispatcher to outputs job needs array ([5676558](https://github.com/lucasilverentand/repo-agents/commit/567655827988c54c38ab2dcc9d8b6f288d8bb278))
* **generator:** audit jobs should only run when agent is dispatched ([d6d2bec](https://github.com/lucasilverentand/repo-agents/commit/d6d2bec52ad809f594bd93f025b3959e676f6347))
* **generator:** handle missing outputs artifacts gracefully ([662c89e](https://github.com/lucasilverentand/repo-agents/commit/662c89e1b0a4df80350eec8c23e90a819bb20a2d))
* improve audit issue template to surface errors prominently ([9de47d9](https://github.com/lucasilverentand/repo-agents/commit/9de47d9d375a5beac12217ead483de8b048dff4e))
* include event_name in concurrency group to avoid collisions ([1f935a3](https://github.com/lucasilverentand/repo-agents/commit/1f935a326b3d7b0bef76baf6b694f1f822cdb290))
* make outputs stage process all outputs when no type specified ([bc40b57](https://github.com/lucasilverentand/repo-agents/commit/bc40b571272b9ab8ad5525c349c2855dece1057c))
* move concurrency to workflow level for unified architecture ([79edfef](https://github.com/lucasilverentand/repo-agents/commit/79edfef4e908754a0bcb98650c7fde15385e21df))
* remove duplicate GITHUB_STEP_SUMMARY write in audit-report ([b71d909](https://github.com/lucasilverentand/repo-agents/commit/b71d909dda84c5c11f018f5a3d14d5eb9864abc6))
* resolve pipe command failures and trigger_labels validation logic ([6ee1af8](https://github.com/lucasilverentand/repo-agents/commit/6ee1af82b25e755828b92030b72bbdbfe57f7db7))
* **runtime:** use OR logic for trigger_labels ([#226](https://github.com/lucasilverentand/repo-agents/issues/226)) ([#278](https://github.com/lucasilverentand/repo-agents/issues/278)) ([52c58cd](https://github.com/lucasilverentand/repo-agents/commit/52c58cdd40926fe03b31be6550230a217debb881))
* use heredoc for add-label and remove-label output execution ([#227](https://github.com/lucasilverentand/repo-agents/issues/227)) ([7f9d619](https://github.com/lucasilverentand/repo-agents/commit/7f9d619298c4dacd6412c7a774ebcac27a4ddc69))
* use heredoc format for large GitHub Actions outputs ([6840306](https://github.com/lucasilverentand/repo-agents/commit/6840306c1ff2ec01e5aa1716fb7a82d6e3f9dc30))
* use setOutputs utility for GitHub Actions outputs ([0658623](https://github.com/lucasilverentand/repo-agents/commit/0658623014dec6256d1eaef0f4994a81d0ec0503))

## [1.6.0](https://github.com/lucasilverentand/repo-agents/compare/v1.5.0...v1.6.0) (2026-01-21)


### Features

* add agent-specific attribution to comments ([e7ee26f](https://github.com/lucasilverentand/repo-agents/commit/e7ee26f0aa0558cc46374dc1ef522b329e2023a7))
* add copy-project and mark-template output types ([8076f4a](https://github.com/lucasilverentand/repo-agents/commit/8076f4a18504a34bdebdac7ff2384db9eececd97))
* add copy-project and mark-template output types ([25d3271](https://github.com/lucasilverentand/repo-agents/commit/25d3271ebcfe35461739177733545f8bfbb3f6c8)), closes [#197](https://github.com/lucasilverentand/repo-agents/issues/197)
* refactor agent workflow to use dispatcher for event handling ([cf75a62](https://github.com/lucasilverentand/repo-agents/commit/cf75a62dc85016b4011fe2f0369ba59c51ee1311))
* refactor workflow to per-agent job generation ([7d94f59](https://github.com/lucasilverentand/repo-agents/commit/7d94f596d2c59c9412fd0e8f6a5a51950530bdaf))


### Bug Fixes

* add repo-agent script to package.json for workflow execution ([59235b1](https://github.com/lucasilverentand/repo-agents/commit/59235b168d9d9bc5b5ac7279079135d98e06d8a5))
* compact JSON output for GitHub Actions environment ([a024772](https://github.com/lucasilverentand/repo-agents/commit/a024772988aebff59e28097d34199e362981a4af))
* correct validation artifact paths in workflow ([cc7fce5](https://github.com/lucasilverentand/repo-agents/commit/cc7fce572c04996972c3f631c81a0f1f0e76144c))
* disable coverage threshold temporarily ([b1fc804](https://github.com/lucasilverentand/repo-agents/commit/b1fc8048e26f76386ea0e5b1c15df5eb8d4a84e9))
* **docs:** pin zod v3 for Astro compatibility ([87f2666](https://github.com/lucasilverentand/repo-agents/commit/87f266649858ce3c8d4133edf7a096932b6457c7))
* execute outputs for each configured output type in agent ([9b3373a](https://github.com/lucasilverentand/repo-agents/commit/9b3373a709c2c427d0346678cd17467a43405109))
* restore unified workflow architecture with route-event ([4107f65](https://github.com/lucasilverentand/repo-agents/commit/4107f654fb3dc6409e59411f41fce1056228598a))
* simplify output_types parsing in check-outputs step ([ee6d31b](https://github.com/lucasilverentand/repo-agents/commit/ee6d31b4e8d0b864b03ac1c332f3691e7c5ccba7))
* support global preflight without agent path ([3358d13](https://github.com/lucasilverentand/repo-agents/commit/3358d13f1175cf8b7c8a4d685447d8c6589fe5c8))
* update CLI version retrieval and refine package file structure ([89dffea](https://github.com/lucasilverentand/repo-agents/commit/89dffea33158854fd851039754ad1373c577f685))
* update workflow tests to reflect dispatcher changes ([a6ef9ad](https://github.com/lucasilverentand/repo-agents/commit/a6ef9add0331f58e3ae5d0665aa31c32c414e34e))

## [1.5.0](https://github.com/lucasilverentand/repo-agents/compare/v1.4.0...v1.5.0) (2026-01-20)


### Features

* add unified workflow generator and runtime ([726c4d4](https://github.com/lucasilverentand/repo-agents/commit/726c4d4d45531f8f5d631af67609b9fc1d821252))
* **cli:** align CLI with clig.dev guidelines for better UX ([843388f](https://github.com/lucasilverentand/repo-agents/commit/843388f8c38878c6a497dd828534e8d4ab4f4a7b))
* migrate compile command to unified workflow ([fc1b969](https://github.com/lucasilverentand/repo-agents/commit/fc1b969e017d926d298d84a169458af5c69c2489))

## [1.4.0](https://github.com/lucasilverentand/repo-agents/compare/v1.3.0...v1.4.0) (2026-01-20)


### Features

* enhance documentation with automated issue lifecycle and update .gitignore ([f17ee00](https://github.com/lucasilverentand/repo-agents/commit/f17ee0044f821600a91856afcac4b5ee7c48453f))


### Bug Fixes

* ensure validate command exits with code 1 on validation failure ([e3eb373](https://github.com/lucasilverentand/repo-agents/commit/e3eb3735efdb7f22fff66738aa4577cecc5e5565))
* remove invalid conditional from GitHub App token step ([c2f74ea](https://github.com/lucasilverentand/repo-agents/commit/c2f74ea3a02a2bcfc8eeaf17bdc5e216310bfa23))
* use official GitHub App token action in workflows ([301d8d2](https://github.com/lucasilverentand/repo-agents/commit/301d8d21391faf95b600f7d6b1a2a8f922ab7590)), closes [#198](https://github.com/lucasilverentand/repo-agents/issues/198)
* use strategy.job-index for matrix first-item check ([baa5c78](https://github.com/lucasilverentand/repo-agents/commit/baa5c78fb47895c1dc8c7e10324af2c847fe197c))

## [1.3.0](https://github.com/lucasilverentand/repo-agents/compare/v1.2.0...v1.3.0) (2026-01-20)


### Features

* add blocking issues and project custom fields with auto-retry ([36a66d8](https://github.com/lucasilverentand/repo-agents/commit/36a66d8e454802fdf649a3e7c10cfc4de32c7616))
* add CLI validation script and improve IDE setup ([435a3f8](https://github.com/lucasilverentand/repo-agents/commit/435a3f84d104788a48cf4976fd87d6be7377ee5e))
* add JSON Schema generation for IDE autocomplete support ([eb2c02e](https://github.com/lucasilverentand/repo-agents/commit/eb2c02e045d46a659335b65a8ab4fa069817447e))
* add strict validation to JSON Schema for outputs and triggers ([55d59e8](https://github.com/lucasilverentand/repo-agents/commit/55d59e8be1373638b89397f3210670f1f9fe3c1f))
* add VS Code tasks for agent validation ([2f09e98](https://github.com/lucasilverentand/repo-agents/commit/2f09e983abf13138d184f22ed950fa0027c0e5a5))
* **agents:** require approved + agent-assigned labels for implementer ([b60f830](https://github.com/lucasilverentand/repo-agents/commit/b60f830ee8a8844d3fbe1c87dbc8f2bb9876547c))
* **agents:** update formatter to trigger triage directly ([e68765b](https://github.com/lucasilverentand/repo-agents/commit/e68765b2fa22bb8cf4b731c6c41e35623de0a592))
* **parser:** add max_open_prs field to agent schema ([46c88dd](https://github.com/lucasilverentand/repo-agents/commit/46c88dd8a2c84beacee7fe03a26505af1974efaa))
* **runtime:** add progress comment tracking for issue/PR workflows ([7805cef](https://github.com/lucasilverentand/repo-agents/commit/7805cefe3ea18c84a5788f3595292b1c6d7c42d9))
* **runtime:** implement max_open_prs pre-flight check ([5d007f2](https://github.com/lucasilverentand/repo-agents/commit/5d007f21a071b7b47d7887994ead2849df2d9c52))
* **workflows:** add individual agent workflow files ([b1e555f](https://github.com/lucasilverentand/repo-agents/commit/b1e555f979ddf77f0416a1eca3b0e23ae40c7f2c))
* **workflows:** add labeled trigger and write permissions ([99e63e6](https://github.com/lucasilverentand/repo-agents/commit/99e63e6a835b46efc986e178cee702bdba5f28a4))


### Bug Fixes

* add strict validation to Zod schemas to catch typos ([ddb4768](https://github.com/lucasilverentand/repo-agents/commit/ddb476819aeb7f9de79a3c8cfa824d8da501e049))
* **agent:** allow Write tool without path restriction ([616c1a0](https://github.com/lucasilverentand/repo-agents/commit/616c1a0f610b41b88585e3b5e47db7693ad6b6fb))
* **agent:** read dispatcher context for original event info ([8777955](https://github.com/lucasilverentand/repo-agents/commit/87779559449d9fb023200d4508e49c4e4bd37739))
* always pass target issue number to agent workflows ([a6f000d](https://github.com/lucasilverentand/repo-agents/commit/a6f000defd442e873c41e545ddec5ad0f4a1cfd3))
* base64 encode event payload to avoid newline issues ([7492bdb](https://github.com/lucasilverentand/repo-agents/commit/7492bdb32d425a5384767fac6e50de8a8f46fe50))
* **dispatcher:** add Bun setup to all jobs ([50ccf9e](https://github.com/lucasilverentand/repo-agents/commit/50ccf9e25af2efbf4479d12cbb1224f86aea5a44))
* **dispatcher:** add GH_TOKEN fallback for workflow dispatch ([1bb98d7](https://github.com/lucasilverentand/repo-agents/commit/1bb98d73a8a043d7bbf685e9a38f416f94fb80a7))
* **dispatcher:** add setup steps to all dispatcher jobs ([8b03c99](https://github.com/lucasilverentand/repo-agents/commit/8b03c995147033e8aeb2e12c856901eee9f85e67))
* **dispatcher:** allow repository owners to trigger agents ([30fa37d](https://github.com/lucasilverentand/repo-agents/commit/30fa37db724c7e10cea73179f72325ad19c79696))
* **dispatcher:** extract event action from payload ([bb0fe66](https://github.com/lucasilverentand/repo-agents/commit/bb0fe665fe5025626b690bc01dc4b61b27238ff2))
* **dispatcher:** fallback to github.token when app-token is empty ([739517e](https://github.com/lucasilverentand/repo-agents/commit/739517e811c116f5757b6866a0a493ddb2ae6c93))
* **dispatcher:** support recursive agent discovery ([e0a992d](https://github.com/lucasilverentand/repo-agents/commit/e0a992da4dfaf81b9f20762e8f1bf306a1af8bb2))
* **dispatcher:** use local code instead of npm package ([302f7d6](https://github.com/lucasilverentand/repo-agents/commit/302f7d6035c6417a910f649961935ebecb9bdd31))
* **dispatcher:** use local code instead of npm package ([55d0bb9](https://github.com/lucasilverentand/repo-agents/commit/55d0bb9724642e5b8e0d3893256f9556737879e1))
* **dispatcher:** use runtime package for run command ([469f87e](https://github.com/lucasilverentand/repo-agents/commit/469f87e22ad3e133a699f1edf9cc036e6807e401))
* **generator:** download dispatch context in execute-outputs job ([1be8910](https://github.com/lucasilverentand/repo-agents/commit/1be891082bc7c7cd565fb87feb258d0020f772a6))
* **generator:** use workflow_dispatch instead of workflow_call ([5d3fb82](https://github.com/lucasilverentand/repo-agents/commit/5d3fb8272c08b333e01c8f2f7928c7d73a435975))
* **outputs:** read dispatcher context for issue/PR numbers ([d0d806a](https://github.com/lucasilverentand/repo-agents/commit/d0d806ad6979fd2bed51232b30546b56236c59ae))
* pass issue number to outputs stage via workflow input ([b3b6b24](https://github.com/lucasilverentand/repo-agents/commit/b3b6b245750c036abf32224f279ab5adde282431))
* pass original event payload to agent workflows ([e13de94](https://github.com/lucasilverentand/repo-agents/commit/e13de94c1f04d603ba2a1b4ef1a815d13cc98c1c))
* regenerate workflows to remove stale prepare-context job ([1b60053](https://github.com/lucasilverentand/repo-agents/commit/1b60053c4c358ebee803f477e9154a39664db6b6))
* **skills:** use output handler generators instead of MCP tool instructions ([c6c69b3](https://github.com/lucasilverentand/repo-agents/commit/c6c69b3e932bdae9f252c9353cd5db32e4916c48))
* update generator to use local code and fix artifact downloads ([3660445](https://github.com/lucasilverentand/repo-agents/commit/3660445c09b474a47702af94ca7d9662ae1f51af))

## [Unreleased]

### ⚠ BREAKING CHANGES

* **dispatcher**: The agent dispatcher workflow has been completely refactored. Users must regenerate workflows after updating to this version.

### Features

* **dispatcher**: move complex logic from YAML to TypeScript CLI commands
  - Reduces generated dispatcher from ~500 lines to ~110 lines (78% reduction)
  - All dispatcher logic now in testable TypeScript instead of embedded bash scripts
  - Adds 4 new CLI commands: `dispatcher:global-preflight`, `dispatcher:prepare-context`, `dispatcher:route`, `dispatcher:dispatch`
  - Enables dynamic agent discovery (no workflow regeneration needed when adding new agents)
  - Improves debugging with structured logging and error messages
  - Creates validation audit artifacts for tracking authorization and rate limiting decisions

### Migration Guide

**Required Actions:**
1. Update repo-agents to the latest version: `bun update repo-agents`
2. Regenerate all workflows: `repo-agents compile`
3. Commit the updated dispatcher workflow: `git commit -am "chore: regenerate dispatcher with simplified architecture"`

**What Changed:**
- The generated `.github/workflows/agent-dispatcher.yml` is now dramatically simpler
- Complex bash scripts (JWT generation, event parsing, routing logic) moved to CLI
- Dispatcher now dynamically discovers agents from `.github/agents/` directory
- Validation logic (authorization, rate limits, trigger labels) unified in TypeScript
- All functionality preserved - only implementation changed

**Rollback Plan:**
If you encounter issues, you can pin to the previous version:
```bash
bunx repo-agent@1.2.0 compile
```

## [1.2.0](https://github.com/lucasilverentand/repo-agents/compare/v1.1.1...v1.2.0) (2026-01-17)


### Features

* add add-reaction output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([3a41d80](https://github.com/lucasilverentand/repo-agents/commit/3a41d8031b88dc0a6cbac0e01eabfea4fb907f2b))
* add approve-pr output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([b5b3a4b](https://github.com/lucasilverentand/repo-agents/commit/b5b3a4b2911ff3588235162854f97062fb3ea79f))
* add assign-issue output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([b7169b0](https://github.com/lucasilverentand/repo-agents/commit/b7169b077e5f064506d848049792b3b75ef3813d))
* add code_scanning_alerts context collector ([#124](https://github.com/lucasilverentand/repo-agents/issues/124)) ([d7bf047](https://github.com/lucasilverentand/repo-agents/commit/d7bf047438d99e1db1d45e13f746477b4cde438e))
* add convert-to-discussion output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([4195706](https://github.com/lucasilverentand/repo-agents/commit/4195706b52537acb17755348355e4e96e00e6b3c))
* add create-branch output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([f761617](https://github.com/lucasilverentand/repo-agents/commit/f761617ab6e2785d6bf7dc85b6245ab22e9e1792))
* add create-release output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([f8aafba](https://github.com/lucasilverentand/repo-agents/commit/f8aafbad504d57328dc2d9a0573da73503859348))
* add delete-branch output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([23fb286](https://github.com/lucasilverentand/repo-agents/commit/23fb28624bfd5b8b8e13a5d911f388a739132640))
* add dependabot_prs context collector ([#123](https://github.com/lucasilverentand/repo-agents/issues/123)) ([b56931a](https://github.com/lucasilverentand/repo-agents/commit/b56931a57ff4d0f0325f208a7e283b308473b573))
* add deployments context collector ([#125](https://github.com/lucasilverentand/repo-agents/issues/125)) ([c31d79d](https://github.com/lucasilverentand/repo-agents/commit/c31d79d3729b49ba4b628c175692b432113059f6))
* add edit-issue output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([108abe3](https://github.com/lucasilverentand/repo-agents/commit/108abe38a19b3d432847b2b28c10f6c65ec09bd5))
* add lock-conversation output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([b388c87](https://github.com/lucasilverentand/repo-agents/commit/b388c87899acfa0c5756f41011315d3b1804ae36))
* add merge-pr output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([8681054](https://github.com/lucasilverentand/repo-agents/commit/86810547e597d56964cb118a40884c01f87a54e9))
* add pin-issue output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([96525c1](https://github.com/lucasilverentand/repo-agents/commit/96525c1b6aabeed2d5e3a5f113ecc7007db9f91c))
* add reopen-issue output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([d989734](https://github.com/lucasilverentand/repo-agents/commit/d98973495b91a235ab23e7dda25cf837f0ecca60))
* add request-review output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([3d63dee](https://github.com/lucasilverentand/repo-agents/commit/3d63dee50271b61f88256af41b49b78f3c38de5f))
* add security_alerts context collector ([#122](https://github.com/lucasilverentand/repo-agents/issues/122)) ([d3cf402](https://github.com/lucasilverentand/repo-agents/commit/d3cf4020675e096bc6d772ac88cc711d861a38d6))
* add set-milestone output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([db794cc](https://github.com/lucasilverentand/repo-agents/commit/db794ccaf08a4482ca11599b78d0525ccc8326ad))
* add trigger-workflow output handler ([#146](https://github.com/lucasilverentand/repo-agents/issues/146)) ([920733b](https://github.com/lucasilverentand/repo-agents/commit/920733bb4d64f327d5e941a94c56967d6dddecbc))
* add types and schemas for new output handlers ([7771d32](https://github.com/lucasilverentand/repo-agents/commit/7771d32c03e1198b337fbb4ee6dfc25edfa69de8))


### Bug Fixes

* **ci:** correct prettier check path for monorepo ([812f322](https://github.com/lucasilverentand/repo-agents/commit/812f322c0462a40501d01064eb9ae12a4fdc42f4))
* disable link validator to unblock docs deployment ([d5de961](https://github.com/lucasilverentand/repo-agents/commit/d5de9616674ff0042990f7a5d39a2cced79be6c3))

## [1.1.1](https://github.com/lucasilverentand/repo-agents/compare/v1.1.0...v1.1.1) (2026-01-14)


### Bug Fixes

* add missing chalk and js-yaml dependencies to CLI package ([34dd950](https://github.com/lucasilverentand/repo-agents/commit/34dd9503b5204b9a8f8c19e71f7953ca7e767941))

## [1.1.0](https://github.com/lucasilverentand/repo-agents/compare/v1.0.0...v1.1.0) (2026-01-14)


### Features

* use scoped package name @repo-agents/cli ([cb97fa0](https://github.com/lucasilverentand/repo-agents/commit/cb97fa0972ce2299b0703bb3e21c1bbe27ff5c0e))


### Bug Fixes

* add missing gray-matter dependency to CLI package ([4245cff](https://github.com/lucasilverentand/repo-agents/commit/4245cff978b19efeba62ea81dd0a91b125b0e9de))
* read version from root package.json for correct bundled output ([f01021e](https://github.com/lucasilverentand/repo-agents/commit/f01021efc6570927b8ae8a2bd56343a4bd8906b2))

## [1.0.0](https://github.com/lucasilverentand/repo-agents/compare/v0.4.1...v1.0.0) (2026-01-14)


### ⚠ BREAKING CHANGES

* Users need to rename their .github/claude-agents directory to .github/agents

### Features

* add centralized dispatcher workflow for trigger aggregation ([0ae9c55](https://github.com/lucasilverentand/repo-agents/commit/0ae9c551944bad3f7a3e8702548aac88b7eb3efb))
* add interactive Agent Gallery component to documentation ([#103](https://github.com/lucasilverentand/repo-agents/issues/103)) ([c60049c](https://github.com/lucasilverentand/repo-agents/commit/c60049cf11ec8eef7034bb69420d9e9ac68f243e))
* add npm publishing to release workflow ([0be99ef](https://github.com/lucasilverentand/repo-agents/commit/0be99ef6186c8fdb7ff992a3894dd5f17016c51e))
* add opencode provider for agent runner ([#120](https://github.com/lucasilverentand/repo-agents/issues/120)) ([ad5a16f](https://github.com/lucasilverentand/repo-agents/commit/ad5a16fea00623c0233b6d0ed012e32135c87990))
* add unified setup wizard and agent library installer ([#109](https://github.com/lucasilverentand/repo-agents/issues/109)) ([42fd083](https://github.com/lucasilverentand/repo-agents/commit/42fd083a0fcaf4edad5bd397dfa9d64d48f7c3a7))


### Bug Fixes

* allow GitHub App bot to trigger Issue Triage agent ([#106](https://github.com/lucasilverentand/repo-agents/issues/106)) ([45f97cb](https://github.com/lucasilverentand/repo-agents/commit/45f97cb98199dcf364f9c5d8ff8752f80f05f73b))
* correct README badge URLs to match workflow names ([a357657](https://github.com/lucasilverentand/repo-agents/commit/a3576572ba4a12ba4ff1fdbec86aa3ef41f6712a))
* handle rate limiting gracefully in audit-report job ([473e634](https://github.com/lucasilverentand/repo-agents/commit/473e6343bf15a543c4eaf9cfa5a223cec0d730d4))
* ignore trigger validation errors from incomplete SchemaStore schema ([bd96054](https://github.com/lucasilverentand/repo-agents/commit/bd960545271774c1b69b75ae8d51b426ec3a313e))
* remove add-comment from scheduled failure-alerts agent ([1c82e94](https://github.com/lucasilverentand/repo-agents/commit/1c82e94e85531aa747551e072e464f80d4f89e71)), closes [#111](https://github.com/lucasilverentand/repo-agents/issues/111)
* validate cached schema to prevent using stale/corrupted cache ([47441a6](https://github.com/lucasilverentand/repo-agents/commit/47441a652b8fb385a41defb242721fb48a70caaa))

## [0.4.1](https://github.com/lucasilverentand/gh-claude/compare/v0.4.0...v0.4.1) (2026-01-05)


### Bug Fixes

* render footer newlines correctly in comments ([09e2cad](https://github.com/lucasilverentand/gh-claude/commit/09e2cad25f428fdb6f3799a182986dfbeb1d81e8))
* use blockquote for footer instead of horizontal rule ([5fa54ac](https://github.com/lucasilverentand/gh-claude/commit/5fa54ac7a62cdc10e46065ae677e1d95be255d44))
* use file path input for private key in setup-app ([80c49e9](https://github.com/lucasilverentand/gh-claude/commit/80c49e920dbe05e58d71bdd2853a894bf4069c47))

## [0.4.0](https://github.com/lucasilverentand/gh-claude/compare/v0.3.0...v0.4.0) (2025-12-29)


### Features

* add footer with workflow and job link to agent-generated comments and discussions ([a48c8f0](https://github.com/lucasilverentand/gh-claude/commit/a48c8f0b6aab8332e91b7f35e8f7db581cbf4e15))


### Bug Fixes

* handle boolean .labels in jq filter to prevent iteration error ([#75](https://github.com/lucasilverentand/gh-claude/issues/75)) ([bab07b2](https://github.com/lucasilverentand/gh-claude/commit/bab07b2f0dec1cffb5eb5a1ec7891c65760d8023)), closes [#61](https://github.com/lucasilverentand/gh-claude/issues/61)
* resolve failing unit tests ([fc6ebc8](https://github.com/lucasilverentand/gh-claude/commit/fc6ebc8fbd7484b015bb74030ebeaac4129936f4))
* use concatenated template for issue/PR number detection ([d553ee7](https://github.com/lucasilverentand/gh-claude/commit/d553ee7f98d002710f0d4e33fbb0e464b8f377ab))
* use concatenated template for issue/PR number detection ([0b5d4ca](https://github.com/lucasilverentand/gh-claude/commit/0b5d4cae402aaf2e1f07685fe67b4e2890c2b8ea))

## [0.3.0](https://github.com/lucasilverentand/gh-claude/compare/v0.2.0...v0.3.0) (2025-12-25)


### Features

* add codebase improver agent for automated PR creation ([ccd0999](https://github.com/lucasilverentand/gh-claude/commit/ccd09996518fb680561bc4ebcccd949aae05ef5c))
* add setup-app command for GitHub App authentication ([4601d58](https://github.com/lucasilverentand/gh-claude/commit/4601d58a1571de92db4af3c41580c1a897a34f2b))


### Bug Fixes

* handle existing branches in create-pr executor ([a40ff4c](https://github.com/lucasilverentand/gh-claude/commit/a40ff4c2ec5f0fe333f8dbdd30d41698fd69892b))
* handle multi-line content in create-pr output executor ([6751127](https://github.com/lucasilverentand/gh-claude/commit/67511279b1bfc8224f884a3272942d1dfc56df31))
* prettier formatting and rename CI workflow ([3c6e75e](https://github.com/lucasilverentand/gh-claude/commit/3c6e75efc308fd4caede8cea9a10eca0b60a608c))
* resolve all ESLint warnings and migrate to flat config ([3ffb3fd](https://github.com/lucasilverentand/gh-claude/commit/3ffb3fdf95a26ebca6d6877accd354c7fb190dc4))
* resolve TypeScript compilation errors ([#53](https://github.com/lucasilverentand/gh-claude/issues/53)) ([4885f54](https://github.com/lucasilverentand/gh-claude/commit/4885f541a281c9ffaee4469180bb666ea40aa366))
* run Claude in repo directory instead of /tmp/claude ([e9a7c95](https://github.com/lucasilverentand/gh-claude/commit/e9a7c95aa2a3672f1ca4dfa22dce9255f88a3a1a))
* strengthen agent instructions to force output file creation ([3413d4c](https://github.com/lucasilverentand/gh-claude/commit/3413d4c30f414b3126078bf459f9e3fe2dcebb4d))
* support both org and repo level secrets in setup-app ([f4019a6](https://github.com/lucasilverentand/gh-claude/commit/f4019a6b0e74c391679bb3955ed35846189560a9))
* support multiple create-pr output files ([e50df52](https://github.com/lucasilverentand/gh-claude/commit/e50df5257d47349ecf3ca3a00e1ead7a3e8e3d69))
* update codebase-improver to use skill system for PR creation ([04f7401](https://github.com/lucasilverentand/gh-claude/commit/04f7401ce9be914012f8be952bc46af8849b463a))
* use snake_case for pull_requests permission in agent ([1a00fd7](https://github.com/lucasilverentand/gh-claude/commit/1a00fd7ecd2c4111074e31dd38fb0311759d03a7))
* use URL query params instead of -f flags for GitHub API calls ([229da59](https://github.com/lucasilverentand/gh-claude/commit/229da59a75f9631b3b5f4bd8772126724fa94474))

## [Unreleased]

## [0.2.0](https://github.com/lucasilverentand/gh-claude/compare/v0.1.0...v0.2.0) (2024-12-14)

### Features

* **audit:** add two-tier audit system with safe-mode diagnostic agent ([493bfac](https://github.com/lucasilverentand/gh-claude/commit/493bfac))
  * Audit configuration in agent frontmatter (`create_issues`, `labels`, `assignees`)
  * Capture Claude execution metrics (cost, turns, duration, session ID)
  * Track permission issues and validation failures during pre-flight
  * Two-tier behavior: quiet mode on success, alert mode on failure
  * Run safe-mode diagnostic agent (read-only tools) to analyze failures
  * Auto-create GitHub issues with diagnosis and remediation steps
  * Deduplicate issues by adding comments to existing open issues

## [0.1.0] - 2024-12-03

### Added

#### Core Features
- Initial release of gh-claude
- CLI extension for GitHub CLI
- Markdown-to-workflow compilation
- Natural language agent definitions with YAML frontmatter

#### Commands
- `gh claude init` - Initialize gh-claude in repository
- `gh claude compile` - Compile agents to workflows
- `gh claude validate` - Validate agent definitions
- `gh claude list` - List all agents

#### Parser & Validation
- Markdown parser with gray-matter
- Zod schema validation for frontmatter
- Comprehensive error reporting
- Warning and error severity levels

#### Workflow Generation
- GitHub Actions workflow YAML generation
- Support for multiple trigger types (issues, pull requests, discussions, schedule, workflow_dispatch)
- Permission management
- Safe output configuration
- Claude model configuration

#### Runtime
- GitHub Actions runtime environment
- Claude API integration
- GitHub API integration via Octokit
- Safe output handlers for:
  - add-comment
  - add-label
  - create-issue

#### Developer Experience
- Colorized terminal output
- Progress indicators with spinners
- Detailed validation feedback
- Dry-run mode for testing

#### Documentation
- Comprehensive README
- Contributing guidelines
- Example agent templates:
  - Issue triage
  - PR review
  - Daily summary
  - Stale issue management
- Examples documentation

#### Security
- Explicit permission requirements
- Safe output validation
- Path restrictions for file modifications
- API key management through GitHub secrets

### Technical Details

#### Dependencies
- TypeScript 5.4+
- Node.js 20+
- Commander.js for CLI
- Anthropic SDK for Claude API
- Octokit for GitHub API
- Zod for schema validation
- gray-matter for frontmatter parsing
- js-yaml for YAML generation
- chalk and ora for terminal UI
- Jest for testing

#### Project Structure
- Modular architecture with separate CLI, parser, generator, and runtime modules
- Strict TypeScript configuration
- ESLint and Prettier for code quality
- Comprehensive test setup with Jest

## [0.0.0] - 2025-12-03

### Planning
- Initial project planning and design
- Architecture decisions documented
- Implementation roadmap created

---

## Versioning Strategy

- **Major (1.0.0)**: Breaking changes, major feature additions
- **Minor (0.1.0)**: New features, backward compatible
- **Patch (0.0.1)**: Bug fixes, minor improvements

## Release Notes Format

Each release includes:
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

[Unreleased]: https://github.com/lucasilverentand/gh-claude/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/lucasilverentand/gh-claude/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/lucasilverentand/gh-claude/releases/tag/v0.1.0
