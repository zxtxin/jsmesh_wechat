import {UNEXPECTED_MESSAGE_TYPE} from "./errorCode";
import {SEG_ACK, SEG_RESENT} from "./MeshOpCode";
import {caculateCMAC, caculateSalt, calculateAuthValueSecureNetBeacon, mesh_enc, T_gen} from "../utils/SecurityToolBox";
import {txt2hex, toHexString} from "../utils/util";
import {LightLightnesStatus} from "./MeshMessage";
import {SecureNetworkBeacon} from "./MeshBeacon"

const [PDU_TYPE_NETWORK, PDU_TYPE_MESH_BEACON] = [0x00, 0x01];

let TYPE = {
    WRITE: 1,//send msg
    RECEIVED: 0,//received data
    OTHER: 2,
}

function valideKey(xy) {
    let arr = []
    let idx = xy.length
    while (idx > 1) {
        arr.push(xy.slice(idx - 2, idx))
        idx -= 2
    }
    if (idx === 1) {
        arr.push(xy.slice(0, idx))
    }
    let ab = new ArrayBuffer(arr.length)
    let dv = new DataView(ab)
    arr.reverse().map((value, index, array) => {
            dv.setUint8(index, parseInt(value, 16))
        }
    )

    function ab2hex(buffer) {
        let hexArr = Array.prototype.map.call(
            new Uint8Array(buffer),
            function (bit) {
                return ('00' + bit.toString(16)).slice(-2)
            }
        )
        return hexArr.join('');
    }

    return ab2hex(ab)
}


const MeshManagerApiInstance = (function () {
    let instance;

    function getInstance() {
        if (instance === undefined) {
            instance = new MeshApi();
        }
        return instance;
    }

    return {
        getInstance: getInstance
    }

})()

function MeshApi() {
    console.log('MeshApi init')
    let that = this
    let Mesh = require('./mesh.js');
    let mesh = new Mesh()
    let OPCODE = require('./MeshOpCode')
    let Curve = require('../ecc/ECDH');
    let ECDH = new Curve()
    let keyPair;
    let provisionBox = {};
    let provisionerProvider;
    let logger;
    that.setLogger = function (log) {
        logger = log;
    }
    //手机主动发起IvIndex更新
    that.updateIvIndexByProvionsioner = function () {
        // let curIvIndex = addPaddingIndex(getIvIndex() + 1);//hex
        let curIvIndex = addPaddingIndex( 1);//test code
        updateIvIndex(1);// test code
        let netkey = that.MeshConfig().networKey[0];
        let Key_Refrsh_Flag = 0;
        let IV_Update_Flag = 1;
        let flag = IV_Update_Flag << 1 | Key_Refrsh_Flag;
        flag = ('0' + (flag & 0xFF).toString(16)).slice(-2);
        let data = calculateAuthValueSecureNetBeacon(netkey, flag, curIvIndex);
        DEBUG('updateIvIndexByProvionsioner', data);
        let pkts = [];
        mesh.proxy_tx(data.beacon, 20, 0x01).map(function (item) {
            pkts.push({seg: item})
        });

        sendPdu(pkts);
    };

    function DEBUG(tag, info) {
        // console.log(info)
        if (logger) {
            logger.DEBUG(tag, info);
        }
    }

    function ERROR(tag, info) {
        if (logger) {
            logger.ERROR(tag, info);
        }
    }

    that.unProvionNode = new function () {
        let node = {};
        this.update = function (filed) {
            for (let key in filed) {
                node[key] = filed[key]
            }
        }
        this.get = function () {
            return node
        }
        this.reset = function () {
            node = {};
        }
    };
    let nodeChangeCallback = new function () {
        let callback;
        this.set = function (cb) {
            callback = cb;

        }
        this.get = function () {
            DEBUG('nodeChangeCallback', 'get')
            return callback
        }
        return this;
    };
    this.nodeChangeCallback = nodeChangeCallback;
    that.setDataProvider = function (callback) {
        provisionerProvider = callback;
    };
    that.MeshConfig = function () {
        return provisionerProvider.provideCurMeshConfig();
    }
    that.seletNode = function () {
        return provisionerProvider.provideCurNode();
    }

    function seqNum() {
        return that.MeshConfig().seq_num
    }

    function netKey() {
        return that.MeshConfig().networKey[0]
    }

    function appkey() {
        return that.MeshConfig().appKeys[0]
    }

    function srcAddress() {
        return that.MeshConfig().src
    }

    function _deviceKey() {
        return that.seletNode().deviceKey;
    };

    let {
        CompositionDataStatus,
        ConfigNodeResetStatus,
        ConfigAppKeyAddStatus,
        ConfigModelAppkeyBindStatus,
        GenericOnOffStatus,
        ConfigModelSubscriptionStatus
    } = require('./MeshMessage')

    let {ab2hex, hexToBytes, unsignedBytesToInt, unsignedByteToInt} = require('../utils/util');
    let incommingBuffer = new Array();
    let netPduArr = new Array();
    let lower_pkts = new Set();
    let meshProvisoningHandler;
    let meshMessageHandler = new Map();
    let pduSendCallBack;
    that.setPduSendCallback = function (callback) {
        pduSendCallBack = callback;
    };
    that.setMeshProvisioningHandler = function (handler) {
        meshProvisoningHandler = handler;
    };
    that.registerMeshMessageHandler = function (key, handler) {
        meshMessageHandler.set(key, handler);
    };
    that.unregisterMeshMessageHandler = function (key) {
        if (meshMessageHandler.has(key))
            meshMessageHandler.delete(key);
    };
    //step2
    that.startInvite = function () {
        if (meshProvisoningHandler) {
            initPublickey();
        }
    }

    //step1
    function initPublickey() {
        let random = ECDH.pick_rand()
        let privKey = random.toString()
        let pubkey = ECDH.getPubkey(privKey)
        if (pubkey.length !== 128 || privKey.length !== 77) {
            initPublickey()
        } else {
            keyPair = {privKey, pubkey}
            meshProvisoningHandler.onStartInvite(startInviteSend())
        }
    }

    function parseProvisionPdu(arrayBuffer) {
        let handler = meshProvisoningHandler
        let ProvisionPduType = '03'
        if (meshProvisoningHandler) {
            let rslt = provision_rx(arrayBuffer)
            if (rslt) {
                let OpCode = parseInt(rslt.pdu.slice(0, 2), 16)
                let pdu = rslt.pdu
                switch (OpCode) {
                    case 0x01:
                        that.unProvionNode.reset();
                        provisionBox.capabilities = (ProvisionPduType + pdu).slice(4)
                        DEBUG('parseProvisionPdu', 'capabilities:' + JSON.stringify(provisionBox.capabilities))
                        handler.onReceivedCapabilities(parseCapabilities(ProvisionPduType + pdu))
                        handler.onProvisionStart(provisionStart(pdu))
                        handler.onSendingPublicKey(sendingPublicKey(keyPair))
                        break;

                    case 0x03:
                        //Received publicKeyState
                        handler.onReceivedPublicKey(receivedPubKey(pdu))
                        handler.onSendConfirmData(sendingConfirm())
                        break;
                    case 0x05:
                        handler.onReceivedConfirm(receivedConfirm())
                        handler.onSendConfirmRandom(sendConfirmRandom())
                        break;
                    case 0x06:
                        handler.onReceivedConfirmRandom(receivedConfirmRandom());
                        let data = sendingProvisionData(pdu);
                        let obj = {
                            unicastAddress: data.provisionBox.unicastAddress,
                            deviceKey: data.provisionBox.deviceKey
                        };
                        updateUnProvNode(obj)
                        handler.onSendingProvisionData(data)
                        break;
                    case 0x08:
                        let res = receivedProvisionComplete();
                        let device = getConnDevice();
                        obj = {name: device.name, deviceId: device.deviceId, uuid: device.uuid};
                        updateUnProvNode(obj);
                        saveProvisionedNode(res);
                        updateUnicastAddress(res);
                        // setCurNode();
                        handler.onReceivedProvisionComplete(res);
                        break
                }
            }
        }
    };

    function updateUnProvNode(obj) {
        that.unProvionNode.update(obj)
    }

    function saveProvisionedNode(res) {
        let node = that.unProvionNode.get();
        setCurNode(node)
        nodeChangeCallback.get().saveProvisionedNode(node)
    }

    function updateUnicastAddress(res) {
        let node = that.unProvionNode.get();
        let elementSize = res.elements;
        let curUnicastAddress = node.unicastAddress;
        nodeChangeCallback.get().updateUnicastAddress(parseInt(curUnicastAddress, 16) + elementSize);
    }

    function setCurNode(node) {
        nodeChangeCallback.get()._setCurNode(node)
    }

    function getConnDevice() {
        return nodeChangeCallback.get().getConnDevice();

    }

    function startInviteSend() {
        cetProvisionMsg('00' + '05');
        return {type: TYPE.WRITE, status: 'Sending Invite'}
    }

    function parseCapabilities(pdu) {
        let bytes = hexToBytes(pdu);
        let res = {
            type: TYPE.RECEIVED,
            status: 'Received CapabilitiesState',
            capabilities: {
                elements: bytes[2],
                algorithm: (((bytes[3] & 0xff) << 8) | (bytes[4] & 0xff)),
                rawPublicKeyType: bytes[5],
                rawStaticOOBType: bytes[6],
                outputOOBSize: bytes[7],
                outputOOBAction: (((bytes[8] & 0xff) << 8) | (bytes[9] & 0xff)),
                inputOOBSize: bytes[10],
                inputOOBAction: (((bytes[11] & 0xff) << 8) | (bytes[12] & 0xff))
            }
        };
        provisionBox.elements = res.capabilities.elements;
        return res;
    }

    function provisionStart(pdu) {
        let start = '0000000000';
        provisionBox.start = start;
        let state = {type: TYPE.WRITE, status: 'Sending ProvisionStartState'};
        cetProvisionMsg('02' + start);
        return state;
    }

    function sendingPublicKey(keyPair) {
        let state = {type: TYPE.WRITE, status: 'Sending PublicKeyState'};
        cetProvisionMsg('03' + keyPair.pubkey);
        return state;
    }

    function receivedPubKey(pdu) {
        let key = pdu.slice(2);
        provisionBox.provisoneeKey = key;
        let point = {x: key.slice(0, 64), y: key.slice(64)};
        let ecdh = ECDH.derivedECDH(point, keyPair.privKey);
        provisionBox.ecdh = valideKey(ecdh);
        let SecureRandom = require('../ecc/rng');
        let random = new SecureRandom();
        let randomBytes = new Array(16);
        random.nextBytes(randomBytes);
        provisionBox.confirmRandom = ab2hex(randomBytes);
        return {type: TYPE.RECEIVED, status: 'Receiving PublicKeyState'};
    }

    function sendingConfirm() {

        function genConfirmRandom(confirmInput, ECDHSecret, randomProvisioner) {
            let ConfirmationSalt = caculateSalt(confirmInput)
            let confirmationKey = caculateCMAC(ECDHSecret, ConfirmationSalt, txt2hex('prck'))
            DEBUG('confirmation', JSON.stringify({confirmInput, ECDHSecret, ConfirmationSalt, confirmationKey}))
            let authValue = '00000000000000000000000000000000'
            return T_gen(randomProvisioner + authValue, confirmationKey)
        }

        let invite = '05'
        let capabilities = provisionBox.capabilities;
        let start = provisionBox.start;
        let publicKey = keyPair.pubkey;
        let provisoneeKey = provisionBox.provisoneeKey;
        let confirmInput = invite + capabilities + start + publicKey + provisoneeKey;
        provisionBox.confirmInput = confirmInput;
        cetProvisionMsg('05' + genConfirmRandom(confirmInput, provisionBox.ecdh, provisionBox.confirmRandom))
        return {type: TYPE.WRITE, status: 'Sending ConfirmDataState'};
    }

    function receivedConfirm(pdu) {
        return {type: TYPE.RECEIVED, status: 'Receiving ConfirmDataState'}
    }

    function sendConfirmRandom() {
        cetProvisionMsg('06' + provisionBox.confirmRandom)
        return {type: TYPE.WRITE, status: 'Sending ConfirmRandomState'}
    }

    function receivedConfirmRandom() {
        return {type: TYPE.RECEIVED, status: 'Receiving ConfirmRandomState'}
    }

    function sendingProvisionData(pdu) {
        let provisioneeRandom = pdu.slice(2);
        let provisionerRandom = provisionBox.confirmRandom;
        let ecdh = provisionBox.ecdh;
        let confirmationSalt = caculateSalt(provisionBox.confirmInput);
        let ProvisioningSalt = caculateSalt(confirmationSalt + provisionerRandom + provisioneeRandom)
        let sessionKey = caculateCMAC(ecdh, ProvisioningSalt, txt2hex('prsk'));
        let sessionNonce = caculateCMAC(ecdh, ProvisioningSalt, txt2hex('prsn')).slice(6);
        let deviceKey = caculateCMAC(ecdh, ProvisioningSalt, txt2hex('prdk'));
        provisionBox.deviceKey = deviceKey;
        let settings = that.MeshConfig();
        DEBUG('sendingProvisonData', JSON.stringify(settings))
        let provisioningData = {
            networKey: settings.networKey,
            keyIndex: settings.keyIndex,
            flags: settings.flags,
            ivIndex: settings.ivIndex,
            unicastAddress: settings.unicastAddress
        }
        provisionBox.unicastAddress = provisioningData.unicastAddress;
        let provisioningDataHex = provisioningData.networKey + provisioningData.keyIndex + provisioningData.flags + provisioningData.ivIndex + provisioningData.unicastAddress
        let encProvdata = mesh_enc(sessionKey, provisioningDataHex, sessionNonce, null, 64)
        cetProvisionMsg('07' + encProvdata);
        return {type: TYPE.WRITE, status: 'Sending ProvisionData', provisionBox}
    }

    function receivedProvisionComplete() {
        return {
            type: TYPE.RECEIVED,
            status: 'Receiving ProvisionCompleteState',
            elements: provisionBox.elements,
            unicastAddress: provisionBox.unicastAddress
        }
    }

    function parseNetworkPdu(arrayBuffer) {
        let pdu = ab2hex(arrayBuffer);
        DEBUG('parseNetworkPdu', pdu);
        let netKeys = that.MeshConfig().networKey;
        let appKeys = that.MeshConfig().appKeys;
        let node = that.seletNode();
        let deviceKey = [];
        deviceKey.push({addr: parseInt(node.unicastAddress, 16), key: node.deviceKey});
        let rsl = mesh.proxy_rx(pdu, incommingBuffer);
        if (!rsl) {
            return;
        }
        if (rsl.type === PDU_TYPE_NETWORK) {
            incommingBuffer = [];
            let rx_pdu = rsl.pdu;
            let iv_index = getIvIndex();
            let res = mesh.rx_pkt_reassemble(rx_pdu, lower_pkts, iv_index, netKeys, appKeys, deviceKey);
            if (!res) return;

            if (res.ctl) {
                parseControlMessage(res)
            } else {
                parseAccessMessage(res)
            }
        } else if (rsl.type === PDU_TYPE_MESH_BEACON) {
            let arr = [];
            arr.push(PDU_TYPE_MESH_BEACON);
            parseMeshBeacon(new SecureNetworkBeacon(arr.concat(hexToBytes(rsl.pdu))))
        }

    }

    function parseAccessMessage(res) {
        if (res && res.upper_pdu.decrypted_pdu) {
            let delay = 0;
            if (!res.unseg) {
                netPduArr = new Array();
                sendBlockAck(res);
                lower_pkts = new Set();
                delay = 200
            }
            let _res = res;
            setTimeout(res => {
                parseMeshMessage(_res)
            }, delay)

        }
    }

    function parseControlMessage(res) {
        DEBUG('parseControlMessage:', JSON.stringify(res));

        function getRetransSegment() {
            let segmentCount = netPduArr.length;
            let retransmitSegments = [];
            let blockAck = parseInt(res.upper_pdu.payload.slice(4), 16);//unsegment header size 3 first byte 0x00 there we need slice start with index of 2
            for (let i = 0; i < segmentCount; i++) {
                let bit = (blockAck >> i) & 1;
                if (bit == 1) {
                    DEBUG('getRetransSegment', "Segment " + i + " of " + (segmentCount - 1) + " received by peer");
                } else {
                    DEBUG('getRetransSegment', "Segment " + i + " of " + (segmentCount - 1) + " not received by peer");
                    if (netPduArr.length > 0) {
                        retransmitSegments.push(netPduArr[i]);
                    }
                }
            }
            return retransmitSegments;
        };

        (function createRetransSegmentsPayload() {
            getRetransSegment().map((seg) => {
                DEBUG('createRetransSegmentsPayload', "Resending segment " + seg)
                meshMessageHandler.forEach(handler => {
                    handler({opcode: SEG_RESENT})
                });
                let resentSeg = mesh.network_enc_obfuscate(res.netkey, seqNum(), res.iv_index, res.ctl, res.ttl, res.dst, res.src, seg)
                increamentSeqNumber();
                let pkts = [];
                mesh.proxy_tx(resentSeg, 20, 0x00).map(function (item) {
                    pkts.push({seg: item})
                })
                sendPdu(pkts)
            })
        })()


    }

    function increamentSeqNumber() {
        DEBUG('increamentSeqNumber', '');
        DEBUG('last seqNum', that.MeshConfig().seq_num);
        nodeChangeCallback.get().updateSeqNumber(++that.MeshConfig().seq_num);
    }

    function setSeqNumber(seq_num) {
        DEBUG('setSeqNumber', seq_num)
        nodeChangeCallback.get().updateSeqNumber(seq_num)
    }

    function createBlockAcknowledgement(segment, seq_Auth) {
        // LOG('MeshManagerApi.js line:14')(JSON.stringify(segment))
        let SegN = segment.pdu_arr[3] & 0x1f;
        let seqZero = seq_Auth;
        DEBUG('createBlockAcknowledgement', 'seqZero:' + seqZero)
        let ttl = segment.ttl;
        let src = segment.dst;
        let dst = segment.src;
        let segmentCount = SegN + 1;
        let ack = 0;
        for (let i = 0; i < segmentCount; i++) {
            ack |= 1 << i;
        }
        let rfu = 0;
        let obo = 0;
        let arrayBuffer = new ArrayBuffer(6);
        let dv = new DataView(arrayBuffer);
        dv.setUint8(0, (obo << 7) | ((seqZero >> 6) & 0x7F));
        dv.setUint8(1, (((seqZero << 2) & 0xFC) | rfu));
        dv.setUint32(2, ack, false);
        let acknowledgementPayload = '00' + mesh.toHexString(new Uint8Array(arrayBuffer));
        DEBUG("createBlockAcknowledgement", acknowledgementPayload);
        return mesh.network_enc_obfuscate(segment.netkey, seqNum(), getIvIndex(), 1, ttl, src, dst, acknowledgementPayload)
    }

    function getIvIndex() {
        //将ivIndex hex 转换成10 进制便于加解密使用
        return parseInt(that.MeshConfig().ivIndex, 16);
    }

    function addPaddingIndex(ivIndex) {
        let arr = new ArrayBuffer(4);
        let dataView = new DataView(arr);
        dataView.setUint32(0, ivIndex);
        return ab2hex(dataView.buffer)
    }

    function updateIvIndex(ivIndex) {
        //将ivIndex转换成16进制  方便查看
        that.MeshConfig().ivIndex = addPaddingIndex(ivIndex);
        DEBUG("updateIvIndex", that.MeshConfig().ivIndex)
    }

    function sendBlockAck(res) {
        DEBUG('sendBlockAck..........', '');
        let pkts = [];
        let segmentAckPayload = createBlockAcknowledgement(res.segments[res.segments.length - 1], res.seq_auth)
        mesh.proxy_tx(segmentAckPayload, 20, 0x00).map(function (item) {
            pkts.push({seg: item})
        });
        increamentSeqNumber();
        sendPdu(pkts);
        meshMessageHandler.forEach(handler => {
            handler({opcode: SEG_ACK})
        })
    }

    function getOpcode(accessPdu) {
        let pdu = hexToBytes(accessPdu);
        let msb = ((pdu[0] & 0xF0) >> 6);
        let opCodeLength;
        if (msb == 0)
            opCodeLength = 1;
        else {
            opCodeLength = msb;
        }
        switch (opCodeLength) {
            case 1:
                return pdu[0];
            case 2:
                return unsignedBytesToInt(pdu[1], pdu[0]);
            case 3:
                return ((unsignedByteToInt(pdu[1]))
                    | ((unsignedByteToInt(pdu[0]) << 8)
                        | ((unsignedByteToInt(pdu[2]) << 16))));
        }
        return -1;
    }


    function parseMeshMessage(res) {
        let callback = nodeChangeCallback.get();
        let accessPdu = res.upper_pdu.decrypted_pdu;
        DEBUG('parseMeshMessage', JSON.stringify(accessPdu));
        if (accessPdu) {
            let opCode = getOpcode(accessPdu);
            let statusMessage;
            let str = '';
            switch (opCode) {
                case OPCODE.CONFIG_COMPOSITION_DATA_STATUS:
                    str = 'CONFIG_COMPOSITION_DATA_STATUS';
                    let compositionDataStatus = new CompositionDataStatus(res)
                    statusMessage = compositionDataStatus;
                    if (statusMessage) {
                        callback.updateNode(statusMessage)
                    }
                    break;
                case OPCODE.CONFIG_NODE_RESET_STATUS:
                    str = 'CONFIG_NODE_RESET_STATUS';
                    callback.removeNode(res.src);
                    statusMessage = new ConfigNodeResetStatus(res);
                    break;
                case OPCODE.CONFIG_APPKEY_STATUS:
                    str = 'CONFIG_APPKEY_STATUS';
                    statusMessage = new ConfigAppKeyAddStatus(res);
                    callback.updateAddedAppkeyInfo(statusMessage);
                    break;
                case OPCODE.CONFIG_MODEL_APP_STATUS:
                    str = 'CONFIG_MODEL_APP_STATUS';
                    statusMessage = new ConfigModelAppkeyBindStatus(res);
                    if (statusMessage.StatusCode === 0) {
                        callback.updateBoundAppkeyInfo(statusMessage)
                    }
                    break
                case OPCODE.CONFIG_MODEL_SUBSCRIPTION_STATUS:
                    str = 'CONFIG_MODEL_SUBSCRIPTION_STATUS';
                    statusMessage = new ConfigModelSubscriptionStatus(res);
                    if (statusMessage.StatusCode === 0)
                        callback.updateConfigModelSubscriptionInfo(statusMessage);
                    break;
                case OPCODE.GENERIC_ON_OFF_STATUS:
                    str = 'GENERIC_ON_OFF_STATUS';
                    statusMessage = new GenericOnOffStatus(res);
                    break;
                case OPCODE.LIGHT_LIGHTNESS_STATUS:
                    str = 'LIGHT_LIGHTNESS_STATUS';
                    statusMessage = new LightLightnesStatus(res);
                    break;

                default:
                    break;
            }
            DEBUG('received Status', str);
            if (meshMessageHandler && statusMessage)
                dispatchMessage(opCode, statusMessage)
        }
    }

    function dispatchMessage(opCode, statusMessage) {
        meshMessageHandler.forEach(cb => {
            cb({opCode, statusMessage})
        })
    }

    this.parseNotification = function (res) {
        try {
            if (res.serviceId === '00001827-0000-1000-8000-00805F9B34FB') {
                parseProvisionPdu(res.value)
            } else if (res.serviceId === '00001828-0000-1000-8000-00805F9B34FB') {
                parseNetworkPdu(res.value)

            }
        } catch (e) {
            console.error(e)
        }


    };

    function parseMeshBeacon(beacon) {
        DEBUG('parseMeshBeacon', beacon)
        let [InProgress, Normal] = [1, 0];
        let netKey = that.MeshConfig().networKey[0];
        let flag = ('0' + (beacon.flag & 0xFF).toString(16)).slice(-2);
        let authValue = calculateAuthValueSecureNetBeacon(netKey, flag, that.MeshConfig().ivIndex).authenticationValue;
        if (authValue === toHexString(beacon.authenticationValue)) {
            if (beacon.type === PDU_TYPE_MESH_BEACON) {
                if (beacon.flags.ivUpdateFlag=== InProgress) {
                    //update ivIndex
                    updateIvIndex(parseInt(beacon.ivIndex, 16) - 1);

                } else if (beacon.flags.ivUpdateFlag === Normal) {
                    //update ivIndex
                    updateIvIndex(parseInt(beacon.ivIndex, 16));
                }
            }
        } else {
            DEBUG('parseMeshBeacon', 'authenticationValue  not  match!')
        }

    };

    function provision_rx(arrayBuffer) {
        let rsl = mesh.proxy_rx(ab2hex(arrayBuffer), incommingBuffer);
        if (rsl) {
            incommingBuffer = [];
            return rsl
        } else {
            return null;
        }
    }

    function cetProvisionMsg(hex) {
        let pkts = [];
        mesh.proxy_tx(hex, 20, 0x03).map(function (item) {
            pkts.push({seg: item})
        });
        sendPdu(pkts)
    }

    function sendPdu(pkts) {
        if (pduSendCallBack) {
            pduSendCallBack(pkts)
        }
    }

    function commonParams(seg, src, dst, netKey, app_dev_key, is_dev_key) {
        let params = {
            ctl: 0,
            ttl: 5,
            seg: seg,
            iv_index: getIvIndex(),
            seq_num: seqNum(),
            src: src,
            dst: dst,
            szmic: 0,
            lable_uuid: null,
            netKey: netKey,
            app_dev_key: app_dev_key,
            is_dev_key: is_dev_key,
            ctl_opcode: null,

        }
        return params
    }

    function genericMsgSend(res) {
        if (typeof res.dst === "string") {
            res.dst = parseInt(res.dst, 16)
        }
        let params = commonParams(res.seg, res.src, res.dst, res.netKey, res.app_dev_key, false)
        DEBUG('genericMsgSend', JSON.stringify(params))
        return new Promise((resolve, reject) => {
            let seg_pkts = mesh.tx_seg_pkt_build(params.ctl, params.ttl, params.seg, params.iv_index, params.seq_num, ab2hex(res.arrayBuffer), params.dst, params.src, params.szmic, params.lable_uuid, params.netKey, params.app_dev_key, params.is_dev_key, null);
            let pkts = [];
            // netPduArr = seg_pkts.net_pkt;
            seg_pkts.encrypted_pkt.map(function (item) {
                mesh.proxy_tx(item, 20, 0x00).map(function (item) {
                    pkts.push({seg: item, message: {opcode: res.opcode}})
                })
            });
            let seq_num = seg_pkts.next_seq;
            setSeqNumber(seq_num);
            sendPdu(pkts);
            resolve()
        })

    }

    function configMsgSend(res) {
        if (typeof res.dst === "string") {
            res.dst = parseInt(res.dst, 16)
        }
        let params = commonParams(res.seg, res.src, res.dst, res.netKey, res.app_dev_key, true);
        return new Promise((resolve, reject) => {
            let data = ab2hex(res.arrayBuffer);
            let seg_pkts = mesh.tx_seg_pkt_build(params.ctl, params.ttl, params.seg, params.iv_index, params.seq_num, data, params.dst, params.src, params.szmic, params.lable_uuid, params.netKey, params.app_dev_key, params.is_dev_key, null);
            let pkts = [];
            netPduArr = [];
            seg_pkts.encrypted_pkt.map(function (item) {
                netPduArr.push('00' + item);
                mesh.proxy_tx(item, 20, 0x00).map(function (item) {
                    pkts.push({seg: item, message: {opcode: res.opcode}})
                })
            });
            let seq_num = seg_pkts.next_seq;
            setSeqNumber(seq_num);
            sendPdu(pkts);
            resolve({success: 'send success'})

        })
    }

    this.sendMeshMessage = function (message) {
        switch (message.messageType().type) {
            case 0://GENERIC_MESSAGE
                return sendGenericMessage(message);
            case 1://CONFIG_MESSAGE
                return sendConfigMessage(message);
            default:
                return new Promise((resolve, reject) => {
                    reject({reason: '未知消息类型', errCode: UNEXPECTED_MESSAGE_TYPE})
                })
        }
    }

    function sendConfigMessage(message) {
        let str
        let opcode = message.messageType().opcode
        switch (opcode) {
            case OPCODE.CONFIG_COMPOSITION_DATA_GET:
                str = 'Send CompositionData Get'
                break
            case OPCODE.CONFIG_APPKEY_ADD:
                str = 'Send ConfigAppKey Add'
                break
            case OPCODE.CONFIG_MODEL_APP_BIND:
                str = 'Send ConfigModelAppKey Bind'
                break
            case OPCODE.CONFIG_MODEL_SUBSCRIPTION_ADD:
                str = 'Send ConfigModelSubscription Add'
                break
            case OPCODE.CONFIG_NODE_RESET:
                str = 'Send ConfigNodeReset '
                break
            default:
                str = 'Unknown Config Message'
                break
        }
        console.log(str)
        dispatchMessage(opcode, {message: str})

        function createAccessPdu(message) {
            console.log('createAccessPdu...')
            return new Promise((resolve, reject) => {
                resolve(message.params())
            })
        }

        function config(arrayBuffer) {
            console.log('config...')
            return new Promise((resolve, reject) => {
                resolve({
                    dst: message.dst(),
                    src: srcAddress(),
                    seg: false,
                    netKey: netKey(),
                    app_dev_key: _deviceKey(),
                    opcode: message.messageType().opcode,
                    arrayBuffer: arrayBuffer,
                    is_dev_key: true
                })
            })
        }

        return createAccessPdu(message).then(config).then(configMsgSend).catch(reason => {
            console.error('sendConfigMessage:' + reason)
        });

    }

    function sendGenericMessage(message) {
        let handler = meshMessageHandler;
        let str;
        let opCode;
        switch (message.messageType().opcode) {
            case OPCODE.GENERIC_ON_OFF_SET_UNACKNOWLEDGED:
                str = 'Send GenericOnOffSetUnack';
                opCode = OPCODE.GENERIC_ON_OFF_SET_UNACKNOWLEDGED;
                //通知注册者回调事件
                handler.forEach(cb => {
                    cb({str, opCode})
                });
                break;
            case OPCODE.GENERIC_ON_OFF_SET:
                str = 'Send GenericOnOffSet';
                opCode = OPCODE.GENERIC_ON_OFF_SET;
                //通知注册者回调事件
                handler.forEach(cb => {
                    cb({str, opCode})
                });
                break;
            case OPCODE.LIGHT_LIGHTNESS_SET:
                str = 'Send Lightness Set';
                opCode = OPCODE.LIGHT_LIGHTNESS_SET;
                //通知注册者回调事件
                handler.forEach(cb => {
                    cb({str, opCode})
                });
                break;
            default:
                str = 'Unknown Generic Message';
                break;


        }

        function createAccessPdu(message) {
            return new Promise((resolve, reject) => {
                resolve(message.params())
            })
        }

        function config(arrayBuffer) {
            return new Promise((resolve, reject) => {
                resolve({
                    dst: message.dst(),
                    src: srcAddress(),
                    seg: false,
                    netKey: netKey(),
                    app_dev_key: appkey(),
                    opcode: message.messageType().opcode,
                    arrayBuffer: arrayBuffer,
                    is_dev_key: false
                })
            })
        }

        return createAccessPdu(message).then(config).then(genericMsgSend);
    }


}

module.exports = MeshManagerApiInstance;

