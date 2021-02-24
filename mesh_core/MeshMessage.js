let OPCODE = require('./MeshOpCode')
const {hexToBytes, toHexString, ab2hex, parseElementAddress, unsignedBytesToInt} = require("../utils/util");
let MESSAGE_TYPE = {GENERIC_MESSAGE: 0, CONFIG_MESSAGE: 1}

function statusName(errcode) {
    switch (errcode) {
        case 0x00:
            return "Success";
        case 0x01:
            return "Invalid Address";
        case 0x02:
            return "Invalid Model";
        case 0x03:
            return "Invalid ApplicationKey Index";
        case 0x04:
            return "Invalid NetKey Index";
        case 0x05:
            return "Insufficient Resources";
        case 0x06:
            return "Key Index Already Stored";
        case 0x07:
            return "Invalid Publish Parameters";
        case 0x08:
            return "Not a Subscribe Model";
        case 0x09:
            return "Storage Failure";
        case 0x0A:
            return "Feature Not Supported";
        case 0x0B:
            return "Cannot Update";
        case 0x0C:
            return "Cannot Remove";
        case 0x0D:
            return "Cannot Bind";
        case 0x0E:
            return "Temporarily Unable to Change State";
        case 0x0F:
            return "Cannot Set";
        case 0x10:
            return "Unspecified Error";
        case 0x11:
            return "Invalid Binding";
        case 0x12:
        default:
            return "RFU";
    }
}

module.exports.ControlMessage = function (blockAck, seqZero, segO) {
    function calculateBlockAcknowledgement(blockAck, segO) {
        let ack = 0;
        if (!blockAck) {
            ack |= 1 << segO;
            getApp().LOG('calculateBlockAcknowledgement')("Block ack value: " + ack);
            return ack;
        } else {
            ack = blockAck;
            ack |= 1 << segO;
            getApp().LOG('calculateBlockAcknowledgement')("Block ack value: " + ack);
            return ack;
        }
    }

    function createAcknowledgementPayload(seqZero, blockAcknowledgement) {
        let rfu = 0;
        let params = new ArrayBuffer(5);
        let dataView = new DataView(params);
        dataView.setUint8(0, (((seqZero << 2) & 0xFC) | rfu));
        dataView.setUint32(1, blockAcknowledgement);
        return {params: ab2hex(params), blockAcknowledgement}
    }

    return createAcknowledgementPayload(seqZero, calculateBlockAcknowledgement(blockAck, segO))

}

function configMessage(opcode) {
    return {
        opcode: opcode,
        type: MESSAGE_TYPE.CONFIG_MESSAGE
    }
}

function genericMessage(opcode) {
    return {
        opcode: opcode,
        type: MESSAGE_TYPE.GENERIC_MESSAGE
    }
}

module.exports.CompositionDataStatus = function (rslt) {
    let pdu = rslt.upper_pdu.decrypted_pdu
    this.TAG=function () {
        return 'CompositionDataStatus'
    }
    function parseCompositionDataPages(accessPdu) {
        let accessPayload = hexToBytes(accessPdu)
        let feature = unsignedBytes2Int(accessPayload[10] + accessPayload[11]);
        return {
            'Company_identifier': ab2hex(unsignedBytes(accessPayload.slice(2, 4))),
            'Product_identifier': ab2hex(unsignedBytes(accessPayload.slice(4, 6))),
            'Version_identifier': ab2hex(unsignedBytes(accessPayload.slice(6, 8))),
            'crpl': ab2hex(accessPayload.slice(8, 10)),
            'Features': ab2hex(accessPayload.slice(10, 12)),
            'Relay_feature': ((feature & (1 << 0)) > 0),
            'Proxy_feature': ((feature & (1 << 1)) > 0),
            'Friend_feature': ((feature & (1 << 2)) > 0),
            'Low_power_feature': ((feature & (1 << 3)) > 0)
        }
    }

    function unsignedByteToInt(b) {
        return b & 0xFF;
    }

    function unsignedBytes(bytes) {
        let newBytes = []
        let ids = 0
        while (ids < bytes.length) {
            newBytes.push(bytes[ids + 1])
            newBytes.push(bytes[ids])
            ids += 2
        }
        return newBytes

    }

    function VendorModel(id) {
        let params = new ArrayBuffer(4);
        let dataView = new DataView(params);
        dataView.setUint32(0, id)
        return {'modelId': ab2hex(params), 'modelName': 'VendorModel'}
    }

    function Element(elementAddress, locationDescriptor, models) {
        return {
            elementAddress: elementAddress,
            locationDescriptor: locationDescriptor,
            models: models
        }
    }

    function unsignedBytes2Int(b0, b1) {
        return (unsignedByteToInt(b0) + (unsignedByteToInt(b1) << 8));
    }

    function parseSigModel(modelId) {
        let id = parseInt(modelId, 16)
        let modelName = ''
        switch (id) {
            case 0x0000:
                modelName = 'Configuration Server'
                break
            case 0x0001:
                modelName = 'Configuration Client'
                break
            case 0x1203:
                modelName = 'Scene Server'
                break
            case 0x1204:
                modelName = 'Scene Setup Server'
                break
            case 0x1004:
                modelName = 'Generic Default Transition Time Server'
                break
            case 0x0002:
                modelName = 'Health Server'
                break
            case 0x1000:
                modelName = 'Generic On Off Server'
                break
            case 0x1002:
                modelName = 'Generic Level Server'
                break
            case 0x1307:
                modelName = 'Light HSL Server'
                break
            case 0x1308:
                modelName = 'Light HSL Setup Server'
                break
            case 0x1300:
                modelName = 'Light Lightness Server'
                break
            case 0x1300:
                modelName = 'Light Lightness Server'
                break
            case 0x01A80000:
                modelName = 'Vendor Model'
                break
            case 0x01A80001:
                modelName = 'Vendor Model'
                break
            default :
                break//  todo more model need to deal with
        }
        return {'modelId': modelId, 'modelName': modelName}
    }

    function parseElement(accessPdu, src) {

        let accessPayload = hexToBytes(accessPdu)
        let mElements = [];
        let tempOffset = 12;
        let counter = 0;
        let elementAddress = 0;
        while (tempOffset < accessPayload.length) {
            let models = [];
            let locationDescriptor = accessPayload[tempOffset + 1] << 8 | accessPayload[tempOffset];

            tempOffset = tempOffset + 2;
            let numSigModelIds = accessPayload[tempOffset];

            tempOffset = tempOffset + 1;
            let numVendorModelIds = accessPayload[tempOffset];

            tempOffset = tempOffset + 1;
            if (numSigModelIds > 0) {
                for (let i = 0; i < numSigModelIds; i++) {
                    let bytes = accessPayload.slice(tempOffset, tempOffset + 2)
                    let modelId = ab2hex([bytes[1], bytes[0]]);
                    models.push(parseSigModel(modelId)); // sig models are 16-bit
                    tempOffset = tempOffset + 2;
                }
            }

            if (numVendorModelIds > 0) {
                for (let i = 0; i < numVendorModelIds; i++) {
                    // vendor models are 32-bit that contains a 16-bit company identifier and a 16-bit model identifier
                    let companyIdentifier = accessPayload[tempOffset] | (accessPayload[tempOffset + 1] << 8)
                    let modelIdentifier = accessPayload[tempOffset + 2] | (accessPayload[tempOffset + 3] << 8)
                    let vendorModelIdentifier = companyIdentifier << 16 | modelIdentifier;
                    models.push(new VendorModel(vendorModelIdentifier));
                    tempOffset = tempOffset + 4;
                }
            }

            if (counter == 0) {
                elementAddress = src;
            } else {
                elementAddress++;
            }

            counter++;
            // console.log('elementAddress:' + elementAddress)
            let element = new Element(parseElementAddress(elementAddress), locationDescriptor, models);
            mElements.push(element);
        }
        return mElements;
    }

    let page = parseCompositionDataPages(pdu)
    let elements = parseElement(pdu, rslt.src)
    return {page,elements}
}
module.exports.ConfigNodeResetStatus = function (rslt) {
    this.TAG=function () {
        return 'ConfigNodeResetStatus'
    }
 return this;
}
module.exports.ConfigAppKeyAddStatus = function (rslt) {
    let pdu = rslt.upper_pdu.decrypted_pdu
    let mParameters = hexToBytes(pdu).slice(2)

    return {
        StatusCode: mParameters[0],
        netKeyIndex: mParameters[2] & 0x0f.toString(16) + (mParameters[1].toString(16)),
        appKeyIndex: (mParameters[3] & 0xF0 >> 4).toString(16) + (mParameters[3] << 4 | (mParameters[2] & 0xF0) >> 4).toString(16)
    }
}
module.exports.ConfigModelSubscriptionStatus = function (rslt) {
    let pdu = rslt.upper_pdu.decrypted_pdu
    let params = pdu.slice(4)
    let arr = hexToBytes(params)
    return {
        pdu: pdu.slice(4),
        StatusCode: arr[0],
        ElementAddress: unsignedBytesToInt(arr[1], arr[2]).toString(16),
        SubscriptionAddress: unsignedBytesToInt(arr[3], arr[4]).toString(16),
        modelId: unsignedBytesToInt(arr[5], arr[6]).toString(16)
    }

}
module.exports.AppKeyList = function (rslt) {
    let pdu = rslt.upper_pdu.decrypted_pdu
    let buffer = hexToBytes(pdu.slice(4))
    let statusCode = buffer[0]
    if (statusCode == 0) {
        return {
            netKeyIndex: buffer[1].toString(16) + (buffer[2].toString(16)),
            appKeyIndexes: ab2hex(buffer.slice(3))
        }
    }
}
module.exports.ConfigModelAppkeyBindStatus = function (rslt) {

    let pdu = rslt.upper_pdu.decrypted_pdu
    let params = pdu.slice(4)
    let arr = hexToBytes(params)
    let data = {
        pdu: pdu.slice(4),
        StatusCode: arr[0],
        ElementAddress: unsignedBytesToInt(arr[1], arr[2]).toString(16),
        AppKeyIndex: unsignedBytesToInt(arr[3], arr[4]).toString(16),
        modelId: unsignedBytesToInt(arr[5], arr[6]).toString(16),
        statusName: statusName(arr[0])
    }
    return data;

}
module.exports.GenericOnOffStatus = function (rslt) {
    let pdu = rslt.upper_pdu.decrypted_pdu;
    let buffer = hexToBytes(pdu.slice(4));
    if (buffer.length > 1) {
        return {
            mTargetOn: buffer[0] == 1,
            mRemainingTime: buffer[1] & 0xFF,
            mTransitionSteps: (buffer[1] & 0xFF & 0x3F),
            mTransitionResolution: (buffer[1] & 0xFF >> 6)
        }
    } else {
        return {mTargetOn: buffer[0] == 1}
    }
}


module.exports.GenericOnOffSetAck = function (on_off, tid, dst) {

    this.messageType = function () {
        return genericMessage(OPCODE.GENERIC_ON_OFF_SET)
    }
    this.dst = function () {
        return dst
    }
    this.params = function () {
        let ab = new ArrayBuffer(2 + 4);
        let dataView = new DataView(ab);
        dataView.setUint16(0, OPCODE.GENERIC_ON_OFF_SET);
        dataView.setUint8(2, on_off)//state  on/ off  1/0
        dataView.setUint8(3, tid)//tid
        dataView.setUint8(4, 0)//转换时间
        dataView.setUint8(5, 0)//delay
        return ab
    }

    return this;
}
module.exports.GenericOnOffSetUnAck = function (on_off, tid, groupAddress) {
    if (typeof groupAddress === 'string') {
        groupAddress = parseInt(groupAddress, 16)
    }
    this.dst = function () {
        return groupAddress
    }
    this.messageType = function () {
        return genericMessage(OPCODE.GENERIC_ON_OFF_SET_UNACKNOWLEDGED)
    }
    this.params = function () {
        let arrayBuffer = new ArrayBuffer(2 + 4);
        let dataView = new DataView(arrayBuffer);
        dataView.setUint16(0, OPCODE.GENERIC_ON_OFF_SET_UNACKNOWLEDGED);
        dataView.setUint8(2, on_off)//state  on/ off  1/0
        dataView.setUint8(3, tid)//tid
        dataView.setUint8(4, 0)//tid
        dataView.setUint8(5, 0)//tid
        return arrayBuffer
    }


    return this;
}

module.exports.ConfigNodeReset = function (unicastAddress) {
    this.dst = function () {
        return unicastAddress
    }
    this.messageType = function () {
        return configMessage(OPCODE.CONFIG_NODE_RESET)
    }
    this.params = function () {
        let ab = new ArrayBuffer(2);
        let dataView = new DataView(ab);
        dataView.setUint16(0, OPCODE.CONFIG_NODE_RESET)
        return ab
    }

}

module.exports.ConfigCompositionDataGet = function (dst) {
    this.dst = function () {
        return dst
    }
    this.messageType = function () {
        return configMessage(OPCODE.CONFIG_COMPOSITION_DATA_GET)
    }
    this.params = function () {
        let params = new ArrayBuffer(3);
        let dataView = new DataView(params);
        dataView.setUint16(0, OPCODE.CONFIG_COMPOSITION_DATA_GET, false);
        dataView.setUint8(2, 0xff)
        return params;
    }
    return this
}
module.exports.ConfigAddKeyAdd = function (appkey, dst) {
    if (typeof appkey === "string") {
        appkey = hexToBytes(appkey)
    }
    this.dst = function () {
        return dst
    }
    this.messageType = function () {
        return configMessage(OPCODE.CONFIG_APPKEY_ADD)
    }
    this.params = function () {
        let arrayBuffer = new ArrayBuffer(20);
        let dataView = new DataView(arrayBuffer);
        dataView.setUint8(0, OPCODE.CONFIG_APPKEY_ADD);
        dataView.setUint8(1, 0)
        dataView.setUint8(2, 0)
        dataView.setUint8(3, 0)
        for (let i = 0; i < appkey.length; i++) {
            dataView.setUint8(i + 4, appkey[i])
        }
        return arrayBuffer;
    }
}
module.exports.ConfigAppkeyGet = function (dst, netKeyIndex) {
    this.dst = function () {
        return dst
    }
    this.messageType = function () {
        return configMessage(OPCODE.CONFIG_APPKEY_GET)
    }
    this.params = function () {
        let arrayBuffer = new ArrayBuffer(2 + 2);
        let dataView = new DataView(arrayBuffer);
        dataView.setUint16(0, OPCODE.CONFIG_APPKEY_GET)
        dataView.setUint16(2, netKeyIndex)
        return arrayBuffer
    }

}
module.exports.ConfigModelAddKeyBind = function (dst,elementAddress, appkeyIndex, modelId) {
    if (typeof elementAddress === "string") {
        elementAddress = parseInt(elementAddress, 16)
    }
    this.dst = function () {
        return dst
    }
    this.messageType = function () {
        return configMessage(OPCODE.CONFIG_MODEL_APP_BIND)
    }
    this.params = function () {
        let arrayBuffer = new ArrayBuffer(6 + 2);
        let dataView = new DataView(arrayBuffer);
        dataView.setUint16(0, OPCODE.CONFIG_MODEL_APP_BIND);
        dataView.setUint16(2, elementAddress, true)
        dataView.setUint16(4, appkeyIndex, true)
        dataView.setUint16(6, modelId, true)

        return arrayBuffer;
    }
    return this

}
 module.exports.ConfigModelSubscriptionAdd = function (dst,elementAddress, subscriptionAddr, modelId) {
    if (typeof (elementAddress) === 'string') {
        elementAddress = parseInt(elementAddress, 16)
    }
    if (typeof (subscriptionAddr) === 'string') {
        subscriptionAddr = parseInt(subscriptionAddr, 16)
    }
    if (typeof (modelId) === "string") {
        modelId = parseInt(modelId, 16)
    }
    this.dst = function () {
        return dst
    }
    this.messageType = function () {
        return configMessage(OPCODE.CONFIG_MODEL_SUBSCRIPTION_ADD)
    }
    this.params = function () {
        let ab = new ArrayBuffer(6 + 2);
        let dataView = new DataView(ab);
        dataView.setUint16(0, OPCODE.CONFIG_MODEL_SUBSCRIPTION_ADD);
        dataView.setUint16(2, elementAddress, true)
        dataView.setUint16(4, subscriptionAddr, true)
        dataView.setUint16(6, modelId, true)

        return ab;
    }
    return this

}

module.exports.LightLightnessSet=function (dst,lightness,tid,transitionTime,delay) {
    this.dst = function () {
        return dst
    }
    this.messageType = function () {
        return configMessage(OPCODE.LIGHT_LIGHTNESS_SET)
    }
    this.params = function () {
        if (transitionTime){
            //transitionTime 如果这个字段存在
            let ab = new ArrayBuffer(3 + 2+2);
            let dataView = new DataView(ab);
            dataView.setUint16(0, OPCODE.LIGHT_LIGHTNESS_SET);
            dataView.setUint16(2, lightness, true);
            dataView.setUint8(4,tid);
            dataView.setUint8(5,transitionTime);//设置当前亮度距离目标亮度转换的时间 1byte
            dataView.setUint8(7,delay);//延时触发 1byte  范围0~255  代表实际的值为 0~1275ms
            return ab;
        }else {

            let ab = new ArrayBuffer(3 + 2);
            let dataView = new DataView(ab);
            dataView.setUint16(0, OPCODE.LIGHT_LIGHTNESS_SET);
            dataView.setUint16(2, lightness, true);
            dataView.setUint8(4,tid);
            return ab;
        }

    }
    return this
}

module.exports.LightLightnesStatus=function (rslt) {
    let pdu = rslt.upper_pdu.decrypted_pdu;//opcode(2bytes)+params
    let params = hexToBytes(pdu.slice(4));//剔除opcode 获取params
    this. presentLightness=params.slice(0,2);//当前亮度
    if (params.length>2){
        this. targetLightness=params.slice(2,4);//目标亮度  比如当前设备亮度0x0001,通过小程序设置目标亮度为0xffff
        this.remainTime=params[4];//距离目标亮度所需时间  这个时间有转换公式
    }
    return this;

}



