// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
let db = cloud.database()
// 云函数入口函数
exports.main = async (event, context) => {
  //查询当前用户信息
  let res=await db.collection('user').where({ primary_member: cloud.getWXContext().OPENID}).get()
  let user=res.data[0]
  let value
  if (isBound(user)){
    //设置绑定用户信息
    async  function update_primary_member(boundId,boundConfig) {

      let res = await db.collection('user').where({primary_member: boundId}).get()
      let user_primary = res.data[0];
      let prev_unicastAddress = parseInt(user_primary.config.unicastAddress, 16);
      let cur_unicastAddress = parseInt(boundConfig.unicastAddress, 16);
      if (cur_unicastAddress > prev_unicastAddress) {
        //同步更新unicastAddress
        await db.collection('user').where({primary_member: boundId}).update({
          data: {
            config: {
              unicastAddress: boundConfig.unicastAddress
            }
          }
        });
      }
    }
    //设置SRC 避免重放攻击
    event.data.src=user.config.src;
    value={boundConfig:event.data};
    await update_primary_member(user.boundId,event.data);
  }else {
    //设置未绑定信息
    value={config:event.data}
  }
  return  await db.collection('user').doc(user._id).update({
    data: value
  })


}

// 判断是否绑定其他用户
function isBound(user) {
  return typeof (user.boundConfig)!=='undefined'
}
