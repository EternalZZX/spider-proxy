const axios = require('axios')
const TaskHandler = require('./src/TaskHandler')
const ProductSpider = require('./src/ProductSpider')
const ProxyPool = require('./src/proxy/ProxyPool')
const IHuanProvider = require('./src/proxy/IHuanProvider')

function main () {
  // printProductData('57842141382', '1_2800_55811_0')
  // printCategoryData()
  // printUrlData()
  const proxyPool = new ProxyPool([
    new IHuanProvider()
  ], {
    async checkFunction (req) {
      const CancelToken = axios.CancelToken
      const source = CancelToken.source()
      const timer = setTimeout(() => {
        source.cancel('Operation canceled by the user.')
      }, 30000);
      const response = await req.get('https://dc.3.cn/category/get', null, {
        cancelToken: source.token
      })
      clearTimeout(timer)
      return response && response.data && response.data.data instanceof Array
    }
  })
  // new IHuanProvider().getProxyAddress({ https: true, post: true, anonymous: true })
  // const request = new BaseRequest({
  //   host: '122.136.212.132',
  //   port: 53281
  // })
  // request.get('https://dc.3.cn/category/get').then(res => {
  //   console.log('res:', res.data)
  // }).catch(err => {
  //   console.log('name:', err.name)
  //   console.log('message:', err.message)
  // })
}

async function printUrlData () {
  const task = new TaskHandler()
  const list = await task.getCategory()
  const urls = task.getListUrl(list)
  const ids = await task.getProductIds('https://coll.jd.com/list.html?sub=38826')
  console.log(ids)
}

async function printCategoryData () {
  const task = new TaskHandler()
  const list = await task.getCategory()
  function fn (data, level = 0) {
    if (!data.list) {
      return
    }
    const space = ' '.repeat(level * 2)
    for (const item of data.list) {
      console.log(`${space}${item.title}:${item.link}`)
      fn(item, level + 1)
    }
  }
  for (const i of list) {
    for (const j of i) {
      console.log(`${j.title}:${j.link}`)
      fn(j, 1)
    }
  }
}

async function printProductData (id, area) {
  const product = await new ProductSpider(id, area)
  console.log('名称: ', `${product.isOfficial ? '【自营】' : ''}`, product.name)
  if (product.isActive) {
    console.log('原价: ', product.price)
    console.log('最终价格: ', product.finalPrice)
  } else {
    console.log('已下架')
  }
  if (product.type.length) {
    console.log('型号: ')
    for (const type of product.type) {
      console.log(`${type.color} ${type.size} (${type.id})`)
    }
  }
  for (const spec of product.specs) {
    console.log(`【${spec.title}】`)
    for (const item of spec.items) {
      console.log(`${item.label}: ${item.value}`)
    }
  }
  console.log(`${product.packageList.label}: ${product.packageList.value}`)
  console.log(`【商品评价】`)
  for (const tag of product.comment.tags) {
    console.log(`${tag.name}(${tag.count})`)
  }
  console.log(`评论数: ${product.comment.commentCount} (默认评价 ${product.comment.defaultGoodCount} 条)`)
  console.log(`好评率: ${product.comment.goodRate} (${product.comment.goodCount})`)
  console.log(`中评率: ${product.comment.generalRate} (${product.comment.generalCount})`)
  console.log(`差评率: ${product.comment.poorRate} (${product.comment.poorCount})`)
  console.log(`五星: ${product.comment.score5Count}`)
  console.log(`四星: ${product.comment.score4Count}`)
  console.log(`三星: ${product.comment.score3Count}`)
  console.log(`两星: ${product.comment.score2Count}`)
  console.log(`一星: ${product.comment.score1Count}`)
}

if (require.main === module) {
  main()
}
