// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
let db = cloud.database()
// 云函数入口函数
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext()
    event._openid = event.openid
    //插入数据之前查询数据库中是否存在该节点
    let rsl = await db.collection('provisioned_nodes').where({name: event.node.name,_openid: event.node._openid}).get()
    if (rsl.data&&rsl.data.length>0) {
        let provisionedNode = rsl.data[0]
        //移除已存在节点
        await db.collection('provisioned_nodes').where({name: provisionedNode.name}).remove()
        //移除on_off_model_state 表中对应记录
        // await  db.collection('on_off_model_state').where({nodeName: provisionedNode.name,_openid:provisionedNode._openid}).remove()
        await  db.collection('on_off_model_state').where({uuid: provisionedNode.uuid}).remove()
    }

    return await db.collection('provisioned_nodes').add({
        data: event.node
    })
}
