// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
let db = cloud.database()
// 云函数入口函数
exports.main = async (event, context) => {
  let model=event.model
    //  insert
    return await db.collection('on_off_model_state').add({
      data:model
    })
}