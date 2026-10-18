// An optional, tiny review aid. It simulates acknowledgement, not a real save API.
export function mountSaveFeedback(root) {
  const draft = root.querySelector('textarea');
  const button = root.querySelector('[data-save]');
  const status = root.querySelector('[data-status]');
  const failure = root.querySelector('[data-failure]');
  const presentation = root.querySelector('select');
  let revision = 0;
  let pending = false;
  const clear = () => { status.textContent = ''; status.classList.remove('failed'); };
  draft.addEventListener('input', () => {
    revision += 1;
    if (!pending) clear();
  });
  presentation.addEventListener('change', clear);
  button.addEventListener('click', async () => {
    if (pending) return;
    const savedRevision = revision;
    const shouldFail = failure.checked;
    const showSuccess = presentation.value === 'after';
    pending = true;
    // Keep the save control focusable while suppressing duplicate activation.
    button.setAttribute('aria-disabled', 'true');
    presentation.disabled = true;
    failure.disabled = true;
    button.textContent = 'Saving…';
    status.textContent = 'Waiting for simulated acknowledgement…';
    status.classList.remove('failed');
    root.setAttribute('aria-busy', 'true');
    await new Promise(resolve => setTimeout(resolve, 450));
    status.classList.toggle('failed', shouldFail);
    status.textContent = shouldFail
      ? 'Could not save. Your draft is still here; try again.'
      : showSuccess
        ? revision === savedRevision ? 'Saved' : 'Earlier draft saved; you have unsaved changes.'
        : '';
    pending = false;
    button.setAttribute('aria-disabled', 'false');
    presentation.disabled = false;
    failure.disabled = false;
    button.textContent = 'Save draft';
    root.setAttribute('aria-busy', 'false');
    // The existing elements stay mounted; editing/focus is not replaced by a page render.
  });
}
