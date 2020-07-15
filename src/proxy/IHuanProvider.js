const cheerio = require('cheerio')
const BaseRequest = require('../BaseRequest')
const ProxyProvider = require('./ProxyProvider')

class IHuanProvider extends ProxyProvider {
  constructor () {
    super()
    this.url = 'https://ip.ihuan.me/today'
  }

  async getProxyAddress ({
    area = 'all',
    https = null,
    post = null,
    anonymous = null
  }) {
    const request = new BaseRequest()
    const response = await request.get(this._getTodayUrl())
    const $ = cheerio.load(response.data)
    const arr = $('.text-left').html().split('<br>')
    const filters = []
    area !== 'all' && filters.push(item => item.includes(this._string2Unicode(area)))
    https && filters.push(item => item.includes('HTTPS'))
    post && filters.push(item => item.includes('POST'))
    anonymous && filters.push(item => item.includes(this._string2Unicode('高匿')))
    return arr.reduce((pool, item) => {
      for (const fn of filters) {
        if (!fn(item)) {
          return pool
        }
      }
      const domain = item.split('@')[0].replace(/ /g, '')
      const t = domain.split(':')
      domain && pool.push({
        domain,
        host: t[0],
        port: t[1]
      })
      return pool
    }, [])
  }

  _getTodayUrl () {
    const now = new Date(new Date().getTime() - 10 * 60 * 1000)
    const year = now.getFullYear()
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const date = (now.getDate()).toString().padStart(2, '0')
    const hours = (now.getHours()).toString().padStart(2, '0')
    return `${this.url}/${year}/${month}/${date}/${hours}.html`
  }

  _string2Unicode (str) {
    return escape(str).replace(/%u([0-9A-Z]{4})/gi,'&#x$1;')
  }
}

module.exports = IHuanProvider
