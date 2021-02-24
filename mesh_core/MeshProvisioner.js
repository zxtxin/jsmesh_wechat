import {parseElementAddress} from "../utils/util";
import {CONFIG_FILED_NULL} from "./errorCode";

let ErrorMessage = require('./ErrorMessage');
const Cloud = require('./CloudfuncController').getInstance();
const ProvisionerInstance = (function () {
    let instance;

    function getInstance() {
        if (instance === undefined) {
            instance = new MeshProvisioner();
        }
        return instance;
    }

    return {
        getInstance: getInstance
    }

})()

function MeshProvisioner() {
    let that = this;
    let curNode;
    let logger;
    let OnOffObserver;
    let recall;
    that. wxUserinfo= new function () {
        let value;

        this.set = function (info) {
            value = info
        };
        this.get = function () {
            return value;

        }
        return this;
    }
    that.setLogger = function (log) {
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

    recall = new function () {
        return debounce(Cloud.updateConfig, 1500)
    };
    that.init = function () {
        // Cloud = cloud;
        Cloud.initUser(that.wxUserinfo.get()).then(that.config.set).then(isBound).then(curOpenid).then(openid => {
            // let openid=res.id
            isBound(that.config.get()).then(bound=>{
                if(bound){
                    that.config.get().boundConfig.ivIndex='00000000';//test code
                }else{
                    that.config.get().config.ivIndex='00000000';//test code
                }

            }).catch(reason => {});

            DEBUG("id:", openid);
            if (that.configDataObserver.get()) {
                that.configDataObserver.get()();
            }
            initWatcher(openid);
            selectNodes(openid).then(res => {
                that.nodes.set(res)
                notifyNodesChange()
            }).catch(reason => {
                ERROR('selectNodes ', JSON.stringify(reason))
            });
            selectGroups(openid).then(res => {
                that.groups.set(res)
                notifyGroupsChange()
            }).catch(reason => {
                ERROR('selectGroups', JSON.stringify(reason))
            });

        });
    };
    that.config = new function () {
        let config;
        this.set = function (res) {
            DEBUG('config set', JSON.stringify(res))
            return new Promise(resolve => {
                config = res;
                resolve(config)
            })

        }
        this.get = function () {
            return config;
        }
        return this;
    };
    that.isBoundOthers=function(){
        return isBound(that.config.get());
    };
    that.getMeshConfig = function () {
        DEBUG('getMeshConfig', '')
        return curConfig();
    }
    that.setCurNode = function (arg) {
        DEBUG('setCurNode', JSON.stringify(arg))
        if (arg) {
            if (typeof (arg) === "string") {
                that.nodes.get().map(item => {
                    if (item.name === arg) {
                        curNode = item;
                    }
                })
            } else {
                curNode = arg
            }
        }

    }
    that.getCurNode = function () {
        return curNode;
    };

    function dataFactory() {
        let data = [];
        this.set = function (res) {
            data = res;
        }
        this.get = function () {
            return data
        }
        return this;
    }

    function observerFactory() {
        let listener;
        this.set = function (res) {
            listener = res;
        };
        this.get = function () {
            return listener
        };
        return this;
    }

    that.nodes = new dataFactory();
    that.groups = new dataFactory();
    that.groupDataObserver = new observerFactory();
    that.nodeDataObserver = new observerFactory();
    that.configDataObserver = new observerFactory();

    function notifyNodesChange() {
        if (that.nodeDataObserver.get())
            that.nodeDataObserver.get()()
    };

    function notifyGroupsChange() {
        if (that.groupDataObserver.get())
            that.groupDataObserver.get()()
    };

    function isBound(res) {
        return new Promise(resolve => {
            resolve(res.boundConfig);
        })
    };

    function curConfig() {
        if (that.config.get().boundConfig) {
            return that.config.get().boundConfig;
        } else {
            return that.config.get().config;
        }

    };

    function getOpenid() {
        if (that.config.get().boundConfig) {
            return that.config.get().boundId;
        } else {
            return that.config.get().primary_member;
        }
    }

    function curOpenid(bound) {
        return new Promise((resolve, reject) => {
            let id;
            if (bound) {
                id = that.config.get().boundId;
            } else {
                id = that.config.get().primary_member;
            }
            resolve(id)
        });
    }

    that.openid = function () {
        return isBound(that.config.get()).then(curOpenid)
    }
    that.reSlectNodes = function () {
        isBound(that.config.get()).then(curOpenid).then(selectNodes).then(res => {
            that.nodes.set(res)
            notifyNodesChange()
        }).catch(reason => {
        })
    }
    that.reSelectGroups = function () {
        isBound(that.config.get()).then(curOpenid).then(selectGroups).then(res => {
            notifyGroupsChange()
        }).catch(reason => {
        })
    }

    function selectNodes(openid) {
        return Cloud.selectProvisionedNodes(openid).catch(reason => {
            ERROR('selectProvisionedNodes', JSON.stringify(reason))
        });
    };

    function selectGroups(openid) {
        return Cloud.selectGroups(openid).then(res => {
            that.groups.set(res)
            return success(res);
        }).catch(reason => {
            ERROR('selectGroups', JSON.stringify(reason))
        })
    }

    function addGroupCloud(group) {
        return Cloud.addGroup(group)
    }

    function insertNode2Cloud(node) {
        isBound(that.config.get()).then(curOpenid).then(openid => {
            DEBUG('insertNode before', JSON.stringify(openid))
            Cloud.insertNode(openid, node).then(res => {
                DEBUG('insertNode', JSON.stringify(res))
            }).catch(reason => {
                ERROR('insertNode', JSON.stringify(reason))
            })
        })
    }

    function deleteNodeCloud() {
        Cloud.deleteNode(arguments[0]).then(res => {
        }).catch(reason => {
            ERROR('deleteNode ', JSON.stringify(reason))
        })
    }

    function updateNodeCloud(node) {

        Cloud.updateNode(node).then(res => {
        }).catch(reason => {
            ERROR('updateNode fail:', JSON.stringify(reason))
        })
    };
    that.addGroup = function (group) {
        isBound(that.config.get()).then(curOpenid).then(openid => {
            group._openid = openid;
            addGroupCloud(group).then(result => {
                console.log(JSON.stringify(result))
                group._id = result._id
                that.reSelectGroups(openid)
            }).catch(reason => {
                ERROR('addGroupCloud ', JSON.stringify(reason))
            })
        })
    };
    that.deleteGroup = function (group) {
        Cloud.deleteGroup(group).then(res => {
            that.reSelectGroups()
        }).catch(reason => {
            ERROR('delete group fail!', JSON.stringify(reason))
        })
    };

    that.insertNode = function (node) {
        let nodes = that.nodes.get()
        let newNodes = []
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].deviceId === node.deviceId) {
                // if (nodes[i].uuid === node.uuid) {
                DEBUG('insertNode', 'node already exist ignore it ')
            } else {
                newNodes.push(nodes[i])
            }
        }
        newNodes.push(node);
        that.nodes.set(newNodes);
        notifyNodesChange();
        insertNode2Cloud(node);
    };
    that.deleteNode = function (address) {
        let willRemoveNode = null;
        let nodes = that.nodes.get();
        let idx = (function getIdx() {
            for (let i = 0; i < nodes.length; i++) {
                let foundUnicastAddress = parseInt(nodes[i].unicastAddress, 16)
                if (foundUnicastAddress === address) {
                    willRemoveNode = nodes[i]
                    return {index: i}//返回对象  如果直接返回index 会导致无法删除第一个节点 index=0 if(index){}
                }
            }
            return null
        })()
        if (idx) {
            remove(that.nodes.get())(idx.index)
            notifyNodesChange()
            deleteNodeCloud(willRemoveNode, idx.index)
        }
    };
    that.updateNode = function (node) {
        let that = this
        let idx = -1;
        let nodes = that.nodes.get();
        for (let i = 0; i < nodes.length; i++) {
            if (nodes[i].deviceId === node.deviceId) {
                idx = i;
                break;
            }
        }
        if (idx != -1) {
            nodes[idx] = node
            notifyNodesChange()
            updateNodeCloud(node)
        }
    };
    that.listenModelChange = function (cb) {
        OnOffObserver = cb;

    }

    that.insertOnOffModel = function (node) {
        let _openid = getOpenid();

        function getModels() {
            let models = []
            node.elements.map(item => {
                let elementAddress = item.elementAddress;
                item.models.map(model => {
                    if (model.modelId === '1000') {
                        let modelId = model.modelId;
                        let modelName = model.modelName;
                        let state = 1;
                        let nodeName = node.name;
                        let uuid = node.uuid;
                        models.push({_openid, elementAddress, modelId, modelName, state, nodeName, uuid})
                    }
                })

            })
            return models
        }

        getModels().map(model => {
            Cloud.insertOnOffModel(getOpenid(), model).catch(reason => {
            })
        })
    };

    that.updateModelStateCloud = function (model) {
        return Cloud.updateModelStateCloud(getOpenid(), model)
    };

    this.updateSeqNumber = function (seqnum) {
        return isBound(that.config.get()).then(bound => {
            let config;
            if (bound) {
                config = that.config.get().boundConfig;
                config.seq_num = seqnum
            } else {
                config = that.config.get().config;
                config.seq_num = seqnum
            }
            if (config) {
                //1500ms 只触发一次减少数据库调用次数(免费版有使用次数限制)，开发者可以根据实际情况调整
                recall(config, that.config.get()._id);
                return success();
            } else return fail({errCode: CONFIG_FILED_NULL, errMsg: 'updateUnicastAddress fail reason config null'});
        })
    };
    this.updateUnicastAddress = function (unicastAddress) {
        return isBound(that.config.get()).then(bound => {
            let config = null;
            let address = parseElementAddress(unicastAddress);
            if (bound) {
                config = that.config.get().boundConfig;
                config.unicastAddress = address;
            } else {
                config = that.config.get().config;
                config.unicastAddress = address;
            }
            if (config) {
                return Cloud.updateConfig(config, that.config.get()._id)
            } else return fail({errCode: CONFIG_FILED_NULL, errMsg: 'updateUnicastAddress fail reason config null'});
        })
    };

    this.keyInfoUpdate = function (status) {
        let addedAppNetkeys = curNode.addedAppNetkeys
        let value = {netKeyIndex: parseInt(status.netKeyIndex, 16), appKeyIndex: parseInt(status.appKeyIndex, 16)}
        value.appkey = curConfig().appKeys[value.appKeyIndex]
        value.netKey = curConfig().networKey[value.netKeyIndex]
        if (!addedAppNetkeys) {
            addedAppNetkeys = []
        }
        let foundIndex = -1
        //查询当前Addedappkey 是否存在
        addedAppNetkeys.map((item, index, self) => {
            if (item.netKey === value.netKey) {
                foundIndex = index
            }
        })
        //不存在
        if (foundIndex == -1) {
            addedAppNetkeys.push(value)
            let node = curNode;
            node.addedAppNetkeys = addedAppNetkeys
            that.updateNode(node)
        }
    }

    this.boundKeyInfoUpdate = function (status) {
        let node = curNode
        let idx = getElementAndModelIndex(node, status.ElementAddress, status.modelId)
        if (idx.elementIndex !== -1 && idx.modelIndex !== -1) {
            // let foundModel = this.selectNode.elements[idx.elementIndex].models[idx.modelIndex]
            let appKeyIndex = parseInt(status.AppKeyIndex, 16)
            let boundedAppkey = curConfig().appKeys[appKeyIndex]
            let boundappKeyIndex = appKeyIndex
            node.elements[idx.elementIndex].models[idx.modelIndex].boundedAppkey = boundedAppkey
            node.elements[idx.elementIndex].models[idx.modelIndex].boundappKeyIndex = boundappKeyIndex
            that.updateNode(node)
        }
    }

    this.subcriptionUpdate = function (status) {
        let node = curNode
        let idx = getElementAndModelIndex(node, status.ElementAddress, status.modelId)
        if (idx.elementIndex != -1 && idx.modelIndex != -1) {
            let subscriptionList = node.elements[idx.elementIndex].models[idx.modelIndex].subscriptionList
            if (!subscriptionList) {
                subscriptionList = []
            }
            let foundindex = -1;
            subscriptionList.map((item, index, self) => {
                if (status.SubscriptionAddress === index) {
                    foundindex = index
                }
            })
            if (foundindex == -1) {
                subscriptionList.push(status.SubscriptionAddress)
                node.elements[idx.elementIndex].models[idx.modelIndex].subscriptionList = subscriptionList
                that.updateNode(node)
            }
        }
    }

    that.bindUser = function (openid) {
        return Cloud.bindUser(openid, that.config.get()).then(res => {
            //由于绑定关系变化，得重新初始化数据
            that.init();
            return success();

        }).catch(reason => {
            ERROR('Provisioner bindUser', JSON.stringify(reason))
            return fail(reason)
        })
    };
    that.unbindUser = function () {
        return Cloud.unbindUser().then(res => {
            //由于绑定关系变化，得重新初始化数据
            that.init();
            return success(res);

        }).catch(reason => {
            ERROR('Provisioner unbindUser', JSON.stringify(reason))
            return fail(reason)
        })
    };
    function closeWatch() {
        Cloud.closeNodesWatch();
        Cloud.closeGroupWatch();
        Cloud.closeProCfgWatch();
        Cloud.closeModelWatch();
    }

    function initWatcher(openid) {
        closeWatch();
        Cloud.listenGroupChange(openid, function (snapshot) {
            that.groups.set(snapshot.docs)
            notifyGroupsChange()
        });
        Cloud.listenNodeChange(openid, function (snapshot) {
            that.nodes.set(snapshot.docs);
            notifyNodesChange()

        });
        Cloud.listenProvCfgChange(openid, function (snapshot) {
            let res = snapshot.docs[0]
            DEBUG('listenProvCfgChange', JSON.stringify(res))
            //多用户之间(多个用户绑定同一个用户，只要某一个或多个用户正在入网,就会回调这段代码)同步unicaAddress，
            isBound(that.config.get()).then(_isBound => {

                let newEastUnicaAddress = res.config.unicastAddress
                if (_isBound) {
                    that.config.get().boundConfig.unicastAddress = newEastUnicaAddress;
                    // if (!res.boundConfig && !res.boundId) {
                    //     that.config.set(res);
                    //     Cloud.initUser(that.wxUserinfo.get()).then(res).catch(reason => {
                    //         ERROR('listenProvCfgChange',reason)
                    //     })
                    // }
                } else {
                    that.config.get().config.unicastAddress = newEastUnicaAddress;
                    // that.config.get().config.seq_num = res.config.seq_num;
                }

                DEBUG('listenProvCfgChange data modify:', JSON.stringify(that.config.get()))

            })

        });

        Cloud.listenModelChange(openid, function (snapshot) {
            if (OnOffObserver) {
                OnOffObserver(snapshot)
            }
        })
    };

}

function debounce(f, ms) {
    let timmer
    return function () {
        if (timmer != null) {
            clearTimeout(timmer)
            timmer = null
        }
        timmer = setTimeout(() => {
            f.apply(this, arguments)
            console.debug('debounce  excute..', '')
            timmer = null
        }, ms);
    };

}

function remove(arr) {
    return function (index) {
        arr.splice(index, 1)
    }
}

function success(res) {
    return new Promise((resolve, reject) => {
        resolve(res)
    })
}

function fail(res) {
    return new Promise((resolve, reject) => {
        reject(res)
    })
}

function getElementAndModelIndex(node, elementAddress, modelId) {

    let elementIndex = getElementIndex(node.elements, elementAddress)
    let modelIndex = elementIndex === -1 ? -1 : getModelIndex(node.elements[elementIndex].models, modelId)

    return {elementIndex, modelIndex}
}

function getElementIndex(elements, elementAddress) {
    let elementIndex = -1
    elements.map((ele, index, self) => {
        if (parseInt(elementAddress, 16) === parseInt(ele.elementAddress, 16)) {
            elementIndex = index;
        }
    })
    return elementIndex
}

function getModelIndex(models, modelId) {
    let modelIndex = -1
    models.map((model, index, self) => {
        if (parseInt(modelId, 16) === parseInt(model.modelId, 16)) {
            modelIndex = index;
        }
    })
    return modelIndex
}

module.exports = ProvisionerInstance;