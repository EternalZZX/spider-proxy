"use strict"
const axios = require('axios')
const cheerio = require('cheerio')
const iconv = require('iconv-lite')

class TaskHandler {
  constructor () {
    this.categoryUrl = 'https://dc.3.cn/category/get'
    this.listUrl = 'list.jd.com/list.html'
    this.listDomain = ['list.jd.com', 'coll.jd.com']
  }

  async getProductIds (url) {
    const ids = new Set()
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)
    $('#J_main ul.gl-warp > li').each(function () {
      const id = $(this).data('sku') || $(this).find('> div').data('sku')
      ids.add(id)
    })
    return Array.from(ids)
  }

  async getCategory () {
    const response = await axios.get(this.categoryUrl, {
      responseType: 'arraybuffer'
    })
    const res = JSON.parse(iconv.decode(response.data, 'GBK'))
    return res.data.map(i => i.s.map(j => this.handleCategory(j)))
  }

  getListUrl (category) {
    const urls = []
    const fn = data => {
      if (!data.list) {
        return
      }
      for (const item of data.list) {
        this.isListUrl(item.link) && urls.push(item.link)
        fn(item)
      }
    }
    for (const i of category) {
      for (const j of i) {
        this.isListUrl(j.link) && urls.push(j.link)
        fn(j)
      }
    }
    return urls
  }

  isListUrl (url) {
    for (const domain of this.listDomain) {
      if (url.includes(domain)) {
        return true
      }
    }
    return false
  }

  handleCategory (data) {
    let [link, title] = data.n.split('|')
    link = /^[0-9\-]+$/.test(link)
      ? `https://${this.listUrl}?cat=${link.split('-').join(',')}`
      : `https://${link}`
    const res = { title, link }
    if (data.s && data.s.length) {
      res.list = data.s.map(item => this.handleCategory(item))
    }
    return res
  }
}

module.exports = TaskHandler
