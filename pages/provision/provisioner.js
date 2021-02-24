import {
    CONNECTION_FAIL, INVALIDE_DATA,
    NO_CHARACTERISTIC, NO_CONNECTION,
    NO_DEVICE,
    NO_SERVICE,
    NOT_AVAILABLE,
    NOT_INIT, OPERATE_TIME_OUT, PROPERTY_NOT_SUPPORT, SYSTEM_ERROR, SYSTEM_NOT_SUPPORT
} from "../../mesh_core/errorCode";

let OPCODE = require('../../mesh_core/MeshOpCode')
const KEY = 'provisioner'
let MeshController;
const Loading = require('../../Loading');
let {
    ConfigCompositionDataGet,
    ConfigAddKeyAdd,
    ConfigModelAddKeyBind,
    ConfigModelSubscriptionAdd
} = require('../../mesh_core/MeshMessage')
let queue = []
let curDevice;
let msgSize;
let isDestory = false
let TYPE = {
    WRITE: 1,//send msg
    RECEIVED: 0,//received data
    OTHER: 2,
}


Page({
    context: function () {
        return this;

    },
    data: {
        provisionStates: []
    },

    init: function () {
        let that = this
        MeshController.setMeshProvisioningHandler({
            onStartInvite: function (res) {
                // that.sendingProvisionInvite()
                that.setProvisionState(res)

            },
            onReceivedCapabilities: function (res) {
                that.setProvisionState(res)
            },
            onProvisionStart: function (res) {
                that.setProvisionState(res)

            },
            onSendingPublicKey: function (res) {
                that.setProvisionState(res)
            },
            onReceivedPublicKey: function (res) {
                that.setProvisionState(res)

            },
            onSendConfirmData: function (res) {
                that.setProvisionState(res)
            },
            onReceivedConfirm: function (res) {
                that.setProvisionState(res)

            },
            onSendConfirmRandom: function (res) {
                that.setProvisionState(res)
            },
            onReceivedConfirmRandom: function (res) {
                that.setProvisionState(res)

            },

            onSendingProvisionData: function (res) {

                that.setProvisionState(res)
            },
            onReceivedProvisionComplete: function (res) {
                that.setProvisionState(res).disconn()
            },
        })


        MeshController.registerMeshMessageHandler(KEY, function (res) {
                let state
                switch (res.opCode) {
                    case OPCODE.SEG_ACK://sending block ack
                        state = {type: TYPE.WRITE, status: 'Sending BlockAcknowledgement'};
                        break;
                    case OPCODE.SEG_RESENT://resend Segment
                        state = {type: TYPE.WRITE, status: 'Rsending Sgement'};
                        break;
                    case OPCODE.CONFIG_COMPOSITION_DATA_GET:
                        state = {type: TYPE.WRITE, status: 'Sending CompositionDataGet'};
                        break;
                    case OPCODE.CONFIG_APPKEY_ADD:
                        state = {type: TYPE.WRITE, status: 'Sending ConfigAppKeyAdd'};
                        break;
                    case OPCODE.CONFIG_MODEL_APP_BIND:
                        state = {type: TYPE.WRITE, status: 'Sending ConfigModelAppkeyBind'};
                        break;
                    case OPCODE.CONFIG_MODEL_SUBSCRIPTION_ADD:
                        state = {type: TYPE.WRITE, status: 'Sending ConfigSubsctiptionAdd'};
                        break;
                    case OPCODE.CONFIG_COMPOSITION_DATA_STATUS:
                        state = {type: TYPE.RECEIVED, status: 'Receiving CompositionDataStatus'}
                        sendingConfigAppKeyAdd();
                        break;
                    case OPCODE.CONFIG_APPKEY_STATUS:
                        state = {type: TYPE.RECEIVED, status: 'Receive ConfigAppkeyStatus'};
                        if (res.statusMessage.StatusCode == 0) {
                            initwillBindKeyModel(that);
                            nextMessageSend();
                        }
                        break
                    case OPCODE.CONFIG_MODEL_APP_STATUS:
                        state = {type: TYPE.RECEIVED, status: 'Receive ConfigModelAppkeyBindStatus'};
                        nextMessageSend();
                        break;
                    case OPCODE.CONFIG_MODEL_SUBSCRIPTION_STATUS:
                        state = {type: TYPE.RECEIVED, status: 'Receive SubscriptionStatus'};
                        nextMessageSend();
                        break;
                    default:
                        break;
                }
                if (state) {
                    that.setProvisionState(state)
                }
            }
        )

        function nextMessageSend() {
            let msg = queue.pop()
            if (msg) {
                let percent = ((msgSize - queue.length) / msgSize) * 100
                wx.setNavigationBarTitle({title: percent + '%'})
                sendMessage(msg)
                that.pageScrollToBottom();
            } else {
                getApp().switchTab('network')
            }

        }

        setTimeout(() => {
            MeshController.startInvite()
        }, 300)


    },
    onLoad: function (options) {
        // do_init();
        let device = JSON.parse(options.device)
        curDevice = device

    },
    onReady: function () {
        MeshController = getApp().getMeshController();
        this.init()

    },
    pageScrollToBottom: function () {
        // 使页面滚动到底部
        wx.pageScrollTo({
            scrollTop: 3000,
            duration: 200
        })
    },


    onShow: function () {
    },

    onHide: function () {
    },


    onUnload: function () {
        isDestory = true
        MeshController.unregisterMeshMessageHandler(KEY)
        if (MeshController._isConnecting()) {
            MeshController.disconnect().then(res => {
                console.debug('closeAdapter:\n' + JSON.stringify(res))
            }).catch(reason => {
                console.error('closeAdapter:\n' + JSON.stringify(reason))
            })
        }

    },


    onPullDownRefresh: function () {

    },


    onReachBottom: function () {

    },


    onShareAppMessage: function () {

    },

    //刷新界面
    setProvisionState: function (res) {
        let that = this
        let arr = []
        let state = {type: res.type, status: res.status}
        if (state.type == TYPE.OTHER) {
            Loading.showLoading(state.status)

        } else {
            Loading.hideLoading()
            if (state.type == TYPE.WRITE) {
                state.img = '../../imags/arrow_right.png'
            } else if (state.type == TYPE.RECEIVED) {
                state.img = '../../imags/arrow_left.png'
            }
            arr.push(state)

        }
        this.setData({
            provisionStates: that.data.provisionStates.concat(arr)
        })
        return this;
    },


    // 入网完毕断开连接并且重新连接
    disconn: function () {
        let that = this
        Loading.showLoading('disconnecting')
        MeshController.disconnect().then(res => {
                Loading.showLoading('reconnecting')
                MeshController.refreshGatt().then(res => {
                    setTimeout(() => {
                        that.reconnectDevice()
                    }, 2500)

                }).catch(reason => {
                    console.error('refreshGatt:' + JSON.stringify(reason))
                })
            },
        ).catch(reason => {
        })

    },

    //重新连接设备，
    reconnectDevice: function () {
        let that = this
        let count = 0

        function conn() {
            count++;
            let node = MeshController.unProvionNode()
            let deviceId = node.deviceId;
            let name = node.name;
            Loading.showLoading('reconnecting')
            MeshController.connect({device: {name, deviceId}}).then(res => {
                Loading.hideLoading();
                //连接成功 获取Composition Data
                that.sendingComposeDataGet();
            }).catch(result => {
                console.error("conn:" + JSON.stringify(result))
                //连接异常  重新连接  这里可以根据需要定义重连次数，来决定是否重连
                //这里判断重连两次还是无法连接，显示cancel 按钮取消重连
                if (!isDestory)
                    showError(result, count >= 2, function () {
                        conn()
                    })
            })
        };
        conn();


    },

    //获取节点信息数据
    sendingComposeDataGet: function () {
        try {
            sendMessage(new ConfigCompositionDataGet(getCurrentUnicastAddress()))
        } catch (e) {
            console.error('sendingComposeDataGet:' + e)
        }

    },
})

function getCurrentUnicastAddress() {
    let unicastAddress = MeshController.getCurNode().unicastAddress;
    return parseInt(unicastAddress, 16)
}

function appkey() {
    return MeshController.getMeshConfig().appKeys
}

function sendingConfigAppKeyAdd() {
    sendMessage(new ConfigAddKeyAdd(appkey()[0], getCurrentUnicastAddress()))
}

//发送消息
function sendMessage(message) {
    MeshController.sendMeshMessage(message).catch(reason => {

    });

}

//初始化需要绑定appkey,订阅组地址的model
function initwillBindKeyModel(context) {
    let currentNode = MeshController.getCurNode();
    let dst = currentNode.unicastAddress;
    let groups = MeshController.getGroups();
    currentNode.elements.map((element, index, self) => {
        element.models.map(model => {
            let modelId = parseInt(model.modelId, 16)
            if (modelId === 0x1000) {
                // model绑定appkey
                let appKeyIndex = 0
                queue.push(new ConfigModelAddKeyBind(dst, element.elementAddress, appKeyIndex, modelId))
                // mdoel 订阅组地址
                let subscriptionAddress = groups.length > 0 ? groups[0].address : 0xc000
                queue.push(new ConfigModelSubscriptionAdd(dst, element.elementAddress, subscriptionAddress, modelId))

            }

        })
    })
    queue = queue.reverse()
    msgSize = queue.length


}

function showError(reason, _showCancel, cb) {
    if (_showCancel === undefined) {
        _showCancel = false
    }
    Loading.hideLoading()
    let res_ = reason
    console.error('showError:\n' + JSON.stringify(res_))
    let confirmText = 'ok'
    switch (res_.errCode) {
        case NOT_INIT://
            break;
        case NOT_AVAILABLE:
            res_.errMsg = 'open bluetooth first please!'
            break;
        case NO_DEVICE:
            break;
        case CONNECTION_FAIL:
            confirmText = 'retry'
            break;
        case NO_SERVICE:
            break;
        case NO_CHARACTERISTIC:
            break;
        case NO_CONNECTION:
            break;
        case PROPERTY_NOT_SUPPORT:
            break;
        case SYSTEM_ERROR:
            break;
        case SYSTEM_NOT_SUPPORT:
            break;
        case OPERATE_TIME_OUT:
            confirmText = 'retry'
            break;
        case INVALIDE_DATA:
            break;
        default:
            break;
    }
    ;

    wx.showModal({
        title: "operate interrupt",
        content: res_.errMsg,
        showCancel: _showCancel,
        cancelText: 'cancel',
        confirmText,
        success(res) {

            if (res.confirm) {
                if (cb) {
                    cb()
                }
            }
            if (res.cancel) {
                wx.navigateBack();
            }
            if (res_.errCode === NOT_AVAILABLE) {
                wx.navigateBack();
            }


        }
    })


}







