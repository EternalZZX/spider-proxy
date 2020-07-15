"use strict"
const cheerio = require('cheerio')
const iconv = require('iconv-lite')
const BaseRequest = require('../common/BaseRequest')

class ProductSpider {
  constructor (proxyPool, id, area) {
    this.proxyPool = proxyPool
    this.pageUrl = `https://item.jd.com/${id}.html`
    this.priceUrl = 'https://p.3.cn/prices/mgets'
    this.imageUrl = 'https://img11.360buyimg.com'
    this.couponUrl = 'https://cd.jd.com/promotion/v2',
    this.commentUrl = 'https://club.jd.com/comment/skuProductPageComments.action'
    this.data = {
      id,
      area
    }
    this.el = null
    this.request = null
    return this.init()
  }

  async init () {
    const proxy = await this.proxyPool.get()
    if (!proxy) {
      return null
    }
    this.request = new BaseRequest(proxy, {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Cache-Control': 'max-age=0',
      'DNT': '1',
      'if-modified-since': 'Wed, 15 Jul 2020 08:40:10 GMT',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1'
    })
    return this.getProduct()
  }

  async getProduct () {
    try {
      const response = await this.request.get(this.pageUrl)
      console.log(response.data)
      const $ = cheerio.load(response.data)
      this.el = $
      const config = eval(`(${
        $('script').html()
          .split(/;\s*try/)[0]
          .match(/(?<=var\ pageConfig\ =\ )[\s\S]*/)[0]
      })`).product
      const data = {
        ...this.data,
        name: config.name,
        cat: config.cat.join(','),
        venderId: config.venderId,
        shopId: config.shopId,
        image: config.src,
        images: config.imageList,
        type: this.getProductType(config)
      }
      const [price, coupons, comment] =  await Promise.all([
        this.getProductPrice(data),
        this.getCoupon(data),
        this.getProductComment(data)
      ])
      data.price = price
      data.coupons = coupons
      data.comment = comment
      data.finalPrice = this.getFinalPrice(data)
      data.specs = this.getProductSpecs()
      data.packageList = this.getPackageList()
      data.isOfficial = this.isOfficial()
      data.isActive = this.isActive()
      this.getProductComment
      this.data = data
      return this.data
    } catch (err) {
      console.log('GET-JD-PRODUCT:', err.message)
      return null
    }
  }

  async getProductPrice (data) {
    try {
      const response = await this.request.get(this.priceUrl, {
        params: {
          skuIds: data.id
        }
      })
      return Number(response.data[0].p) * 100
    } catch (err) {
      console.log('GET-JD-PRICE:', err.message)
      return 0
    }
  }

  async getCoupon (data) {
    try {
      const response = await this.request.get(this.couponUrl, {
        params: {
          skuId: data.id,
          area: data.area,
          cat: data.cat,
          venderId: data.venderId,
          shopId: data.shopId
        }
      })
      return response.data.skuCoupon.map(coupon => ({
        quota: coupon.quota * 100,
        discount: coupon.discount * 100,
        trueDiscount: coupon.trueDiscount * 100
      }))
    } catch (err) {
      console.log('GET-JD-COUPON:', err.message)
      return []
    }
  }

  getFinalPrice (data) {
    let finalPrice = data.price
    for (const coupon of data.coupons) {
      if (!coupon.quota || finalPrice >= coupon.quota) {
        finalPrice -= coupon.trueDiscount || coupon.discount
        break
      }
    }
    return finalPrice
  }

  getImageUrl (url, size = 1) {
    return `${this.imageUrl}/n${size}/${url}`
  }

  getProductType (config) {
    return config.colorSize
      ? config.colorSize.map(item => {
        const type = {
          id: item.skuId
        }
        if (item['颜色']) {
          type.color = item['颜色']
        }
        if (item['尺码']) {
          type.size = item['尺码']
        }
        return type
      })
      : []
  }

  getProductSpecs () {
    const $ = this.el
    const specs = []
    $('.Ptable .Ptable-item').each(function () {
      const data = {
        title: $(this).find('> h3').text(),
        items: []
      }
      $(this).find('> dl dl').each(function () {
        data.items.push({
          label: $(this).find('dt').text(),
          value: $(this).find('dd:not(.Ptable-tips)').text()
        })
      })
      specs.push(data)
    })
    return specs
  }

  getPackageList () {
    const $ = this.el
    const packageList = $('.package-list')
    return {
      label: packageList.find('> h3').text(),
      value: packageList.find('> p').text()
    }
  }

  isOfficial () {
    const $ = this.el
    return $('.goodshop .u-jd').length === 1
  }

  isActive () {
    const $ = this.el
    return !$('.itemover-tip').length
  }

  async getProductComment (data) {
    try {
      const response = await this.request.get(this.commentUrl, {
        productId: data.id,
        score: 0,
        sortType: 5,
        page: 0,
        pageSize: 10
      }, {
        responseType: 'arraybuffer'
      })
      const res = JSON.parse(iconv.decode(response.data, 'GBK'))
      const summary = res.productCommentSummary
      const tags = res.hotCommentTagStatistics
      return {
        commentCount: summary.commentCount,
        defaultGoodCount: summary.defaultGoodCount,
        goodCount: summary.goodCount,
        goodRate: summary.goodRate,
        generalCount: summary.generalCount,
        generalRate: summary.generalRate,
        poorCount: summary.poorCount,
        poorRate: summary.poorRate,
        score1Count: summary.score1Count,
        score2Count: summary.score2Count,
        score3Count: summary.score3Count,
        score4Count: summary.score4Count,
        score5Count: summary.score5Count,
        tags: tags.map(item => {
          return {
            name: item.name,
            count: item.count
          }
        })
      }
    } catch (err) {
      console.log('GET-JD-COOMMENT:', err.message)
      return {}
    }
  }
}

module.exports = ProductSpider
