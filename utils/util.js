const formatTime = date => {
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hour = date.getHours()
    const minute = date.getMinutes()
    const second = date.getSeconds()
    const milliSecond = date.getMilliseconds()

    return [year, month, day].map(formatNumber).join('/') + ' ' + [hour, minute, second, milliSecond].map(formatNumber).join(':')
}

function toHexString(byteArray) {
    return Array.prototype.map.call(byteArray, function (byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
}

function unsignedByteToInt(b) {
    return b & 0xFF;
}

/**
 * Convert signed bytes to a 16-bit unsigned int.
 */
function unsignedBytesToInt(b0, b1) {
    return (unsignedByteToInt(b0) + (unsignedByteToInt(b1) << 8));
}

function parseElementAddress(elementAddress) {
    let arr = new ArrayBuffer(2)
    let dataView = new DataView(arr)
    dataView.setUint16(0, elementAddress)
    return ab2hex(dataView.buffer)
}

function indexof(arr, key) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i].deviceId === key) {
            return i;
        }
    }
    return -1;
}

function inArray(arr, key, val) {
    for (let i = 0; i < arr.length; i++) {
        if (arr[i][key] === val) {
            return i;
        }
    }
    return -1;
}

const formatNumber = n => {
    n = n.toString()
    return n[1] ? n : '0' + n
}

function hexToBytes(hex) {
    let bytes = []
    for (let c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
    var hexArr = Array.prototype.map.call(
        new Uint8Array(buffer),
        function (bit) {
            return ('00' + bit.toString(16)).slice(-2)
        }
    )
    return hexArr.join('');
}

function hex2ab(hex) {
    let typedArray = new Uint8Array(hex.match(/[\da-f]{2}/gi).map(function (h) {
        return parseInt(h, 16)
    }))
    let buffer = typedArray.buffer
    return buffer
}

function randomNum(minNum, maxNum) {
    switch (arguments.length) {
        case 1:
            return parseInt(Math.random() * minNum + 1, 10);
            break;
        case 2:
            return parseInt(Math.random() * (maxNum - minNum + 1) + minNum, 10);
            break;
        default:
            return 0;
            break;
    }
}

function toASCIIArray(string) {
    let asciiKeys = [];
    for (var i = 0; i < string.length; i++)
        asciiKeys.push(string[i].charCodeAt(0));
    return asciiKeys;
}

function toByteArray(hexString) {
    var result = [];
    while (hexString.length >= 2) {
        result.push(parseInt(hexString.substring(0, 2), 16));
        hexString = hexString.substring(2, hexString.length);
    }
    return result;
}

function txt2hex(txt) {
    return ab2hex(toASCIIArray(txt))
}

function randomBytes(length) {
    let randoms = []
    for (let i = 0; i < length; i++) {
        randoms.push(randomNum(0, 254))
    }
    return ab2hex(randoms)
}

function MapToObj(strMap) {
    let obj = Object.create(null);
    for (let [k, v] of strMap) {
        obj[k] = v;
    }
    return obj;
}

function objToStrMap(obj) {
    let strMap = new Map();
    for (let k of Object.keys(obj)) {
        strMap.set(k, obj[k]);
    }
    return strMap;
}
function debounce(f, ms) {

    let isCooldown = false;

    return function() {
        if (isCooldown) return;

        f.apply(this, arguments);

        isCooldown = true;

        setTimeout(() => isCooldown = false, ms);
    };

}

module.exports = {
    debounce,
    hexToBytes: hexToBytes,
    ab2hex: ab2hex,
    hex2ab: hex2ab,
    toHexString,
    toByteArray,
    randomBytes: randomBytes,
    txt2hex,
    toASCIIArray,
    parseElementAddress,
    unsignedByteToInt,
    unsignedBytesToInt

}
