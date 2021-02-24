const sjcl = require('../mesh_core/sjcl');
const AesCmac = require('../mesh_core/AesCmac')
const {ab2hex, toASCIIArray, txt2hex} = require('./util')

/**
 *
 * @param M hex String
 * @returns {*}
 */
function caculateSalt(M) {
    return s1(M)
}

function caculateCMAC(a, b, c) {
    return k1(a, b, c)
}

function s1(M) {
    let cmac = new AesCmac();
    cmac.init("0x00000000000000000000000000000000");
    return sjcl.codec.hex.fromBits(cmac.generateCmac(M));
}

function T_gen(N, M) {
    let cmac = new AesCmac();
    cmac.init(M);
    return sjcl.codec.hex.fromBits(cmac.generateCmac(N));
}

function k1(ecdh, confirmSalt, text) {
    return T_gen(text, T_gen(ecdh, confirmSalt))
}

function k3(netKey) {
    let N = netKey;
    let salt = s1(txt2hex('smk3'))
    let t = T_gen(N, salt)
    let t1 = txt2hex('id64') + '01'
    let result = T_gen(t1, t)
    return result.slice(result.length - 8 * 2)


}

function calculateAuthValueSecureNetBeacon(netKey, flags, ivIndex) {
    let networkId = k3(netKey);
    let beaconKey = calculateBeaconKey(netKey);
    let hex = flags + networkId + ivIndex;
    let authenticationValue = T_gen(hex, beaconKey).slice(0, 16);
    let beacon ='01'+ flags + networkId + ivIndex + authenticationValue;
    return {
        netKey,
        flags:{ivUpdateFlag:parseInt(flags, 16) >> 1,keyRefreshFlag:parseInt(flags, 16) & 0x01},
        networkId,
        ivIndex,
        authenticationValue,
        beacon,
        ivUpdateFlag: parseInt(flags, 16) >> 1 === 1 ? 'InProgress' : 'Normal',
        keyRefreshFlag: parseInt(flags, 16) & 0x01 === 1 ? 'true' : 'false'

    }
}


function calculateBeaconKey(netKey) {

    let salt = s1(txt2hex('nkbk'));
    let id128 = txt2hex('id128') + '01';
    return k1(netKey, salt, id128);
}

// console.log(calculateAuthValueSecureNetBeacon('7dd7364cd842ad18c17c2b820c84c3d6','02','12345679'))
function identifyKey(netKey) {
    let N = netKey;
    let salt = s1(txt2hex('nkik'))
    let id128 = txt2hex('id128') + '01'
    return k1(N, salt, id128)
}

function caculatehash(netKey, random, src) {
    let hash_padding = '000000000000'
    let hashInput = hash_padding + random + src
    let hash = aes_ecb(hashInput, identifyKey(netKey))
    return hash;
}

function aes_ecb(hashInput, identitykey) {
    let aes = new sjcl.cipher.aes(sjcl.codec.hex.toBits(identitykey));
    let ecb = aes.encrypt(sjcl.codec.hex.toBits(hashInput));
    let hex = sjcl.codec.hex.fromBits(ecb);
    return hex.slice(16)
}

function mesh_enc(key, pt, iv, adata, tlen) {
    let toBits = sjcl.codec.hex.toBits;
    let encrypted = sjcl.mode.ccm.encrypt(new sjcl.cipher.aes(toBits(key)),
        toBits(pt), toBits(iv), adata ? toBits(adata) : null, tlen);
    return sjcl.codec.hex.fromBits(encrypted);
}

function hex2bits(hex) {
    return sjcl.codec.hex.toBits(hex)
}

module.exports = {
    mesh_enc,
    s1,
    k1,
    k3,
    T_gen,
    caculatehash,
    hex2bits,
    caculateSalt,
    caculateCMAC,
    calculateAuthValueSecureNetBeacon

}
