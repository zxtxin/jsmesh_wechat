module.exports.SecureNetworkBeacon = function (beaconData) {
    let _beacon = beaconData.slice(1);
    return {
        type:beaconData[0],
        flags:{ivUpdateFlag:parseInt(_beacon[0], 16) >> 1,keyRefreshFlag:parseInt(_beacon[0], 16) & 0x01},
        networkId: _beacon.slice(1, 9),
        ivIndex: _beacon.slice(9, 13),
        authenticationValue: _beacon.slice(13),
        ivUpdateFlag: parseInt(_beacon[0], 16) >> 1 === 1 ? 'InProgress' : 'Normal',
        keyRefreshFlag: parseInt(_beacon[0], 16) & 0x01 === 1 ? 'true' : 'false'
    }

}