// Functional regression fixture, not an agent timing sample. Runtime owns all focus helpers.
export default {
  title: 'Invoice review and batch approval', writes: true,
  async run({page, rec, checks}) {
    const metrics = name => page.getByRole('region', {name}).locator('.metric')
    const fields = name => {
      const cards = metrics(name)
      return {
        count: {at: cards.nth(0).locator('strong'), integer: 2, target: cards.nth(0)},
        total: {at: cards.nth(1).locator('strong'), dollarMinor: 200000, target: cards.nth(1)},
        ...(name === 'Batch summary' ? {status: {at: cards.nth(2).locator('strong'), text: 'Approved', target: cards.nth(2)}} : {}),
      }
    }
    await rec.step('overview', 'Review the invoice queue', 'action', () => rec.focus({heading: page.getByRole('heading', {name:'Invoice review', exact:true})}))
    await rec.step('site', 'Choose North Workshop', 'action', async () => {
      await rec.click(page.getByLabel('Site', {exact:true})); await page.getByLabel('Site', {exact:true}).selectOption('North Workshop')
    })
    await rec.step('status', 'Show invoices needing review', 'action', async () => {
      await rec.click(page.getByLabel('Status', {exact:true})); await page.getByLabel('Status', {exact:true}).selectOption('Needs review')
    })
    await rec.step('filtered', 'Two invoices, $2,000.00 to review', 'action', async () => {
      await checks.count(page.locator('table[aria-label="Invoices"] tbody tr'), 2)
      await rec.show(fields('Filtered summary'))
    })
    await rec.step('edit', 'Review INV-2041', 'action', () => rec.click(page.getByRole('button',{name:'Edit INV-2041',exact:true})))
    await rec.step('category', 'Code as Office supplies', 'action', async () => {
      await rec.click(page.getByLabel('Category', {exact:true})); await page.getByLabel('Category', {exact:true}).selectOption('Office supplies')
    })
    await rec.step('note', 'Add the workshop review note', 'action', () => rec.type(page.getByLabel('Review note', {exact:true}), 'September workshop setup'))
    await rec.step('save', 'Save the invoice coding', 'action', () => rec.click(page.getByRole('button',{name:'Save changes',exact:true})))
    await rec.step('saving', 'Saving the invoice coding', 'wait', async () => {
      await page.getByRole('dialog').waitFor({state:'hidden'})
      await checks.text(page.getByRole('status'), 'INV-2041 changes saved')
      await page.waitForTimeout(400) // Let the recorded browser paint the settled result before ending the wait.
    })
    await rec.step('saved', 'The coding and note are saved', 'action', async () => {
      await rec.show({coding:{at:page.locator('table[aria-label="Invoices"] tbody tr').nth(0).locator('td').nth(3), text:'Office supplies September workshop setup'}})
    })
    await rec.step('select-first', 'Select INV-2041', 'action', () => rec.click(page.getByRole('checkbox',{name:'Select INV-2041',exact:true})))
    await rec.step('select-second', 'Select INV-2042', 'action', () => rec.click(page.getByRole('checkbox',{name:'Select INV-2042',exact:true})))
    await rec.step('open-preview', 'Open the approval preview', 'action', () => rec.click(page.getByRole('button',{name:'Review approval',exact:true})))
    await rec.step('preview', 'Check both invoices before approval', 'action', async () => {
      const preview=page.getByRole('region',{name:'Approval summary'})
      await checks.text(preview.locator('li').nth(0),'INV-2041 · Lumen Supply · $1,250.00')
      await checks.text(preview.locator('li').nth(1),'INV-2042 · Aster Services · $750.00')
      await rec.show({count:{at:preview.locator('div'),text:'2 invoices selected'},
        total:{at:preview.locator('strong'),dollarMinor:200000},
        invoices:{at:preview.locator('li'),count:2,target:preview.locator('ul')}})
    })
    await rec.step('confirm', 'Approve the two invoices', 'action', () => rec.click(page.getByRole('button',{name:'Approve 2 invoices',exact:true})))
    await rec.step('approving', 'Creating the approved batch', 'wait', async () => {
      await page.getByRole('dialog').waitFor({state:'hidden'})
      await checks.text(page.getByRole('status'),'2 invoices approved · $2,000.00 View batch')
      await page.waitForTimeout(400)
    })
    await rec.step('approved', 'Two invoices approved, $2,000.00', 'action', () => rec.show({approval:{at:page.getByRole('status'),text:'2 invoices approved · $2,000.00 View batch'}}))
    await rec.step('view-batch', 'Open the approved batch', 'action', () => rec.click(page.getByRole('button',{name:'View batch',exact:true})))
    await rec.step('reload', 'Reload to verify saved results', 'wait', async () => {
      await page.reload(); await checks.text(page.getByRole('heading',{name:'BATCH-1001',exact:true}),'BATCH-1001')
      await page.waitForTimeout(400)
    })
    await rec.step('batch', 'Two approved invoices, $2,000.00 total', 'action', async () => {
      await checks.count(page.locator('table[aria-label="Batch invoices"] tbody tr'),2)
      await rec.show(fields('Batch summary'))
    })
    await rec.step('retained', 'Invoice coding survives approval', 'action', () => rec.show({coding:{
      at:page.locator('table[aria-label="Batch invoices"] tbody tr').nth(0).locator('td').nth(1),
      text:'Office supplies September workshop setup'}}))
  },
}
