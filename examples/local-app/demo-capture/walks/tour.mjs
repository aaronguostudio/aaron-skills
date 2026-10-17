export default {
  title: 'A simple feature walkthrough',
  writes: false,
  async run({page,rec}) {
    await rec.step('overview','The feature is ready','action',async()=>rec.focus({heading:page.getByRole('heading',{name:'Demo App'})}))
    await rec.step('open','Open the result','action',async()=>rec.click(page.getByRole('button',{name:'Open result'})))
    await rec.step('load','Wait for the result','wait',async()=>page.getByRole('heading',{name:'Demo result'}).waitFor())
    await rec.step('result','Three example items are ready','action',async()=>{
      await rec.show({items:{at:page.getByRole('listitem'),count:3,target:page.getByRole('region',{name:'Result'})}})
    })
  },
}
