// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
let db = cloud.database()
// 云函数入口函数
exports.main = async (event, context) => {
  // console.log("params:"+JSON.stringify(event))
  return await db.collection('groups').where({ _openid: event.openid}).get()
}