const BaseRequest = require('../common/BaseRequest')

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

class ProxyPool {
  constructor (providers, options) {
    this.options = {
      ready: null,
      checkHandler: null,
      checkInterval: 5 * MINUTE,
      batchSize: 1000,
      batchInterval: 0,
      inspectInterval: 30 * MINUTE,
      updateInterval: 1 * HOUR,
      abortCount: 50,
      abortTime: 3 * DAY,
      provider: {
        https: true,
        post: true,
        anonymous: false
      },
      ...options
    }
    this.providers = providers
    this.activePool = new Map()
    this.inactivePool = new Map()
    this.iterator = this.activePool.values()
    this._ready = this.options.ready
    this._updateTimer = null
    this._inspectTimer = null
    this._checkCount = 0
    this._init()
  }

  _init () {
    console.log('[PROXY] Init')
    this.update()
    this._inspect()
    this._updateTimer = setInterval(() => this.update(), this.options.updateInterval)
    setInterval(() => {
      console.log('[PROXY] Active Pool:', this.activePool.size, 'Inactive Pool:', this.inactivePool.size, 'Checking:', this._checkCount)
    }, 10 * 1000);
  }

  async get (retry = 3) {
    if (retry <= 0) {
      return null
    }
    let proxy = this.iterator.next().value
    if (proxy) {
      proxy = await this._updateProxy(proxy)
      return proxy.status ? proxy : this.get(retry - 1)
    } else {
      this.iterator = this.activePool.values()
      return this.get(retry - 1)
    }
  }

  async check (proxy) {
    if (!this._isNeedCheck(proxy)) {
      return proxy.status
    }
    let status
    try {
      this._checkCount++
      const request = new BaseRequest(proxy)
      status = await this.options.checkHandler(request)
      console.log('[PROXY] Check:', status ? 'Active' : 'Refused', proxy.domain)
    } catch (err) {
      status = false
      console.log('[PROXY] Check: Inactive', err.message)
    } finally {
      this._checkCount--
    }
    return status
  }

  async update () {
    console.log('[PROXY] Provider Updating...')
    const providerPool = await Promise.all(
      this.providers.map(provider => provider.getProxyAddress(this.options.provider))
    )
    const pool = providerPool.flat()
    console.log('[PROXY] Provider Update:', pool.length)
    this._batchCheck(pool)
  }

  _inspect () {
    this._inspectTimer = setInterval(() => {
      console.log('[PROXY] Inspect Pool')
      const pool = Array.from(this.activePool).concat(Array.from(this.inactivePool))
      this._batchCheck(pool)
    }, this.options.inspectInterval)
  }

  async _batchCheck (pool, start = 0) {
    const end = start + this.options.batchSize
    await Promise.all(
      pool.slice(start, end)
        .map(proxy => this._updateProxy(proxy instanceof Array ? proxy[1] : proxy))
    )
    if (end < pool.length) {
      setTimeout(() => {
        this._batchCheck(pool, end)
      }, this.options.batchInterval)
    } else if (this.activePool.size && this._ready) {
      console.log('[PROXY] Ready')
      this._ready()
      this._ready = null
    }
  }

  async _updateProxy (proxy) {
    const domain = `${proxy.host}:${proxy.port}`
    proxy = this.activePool.get(domain) || this.inactivePool.get(domain) || proxy
    let status = proxy.status
    let lastCheck = proxy.lastCheck
    let activeCount = proxy.activeCount || 0
    let inactiveCount = proxy.inactiveCount || 0
    if (this._isNeedCheck(proxy)) {
      status = await this.check(proxy)
      status ? activeCount++ : inactiveCount++
      lastCheck = new Date().getTime()
    }
    proxy = {
      domain,
      host: proxy.host,
      port: proxy.port,
      status,
      activeCount,
      inactiveCount,
      lastCheck,
      lastActive: status ? lastCheck : proxy.lastActive || null
    }
    this._updatePool(proxy)
    return proxy
  }

  _updatePool (proxy) {
    if (proxy.status) {
      this.activePool.set(proxy.domain, proxy)
      this.inactivePool.has(proxy.domain) && this.inactivePool.delete(proxy.domain)
    } else {
      const now = new Date().getTime()
      if (proxy.inactiveCount < this.options.abortCount ||
        now - proxy.lastActive < this.options.abortTime) {
        this.inactivePool.set(proxy.domain, proxy)
      }
      this.activePool.has(proxy.domain) && this.activePool.delete(proxy.domain)
    }
  }

  _isNeedCheck (proxy) {
    const now = new Date().getTime()
    return !proxy.lastCheck || now - proxy.lastCheck >= this.options.checkInterval
  }
}

module.exports = ProxyPool
