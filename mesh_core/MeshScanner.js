import {MESH_CONFIG_PROVIDER_NULL, NOT_VALIABLE_MESH_SERVICES, STATE_ALREADY_SCANNING} from "./errorCode";
import {ab2hex} from "../utils/util";
import {caculatehash, k3} from "../utils/SecurityToolBox";
import {MESH_PROVISION_UUID, MESH_PROXY_UUID} from "./constant";
let ErrorMessage=require("./ErrorMessage")

const NODE_IDENTITY = 0x01;
const NETWORKID_IDENTITY = 0x00;
const MeshScannerInstance = (function () {
    let instance;

    function getInstance() {
        if (instance === undefined) {
            instance = new MeshScanner();
        }
        return instance;
    }

    return {
        getInstance: getInstance
    }

})()

function MeshScanner() {
    let isScanning = false;
    let blueAdapter = new BlueAdapter();
    let that = this
    let meshConfigProvider;
    let logger;
    let scanCallback;
    that.setScanCanllback=function(cb){
        scanCallback=cb
    }
    that.getScanCallback=function(){
        return scanCallback
    };
    that.setLogger=function(log){
        logger=log;
    }
    that._isScanning=function (){return isScanning}
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
    that.setMeshConfigProvider=function(res){
        meshConfigProvider=res;
    }
    blueAdapter.listenBlueAdapterStateChange(function (res) {
        if (!res.available) {
            if (isScanning) {
                isScanning=false;
                that.stopScan()
            }
        } else {

        }
    });
    //刷新手机gatt 缓存 扫描不同服务设备需要调用这段代码
    that.refreshGatt = function () {
        return blueAdapter.closeBlueAdapter().then(blueAdapter.openBlueAdapter)
    }
    /**
     *
     * @param cb{ function (res){}//扫描设备回调}
     * @returns {Promise<any>|Promise<any | never>}
     */
    this.scanUnprovDevice = function () {
        if (isScanning) {
            return deviceAlreadyScanning()
        }
        function buildParams() {
            return success({uuid: MESH_PROVISION_UUID})
        }

        return that.refreshGatt().then(buildParams).then(startScan)


    }
    this.closeAdapter=function  () {
        return blueAdapter.closeBlueAdapter()

    }
    /**
     *
     * @param res:{networKey,//hex;
     *             nodes,//已经入网的设备；
     *             cb:function(res){}//扫描到的设备回调
     *             }
     * @returns {Promise<any>|Promise<any | never>}
     */
    this.scanProxyNode = function () {
        let res = {}
        if (!meshConfigProvider){
            return new Promise((resolve, reject) => {
                reject(new ErrorMessage(MESH_CONFIG_PROVIDER_NULL,'meshConfigProvider can not be null!'))
            })

        }

        if (isScanning) {
            return deviceAlreadyScanning()
        }
        res.networKey =meshConfigProvider.provideMeshConfig().networKey[0];
        res.uuid = MESH_PROXY_UUID
        res.nodes=meshConfigProvider.provideNodes();
        function buildParams() {
            return success(res)
        }

        return that.refreshGatt().then(buildParams).then(startScan)
    }
    this.stopScan = function () {

        return new Promise((resolve, reject) => {
            wx.stopBluetoothDevicesDiscovery({
                success(res) {
                    isScanning = false
                    DEBUG('stopScan','success')
                    resolve(res)

                }, fail(res) {
                    ERROR('stopScan',JSON.stringify(res))
                    reject(res)
                }
            })
        })
    }

    function startScan(params) {
        if (params.uuid === MESH_PROXY_UUID) {
            DEBUG('scanProxyNode','......')
            params.caculateNetKeyId = k3(params.networKey).toUpperCase()
        }else {
            DEBUG('scanUnProvision Devices','......')
        }
        return new Promise((resolve, reject) => {
            let ErrorMessage = require('./ErrorMessage')
            wx.startBluetoothDevicesDiscovery({
                services: params.uuid,
                allowDuplicatesKey: true,
                success(res) {
                    isScanning = true
                    DEBUG('isScanning',isScanning)
                    wx.onBluetoothDeviceFound(function (result) {
                        if (params.uuid === MESH_PROXY_UUID) {
                                let nodes = params.nodes
                                result.devices.map(device => {
                                    let _devices = filterAdv(params.networKey,device, params.caculateNetKeyId, nodes)
                                    if (_devices){
                                        if (scanCallback){
                                            scanCallback(_devices)
                                        }
                                    }
                                        // params.cb(_devices)
                                })
                                resolve()

                            } else if (params.uuid === MESH_PROVISION_UUID) {
                                result.devices.map(device => {
                                    device.uuid=ab2hex(device.serviceData[MESH_PROVISION_UUID])
                                    if (scanCallback){
                                        scanCallback(device)
                                    }
                                    // params.cb(device)
                                })
                                resolve()
                            } else {
                                reject(new ErrorMessage(NOT_VALIABLE_MESH_SERVICES, 'mesh service not found' ))
                            }

                    })
                },
                fail(res) {
                    reject(res)
                }
            })
        })
    }

    function filterAdv(networKey,device, caculateNetKeyId, nodes) {
        let beacon = device.serviceData[MESH_PROXY_UUID]//arrayBuffer
        if (beacon) {
            let hex = ab2hex(beacon)
            let beaconType = parseInt(hex.slice(0, 2), 16)
            if (beaconType === NODE_IDENTITY) {
                let netKey = networKey;
                let beaconhash = hex.slice(2, 2 * 9)
                let random = hex.slice(9 * 2)
                let _device;
                nodes.map(res => {
                    let caculhash = caculatehash(netKey, random, res.unicastAddress)
                    if (caculhash === beaconhash) {
                        console.log('node identity  match')
                        _device = device
                    }
                })
                return _device;
            } else if (beaconType === NETWORKID_IDENTITY) {
                if (hex.slice(2).toUpperCase() === caculateNetKeyId) {
                    console.log('networkID identity match')
                    return device
                }
            }
        }

        return null;
    }

    function deviceAlreadyScanning() {
        let ErrorMessage = require('./ErrorMessage')
        return fail(new ErrorMessage(STATE_ALREADY_SCANNING, 'state is scanning you need stopScan first'))
    }


}

function success(res) {
    return new Promise(resolve => {
        resolve(res)
    })
}

function fail(res) {
    return new Promise((resolve, reject) => {
        reject(res)
    })
}

function BlueAdapter() {
    this.openBlueAdapter = function () {
        return new Promise((resolve, reject) => {
          wx.openBluetoothAdapter({
                success(res) {
                    resolve(res)

                },
                fail(res) {
                    reject(res)
                }
            })

        })

    }
    this.closeBlueAdapter = function () {
        return new Promise((resolve, reject) => {
            wx.closeBluetoothAdapter({
                success(res) {
                    resolve(res)
                },
                fail(res) {
                    reject(res)
                }
            })
        })
    }
    this.listenBlueAdapterStateChange = function (cb) {
        wx.onBluetoothAdapterStateChange(res => {
            cb(res)
        })
    }


}

module.exports = MeshScannerInstance;