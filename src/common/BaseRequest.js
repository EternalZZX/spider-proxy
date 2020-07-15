"use strict"
const axios = require('axios')
const tunnel = require('tunnel')

class BaseRequest {
  constructor (proxy = null, headers = {}) {
    this.tunnelProxy = proxy ? tunnel.httpsOverHttp({ proxy }) : null
    this.$http = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:62.0) Gecko/20100101 Firefox/62.0',
        ...headers
      },
      proxy: false,
      httpsAgent: this.tunnelProxy,
      timeout: 30000
    })
  }

  async get (url, params = null, config = {}) {
    const CancelToken = axios.CancelToken
    const source = CancelToken.source()
    const timer = setTimeout(() => {
      source.cancel('Operation canceled by the user.')
    }, 30000);
    const response = await this.$http.get(url, {
      params,
      cancelToken: source.token,
      ...config
    })
    clearTimeout(timer)
    return response
  }
}

module.exports = BaseRequest
