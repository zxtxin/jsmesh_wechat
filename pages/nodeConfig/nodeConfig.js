// pages/nodeConfig/nodeConfig.js
"use strict";
import {
    CONFIG_APPKEY_STATUS,
    CONFIG_COMPOSITION_DATA_STATUS,
    CONFIG_MODEL_APP_STATUS, CONFIG_MODEL_SUBSCRIPTION_STATUS, CONFIG_NODE_RESET_STATUS,
    GENERIC_ON_OFF_STATUS,
    CONFIG_COMPOSITION_DATA_GET,
} from "../../mesh_core/MeshOpCode";
import {debounce} from "../../utils/util";

let MeshController;
let debounceTimmer;
const Loading = require('../../Loading')
let {
    GenericOnOffSetAck,
    ConfigCompositionDataGet,
    ConfigAddKeyAdd,
    ConfigModelAddKeyBind,
    ConfigModelSubscriptionAdd,
    ConfigNodeReset
} = require('../../mesh_core/MeshMessage')
Page({
    /**
     * 页面的初始数据
     */
    data: {
        on_off: 0,
        OnOffState: 'OFF',
        models: [],
        // properties:{cancel:'cancelA',sure:'SureB',show:false}
    },
    curElementAddress: null,

    init: function () {
        let that = this

        function initNode() {
            return new Promise(((resolve, reject) => {
                let provisionedNode = _curNode()
                if (provisionedNode && provisionedNode.elements) {
                } else {
                }
                resolve(provisionedNode)
            }))
        };
        initNode()
            .then(that.selectOnOffModels)
            .catch(reason => {
                console.debug('initNode:' + reason)
            });
    },
    onLoad: function (options) {
        let that = this
        MeshController = getApp().getMeshController();
        MeshController.regDeviceReadyCb(getPageKey(), function () {
            console.log('onDeviceReady..............')
            setupNodeInfo(that)
        });
        MeshController.listenModelChange( function (snapshot) {
            that.setData({models: that.parseModelImage(snapshot.docs)})
        });
        (function initMeshMsgHandler() {
            MeshController.registerMeshMessageHandler(getPageKey(), function (res) {
                switch (res.opCode) {
                    case CONFIG_COMPOSITION_DATA_GET:
                        Loading.showLoading('loading')
                        break;

                    case CONFIG_NODE_RESET_STATUS:
                        // if connected device  is reset  should  disconnect
                        let isCurNodeReset = MeshController.isCurNodeReset()
                        console.debug('isCurNodeReset：' + isCurNodeReset)
                        if (isCurNodeReset) {
                            MeshController.disconnect().then(res => {
                                getApp().switchMain()
                            }).catch(reason => {
                            })
                        } else {
                            getApp().switchMain()
                        }

                        break;
                    case CONFIG_COMPOSITION_DATA_STATUS:
                        setupNodeInfo(that)
                        break;
                    case CONFIG_APPKEY_STATUS:
                        nextMessage()
                        break;
                    case CONFIG_MODEL_APP_STATUS:
                        nextMessage()
                        break;
                    case CONFIG_MODEL_SUBSCRIPTION_STATUS:
                        nextMessage()
                        break;
                    case GENERIC_ON_OFF_STATUS:
                        that.updateOnOffModelState(res.statusMessage)
                        break;

                }


            })


        })();

        function nextMessage() {
            if (that.data.queue) {
                if (that.data.queue.length > 0) {
                    sendMessage(that.data.queue.pop())
                } else {
                    //refresh UI
                    Loading.hideLoading()
                    that.refreshUI()
                }

            }
        }

        if (MeshController.connected()) {
            setupNodeInfo(this)
        } else {
            if (_curNode().elements && _curNode().elements.length >= 0) {
                that.init()
            }
        }
    },
    updateOnOffModelState: function (res) {
        let that = this
        let models = that.data.models
        let idx = -1
        models.map((item, index) => {
            if (item.elementAddress === that.curElementAddress) {
                idx = index
            }
        })
        if (idx !== -1) {
            if (res.mTargetOn) {
                models[idx].img = '../../imags/light_on.svg'
                models[idx].state = 1
            } else {
                models[idx].img = '../../imags/light_off.svg'
                models[idx].state = 0
            }
            that.setData({
                models: models
            });
            MeshController.updateModelStateCloud(models[idx]).then(res => {
                let _id = res.result._id
                models[idx]._id = _id
            })


        }

    },

    selectOnOffModels: function (node) {
        let that = this
        return new Promise((resolve, reject) => {
            MeshController.selectModelsCloud(node).then(res => {
                if (res.result.data && res.result.data.length > 0) {
                    that.setData({models:  that.parseModelImage(res.result.data)})
                }
                resolve({})

            }).catch(reason => {
                reject(reason)
            })
        })
    },
    parseModelImage: function (models) {

        models.map(model => {
            if (model.state === 1) {
                model.img = '../../imags/light_on.svg'
            } else {
                model.img = '../../imags/light_off.svg'
            }
        })
        console.log('parseModelImage:' + JSON.stringify(models))
        return models;
    },
    refreshUI: function () {
        this.init()

    },
    /**
     * 生命周期函数--监听页面初次渲染完成
     */

    onReady: function () {


    },


    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {

    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {
        if (debounceTimmer !== undefined) {
            debounceTimmer();
        }
        MeshController.closeModelWatch()
        MeshController.unregisterMeshMessageHandler(getPageKey())
        MeshController.unRegDeviceReadyCb(getPageKey())
    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function () {
        this.selectOnOffModels(_curNode()).then(res => {
            wx.stopPullDownRefresh()
        })
    },
    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function () {

    },
    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function () {

    },


    modelPage: function (e) {
        let model = e.currentTarget.dataset.data
        let elementAddress = e.currentTarget.dataset.element.elementAddress
        switch (parseInt(model.modelId, 16)) {
            case 0x1000:
                //GenericOnOffServerModel
                wx.navigateTo({
                    url: '../models/genericOnOffServer/genericOnOffServer?elementAddress=' + elementAddress + '&model=' + JSON.stringify(model)
                })
                break

        }

    },
    genericOnSet: function (e) {

        this.curElementAddress = e.currentTarget.dataset.data.elementAddress
        sendMessage(new GenericOnOffSetAck(1, _seqNum(), this.curElementAddress))
        // this.updateOnOffModelState({mTargetOn:true})
    },
    genericOffSet: function (e) {
        this.curElementAddress = e.currentTarget.dataset.data.elementAddress
        sendMessage(new GenericOnOffSetAck(0, _seqNum(), this.curElementAddress))
        // this.updateOnOffModelState({mTargetOn:false})
    },
    nodeReset: function () {
        wx.showModal({
            title: 'Node Reset',
            content: 'Resetting this node will change its provisioned state back to un-provisioned',
            showCancel: true,
            cancelText: 'cancel',
            cancelColor: '#858585',
            confirmColor: '#378BFF',
            confirmText: 'sure',
            success(res) {
                if (res.confirm) {
                    sendMessage(new ConfigNodeReset(_uniCastAddress()))
                }
            }
        })
        // this.data.properties.show=true
        // this.setData({properties:this.data.properties} )
        //
    },
    onCancelClick: function () {
        this.data.properties.show = false
        this.setData({properties: this.data.properties})
    },
    onSureClick: function () {
        this.data.properties.show = false
        this.setData({properties: this.data.properties})
    }

})

let route = debounce(skip2DeviceScan, 1000);

function sendMessage(message) {

    if (message) {
        if (MeshController.connected()) {
            MeshController.sendMeshMessage(message).catch(reason => {
                console.error('sendMessage error:' + reason)
            });
        } else {
            debounceTimmer = route();

        }
    }

}


function setupNodeInfo(context) {
    let queue = compositioDataGetQueue().concat(addAppkeyQueue().concat(bindAppkeyQueue())).reverse();
    console.log(queue.length)
    if (queue.length > 0) {
        context.data.queue = queue
        sendMessage(queue.pop())
    } else {
        context.init()
    }


}

function compositioDataGetQueue() {
    let queue = []
    if (!_curNode().elements) {
        console.log('compositioDataGetQueue')
        queue.push(new ConfigCompositionDataGet(_uniCastAddress()))
    }
    return queue
}

function addAppkeyQueue() {
    let queue = []
    if (!_curNode().addedAppNetkeys) {
        queue.push(new ConfigAddKeyAdd(_appKeys()[0], _uniCastAddress()))
        console.log('addAppkeyQueue')
    }
    return queue

}

function bindAppkeyQueue() {
    let groups = _groups();
    let queue = []
    if (_curNode().elements) {
        let dst = _uniCastAddress()
        _curNode().elements.map(element => {
            element.models.map(model => {
                let modelId = parseInt(model.modelId, 16)
                if (modelId === 0x1000) {
                    // bind appkey
                    if (!model.boundedAppkey) {
                        console.log('bindAppkeyQueue')
                        queue.push(new ConfigModelAddKeyBind(dst, element.elementAddress, 0, modelId))
                    }
                    if (!model.subscriptionList) {
                        console.log('subScriptionQueue')
                        let groupAddress = groups.length > 0 ? groups[0].address : 0xc000
                        queue.push(new ConfigModelSubscriptionAdd(dst, element.elementAddress, groupAddress, modelId))
                    }
                }

            })
        })
    }
    return queue
}


function skip2DeviceScan() {
    wx.navigateTo({
        url: '../scanner/scanner?auto_Connect=' + false + '&uuid=' + '00001828-0000-1000-8000-00805F9B34FB'
    })
}

function LOG(tag) {
    return function (info) {
        console.log(tag + ':\n' + info)
    }
}

function _curNode() {
    return MeshController.getCurNode();
}

function _groups() {
    return MeshController.getGroups();
}

function getPageKey() {
    return 'nodeConfig'
}

function _seqNum() {
    return MeshController.getMeshConfig().seq_num;
}

function _uniCastAddress() {
    return MeshController.getCurNode().unicastAddress
}

function _appKeys() {
    return MeshController.getMeshConfig().appKeys
}




