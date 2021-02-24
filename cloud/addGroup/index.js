// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init()
let db = cloud.database()
// 云函数入口函数
exports.main = async (event, context) => {
    let group = event.group
    let rsl = await db.collection('groups').where({_openid: group._openid, address: group.address}).get()
    if (rsl.data && rsl.data.length > 0) {
        let result = await db.collection('groups').where({
            _openid: group._openid,
            address: group.address,
            addressName: group.addressName
        }).remove()
        if (result.stats.removed == 1) {
            return await db.collection('groups').add({data: group})
        }
    } else {
        return await db.collection('groups').add({data: group})
    }
}



