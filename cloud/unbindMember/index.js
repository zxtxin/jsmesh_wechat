const cloud = require('wx-server-sdk')
cloud.init();
let db = cloud.database();
let wxContext;
exports.main = async (event, context) => {
  wxContext = cloud.getWXContext();
    let boundUser = await db.collection('user').where({primary_member: wxContext.OPENID}).get();
    //解除绑定
    delete boundUser.data[0].boundConfig;
    delete boundUser.data[0].boundId;
    let _id=boundUser.data[0]._id;
    delete boundUser.data[0]._id;
    return await db.collection('user').doc(_id).set({
        data: boundUser.data[0]
    })

}