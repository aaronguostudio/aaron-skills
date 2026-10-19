export default {
  contract: 1,
  name: 'showcase-ledgerlane',
  environments: {
    local: {url: 'http://127.0.0.1:4231', production: false, hosts: ['127.0.0.1'], writeGoAhead: true},
  },
  signInPath: '/login',
  isSignedOut: url => new URL(url).pathname === '/login',
  async beforeStep({page}) {
    await page.getByText('Jamie Example · Demo reviewer', {exact: true}).waitFor({state: 'visible'});
  },
};
