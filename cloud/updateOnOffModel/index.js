// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
let db = cloud.database()
// 云函数入口函数
exports.main = async (event, context) => {
    let model=event.model
      let rsl=await db.collection('on_off_model_state').where({_openid:model.openid,name:model.name,elementAddress:model.elementAddress,modelId:model.modelId}).get()
      if (rsl.data&&rsl.data.length>0) {
         return await db.collection('on_off_model_state').doc(rsl.data[0]._id).set({
                data:model
          })
      }else {
          //  insert
          return await db.collection('on_off_model_state').add({
              data:model
          })
      }
}