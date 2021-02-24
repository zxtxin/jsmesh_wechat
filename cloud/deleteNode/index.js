// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()

// 云函数入口函数
const db = cloud.database()
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    //移除on_off_model_state 表中对应记录
    // if (event.uuid){
    //     await  db.collection('on_off_model_state').where({uuid: event.uuid}).remove()
    // }else {
    //     await  db.collection('on_off_model_state').where({nodeName: event.name}).remove()
    // }
    await  db.collection('on_off_model_state').where({uuid: event.uuid}).remove()

    return await db.collection('provisioned_nodes').doc(event._id).remove()
   

}

