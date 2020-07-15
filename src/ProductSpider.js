"use strict"
const axios = require('axios')
const cheerio = require('cheerio')
const iconv = require('iconv-lite')

class ProductSpider {
  constructor (id, area) {
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
    return this.getProduct()
  }

  async getProduct () {
    const response = await axios.get(this.pageUrl)
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
  }

  async getProductPrice (data) {
    const response = await axios.get(this.priceUrl, {
      params: {
        skuIds: data.id
      }
    })
    return Number(response.data[0].p) * 100
  }

  async getCoupon (data) {
    const response = await axios.get(this.couponUrl, {
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
    const response = await axios.get(this.commentUrl, {
      params: {
        productId: data.id,
        score: 0,
        sortType: 5,
        page: 0,
        pageSize: 10
      },
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
  }
}

module.exports = ProductSpider
