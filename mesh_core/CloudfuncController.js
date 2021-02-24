const CloudControllerInstance = (function () {
    let instance;

    function getInstance() {
        if (instance === undefined) {
            instance = new CloudController();
        }
        return instance;
    }


    return {
        getInstance: getInstance
    }
})();

function success(res) {
    return new Promise((resolve,reject) => {
        resolve(res)
    })
}

function fail(res) {
    return new Promise((resolve, reject) => {
        reject(res)
    })
}

function CloudController() {
    wx.cloud.init({
        env: 'mesh-demo'
    })
    let db = wx.cloud.database()
    let watchModel;
    let groupWacth;
    let nodesWatch;
    let provCfgWatch;
    let logger;
    this.setLogger = function (log) {
        logger = log;
    }

    function DEBUG(tag, info) {
        if (logger) {
            logger.DEBUG(tag, info);
        }
    }

    function ERROR(tag, info) {
        if (logger) {
            logger.ERROR(tag, info);
        }
    }

    this.closeModelWatch = function () {
        if (watchModel) {
            watchModel.close()
            console.log('close model wacth')
        }
    }
    this.closeGroupWatch = function () {
        if (groupWacth) {
            groupWacth.close()
            console.log('close group wacth')
        }
    }
    this.closeNodesWatch = function () {
        if (nodesWatch) {
            nodesWatch.close()
            console.log('close nodes wacth')
        }
    }
    this.closeProCfgWatch = function () {
        if (provCfgWatch) {
            provCfgWatch.close()
            console.log('close provCfg wacth')
        }
    }
    this.listenModelChange = function (openid, cb) {
        watchModel = db.collection('on_off_model_state').where({
            _openid: openid

        }).watch({
            onChange: function (snapshot) {
                if (cb)
                    cb(snapshot)
            },
            onError: function (err) {
                ERROR('listenModelChange', JSON.stringify(err));
            }
        })
    }

    this.listenGroupChange = function (openid, cb) {
        groupWacth = db.collection('groups').where({
            _openid: openid
        }).watch({
            onChange: function (snapshot) {
                if (cb)
                    cb(snapshot)
            },
            onError: function (err) {
                ERROR('listenGroupChange', JSON.stringify(err))
            }
        })
    }
    this.listenNodeChange = function (openid, cb) {
        nodesWatch = db.collection('provisioned_nodes').where({
            _openid: openid
        }).watch({
            onChange: function (snapshot) {
                if (cb)
                    cb(snapshot)
            },
            onError: function (err) {
                ERROR('listenNodeChange', err)
            }
        })
    }
    this.listenProvCfgChange = function (openid, cb) {
        nodesWatch = db.collection('user').where({
            primary_member: openid
        }).watch({
            onChange: function (snapshot) {
                if (cb)
                    cb(snapshot)
            },
            onError: function (err) {
                ERROR('listenProvCfgChange', err)
            }
        })
    }
    this.insertNode = function (openid, node) {
        node._openid = openid
        DEBUG('insertNode cloud', JSON.stringify({node, openid}));
        return wx.cloud.callFunction({name: 'insertNode', data: {node, openid}}).then(res => {
            node._id = res.result._id
            DEBUG('insertNode success', JSON.stringify(node));
            return success(node)
        }).catch(res => {
            ERROR('insertNode fail', JSON.stringify(res))
            return fail(res)
        })
    }
    this.deleteNode = function (node) {
        return wx.cloud.callFunction({
            name: 'deleteNode',
            data: {_id: node._id, name: node.name,uuid:node.uuid}
        }).then(res => {
            DEBUG('deleteNode success', JSON.stringify(res))
            return success(res)
        }).catch(res => {
            ERROR('deleteNode fail', JSON.stringify(res))
            return fail(res)
        })
    }

    this.updateNode = function (node) {
        return wx.cloud.callFunction({name: 'updateNode', data: node}).then(res => {
            DEBUG('updateNode success', JSON.stringify(res))
            return success(res)
        }).catch(res => {
            ERROR('updateNode fail', JSON.stringify(res))
            return fail(res)
        })
    }
    this.initUser = function (userInfo) {
        return wx.cloud.callFunction({
            name: 'userInit',
            data:{userInfo}
        }).then(res => {
            DEBUG('initUser success', JSON.stringify(res))
            return success(res.result.data[0])
        }).catch(res => {
            ERROR('initUser fail', JSON.stringify(res))
            return fail(res)
        })
    }
    this.selectProvisionedNodes = function (openid) {
        return wx.cloud.callFunction({
            name: 'selectNodes',
            data: {openid: openid}

        }).then(res => {
            DEBUG('selectProvisionedNodes success', JSON.stringify(res))
            return success(res.result.data)
        }).catch(res => {
            ERROR('selectProvisionedNodes fail', JSON.stringify(res))
            return fail(res)
        })
    }
    this.bindUser = function (openid, userinfo) {
        let newobj = cloneObject(userinfo);
        DEBUG('bindUser', JSON.stringify(newobj));
        return wx.cloud.callFunction({
            name: 'updateUserInfo',
            data: {data: newobj, _id: userinfo._id, openid: openid}
        }).then(res => {
            DEBUG('bindUser success..', JSON.stringify(res));
                return success(res.result.data);

        }).catch(res => {
            ERROR('bindUser fail', JSON.stringify(res));
            return fail(res);
        })
    };

    this.unbindUser = function () {
        DEBUG('unbindUser', '');
        return wx.cloud.callFunction({
            name: 'unbindMember',
            data: { openid: ''}
        }).then(res => {
            DEBUG('unbindUser success..', JSON.stringify(res));
            return success(res.result.data);

        }).catch(res => {
            ERROR('unbindUser fail', JSON.stringify(res));
            return fail(res);
        })
    };
    this.updateConfig = function (value, _id) {
        return wx.cloud.callFunction({
            name: 'updateConfigInfo',
            data: {data: value, _id: _id}
        }).then(res => {
            DEBUG('updateConfig success', JSON.stringify(res))
            return success(res)
        }).catch(res => {
            ERROR('updateConfig fail', JSON.stringify(res))
            return fail(res)
        })
    }
    this.selectGroups = function (openid) {
        return wx.cloud.callFunction({
            name: 'selectGroups',
            data: {openid: openid}
        }).then(res => {
            DEBUG('selectGroups success', JSON.stringify(res))
            return success(res.result.data)
        }).catch(res => {
            ERROR('selectGroups fail', JSON.stringify(res))
            return fail(res)
        })
    }
    this.addGroup = function (group) {
        return wx.cloud.callFunction({
            name: 'addGroup',
            data: {group: group}
        }).then(res => {
            DEBUG('addGroup success', JSON.stringify(res))
            return success(res)

        }).catch(res => {
            ERROR('addGroup fail', JSON.stringify(res))
            return fail(res)
        })
    }
    this.deleteGroup = function (group) {
        return wx.cloud.callFunction({
            name: 'deleteGroup',
            data: {_id: group._id}
        }).then(res => {
            DEBUG('deleteGroup success', JSON.stringify(res))
            return success(res)

        }).catch(res => {
            ERROR('deleteGroup fail', JSON.stringify(res))
            return fail(res)
        })
    }
    this.insertOnOffModel = function (openid, model) {
        return wx.cloud.callFunction({
            name: 'insertOnOffModel',
            data: {model}
        }).then(res => {
            DEBUG('insertOnOffModel success', JSON.stringify(res))
            return success(res)

        }).catch(res => {
            ERROR('insertOnOffModel fail', JSON.stringify(res))
            return fail(res)
        })

    }
    this.updateModelStateCloud = function (openid, model) {
        model._openid = openid
        model = cloneObjectWithoutfiledId(model)
        return wx.cloud.callFunction({
            name: 'updateOnOffModel',
            data: {model}
        }).then(res => {
            DEBUG('updateModelState success', JSON.stringify(res))
            return success(res)

        }).catch(res => {
            ERROR('updateModelState fail', JSON.stringify(res))
            return fail(res)
        })

    }

    this.selectModelsCloud = function (node) {
        return wx.cloud.callFunction({
            name: 'selectOnOffModels',
            data: {node}
        }).then(res => {
            DEBUG('selectOnOffModels success', JSON.stringify(res))
            return success(res)

        }).catch(res => {
            ERROR('selectOnOffModels fail', JSON.stringify(res))
            return fail(res)
        })
    }

    function cloneObject(obj) {
        let newobj = {}
        for (let key in obj) {
            if (key != '_id')
                newobj[key] = obj[key]
        }
        return newobj
    }
}


function cloneObjectWithoutfiledId(old) {
    let obj = {}
    for (let key in old) {
        if (key != '_id')//remove _id  key Error: errCode: -501007 ，errMsg: Invalid Key Name (_id)
            obj[key] = old[key]
    }
    return obj
}

module.exports = CloudControllerInstance;