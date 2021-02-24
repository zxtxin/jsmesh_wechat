import {MESH_STACK_LOG_ENABLE} from "./constant";

function Mesh() {
    let sjcl = require('./sjcl');
    let AesCmac = require('./AesCmac');
    let that = this

    function LOG(tag) {
        return function (info) {
            if (MESH_STACK_LOG_ENABLE)
                console.log(tag + ':\n' + info)
        }
    }

    function toHexString(byteArray) {
        return Array.prototype.map.call(byteArray, function (byte) {
            return ('0' + (byte & 0xFF).toString(16)).slice(-2);
        }).join('');
    }

// ArrayBuffer转16进度字符串示例
    function ab2hex(buffer) {
        let hexArr = Array.prototype.map.call(
            new Uint8Array(buffer),
            function (bit) {
                return ('00' + bit.toString(16)).slice(-2)
            }
        )
        return hexArr.join('');
    }

    function toByteArray(hexString) {
        var result = [];
        while (hexString.length >= 2) {
            result.push(parseInt(hexString.substring(0, 2), 16));
            hexString = hexString.substring(2, hexString.length);
        }
        return result;
    }

    function intToByteArray(num, little_endian) {
        let arr = new Uint8Array(4);
        if (little_endian) {
            arr[0] = num & 0xff;
            arr[1] = num >> 8 & 0xff;
            arr[2] = num >> 16 & 0xff;
            arr[3] = num >> 24 & 0xff;
        } else {
            arr[0] = num >> 24 & 0xff;
            arr[1] = num >> 16 & 0xff;
            arr[2] = num >> 8 & 0xff;
            arr[3] = num & 0xff;
        }
        return arr;
    }

    function toASCIIArray(string) {
        let asciiKeys = [];
        for (var i = 0; i < string.length; i++)
            asciiKeys.push(string[i].charCodeAt(0));
        return asciiKeys;
    }

    function s1(M) {
        let cmac = new AesCmac();
        cmac.init("0x00000000000000000000000000000000");
        return sjcl.codec.hex.fromBits(cmac.generateCmac(toHexString(toASCIIArray(M))));
    }

    function T_gen(N, M) {
        let cmac = new AesCmac();
        const SALT = s1(M);
        cmac.init(SALT);
        return sjcl.codec.hex.fromBits(cmac.generateCmac(N));
    }


    function k2(N, P) {
        const T = T_gen(N, "smk2");
        let cmac = new AesCmac();
        cmac.init(T);

        let T0 = "";
        let T1 = sjcl.codec.hex.fromBits(cmac.generateCmac(T0 + toHexString(P) + toHexString([1])));
        let T2 = sjcl.codec.hex.fromBits(cmac.generateCmac(T1 + toHexString(P) + toHexString([2])));
        let T3 = sjcl.codec.hex.fromBits(cmac.generateCmac(T2 + toHexString(P) + toHexString([3])));
        return [toByteArray(T1).slice(-1) & 0x7f, T2, T3];
    }

    function k4(N) {
        const T = T_gen(N, "smk4");
        let cmac = new AesCmac();
        cmac.init(T);
        let M = toASCIIArray("id6");
        M.push(0x01);
        let cmac_rslt = sjcl.codec.hex.fromBits(cmac.generateCmac(toHexString(M)));
        return toByteArray(cmac_rslt).slice(-1) & 0x3f;
    }

    function mesh_enc(key, pt, iv, adata, tlen) {
        LOG('unencryptedNetworkPayload')(pt)
        let toBits = sjcl.codec.hex.toBits;
        let encrypted = sjcl.mode.ccm.encrypt(new sjcl.cipher.aes(toBits(key)),
            toBits(pt), toBits(iv), adata ? toBits(adata) : null, tlen);
        return sjcl.codec.hex.fromBits(encrypted);
    }

    function nonce_build(type, byte1, seq, src, dst, iv_index) {
        // LOG('nonce_build')(JSON.stringify({type, byte1, seq, src, dst, iv_index}))
        let nonce = new ArrayBuffer(13);
        let nonce_dv = new DataView(nonce);
        nonce_dv.setUint8(0, type);
        nonce_dv.setUint8(1, byte1);
        nonce_dv.setUint8(2, seq >> 16);
        nonce_dv.setUint8(3, seq >> 8);
        nonce_dv.setUint8(4, seq);
        nonce_dv.setUint16(5, src, false);
        nonce_dv.setUint16(7, dst, false);
        nonce_dv.setUint32(9, iv_index, false);
        let array = new Uint8Array(nonce);
        LOG((function () {
            switch (type) {
                case 0:
                    return 'Network nonce'
                    break;
                case 1:
                    return 'Application nonce'
                    break;
                case 2:
                    return 'Device nonce'
                case 3:
                    return 'Proxy nonce'
                default:
                    return 'Unknown nonce'
            }
        })())(toHexString(array))
        return array;
    }

    function access_enc(key, is_dev_key, pt, iv_index, seq_auth, dst, src, szmic, label_uuid = null) {
        LOG('Access PDU ')(pt)
        let nonce = nonce_build(is_dev_key ? 2 : 1, szmic << 7, seq_auth, src, dst, iv_index);
        return mesh_enc(key, pt, toHexString(nonce), label_uuid, szmic ? 64 : 32);
    }

    function obfuscate(privacy_random, privacy_key, iv_index, input_arr) {
        LOG('Privacy Random')(privacy_random)
        let privacy_pt = "0000000000" + toHexString(intToByteArray(iv_index, false)) + privacy_random;
        let aes = new sjcl.cipher.aes(sjcl.codec.hex.toBits(privacy_key));
        let pecb = aes.encrypt(sjcl.codec.hex.toBits(privacy_pt));
        let pecb_arr = toByteArray(sjcl.codec.hex.fromBits(pecb));
        let rslt = new Uint8Array(6);
        for (let i = 0; i < 6; ++i) {
            rslt[i] = input_arr[i] ^ pecb_arr[i];
        }
        return rslt;
    }

    function network_enc_obfuscate(key, seq_num, iv_index, ctl, ttl, src, dst, pt) {
        let nonce = nonce_build(0, ttl & 0x7f | ctl << 7, seq_num, src, 0, iv_index);
        let dst_be = new ArrayBuffer(2);
        let dst_be_dv = new DataView(dst_be);
        dst_be_dv.setUint16(0, dst, false);
        let [nid, encryption_key, privacy_key] = k2(key, [0]);
        // LOG('network_enc_obfuscate')({key,nid,encryption_key,privacy_key})
        let encrypted_str = mesh_enc(encryption_key, toHexString(new Uint8Array(dst_be)) + pt, toHexString(nonce), null, ctl ? 64 : 32);
        let ctl_ttl_seq_src_arr = (function () {
            let buf = new ArrayBuffer(6);
            let buf_dv = new DataView(buf);
            buf_dv.setUint8(0, ctl << 7 | ttl);
            buf_dv.setUint8(1, seq_num >> 16);
            buf_dv.setUint8(2, seq_num >> 8);
            buf_dv.setUint8(3, seq_num);
            buf_dv.setUint16(4, src, false);
            return new Uint8Array(buf);
        })();
        let enc_net_pkt = toHexString([(iv_index & 0x1) << 7 | nid]) + toHexString(obfuscate(encrypted_str.slice(0, 14), privacy_key, iv_index, ctl_ttl_seq_src_arr)) + encrypted_str
        // LOG('Encrypted Network payload')(enc_net_pkt)
        return enc_net_pkt;
    }

    that.tx_seg_pkt_build = function (ctl, ttl, seg, iv_index, seq_num, pt, dst, src, szmic, label_uuid, netkey, app_dev_key, is_dev_key, ctl_opcode) {
        // LOG('tx_seg_pkt_build')(JSON.stringify({ctl, ttl, seg, iv_index, seq_num, pt, dst, src, szmic, label_uuid, netkey, app_dev_key, is_dev_key, ctl_opcode}))
        let upper_pdu;
        let SegN;
        if (ctl == 0) {
            upper_pdu = access_enc(app_dev_key, is_dev_key, pt, iv_index, seq_num, dst, src, szmic, label_uuid);
            // LOG('Encrypted upper transport pdu')(upper_pdu)
            SegN = Math.ceil(upper_pdu.length / 2 / 12) - 1;
        } else {
            upper_pdu = pt;
            SegN = Math.ceil(upper_pdu.length / 2 / 8) - 1;
        }
        if (SegN) {
            seg = true;
        }
        let net_pkt = [];
        for (let SegO = 0; SegO <= SegN; ++SegO) {
            let head = seg ? 0x80000000 : 0x00;
            let head_str;
            let seq_zero = seq_num & 0x1fff;
            if (ctl) {
                if (seg) {
                    head |= ctl_opcode << 24 | seq_zero << 10 | SegO << 5 | SegN;
                    head_str = toHexString(intToByteArray(head, false));
                } else {
                    head |= ctl_opcode;
                    head_str = toHexString([head]);
                }
                net_pkt.push(head_str + upper_pdu.slice(8 * SegO * 2, 8 * (SegO + 1) * 2));
            } else {
                let aid = is_dev_key ? 0 : k4(app_dev_key);
                if (seg) {
                    head |= (is_dev_key ? 0 : 1) << 30 | aid << 24 | szmic << 23 | seq_zero << 10 | SegO << 5 | SegN;
                    head_str = toHexString(intToByteArray(head, false));
                } else {
                    head |= (is_dev_key ? 0 : 1) << 6 | aid;
                    head_str = toHexString([head]);
                }
                net_pkt.push(head_str + upper_pdu.slice(12 * SegO * 2, 12 * (SegO + 1) * 2));
            }
        }
        LOG('Lower transport access PDU')(JSON.stringify(net_pkt))
        return {
            net_pkt:net_pkt,
            encrypted_pkt: net_pkt.map(pkt => network_enc_obfuscate(netkey, seq_num++, iv_index, ctl, ttl, src, dst, pkt)),
            next_seq: seq_num
        };
    }

    function mesh_dec(key, ct, iv, adata, tlen) {
        let toBits = sjcl.codec.hex.toBits;
        let plain;
        try {
            plain = sjcl.codec.hex.fromBits(sjcl.mode.ccm.decrypt(new sjcl.cipher.aes(toBits(key)),
                toBits(ct), toBits(iv), adata ? toBits(adata) : null, tlen));
        } catch (e) {
            plain = null;
        }
        return plain;
    }

    function network_deobfuscate_dec(obfuscated_encrypted_arr, iv_index, netkey_set) {
        for (let key of netkey_set) {
            let obfuscated_arr = obfuscated_encrypted_arr.slice(0, 6);
            let [nid, encryption_key, privacy_key] = k2(key, [0]);
            let ctl_ttl_seq_src_arr = obfuscate(toHexString(obfuscated_encrypted_arr.slice(6, 13)), privacy_key, iv_index, obfuscated_arr);
            let ctl = ctl_ttl_seq_src_arr[0] >> 7;
            let ttl = ctl_ttl_seq_src_arr[0] & 0x7f;
            let seq_num = ctl_ttl_seq_src_arr[1] << 16 | ctl_ttl_seq_src_arr[2] << 8 | ctl_ttl_seq_src_arr[3];
            let src = ctl_ttl_seq_src_arr[4] << 8 | ctl_ttl_seq_src_arr[5];
            let nonce = nonce_build(0, ttl & 0x7f | ctl << 7, seq_num, src, 0, iv_index);
            let decrypted_str = mesh_dec(encryption_key, toHexString(obfuscated_encrypted_arr.slice(6)), toHexString(nonce), null, ctl ? 64 : 32);
            if (decrypted_str) {
                let decrypted_arr = toByteArray(decrypted_str);
                let dst = decrypted_arr[0] << 8 | decrypted_arr[1];
                return {
                    ctl: ctl,
                    ttl: ttl,
                    iv_index: iv_index,
                    seq_num: seq_num,
                    src: src,
                    dst: dst,
                    pdu_arr: decrypted_arr.slice(2),
                    netkey: key,
                };
            }
        }
        return null;
    }

    function access_dec(encrypted_str, app_dev_key_set, seq_auth, src, dst, iv_index, szmic, is_dev_key) {
        for (let key of app_dev_key_set) {
            let nonce = nonce_build(is_dev_key ? 2 : 1, szmic << 7, seq_auth, src, dst, iv_index);
            let decrypted_str = mesh_dec(key, encrypted_str, toHexString(nonce), null, szmic ? 64 : 32);
            if (decrypted_str) {
                return {
                    pdu: decrypted_str,
                    key: key,
                };
            }
        }
        return null;
    }

    that.rx_pkt_reassemble = function (rx_pkt, lower_pkts, iv_index, netkey_set, appkey_set, devkey_set) {
        let rx_pkt_arr = toByteArray(rx_pkt);
        let nid = rx_pkt_arr[0] & 0x7f;
        let matched_netkey = [];
        for (let key of netkey_set) {
            if (nid == k2(key, [0])[0]) {
                matched_netkey.push(key);
            }
        }

        function appkey_match(aid, appkey_set) {
            let matched_key = [];
            for (let key of appkey_set) {
                if (aid == k4(key)) {
                    matched_key.push(key);
                }
            }
            return matched_key;
        }

        function devkey_match(src, devkey_set) {

            for (let item of devkey_set) {
                if (item.addr == src) {
                    return [item.key];
                } else {
                    LOG('devkey_match')('devkey  not match!')
                }
            }
            return [];
        }

        function get_seq_auth(current_seq_num, seqzero) {
            let seq_auth1 = 0, seq_auth2 = 0;
            seq_auth1 = ((current_seq_num - 0x1FFF) & 0xFFFFF800) | seqzero;//sub
            seq_auth2 = ((current_seq_num - 0x0000) & 0xFFFFF800) | seqzero;//no sub
            if ((seq_auth1 >= (current_seq_num - 0x1FFF)) && (seq_auth1 <= current_seq_num))//judge overflow
            {
                return seq_auth1;
            } else if ((seq_auth2 >= (current_seq_num - 0x1FFF)) && (seq_auth2 <= current_seq_num)) {
                return seq_auth2;
            }
            return 0;
        }

        let current_pkt = network_deobfuscate_dec(rx_pkt_arr.slice(1), iv_index, matched_netkey);
        if (current_pkt) {
            let segments_complete = true;
            let env = null;
            let seg = current_pkt.pdu_arr[0] >> 7;
            if (seg) {
                let SegN = current_pkt.pdu_arr[3] & 0x1f;
                let SegO = (current_pkt.pdu_arr[3] >> 5 & 0x7) | (current_pkt.pdu_arr[2] & 0x3) << 3;
                let seq_zero = (current_pkt.pdu_arr[2] >> 2 & 0x3f) | (current_pkt.pdu_arr[1] & 0x7f) << 6;
                LOG('SegO')(SegO)
                LOG('SegN')(SegN)
                LOG('reveived seq_num')(current_pkt.seq_num)
                LOG('seq_zero')(seq_zero)


                let rx_seq_auth = get_seq_auth(current_pkt.seq_num, seq_zero);
                LOG('seq_auth')(rx_seq_auth)
                for (let pkt of lower_pkts) {
                    if (rx_seq_auth == pkt.seq_auth) {
                        env = pkt;
                        break;
                    }
                }
                if (env) {
                    segments_complete = true;
                    env.segments[SegO] = current_pkt;
                    for (let segment of env.segments) {
                        if (segment) {
                        } else {
                            segments_complete = false;
                        }
                    }

                } else {
                    // received first segment
                    segments_complete = false;
                    let segments = new Array(SegN);// init segments size
                    segments[SegO] = current_pkt;
                    env = {
                        ctl: current_pkt.ctl,
                        src: current_pkt.src,
                        dst: current_pkt.dst,
                        netkey: current_pkt.netkey,
                        seq_auth: rx_seq_auth,
                        segments: segments,
                        upper_pdu: null,
                    };
                    lower_pkts.add(env);
                    // if received single segment means that SegO=SegN
                    if (SegO == SegN) {
                        for (let pkt of lower_pkts) {
                            if ((rx_seq_auth == pkt.seq_auth)) {
                                env = pkt;
                                break;
                            }
                        }
                        if (env) {
                            segments_complete = true;
                            env.segments[SegO] = current_pkt;
                            for (let segment of env.segments) {
                                if (segment) {
                                } else {
                                    segments_complete = false;
                                }
                            }
                        }
                    }
                }
            } else {
                //  in our mesh stack this will excute never, the reason that we  received seg pkt all the time
                segments_complete = true;
                env = {
                    ctl: current_pkt.ctl,
                    src: current_pkt.src,
                    dst: current_pkt.dst,
                    netkey: current_pkt.netkey,
                    seq_auth: current_pkt.seq_num,
                    segments: [current_pkt],
                    upper_pdu: null,
                    unseg:1
                };
                lower_pkts.add(env);

            }
            if (segments_complete) {

                let pdu = env.segments.reduce(function (previousValue, item, index, array) {
                    return previousValue + toHexString(item.pdu_arr.slice(seg ? 4 : 1));
                }, "");
                if (env.ctl) {
                    env.upper_pdu = {
                        opcode: current_pkt.pdu_arr[0] & 0x7f,
                        payload: pdu,
                    };
                    lower_pkts.delete(env);
                    return env;
                } else {
                    let akf = (current_pkt.pdu_arr[0] >> 6) & 0x1;
                    let is_dev_key = akf ? false : true;
                    let matched_key;
                    if (akf) {
                        let aid = current_pkt.pdu_arr[0] & 0x3f;
                        matched_key = appkey_match(aid, appkey_set);
                    } else {
                        matched_key = devkey_match(env.src, devkey_set);
                    }

                    let access_decrypt = access_dec(pdu, matched_key, env.seq_auth,
                        env.src, env.dst, iv_index, 0, is_dev_key);
                    if (access_decrypt) {
                        env.upper_pdu = {
                            is_dev_key: is_dev_key,
                            app_dev_key: access_decrypt.key,
                            encrypted_pdu: pdu,
                            decrypted_pdu: access_decrypt.pdu,
                        };
                        lower_pkts.delete(env);
                        return env;
                    }
                }

            }
        }
        return null;
    }

    that.proxy_rx = function (rx_pdu, proxy_pkts) {
        let rx_pdu_arr = toByteArray(rx_pdu);
        let type = rx_pdu_arr[0] & 0x3f;
        let sar = rx_pdu_arr[0] >> 6;
        let rslt = null;
        switch (sar) {
            case 0:
                rslt = {type: type, pdu: toHexString(rx_pdu_arr.slice(1))};
                break;
            case 1:
                proxy_pkts.push(toHexString(rx_pdu_arr.slice(1)));
                break;
            case 2:
                proxy_pkts.push(toHexString(rx_pdu_arr.slice(1)));
                break;
            case 3:
                proxy_pkts.push(toHexString(rx_pdu_arr.slice(1)));
                rslt = {
                    type: type,
                    pdu: proxy_pkts.reduce((prev, item) => (prev + item), ""),
                };
                proxy_pkts = [];
                break;
            default:
                console.error("invalid sar");
                break;
        }
        return rslt;
    }

    that.proxy_tx = function (pdu, max_size, type) {
        let pdu_arr = toByteArray(pdu);
        max_size -= 1;
        let num = Math.ceil(pdu_arr.length / max_size);
        let pkts = [];
        if (num > 1) {
            for (let i = 0; i < num; ++i) {
                if (i == 0) {
                    pkts[i] = toHexString([type & 0x3f | 0x1 << 6]) + toHexString(pdu_arr.slice(0, max_size));
                } else if (i == num - 1) {
                    pkts[i] = toHexString([type & 0x3f | 0x3 << 6]) + toHexString(pdu_arr.slice(i * max_size, (i + 1) * max_size));
                } else {
                    pkts[i] = toHexString([type & 0x3f | 0x2 << 6]) + toHexString(pdu_arr.slice(i * max_size, (i + 1) * max_size));
                }
            }
        } else {
            pkts[0] = toHexString([type & 0x3f]) + toHexString(pdu_arr);
        }
        return pkts;
    }

    that.network_enc_obfuscate = network_enc_obfuscate
    that.toHexString = toHexString

}

module.exports = Mesh



