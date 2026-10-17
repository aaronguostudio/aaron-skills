export default {
  contract: 1,
  name: 'demo-example',
  environments: {local: {url: process.env.AARON_DEMO_EXAMPLE_URL || 'http://127.0.0.1:3005', production: false, hosts: ['127.0.0.1']}},
  signInPath: '/',
  isSignedOut: () => false,
  revision: async () => 'public-example-1',
}
