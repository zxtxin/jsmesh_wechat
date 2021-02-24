// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()

// 云函数入口函数
exports.main = async (event, context) => {
    let db = cloud.database()
    let node=event.node
  // let condition = { _openid: node._openid, nodeName: node.name }
    let condition = { _openid: node._openid }
  return await db.collection('on_off_model_state').where(condition).get()

}