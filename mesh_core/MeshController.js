const MeshControllerInstance = (function () {
    let instance;

    function getInstance() {
        if (instance === undefined) {
            instance = new MeshController();
        }
        return instance;
    }

    return {
        getInstance: getInstance
    }

})();

function MeshController() {
    let that = this
    let _MeshApi = null;
    let _MeshConnector = null;
    let _MeshScanner = null;
    let _CloudController = null;
    let _Provisioner = null;
    let logger;
    let nodesDataChangeListener;
    let connStateChangeListener;
    let groupDataChangeistener;
    let userConfigChangeListener;
    let wxUserInfo;
    that.MeshApi = new function () {
        return _MeshApi
    };
    that.MeshConnector = new function () {
        return _MeshConnector
    };
    that.MeshScanner = new function () {
        return _MeshScanner
    };
    that.CloudController = new function () {
        return _CloudController
    };
    that.Provisioner = new function () {
        return _Provisioner
    };

    that.init = function () {
        _MeshApi = require('./MeshmanagerApi.js').getInstance();
        _MeshConnector = require('./MeshConnector').getInstance();
        _MeshScanner = require('./MeshScanner').getInstance();
        _CloudController = require('./CloudfuncController').getInstance();
        _Provisioner = require('./MeshProvisioner').getInstance();
        _Provisioner.nodeDataObserver.set(function () {
            if (nodesDataChangeListener) {
                nodesDataChangeListener();
            }
        })
        _MeshConnector.setConnStateChangelistener(function (res) {
            if (connStateChangeListener) {
                connStateChangeListener(res)
            }
        })

        _Provisioner.groupDataObserver.set(function () {
            if (groupDataChangeistener) {
                groupDataChangeistener()
            }
        })
        _Provisioner.configDataObserver.set(function () {
            if (userConfigChangeListener) {
                userConfigChangeListener()
            }
        })
        _Provisioner.wxUserinfo.set(wxUserInfo);
        _Provisioner.init();
        (function init() {
            _MeshScanner.setMeshConfigProvider({
                provideMeshConfig: function () {
                    return _Provisioner.getMeshConfig();
                },
                provideCurNode: function () {
                    return _Provisioner.getCurNode();
                },
                provideNodes: function () {
                    return _Provisioner.nodes.get();
                }
            });

            _MeshConnector.setNotificationCallback(function (res) {
                //接收数据并解析

                _MeshApi.parseNotification(res)
            });
            _MeshApi.setPduSendCallback(pkts => {
                //发送数据
                _MeshConnector.sendPdu(pkts)
            });
            _MeshApi.setDataProvider({
                provideCurMeshConfig: function () {
                    return _Provisioner.getMeshConfig();
                },
                provideCurNode: function () {
                    return _Provisioner.getCurNode();
                }
            });
            _MeshApi.nodeChangeCallback.set({

                removeNode: function (res) {
                    _Provisioner.deleteNode(res)
                },
                updateNode: function (res) {
                    //获取CompositionData 后回调
                    let node = _Provisioner.getCurNode()
                    node.page = res.page;
                    node.elements = res.elements;
                    _Provisioner.updateNode(node);
                    _Provisioner.insertOnOffModel(node)
                },
                updateAddedAppkeyInfo: function (res) {
                    _Provisioner.keyInfoUpdate(res)
                },
                updateBoundAppkeyInfo: function (res) {
                    _Provisioner.boundKeyInfoUpdate(res)
                },

                updateConfigModelSubscriptionInfo: function (res) {
                    _Provisioner.subcriptionUpdate(res)
                },
                updateSeqNumber: function (seqNum) {
                    notifySeqNumberChange({seqNum,ivIndex:_Provisioner.getMeshConfig().ivIndex})
                    _Provisioner.updateSeqNumber(seqNum).then(res => {
                    }).catch(reason => {
                    })
                },
                _setCurNode: function (node) {
                    that.setCurNode(node)
                },
                saveProvisionedNode: function (node) {
                    _Provisioner.insertNode(node)
                },
                updateUnicastAddress: function (unicastAddress) {
                    _Provisioner.updateUnicastAddress(unicastAddress).catch(reason => {
                    })
                },
                getConnDevice: function () {
                    return that.getConnDevice();
                }

            });


        })();
    }

    that.nodeDataObserver = function (observer) {
        nodesDataChangeListener = observer

    }
    that.nodes = function () {
        return _Provisioner.nodes.get();
    };
    that.reSlectNodes = function () {
        _Provisioner.reSlectNodes()
    };
    that.setLogger = function (log) {
        logger = log;
        _MeshApi.setLogger(log);
        _MeshConnector.setLogger(log);
        _MeshScanner.setLogger(log);
        _CloudController.setLogger(log);
        _Provisioner.setLogger(log);
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


    that.isCurNodeReset = function () {
        return (_Provisioner.getCurNode().name === _MeshConnector.device.get().name)
    };
    that.scanUnprovDevice = function () {
        return _MeshScanner.scanUnprovDevice(arguments[0]);
    }
    that.scanProxyNode = function () {
        return _MeshScanner.scanProxyNode(arguments[0]);
    }
    that._stopScan = function () {
        return _MeshScanner.stopScan()
    };
    that.setScanCanllback = function (cb) {
        _MeshScanner.setScanCanllback(cb)
    }
    that.getScanCallback = function () {
        return _MeshScanner.getScanCallback();
    }
    that.connect = function (device, connectToProxy) {
        return _MeshConnector.connect(device).then(res => {
            DEBUG('connect success', connectToProxy)
            if (connectToProxy) {
                //连接成功设置当前代理节点
                that.setCurNode(device.name)
            }
            return new Promise(resolve => {
                resolve(res);
            })
        }).catch(reason => {
            return new Promise((resolve, reject) => {
                reject(reason)
            })
        })
    }
    //是否正在连接
    that._isConnecting = function () {
        return _MeshConnector._isConnecting();
    }
    that._isScaning = function () {
        return _MeshScanner._isScanning();
    };
    that.connected = function () {
        return _MeshConnector.connected.get();
    }
    that.disconnect = function () {
        return _MeshConnector.disconnect().then(that.closeAdapter_)
    }

    that.refreshGatt = function () {
        return _MeshScanner.refreshGatt()
    }
    that.closeAdapter_ = function () {
        return _MeshScanner.closeAdapter();
    }
    that.setMeshProvisioningHandler = function (res) {
        _MeshApi.setMeshProvisioningHandler(res)
    };
    that.registerMeshMessageHandler = function (res, cb) {
        _MeshApi.registerMeshMessageHandler(res, cb)
    };
    that.unregisterMeshMessageHandler = function (key) {
        _MeshApi.unregisterMeshMessageHandler(key)
    };
    that.regDeviceReadyCb = function (key, cb) {
        _MeshConnector.regDeviceReadyCb(key, cb)
    }
    that.unRegDeviceReadyCb = function (key) {
        _MeshConnector.unRegDeviceReadyCb(key)
    }
    that.getConnDevice = function () {
        return _MeshConnector.device.get()
    }
    that.getCurNode = function () {
        return _Provisioner.getCurNode();
    };
    that.getGroups = function () {
        return _Provisioner.groups.get()
    };
    that.addGroup = function (group) {
        _Provisioner.addGroup(group)
    }
    that.deleteGroup = function (group) {
        _Provisioner.deleteGroup(group)
    }
    that.groupDataObserver = function (cb) {
        groupDataChangeistener = cb;
    }
    that.reSelectGroups = function () {
        _Provisioner.reSelectGroups();
    };
    that.getMeshConfig = function () {
        return _Provisioner.getMeshConfig()
    }
    that.isBound = function () {
        return _Provisioner.isBoundOthers();
    }
    that.setSelectedNode = function (res) {
        _MeshApi.seletNode.set(res)
    };
    that.setCurNode = function (node) {
        _Provisioner.setCurNode(node)
    };
    that.unProvionNode = function () {
        return _MeshApi.unProvionNode.get()
    };
    that.sendMeshMessage = function (message) {
        return _MeshApi.sendMeshMessage(message)
    };
    that.startInvite = function () {
        _MeshApi.startInvite()
    };
    that.openid = function () {
        return _Provisioner.openid();
    };
    that.selectModelsCloud = function (node) {
        return _CloudController.selectModelsCloud(node)
    };
    that.listenModelChange = function (cb) {
        _Provisioner.listenModelChange(cb)
    };
    that.updateModelStateCloud = function (model) {
        return _Provisioner.updateModelStateCloud(model)
    };
    that._setConnStateChangelistener = function (cb) {
        connStateChangeListener = cb;

    };
    that.closeModelWatch = function () {
        _CloudController.closeModelWatch()
    };

    that.bindUser = function (openid) {
        return _Provisioner.bindUser(openid)
    };
    that.unbindUser = function () {
        return _Provisioner.unbindUser()
    };
    that.setUserConfigChangeListener = function (cb) {
        userConfigChangeListener = cb
    };
    that.setUserInfo = function (userInfo) {
        wxUserInfo = userInfo
    };
    that.updateIvIndex=function(){
       _MeshApi.updateIvIndexByProvionsioner()
    };
    function notifySeqNumberChange(res){
      if (that.seqNumObserver.get())
        that.seqNumObserver.get()(res);
    }
    that.seqNumObserver=new function(){
        let observer;
        this.set=function (fun) {
            observer=fun;
        }
        this.get=function () {
            return observer;
        }
        return this;
    }
    that.destroy = function () {
        _CloudController.closeNodesWatch();
        _CloudController.closeGroupWatch();
        _CloudController.closeProCfgWatch();
        _CloudController.closeModelWatch();
    }
}

module.exports = MeshControllerInstance.getInstance();