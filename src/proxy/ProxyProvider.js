class ProxyProvider {
  constructor () {
    if (new.target === ProxyProvider) {
      throw new TypeError("Cannot construct ProxyProvider instances directly")
    }
    this.pool = []
  }

  getProxyAddress ({
    area = 'all',
    https = null,
    post = null,
    anonymous = null,
    lastCheck = null
  }) {
    throw new Error('Cannot call abstract method')
  }
}

module.exports = ProxyProvider
