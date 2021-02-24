// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
const db = cloud.database()
// 云函数入口函数
exports.main = async (event, context) => {
  // console.log(JSON.stringify(event))
    return await db.collection('provisioned_nodes').where({_openid: event.openid}).get()

}
