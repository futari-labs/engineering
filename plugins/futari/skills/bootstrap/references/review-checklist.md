# Review the design before execution

Scale the review to the project's risk. Use the current artifacts, not a leading description of what to approve. Report concrete findings with affected requirement/task IDs and evidence. Separate blocking findings from accepted tradeoffs.

## Product and interface

- Can someone observe whether each requirement is satisfied?
- Are non-goals and the launch environment explicit?
- For UI work, are the primary flow, loading/empty/error states, accessibility expectations, and component reuse policy agreed?
- Are third-party capabilities verified rather than assumed?

## Architecture

- Does each piece of state have an owner and an explicit lifecycle?
- Do interfaces, retries, idempotency, concurrency, and failure recovery fit the actual workflows?
- Are security, tenant boundaries, data retention, and observability proportional to the product?
- Is the largest technical uncertainty tested early enough to change course cheaply?
- Could a simpler architecture satisfy the same requirements?

## Evaluations

- Does every requirement map to a discriminating evaluation?
- Are representative happy, edge, failure, and relevant adversarial cases present?
- Are fixture validation, expected failing product assertions, live checks, and blocked runs distinguished?
- Are datasets and labels attributed, thresholds approved, and AI judge behavior calibrated?
- Would a naive, empty, hardcoded, or fabricated implementation fail the tests?
- Are scoring configuration, regression fixtures, and threshold files in the frozen input list?
- Is there a repeatable final end-to-end acceptance command or documented procedure?

## Execution

- Can each task be implemented and verified without guessing product intent?
- Do dependencies form a valid order, and does the vertical slice precede expansion?
- Do file scopes include required tests/configuration while exposing overlap and shared-file risks?
- Are interface/lockfile migrations sequenced before parallel work?
- Does one worker own each PR through review and CI, with a separate independent review?
- Are external access, cost, stop conditions, merge policy, and deployment boundaries explicit?
- Can a new session resume using only committed artifacts and actual GitHub state?

## Reviewer output

List findings with severity, affected IDs/files, why they matter, and the smallest useful correction. Record remaining uncertainties and return READY, CHANGES REQUIRED, or BLOCKED with reasons. READY is advisory; only the human approves the contract.
