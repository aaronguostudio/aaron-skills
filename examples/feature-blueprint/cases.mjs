// Presentation metadata for two authored examples, not mandatory skill modes.
export const fieldnoteViews = [
  ['overview', 'The full case'],
  ['evidence', 'Evidence & brief'],
  ['clarify', 'Clarification'],
  ['workflow', 'Workflow'],
  ['model', 'Data model'],
  ['prototype', 'Try the prototype'],
  ['handoff', 'Build handoff'],
];
export const caseStudies = [
  {
    id: 'save-feedback', route: 'lightweight', title: 'A quiet “Saved”.',
    context: 'A clear UI request with existing save behavior and status styling.',
    uncertainty: 'Very little: the supplied context already answers the important questions.',
    output: 'A short response, observable checks and reuse of the existing component.',
    medium: 'Conversation or project note; an optional focused visual in the available tool.',
    next: 'Wire the inline status into the current save handler.',
    omitted: 'No workflow diagram, data model, source ledger or portable JSON.',
    source: 'lightweight.md',
  },
  {
    id: 'fieldnote', route: 'overview', title: 'A request with many owners.',
    context: 'A fictional equipment workflow with conflicting meeting suggestions.',
    uncertainty: 'Approval authority, editable states, rejection recovery and stale writes.',
    output: 'Questions, workflow, conceptual model, prototype and structured handoff.',
    medium: 'This local case reader; real design work can remain in its native tool.',
    next: 'Implement the agreed slices and independently verify a real backend.',
    omitted: 'Inventory reservations and email remain outside the pilot.',
    source: 'blueprint.json',
  },
];
export function navigationFor(page) {
  return fieldnoteViews.some(([route]) => route === page)
    ? [['compare', 'Compare examples'], ...fieldnoteViews]
    : [['compare', 'Compare examples'], ['lightweight', 'The small change']];
}
