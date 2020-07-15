const BaseRequest = require('../BaseRequest')

class ProxyPool {
  constructor (providers, options) {
    this.options = {
      checkFunction: null,
      checkInterval: 5 * 60 * 1000,
      batchSize: 1000,
      batchInterval: 0,
      inspectInterval: 30 * 60 * 1000,
      updateInterval: 60 * 60 * 1000,
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
    this._updateTimer = null
    this._inspectTimer = null
    this._checkCount = 0
    this._init()
  }

  _init () {
    console.log('=== PROXY POOL INIT ===')
    this.update()
    this._inspect()
    this._updateTimer = setInterval(() => this.update(), this.options.updateInterval)
    setInterval(() => {
      console.log('ACTIVE POOL:', this.activePool.size, 'INACTIVE POOL:', this.inactivePool.size, 'CHECKING:', this._checkCount)
    }, 10 * 1000);
  }

  get () {

  }

  async check (proxy) {
    if (!this._isNeedCheck(proxy)) {
      return proxy.status
    }
    let status
    try {
      this._checkCount++
      const request = new BaseRequest(proxy)
      status = await this.options.checkFunction(request)
      console.log('CHECK RES:', status ? 'SUCCESS' : 'REFUSED')
    } catch (err) {
      status = false
      console.log('CHECK ERR:', err.message)
    } finally {
      this._checkCount--
    }
    return status
  }

  async update () {
    console.log('=== UPDATE PROVIDER ADDRESS ===')
    const providerPool = await Promise.all(
      this.providers.map(provider => provider.getProxyAddress(this.options.provider))
    )
    console.log('=== UPDATE PROVIDER ADDRESS FINISH ===')
    console.log('=== BATCH CHECK ===')
    this._batchCheck(providerPool.flat())
  }

  _inspect () {
    this._inspectTimer = setInterval(() => {
      console.log('=== INSPECT POOL ===')
      const pool = Array.from(this.activePool).concat(Array.from(this.inactivePool))
      console.log('=== BATCH CHECK ===')
      this._batchCheck(pool)
    }, this.options.inspectInterval)
  }

  async _batchCheck (pool, start = 0) {
    const end = this.options.batchSize + start
    const len = pool.length
    await Promise.all(
      pool.slice(start, end)
        .map(async proxy => {
          if (proxy instanceof Array) {
            proxy = proxy[1]
          }
          const domain = `${proxy.host}:${proxy.port}`
          proxy = this.activePool.get(domain) || this.inactivePool.get(domain) || proxy
          let status = proxy.status
          let activeCount = proxy.activeCount || 0
          let inactiveCount = proxy.inactiveCount || 0
          if (this._isNeedCheck(proxy)) {
            status = await this.check(proxy)
            status ? activeCount++ : inactiveCount++
          }
          proxy = {
            domain,
            host: proxy.host,
            port: proxy.port,
            status,
            activeCount,
            inactiveCount,
            lastCheck: new Date().getTime()
          }
          this._updatePool(proxy)
          return proxy
        })
    )
    end < len 
      ? setTimeout(() => {
        this._batchCheck(pool, end)
      }, this.options.batchInterval)
      : console.log('=== BATCH CHECK FINISH ===')
  }

  _updatePool (proxy) {
    if (proxy.status) {
      this.activePool.set(proxy.domain, proxy)
      this.inactivePool.has(proxy.domain) && this.inactivePool.delete(proxy.domain)
    } else {
      this.inactivePool.set(proxy.domain, proxy)
      this.activePool.has(proxy.domain) && this.activePool.delete(proxy.domain)
    }
  }

  _isNeedCheck (proxy) {
    const now = new Date().getTime()
    return !proxy.lastCheck || now - proxy.lastCheck >= this.options.checkInterval
  }
}

module.exports = ProxyPool
