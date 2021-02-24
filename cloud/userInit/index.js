// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init()
let wxContext


exports.main = async (event, context) => {
    let db = cloud.database()
    wxContext = cloud.getWXContext()
    let userInfo = await db.collection('user').where({primary_member: wxContext.OPENID}).get()
    let data = userInfo.data
    if (data && data.length > 0) {
        // 当前用户已经初始化  直接返回该用户信息
        if (!userInfo.data[0].userInfo){
            userInfo.data[0].userInfo=event.userInfo
            res= await  db.collection('user').doc({_id: userInfo.data[0]._id}).update({data:{userInfo:event.userInfo}})
            return await  db.collection('user').where({primary_member: wxContext.OPENID}).get()
        }else{
            return new Promise(resolve => {
                resolve(userInfo)
            })
        }

    } else {
        //查询当前用户openid 对应src
        let srcAddress = await db.collection('src').where({openid:wxContext.OPENID}).get()
        let src
        //查询到该用户对应的src
        if (srcAddress.data.length != 0) {
            src = (srcAddress.data[0].src )
        } else {
            //src 表中不存在该用户记录  倒叙查询所有src记录
            let srcAddress = await db.collection('src').orderBy('src', 'desc').get()
            if (srcAddress.data.length != 0) {
                //查询到最后一个用户src 当前用户src=src+1
                src = (srcAddress.data[0].src + 1)//range:0x0001~0xffff
            }else {
                //src 表中无数据，说明当前用户是第一个
               src=0x0001
            }
            await db.collection('src').add({data: {src,openid:wxContext.OPENID}})

        }
        //在用户表中加入一条当前用户数据(添加新用户)
        let config = await db.collection('provision_config').get()
        let provisionConfig = config.data[0]
        let netkeys = []
        let appkeys = []
        netkeys.push(createNetKey())
        appkeys.push(createAppKey())
        provisionConfig.networKey = netkeys
        provisionConfig.appKeys = appkeys
        let obj = clone(config.data[0])
        obj.src = src
        await db.collection('user').add({
            data: {
                config: obj,
                child_member: [],
                primary_member: wxContext.OPENID,
                userInfo:event.userInfo
            }
        })
        return await db.collection('user').where({primary_member: wxContext.OPENID}).get()

    }
}

function clone(old) {
    let newObj = {}
    for (let key in old) {
        if (key != '_id')
            newObj[key] = old[key]
    }
    return newObj
}

function toASCIIArray(string) {
    let asciiKeys = [];
    for (let i = 0; i < string.length; i++)
        asciiKeys.push(string[i].charCodeAt(0));
    return asciiKeys;
}

function ab2hex(buffer) {
    var hexArr = Array.prototype.map.call(
        new Uint8Array(buffer),
        function (bit) {
            return ('00' + bit.toString(16)).slice(-2)
        }
    )
    return hexArr.join('');
}

function createNetKey() {
    let openid = wxContext.OPENID
    return ab2hex(toASCIIArray(openid).slice(6, 22))
}

function createAppKey() {
    let openid = wxContext.OPENID
    return ab2hex(toASCIIArray(openid).slice(6, 22).reverse())
}