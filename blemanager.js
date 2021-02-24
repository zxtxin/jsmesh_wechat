import {MESH_BLUE_LOG_ENABLE} from "./mesh_core/constant";

const MESH_PROVISION_UUID = ['00001827-0000-1000-8000-00805F9B34FB']
const MESH_PROXY_UUID = ['00001828-0000-1000-8000-00805F9B34FB']
const MESH_PROXY_DATA_IN = '00002ADD-0000-1000-8000-00805F9B34FB'
const MESH_PROXY_DATA_OUT = '00002ADE-0000-1000-8000-00805F9B34FB'
const MESH_PROVISIONING_DATA_IN = '00002ADB-0000-1000-8000-00805F9B34FB'
const MESH_PROVISIONING_DATA_OUT = '00002ADC-0000-1000-8000-00805F9B34FB'

function BleManager(blueStateCb) {
    let that = this;
    let util = require('/utils/util.js');
    let Queue = require('Queue');
    let queue = new Queue()
    let mMeshProvisioningDataInCharacteristic = null;
    let mMeshProvisioningDataOutCharacteristic = null;
    let mMeshProxyDataInCharacteristic = null;
    let mMeshProxyDataOutCharacteristic = null;
    let isProvisionedComplete = true;
    let busy = false;
    let connectedTomesh = false
    let write_complete_cb = null
    let blueState_cb = blueStateCb
    let currentDevice = null
    let blueAdapterState = new Object()
    let disconnectByUser = false
    let isScanning = false
    let isConnecting = false
    let deviceReady = false
    that.isDeviceReady = function () {
        return deviceReady
    }
    that.isConnectToMesh = function () {
        return connectedTomesh;
    }
    that.isProvisioned = function () {
        return isProvisionedComplete;
    }
    that._isScaning = function () {
        return isScanning
    }
    that._isConnecting = function () {
        return isConnecting
    };
    this.getDevice = function () {
        return currentDevice;
    };
    (function init() {
        wx.openBluetoothAdapter({
            success(res) {
                if (blueState_cb) {
                    blueState_cb.onBlueOpened(res)
                }
            },
            fail(res) {
                LOG('openBluetoothAdapter ')('fail ' + JSON.stringify(res))
                if (blueState_cb) {
                    blueState_cb.onBlueOpenfailed(res)
                }
            },
            complete(res) {
            }
        })

        wx.onBLEConnectionStateChanged(res => {
            connectedTomesh = res.connected
            if (!res.connected) {
                resetParams()
            } else {
                res.name = currentDevice.name
            }
            if (blueState_cb) {
                res.connected ? blueState_cb.onDeviceConnected(res) : blueState_cb.onDeviceDisConnected(res);
            }


        })
        wx.onBluetoothAdapterStateChange(res => {
            blueAdapterState = res
            if (blueState_cb) {
                res.available ? blueState_cb.onBlueAdapterEnabled(res) : blueState_cb.onBlueAdapterdisabled(res)
            }
            if (!res.available)
                if (!disconnectByUser) {
                    closeBleConnection(true)
                }
        })

    })();


    function onDeviceDiscovery(res) {
        wx.onBluetoothDeviceFound(function (res) {
            if (blueState_cb) {
                blueState_cb.onScanResults(res)
            }

        })
        return success(res)
    }

    /**
     * 开启蓝牙适配器
     * @param cb
     */
    async function enableBluetoothAdapter(res) {
        return new Promise((resolve, reject) => {
            wx.openBluetoothAdapter({
                success(res) {
                    blueAdapterState.available = true
                    resolve(res)
                },
                fail(res) {
                    LOG('enableBluetoothAdapter')('fail:' + JSON.stringify(res))
                    blueAdapterState.available = false
                    reject(res)
                }
            })
        })
    }

    /**
     * 释放蓝牙资源
     */
    function closeBluetoothAdapter() {
        return new Promise((resolve, reject) => {
            wx.closeBluetoothAdapter({
                success(res) {
                    blueAdapterState.discovering = false
                    blueAdapterState.available = false
                    resolve(res)
                },
                fail(res) {
                    LOG('closeBluetoothAdapter')('blue adapter close fail:' + JSON.stringify(res))
                    reject(res)
                },
                complete(res) {
                }
            })
        })
    }

    that.startScanProvisonedDevice = function () {
        return that.startBluetoothDevicesDiscovery(MESH_PROXY_UUID)
    }
    that.startScanUnProvisonedDevice = function () {
        return that.startBluetoothDevicesDiscovery(MESH_PROVISION_UUID)
    }

    function startBluetoothDevicesDiscovery(uuid) {
        function scanUUid() {
            return success(uuid)
        }

        return isBlueStateAvaliable()
            .then(scanUUid)
            .then(scanStart)
            .then(onDeviceDiscovery)
    }

    that.startScan = startBluetoothDevicesDiscovery

    function scanStart(uuid) {
        LOG('startBluetoothDevicesDiscovery')('scan uuid:' + uuid)
        isScanning = true
        return new Promise((resolve, reject) => {
            wx.startBluetoothDevicesDiscovery({
                // services: isProvisionedComplete ? [MESH_PROXY_UUID] : [MESH_PROVISION_UUID],
                // services: ['9527'],
                services: uuid,
                allowDuplicatesKey: true,
                success(res) {
                    resolve(res)
                },
                fail(res) {
                    LOG('startBluetoothDevicesDiscovery')('fail:' + JSON.stringify(res))
                    reject(res)
                }
            })
        })
    }

    function stopScan() {
        return new Promise((resolve, reject) => {
            wx.stopBluetoothDevicesDiscovery({
                success(res) {
                    isScanning = false

                    resolve(res)

                }, fail(res) {
                    LOG('stopBluetoothDevicesDiscovery')('scaning stoped fail')
                }
            })
        })

    }

    this.stopScan = stopScan

    this.createBLEConnection = function (BluetoothDevice) {
        currentDevice = BluetoothDevice

        function device() {
            return success(currentDevice)
        }

        return isBlueStateAvaliable()
            .then(isBlueDiscovering)
            .then(stopDiscroveringifNecessary)
            .then(device)
            .then(connect)
            .then(discoveryServices)
            .then(matchMeshService)
            .then(enableNotification)
            .then(onBleCharValueChange)

    }

    function stopDiscroveringifNecessary(res) {
        return new Promise(((resolve, reject) => {
            if (res.discovering) {
                return resolve(stopScan())
            } else {
                return resolve({discovering: false})
            }
        }))
    }

    function connect(device) {
        return new Promise((resolve, reject) => {
            wx.createBLEConnection({
                deviceId: device.deviceId,
                success(res) {
                    isConnecting = false
                    res.deviceId = device.deviceId
                    resolve(res)
                },
                fail(res) {
                    reject(res)
                }
            })
        })
    }

    function isBlueStateAvaliable() {
        return new Promise((resolve, reject) => {
            if (!blueAdapterState.available) {
                return resolve(enableBluetoothAdapter())
            } else {
                return resolve(blueAdapterState)
            }
        })
    }

    function isBlueDiscovering(res) {
        return new Promise((resolve, reject) => {
            resolve(blueAdapterState)
        })
    }

    function resetParams() {
        isProvisionedComplete = false
        connectedTomesh = false
        isConnecting = false
        mMeshProvisioningDataInCharacteristic = null;
        mMeshProvisioningDataOutCharacteristic = null;
        mMeshProxyDataInCharacteristic = null;
        mMeshProxyDataOutCharacteristic = null;
        queue.clear()
        currentDevice = null
        busy = false
        deviceReady = false
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

    function closeBleConnection(ifNeedCloseAdapter) {
        disconnectByUser = true;
        return new Promise((resolve, reject) => {
            wx.closeBLEConnection({
                deviceId: currentDevice.deviceId,
                success(res) {
                    queue.clear()
                    if (ifNeedCloseAdapter) {
                        resolve(closeBluetoothAdapter())
                    } else {
                        resolve(res)
                    }

                }
                , fail(res) {
                    reject(res)
                }
            })
        })
    }

    this.disconnectBlu = function () {
        return closeBleConnection(true)
    }

    function matchMeshService(res) {
        LOG('matchMeshService')(JSON.stringify(res))
        return new Promise((resolve, reject) => {
            let deviceId = res.deviceId
            let services = res.services
            let serviceId
            let result
            services.map((service => {
                if (service.uuid === MESH_PROVISION_UUID[0] || service.uuid === MESH_PROXY_UUID[0])
                    serviceId = service.uuid
            }))
            wx.getBLEDeviceCharacteristics({
                deviceId,
                serviceId,
                success: (res) => {
                    LOG('getBLEDeviceCharacteristics')(serviceId)
                    if (serviceId === MESH_PROVISION_UUID[0]) {
                        isProvisionedComplete = false
                        if (res.characteristics[0].uuid === MESH_PROVISIONING_DATA_IN) {
                            mMeshProvisioningDataInCharacteristic = res.characteristics[0].uuid
                        }
                        if (res.characteristics[1].uuid === MESH_PROVISIONING_DATA_OUT) {
                            mMeshProvisioningDataOutCharacteristic = res.characteristics[1].uuid

                        }
                        result = {
                            serviceId: serviceId,
                            charIn: mMeshProvisioningDataInCharacteristic,
                            charOut: mMeshProvisioningDataOutCharacteristic
                        }
                        resolve(result)
                        // enableNotification(cb)
                    } else if (serviceId === MESH_PROXY_UUID[0]) {
                        isProvisionedComplete = true
                        if (res.characteristics[0].uuid === MESH_PROXY_DATA_IN) {
                            // console.log(res.characteristics[0])
                            mMeshProxyDataInCharacteristic = res.characteristics[0].uuid
                        }
                        if (res.characteristics[1].uuid === MESH_PROXY_DATA_OUT) {
                            // console.log(res.characteristics[1])
                            mMeshProxyDataOutCharacteristic = res.characteristics[1].uuid
                        }
                        result = {
                            serviceId: serviceId,
                            charIn: mMeshProxyDataInCharacteristic,
                            charOut: mMeshProxyDataOutCharacteristic
                        }
                        resolve(result)
                        // enableNotification(cb)
                    } else {

                        //do  nothing

                    }

                },
                fail(res) {
                    console.error('getBLEDeviceCharacteristics', res)
                    reject(res)
                }
            })
        })
    }

    function discoveryServices(res) {
        LOG('discoveryServices')(JSON.stringify(res))
        let deviceId = res.deviceId
        return new Promise((resolve, reject) => {
            wx.getBLEDeviceServices({
                deviceId: deviceId,
                success: (res) => {
                    res.deviceId = deviceId
                    resolve(res)
                },
                fail(res) {

                    reject(res)
                }
            })
        })
    }

    function onBleCharValueChange() {
        // notify dataChanged
        wx.onBLECharacteristicValueChange(function (res) {
            blueState_cb.onDataReceived(res)
        })
        deviceReady = true
        blueState_cb.onDeviceReady()
        return success({enableNotification: true})
    }

    function enableNotification(res) {
        LOG('enableNotification')(JSON.stringify(res))
        return new Promise((resolve, reject) => {
            let characteristicId = res.charOut
            let serviceId = res.serviceId
            wx.notifyBLECharacteristicValueChange({
                deviceId: currentDevice.deviceId,
                serviceId: serviceId,
                characteristicId: characteristicId,
                type: 'indicate',
                state: true,
                success() {
                    resolve({'enableNotification': true})
                    // onBleCharChange()
                },
                fail(res){
                    reject(res)
                }
            })
        })
    }

    this.setDataWriteCallback = function (cb) {
        write_complete_cb = cb;
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
        console.log('write:'+util.ab2hex(ab))
        if (currentDevice)
            wx.writeBLECharacteristicValue({
                deviceId: currentDevice.deviceId,
                serviceId: serviceId,
                characteristicId: characteristicId,
                value: ab,
                success: function (res) {
                    if (curSegments.length == 0) {
                        if (queue.size() !== 0) {
                            //写入下一个消息
                            if (write_complete_cb) {
                                if (pdu.message)
                                    write_complete_cb(pdu.message)
                            }
                            writeNextMessage()
                        } else {
                            //消息列表empty
                            busy = false
                        }
                    } else {
                        // let delay=0
                        // if (pdu.message)
                       // delay=pdu.message.opcode===0x00?1000:0  // 用于验证消息重发是否可行(ConfigAppKeyAdd  分段包)，
                       //  setTimeout(() => {
                       //      writeRemainSegments(curSegments)
                       //  }, delay)
                        writeRemainSegments(curSegments)
                    }
                },
                fail: function () {
                    LOG('writeBLECharacteristicValue')('write failed..' + util.ab2hex(curSegments))
                },
                complete: function (res) {

                }
            })


    }


}

function LOG(tag) {
    return function (info) {
        if (MESH_BLUE_LOG_ENABLE)
            console.log('bleManager ' + tag + ':\n' + info)
    }
}

module.exports = BleManager;
