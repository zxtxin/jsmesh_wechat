// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
const db=cloud.database()
// 云函数入口函数
exports.main = async (event, context) => {
  let wxContext = cloud.getWXContext()
  function cloneObject(old) {
    let newNode = {}
    for (let key in old) {
      if (key != '_id'&&key!=='userInfo')//remove _id  key Error: errCode: -501007 ，errMsg: Invalid Key Name (_id)
        newNode[key] = old[key]
    }
    return newNode
  }

  let node= cloneObject(event)
  return  await db.collection('provisioned_nodes').doc(event._id).set({
    data:node
  })


}

