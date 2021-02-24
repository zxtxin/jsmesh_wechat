import {
    MESH_PROVISION_UUID,
    MESH_PROVISIONING_DATA_IN,
    MESH_PROVISIONING_DATA_OUT,
    MESH_PROXY_DATA_IN, MESH_PROXY_DATA_OUT,
    MESH_PROXY_UUID
} from "./constant";
const MeshConnectorInstance = (function () {
    let instance;

    function getInstance() {
        if (instance === undefined) {
            instance = new MeshConnector();
        }
        return instance;
    }

    return {
        getInstance: getInstance
    }

})()

function MeshConnector() {
    let that = this
    let logger;
    let isConnecting=false;
    that.setLogger=function(log){
        logger=log;
    }
    function DEBUG(tag,info){
        if (logger){
            logger.DEBUG(tag,info);
        }
    }
    function  ERROR(tag,info){
        if (logger){
            logger.ERROR(tag,info);
        }
    }
    let util = require('../utils/util.js');
    let Queue = require('../Queue');
    let queue = new Queue()
    let busy = false;
    that.connectedName = null;
    that._isConnecting=function(){
        return isConnecting;
    };
    that.connected = new function () {
        let conn=false;
        this.set=function (res) {
            conn=res
        }
        this.get=function () {
            return conn;
        }
    };
    that.device=new function(){
        let device={};
        this.set=function (res) {
            device=res
        }
        this.get=function () {
            return device;
        }
        this.reset=function () {
            device={}
        }
    };
    let devicesReadyCbMap = new Map();
    let isProvisionedComplete = true;
    let mMeshProvisioningDataInCharacteristic = null;
    let mMeshProvisioningDataOutCharacteristic = null;
    let mMeshProxyDataInCharacteristic = null;
    let mMeshProxyDataOutCharacteristic = null;
    (function initConnState() {
        wx.onBLEConnectionStateChanged(res => {
            DEBUG('onBLEConnectionStateChanged',JSON.stringify(res))
            that.connected.set(res.connected);
            if (res.connected) {
                that.deviceId = res.deviceId;
                res.name=that.device.get().name
            } else {
                that.device.reset();
                that.deviceId = null;
                resetParams()
            }
            if (that.connStatelistener) {
                that.connStatelistener(res)
            }
        })
    })()
    that.setConnStateChangelistener = function (listener) {
        that.connStatelistener = listener

    }
    that.regDeviceReadyCb = function (key, listener) {
        devicesReadyCbMap.set(key, listener)
    }
    that.unRegDeviceReadyCb = function (key) {
        if (devicesReadyCbMap.has(key))
            devicesReadyCbMap.delete(key)
    }

    function resetParams() {
        isProvisionedComplete = false;
        mMeshProvisioningDataInCharacteristic = null;
        mMeshProvisioningDataOutCharacteristic = null;
        mMeshProxyDataInCharacteristic = null;
        mMeshProxyDataOutCharacteristic = null;
        queue.clear()
        busy = false
        DEBUG('resetParams','......')
    }

    /**
     *
     * @param params{{device: *}}
     * @returns {Promise<any>}
     */
    this.connect = function (params) {
        that.device.set(params.device)
        return connectReal(params).then(discoveryServices).then(matchMeshService).then(enableNotification)
    }

    this.disconnect = function () {
        return new Promise((resolve, reject) => {
            wx.closeBLEConnection({
                deviceId: that.deviceId,
                success(res) {
                    resolve(res)
                }, fail(res) {
                    reject(res)
                }
            })
        })
    }

    function connectReal(params) {
       DEBUG('connectReal' , params)
        let device = params.device;
        isConnecting = true
        return new Promise((resolve, reject) => {
            that.deviceId=device.deviceId;
            wx.createBLEConnection({
                deviceId: device.deviceId,
                success(res) {
                    resolve(params)
                },
                fail(res) {
                    reject(res)
                }
            })
        })
    }

    function discoveryServices(params) {
      DEBUG('discoveryServices' , JSON.stringify(params))
        return new Promise((resolve, reject) => {
            wx.getBLEDeviceServices({
                deviceId: params.device.deviceId,
                success: (res) => {
                    params.services = res.services
                    resolve(params)
                },
                fail(res) {
                    reject(res)
                }
            })
        })
    }

    function matchMeshService(params) {
        DEBUG('matchMeshService' , JSON.stringify(params))
        return new Promise((resolve, reject) => {
            let deviceId = params.device.deviceId
            let services = params.services
            let serviceId=null
            services.map((service => {
                if (service.uuid === MESH_PROVISION_UUID[0] || service.uuid === MESH_PROXY_UUID[0])
                    serviceId = service.uuid
            }))
            DEBUG('matchMeshService' , {deviceId,serviceId});
            wx.getBLEDeviceCharacteristics({
                deviceId,
                serviceId,
                success: (res) => {
                    if (serviceId === MESH_PROVISION_UUID[0]) {
                        isProvisionedComplete = false
                        if (res.characteristics[0].uuid === MESH_PROVISIONING_DATA_IN) {
                            mMeshProvisioningDataInCharacteristic = res.characteristics[0].uuid
                        }
                        if (res.characteristics[1].uuid === MESH_PROVISIONING_DATA_OUT) {
                            mMeshProvisioningDataOutCharacteristic = res.characteristics[1].uuid

                        }
                        params.serviceId = serviceId;
                        params.charIn = mMeshProvisioningDataInCharacteristic;
                        params.charOut = mMeshProvisioningDataOutCharacteristic;
                        resolve(params)
                    } else if (serviceId === MESH_PROXY_UUID[0]) {
                        isProvisionedComplete = true
                        if (res.characteristics[0].uuid === MESH_PROXY_DATA_IN) {
                            mMeshProxyDataInCharacteristic = res.characteristics[0].uuid
                        }
                        if (res.characteristics[1].uuid === MESH_PROXY_DATA_OUT) {
                            mMeshProxyDataOutCharacteristic = res.characteristics[1].uuid
                        }
                        params.serviceId = serviceId;
                        params.charIn = mMeshProxyDataInCharacteristic;
                        params.charOut = mMeshProxyDataOutCharacteristic;
                        resolve(params)
                    } else {
                    }

                },
                fail(res) {
                   ERROR('getBLEDeviceCharacteristics', JSON.stringify(res))
                    reject(res)
                }
            })
        })
    }


    function enableNotification(params) {
        return new Promise((resolve, reject) => {
            let characteristicId = params.charOut
            let serviceId = params.serviceId
            let deviceId=params.device.deviceId
            DEBUG('enableNotification' ,JSON.stringify({characteristicId,serviceId,deviceId}));
            wx.notifyBLECharacteristicValueChange({
                deviceId: deviceId,
                serviceId: serviceId,
                characteristicId: characteristicId,
                type: 'indicate',
                state: true,
                success(res) {
                    isConnecting = false
                    deviceReady();
                    resolve(res)
                },
                fail(res) {
                    reject(res)
                }
            })
        })
    }

    function deviceReady() {
        devicesReadyCbMap.forEach(cb => {
            cb();
        })
    }


    //设置接收蓝牙数据回调
    this.setNotificationCallback = function (cb) {
        wx.onBLECharacteristicValueChange(function (res) {
            if (cb)
                cb(res)
        })
    }
    /**
     * 发送数据
     * @param params
     */
    this.sendPdu = function (pdu) {
        queue.push(pdu)
        if (!busy) {
            next()
        } else {
            console.log('busy....')
        }

    }

    // let timmer

    function next() {
        let block = queue.pop()//['seg1','seg2'...]
        if (block) {
            busy = true;
            writeData(block)

        }
    }

    function writeRemainSegments(segments) {
        writeData(segments)
    }

    function writeNextMessage() {
        next()
    }

    function writeData(curSegments) {
        let pdu = curSegments.shift()
        let ab = util.hex2ab(pdu.seg)
        let characteristicId = isProvisionedComplete ? mMeshProxyDataInCharacteristic : mMeshProvisioningDataInCharacteristic
        let serviceId = isProvisionedComplete ? MESH_PROXY_UUID[0] : MESH_PROVISION_UUID[0]
        DEBUG('write' , util.ab2hex(ab))
        if (that.deviceId&&serviceId&&characteristicId)
        wx.writeBLECharacteristicValue({
            deviceId: that.deviceId,
            serviceId: serviceId,
            characteristicId: characteristicId,
            value: ab,
            success: function (res) {
                if (curSegments.length == 0) {
                    if (queue.size() !== 0) {
                        writeNextMessage()
                    } else {
                        //消息列表empty
                        busy = false
                    }
                } else {
                    writeRemainSegments(curSegments)
                }
            },
            fail: function () {
               ERROR('writeData' + util.ab2hex(curSegments))
            },
            complete: function (res) {

            }
        })


    }

}

module.exports = MeshConnectorInstance;