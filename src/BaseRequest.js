"use strict"
const axios = require('axios')
const tunnel = require('tunnel')

class BaseRequest {
  constructor (proxy = null) {
    this.tunnelProxy = proxy ? tunnel.httpsOverHttp({ proxy }) : null
    this.$http = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36'
      },
      proxy: false,
      httpsAgent: this.tunnelProxy,
      timeout: 30000
    })
  }

  get (url, params = null, config = {}) {
    return this.$http.get(url, {
      params,
      ...config
    })
  }
}

module.exports = BaseRequest