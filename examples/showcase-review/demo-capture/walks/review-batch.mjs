export default {
  title: 'Two invoices. One checked decision.',
  description: 'Code a fictional invoice, review the count and total, then verify the approved batch.',
  writes: true,
  startPath: '/',
  async run({page, rec, checks}) {
    // Reset only this fictional fixture before the recorded story starts.
    await page.getByRole('button', {name: 'Reset demo', exact: true}).click();
    const invoice = page.getByRole('row').filter({has: page.getByText('INV-2041', {exact: true})});
    await checks.text(invoice.locator('td').nth(3), 'Unassigned');
    await rec.step('missing-code', 'One invoice still needs a category.', 'action', async () => {
      await rec.show({category: {at: invoice.locator('td').nth(3), text: 'Unassigned', target: invoice.locator('td').nth(3)}});
    });
    await rec.step('open-review', 'Open the invoice review.', 'action', async () => {
      await rec.click(page.getByRole('button', {name: 'Edit INV-2041', exact: true}));
    });
    await rec.step('code-invoice', 'Choose a category. Leave a reason.', 'action', async () => {
      await page.getByRole('combobox', {name: 'Category', exact: true}).selectOption('Office supplies');
      await rec.type(page.getByRole('textbox', {name: 'Review note', exact: true}), 'Reviewed for workshop supplies');
    });
    await rec.step('save-coding', 'Save the coding.', 'action', async () => {
      await rec.click(page.getByRole('button', {name: 'Save changes', exact: true}));
    });
    await rec.step('coding-settled', 'Wait for the saved result.', 'wait', async () => {
      await page.getByRole('dialog').waitFor({state: 'hidden'});
      await checks.text(invoice.locator('td').nth(3), 'Office supplies Reviewed for workshop supplies');
      // The state check passes first; allow the settled UI to reach the video stream.
      await page.waitForTimeout(250);
    });
    await rec.step('saved-coding', 'Coding and review note are saved.', 'action', async () => {
      await rec.show({coding: {at: invoice.locator('td').nth(3), text: 'Office supplies Reviewed for workshop supplies', target: invoice.locator('td').nth(3)}});
    });
    await rec.step('select-batch', 'Select the two intended invoices.', 'action', async () => {
      await rec.click(page.getByRole('checkbox', {name: 'Select INV-2041', exact: true}));
      await rec.click(page.getByRole('checkbox', {name: 'Select INV-2042', exact: true}));
    });
    await rec.step('open-preview', 'Review before approving.', 'action', async () => {
      await rec.click(page.getByRole('button', {name: 'Review approval', exact: true}));
    });
    await rec.step('check-total', 'Two invoices. Exactly $2,000.00.', 'action', async () => {
      const summary = page.getByRole('region', {name: 'Approval summary', exact: true});
      await rec.show({
        count: {at: summary.locator('div').first(), text: '2 invoices selected', target: summary.locator('div').first()},
        total: {at: summary.locator('strong'), dollarMinor: 200000, target: summary.locator('strong')},
      });
    });
    await rec.step('approve-demo', 'Approve this fictional batch.', 'action', async () => {
      await rec.click(page.getByRole('button', {name: 'Approve 2 invoices', exact: true}));
    });
    await rec.step('approval-settled', 'Wait for approval to finish.', 'wait', async () => {
      await page.getByRole('dialog').waitFor({state: 'hidden'});
      await page.getByRole('button', {name: 'View batch', exact: true}).waitFor({state: 'visible'});
      await page.waitForTimeout(250);
    });
    await rec.step('open-batch', 'Open the saved batch.', 'action', async () => {
      await rec.click(page.getByRole('button', {name: 'View batch', exact: true}));
    });
    await rec.step('reload-result', 'Reload to verify the saved result.', 'wait', async () => {
      await page.reload();
      await page.getByRole('heading', {name: 'BATCH-1001', exact: true}).waitFor({state: 'visible'});
      await checks.count(page.getByRole('table', {name: 'Batch invoices', exact: true}).locator('tbody tr'), 2);
      await page.waitForTimeout(250);
    });
    await rec.step('verified-batch', 'Two approved. Exactly $2,000.00.', 'action', async () => {
      const cards = page.getByRole('region', {name: 'Batch summary', exact: true}).locator('.metric');
      await rec.show({
        count: {at: cards.nth(0).locator('strong'), integer: 2, target: cards.nth(0)},
        total: {at: cards.nth(1).locator('strong'), dollarMinor: 200000, target: cards.nth(1)},
        status: {at: cards.nth(2).locator('strong'), text: 'Approved', target: cards.nth(2)},
      });
    });
  },
};
