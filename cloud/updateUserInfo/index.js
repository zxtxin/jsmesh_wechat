const cloud = require('wx-server-sdk')

cloud.init()
let db = cloud.database()
let wxContext;
exports.main = async (event, context) => {
    wxContext = cloud.getWXContext();
   let boundUser=await db.collection('user').where({primary_member:event.openid}).get()
    let boundedUser=await db.collection('user').where({primary_member:wxContext.OPENID}).get();
    //切换当前入网配置
    event.data.boundConfig=boundUser.data[0].config
    event.data.boundId=event.openid
    event.data.boundConfig.src=boundedUser.data[0].config.src
    await db.collection('user').doc(event._id).set({
     data: event.data
   })
    //return newest userinfo
    return await db.collection('user').doc(event._id).get()
}
