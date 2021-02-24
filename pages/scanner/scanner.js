import {debounce} from "../../utils/util";
import {
    CONNECTION_FAIL,
    INVALIDE_DATA, NO_CHARACTERISTIC, NO_CONNECTION, NO_DEVICE, NO_SERVICE,
    NOT_AVAILABLE,
    NOT_INIT,
    OPERATE_TIME_OUT, PROPERTY_NOT_SUPPORT,
    SYSTEM_ERROR,
    SYSTEM_NOT_SUPPORT
} from "../../mesh_core/errorCode";
import {MESH_PROVISION_UUID, MESH_PROXY_UUID} from "../../mesh_core/constant";
import {
    CONFIG_APPKEY_STATUS,
    CONFIG_COMPOSITION_DATA_GET,
    CONFIG_COMPOSITION_DATA_STATUS, CONFIG_MODEL_APP_STATUS, CONFIG_MODEL_SUBSCRIPTION_STATUS,
    CONFIG_NODE_RESET_STATUS, GENERIC_ON_OFF_STATUS
} from "../../mesh_core/MeshOpCode";

let Loading = require('../../Loading');
let timmer;
let reconnTimmer;
let MeshController;
let isDestory = false;
let stopScanTimmer;
let debounceTimmer;

function inArray(arr, key, val) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i][key] === val) {
            return i;
        }
    }
    return -1;
}

function index(arr, key) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].deviceId === key) {
            return i;
        }
    }
    return -1;
}


Page({
    data: {
        devices: [],
        connected: false,
        auto_connect: false,
        conn_state: '',
        uuid: []

    },
    onLoad: function (options) {
        this.data.auto_connect = options.auto_Connect === 'true' ? true : false
        this.data.uuid.push(options.uuid)

    },
    connStateChange: function (res) {
        let that = this
        let deviceId = res.deviceId;
        for (let i = 0; i < that.data.devices.length; i++) {
            that.data.devices[i].connect = res.connected
            if (deviceId === that.data.devices[i].deviceId) {
                that.data.devices[i].conn_state = res.connected ? 'connected' : ''
            } else {
                that.data.devices[i].conn_state = ''
            }
        }
        that.setData({
            devices: that.data.devices,
            conn_state: that.data.conn_state,
            connected: res.connected

        })

    },


    connectDevice: function (e) {
        let that = this
        let BluetoothDevice = {}
        let dataSet = e.currentTarget.dataset.device
        BluetoothDevice.deviceId = dataSet.deviceId
        BluetoothDevice.name = dataSet.name
        BluetoothDevice.uuid = dataSet.uuid
        let uuid = that.data.uuid[0]
        route(uuid, BluetoothDevice)

    },

    onShow: function () {
    },

    onReady: function () {
        let that = this;
        MeshController = getApp().getMeshController();
        MeshController.setScanCanllback(function (device) {
            that.addDevice(device)
        });
       that.onPullDownRefresh()
    },
    onPullDownRefresh: function () {
        let that = this;
        Loading.showLoading('scanning', true)
        that.setData({
            devices: []
        })
        if (!MeshController._isScaning()) {
            debounceTimmer=debounceRefresh(that)
        }
    },
    onHide: function () {


    },
    parsedbmImage: function (rssi) {
        let v = rssi + 100
        if (v >= 0 && v <= 33) {
            return '../../imags/rssi_1.svg'
        } else if (v > 33 & v <= 66) {
            return '../../imags/rssi_2.svg'
        } else if (v > 66) {
            return '../../imags/rssi_3.svg'
        } else return '../../imags/rssi_1.svg'
    },
    addDevice: function (device) {
        let that = this;
        Loading.hideLoading();
        wx.stopPullDownRefresh();
        console.debug('addDevice:' + JSON.stringify(device))
        let foundDevices = that.data.devices
        let idx = inArray(foundDevices, 'deviceId', device.deviceId)
        let data = {}
        device.connect = false;
        if (idx === -1) {
            device.name = device.localName// ios 手机这两个字段内容不一致
            device.image = that.parsedbmImage(device.RSSI)
            data[`devices[${foundDevices.length}]`] = device
        } else {
            device.image = that.parsedbmImage(device.RSSI)
            device.name = device.localName// ios 手机这两个字段内容不一致
            data[`devices[${idx}]`] = device
        }
        that.setData(data)
    },
    onUnload: function () {
        isDestory = true;
        Loading.hideLoading()
        MeshController.setScanCanllback(null);
        if (MeshController._isScaning()) {
            MeshController._stopScan().then(res => {
                console.debug('onUnload stopScan:\n' + JSON.stringify(res))
            }).catch(reason => {
                console.error('onUnload stopScan:\n' + JSON.stringify(reason))
            });
        }
        if (MeshController._isConnecting()) {
            MeshController.disconnect().then(res => {
                console.debug('onUnload disconnect:\n' + JSON.stringify(res))
            }).catch(reason => {
                console.error('onUnload disconnect:\n' + JSON.stringify(reason))
            })
        }
        if (timmer!=null) {
            clearTimeout(timmer)
        }
        if (reconnTimmer!=null) {
            clearTimeout(reconnTimmer)
        }
        if (stopScanTimmer!=null) {
            clearTimeout(stopScanTimmer)
        }
        if (debounceTimmer!==undefined){
            debounceTimmer();
        }
        MeshController.unregisterMeshMessageHandler(getPageKey())
    },

})

function showError(reason, _showCancel, cb) {
    if (_showCancel === undefined) {
        _showCancel = false
    }
    Loading.hideLoading()
    let res_ = reason.reason
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
            if (res_.errCode === NOT_AVAILABLE) {
                wx.navigateBack();
            }


        }
    })


}

let route = debounce(connectToNode, 1000);
let debounceRefresh = debounce(reScan, 2500)

function reScan(context) {
    let that = context;
    let title = ''
    Loading.showLoading('scanning', true)
    switch (that.data.uuid[0]) {
        case MESH_PROVISION_UUID[0]:
            title = 'scan unprovisioned'
            MeshController.scanUnprovDevice().catch(reason => {
                showError({reason}, false, () => {
                    MeshController._stopScan().catch(reason1 => {
                        showError({reason: reason1})
                    })
                })
            })
            break;
        case MESH_PROXY_UUID[0]:
            title = 'scan provisioned'
            MeshController.scanProxyNode().catch(reason => {
                showError({reason}, false, () => {
                    MeshController._stopScan().then(res => {
                        debounceRefresh(that)
                    }).catch(reason1 => {
                    })
                })
            })
            break
    }
    ;
    if (stopScanTimmer!=null) {
        clearTimeout(stopScanTimmer)
    }
    stopScanTimmer = setTimeout(() => {
        MeshController._stopScan().then(res => {
            Loading.showToast('stopScan')
        }).catch(reason => {
        })
    }, 60 * 1000)
    wx.setNavigationBarTitle({
        title
    })
}

function connectToNode() {
    let uuid = arguments[0];
    let bluetoothDevice = arguments[1]
    console.log('connectToNode:' + JSON.stringify(bluetoothDevice))

    function conn(title) {
        MeshController._stopScan().then(res => {
            Loading.showLoading(title);
            let device = bluetoothDevice;
            let conn2ProxyNode = uuid === MESH_PROXY_UUID[0]
            MeshController.connect({device}, conn2ProxyNode).then(res => {
                Loading.hideLoading()
                switch (uuid) {
                    case MESH_PROVISION_UUID[0]:
                        wx.navigateTo({
                            url: '../provision/provisioner?device=' + JSON.stringify(bluetoothDevice)
                        })

                        break;
                    case MESH_PROXY_UUID[0]:
                        MeshController.setCurNode(bluetoothDevice.name);
                        wx.navigateBack()
                        break;
                    default:
                        break;
                }
            }).catch(reason => {
                // 连接异常捕获 具体请参考errCode.js中的定义 这里的处理方式 ->重新连接
                if (!isDestory)
                    showError({reason}, true, function (res) {
                        conn('reconnecting')
                    })
            })

        }).catch(reason => {
            showError({reason})
        });
    }

    conn('connecting')

}

function getPageKey() {
    return 'scanner'
}