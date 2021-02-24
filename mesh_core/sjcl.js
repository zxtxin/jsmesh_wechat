"use strict";
var sjcl = {
    cipher: {}, hash: {}, keyexchange: {}, mode: {}, misc: {}, codec: {}, exception: {
        corrupt: function (a) {
            this.toString = function () {
                return "CORRUPT: " + this.message
            };
            this.message = a
        }, invalid: function (a) {
            this.toString = function () {
                return "INVALID: " + this.message
            };
            this.message = a
        }, bug: function (a) {
            this.toString = function () {
                return "BUG: " + this.message
            };
            this.message = a
        }, notReady: function (a) {
            this.toString = function () {
                return "NOT READY: " + this.message
            };
            this.message = a
        }
    }
};
sjcl.cipher.aes = function (f) {
    if (!this._tables[0][0][0]) {
        this._precompute()
    }
    var d, e, l, c, a, k = this._tables[0][4], b = this._tables[1], g = f.length, h = 1;
    if (g !== 4 && g !== 6 && g !== 8) {
        throw new sjcl.exception.invalid("invalid aes key size")
    }
    this._key = [c = f.slice(0), a = []];
    for (d = g; d < 4 * g + 28; d++) {
        l = c[d - 1];
        if (d % g === 0 || (g === 8 && d % g === 4)) {
            l = k[l >>> 24] << 24 ^ k[l >> 16 & 255] << 16 ^ k[l >> 8 & 255] << 8 ^ k[l & 255];
            if (d % g === 0) {
                l = l << 8 ^ l >>> 24 ^ h << 24;
                h = h << 1 ^ (h >> 7) * 283
            }
        }
        c[d] = c[d - g] ^ l
    }
    for (e = 0; d; e++, d--) {
        l = c[e & 3 ? d : d - 4];
        if (d <= 4 || e < 4) {
            a[e] = l
        } else {
            a[e] = b[0][k[l >>> 24]] ^ b[1][k[l >> 16 & 255]] ^ b[2][k[l >> 8 & 255]] ^ b[3][k[l & 255]]
        }
    }
};
sjcl.cipher.aes.prototype = {
    encrypt: function (a) {
        return this._crypt(a, 0)
    }, decrypt: function (a) {
        return this._crypt(a, 1)
    }, _tables: [[[], [], [], [], []], [[], [], [], [], []]], _precompute: function () {
        var m = this._tables[0], l = this._tables[1], p = m[4], q = l[4], n, f, k, j = [], c = [], e, g, h, o, b, a;
        for (n = 0; n < 256; n++) {
            c[(j[n] = n << 1 ^ (n >> 7) * 283) ^ n] = n
        }
        for (f = k = 0; !p[f]; f ^= e || 1, k = c[k] || 1) {
            o = k ^ k << 1 ^ k << 2 ^ k << 3 ^ k << 4;
            o = o >> 8 ^ o & 255 ^ 99;
            p[f] = o;
            q[o] = f;
            h = j[g = j[e = j[f]]];
            a = h * 16843009 ^ g * 65537 ^ e * 257 ^ f * 16843008;
            b = j[o] * 257 ^ o * 16843008;
            for (n = 0; n < 4; n++) {
                m[n][f] = b = b << 24 ^ b >>> 8;
                l[n][o] = a = a << 24 ^ a >>> 8
            }
        }
        for (n = 0; n < 5; n++) {
            m[n] = m[n].slice(0);
            l[n] = l[n].slice(0)
        }
    }, _crypt: function (h, l) {
        if (h.length !== 4) {
            throw new sjcl.exception.invalid("invalid aes block size")
        }
        var k = this._key[l], e = h[0] ^ k[0], r = h[l ? 3 : 1] ^ k[1], p = h[2] ^ k[2], g = h[l ? 1 : 3] ^ k[3], j, f,
            x, n = k.length / 4 - 2, y, m = 4, o = [0, 0, 0, 0], w = this._tables[l], s = w[0], t = w[1], u = w[2],
            v = w[3], q = w[4];
        for (y = 0; y < n; y++) {
            j = s[e >>> 24] ^ t[r >> 16 & 255] ^ u[p >> 8 & 255] ^ v[g & 255] ^ k[m];
            f = s[r >>> 24] ^ t[p >> 16 & 255] ^ u[g >> 8 & 255] ^ v[e & 255] ^ k[m + 1];
            x = s[p >>> 24] ^ t[g >> 16 & 255] ^ u[e >> 8 & 255] ^ v[r & 255] ^ k[m + 2];
            g = s[g >>> 24] ^ t[e >> 16 & 255] ^ u[r >> 8 & 255] ^ v[p & 255] ^ k[m + 3];
            m += 4;
            e = j;
            r = f;
            p = x
        }
        for (y = 0; y < 4; y++) {
            o[l ? 3 & -y : y] = q[e >>> 24] << 24 ^ q[r >> 16 & 255] << 16 ^ q[p >> 8 & 255] << 8 ^ q[g & 255] ^ k[m++];
            j = e;
            e = r;
            r = p;
            p = g;
            g = j
        }
        return o
    }
};
sjcl.bitArray = {
    bitSlice: function (b, d, c) {
        b = sjcl.bitArray._shiftRight(b.slice(d / 32), 32 - (d & 31)).slice(1);
        return (c === undefined) ? b : sjcl.bitArray.clamp(b, c - d)
    }, extract: function (b, d, c) {
        var f, e = Math.floor((-d - c) & 31);
        if ((d + c - 1 ^ d) & -32) {
            f = (b[d / 32 | 0] << (32 - e)) ^ (b[d / 32 + 1 | 0] >>> e)
        } else {
            f = b[d / 32 | 0] >>> e
        }
        return f & ((1 << c) - 1)
    }, concat: function (a, b) {
        if (a.length === 0 || b.length === 0) {
            return a.concat(b)
        }
        var c = a[a.length - 1], d = sjcl.bitArray.getPartial(c);
        if (d === 32) {
            return a.concat(b)
        } else {
            return sjcl.bitArray._shiftRight(b, d, c | 0, a.slice(0, a.length - 1))
        }
    }, bitLength: function (b) {
        var c = b.length, d;
        if (c === 0) {
            return 0
        }
        d = b[c - 1];
        return (c - 1) * 32 + sjcl.bitArray.getPartial(d)
    }, clamp: function (b, d) {
        if (b.length * 32 < d) {
            return b
        }
        b = b.slice(0, Math.ceil(d / 32));
        var c = b.length;
        d = d & 31;
        if (c > 0 && d) {
            b[c - 1] = sjcl.bitArray.partial(d, b[c - 1] & 2147483648 >> (d - 1), 1)
        }
        return b
    }, partial: function (b, c, a) {
        if (b === 32) {
            return c
        }
        return (a ? c | 0 : c << (32 - b)) + b * 1099511627776
    }, getPartial: function (a) {
        return Math.round(a / 1099511627776) || 32
    }, equal: function (c, d) {
        if (sjcl.bitArray.bitLength(c) !== sjcl.bitArray.bitLength(d)) {
            return false
        }
        var f = 0, e;
        for (e = 0; e < c.length; e++) {
            f |= c[e] ^ d[e]
        }
        return (f === 0)
    }, _shiftRight: function (b, g, c, f) {
        var d, e = 0, h;
        if (f === undefined) {
            f = []
        }
        for (; g >= 32; g -= 32) {
            f.push(c);
            c = 0
        }
        if (g === 0) {
            return f.concat(b)
        }
        for (d = 0; d < b.length; d++) {
            f.push(c | b[d] >>> g);
            c = b[d] << (32 - g)
        }
        e = b.length ? b[b.length - 1] : 0;
        h = sjcl.bitArray.getPartial(e);
        f.push(sjcl.bitArray.partial(g + h & 31, (g + h > 32) ? c : f.pop(), 1));
        return f
    }, _xor4: function (a, b) {
        return [a[0] ^ b[0], a[1] ^ b[1], a[2] ^ b[2], a[3] ^ b[3]]
    }, byteswapM: function (b) {
        var c, e, d = 65280;
        for (c = 0; c < b.length; ++c) {
            e = b[c];
            b[c] = (e >>> 24) | ((e >>> 8) & d) | ((e & d) << 8) | (e << 24)
        }
        return b
    }
};
sjcl.codec.hex = {
    fromBits: function (a) {
        var c = "", b;
        for (b = 0; b < a.length; b++) {
            c += ((a[b] | 0) + 263882790666240).toString(16).substr(4)
        }
        return c.substr(0, sjcl.bitArray.bitLength(a) / 4)
    }, toBits: function (d) {
        var a, c = [], b;
        d = d.replace(/\s|0x/g, "");
        b = d.length;
        d = d + "00000000";
        for (a = 0; a < d.length; a += 8) {
            c.push(parseInt(d.substr(a, 8), 16) ^ 0)
        }
        return sjcl.bitArray.clamp(c, b * 4)
    }
};
sjcl.mode.ccm = {
    name: "ccm", _progressListeners: [], listenProgress: function (a) {
        sjcl.mode.ccm._progressListeners.push(a)
    }, unListenProgress: function (a) {
        var b = sjcl.mode.ccm._progressListeners.indexOf(a);
        if (b > -1) {
            sjcl.mode.ccm._progressListeners.splice(b, 1)
        }
    }, _callProgressListener: function (c) {
        var b = sjcl.mode.ccm._progressListeners.slice(), a;
        for (a = 0; a < b.length; a += 1) {
            b[a](c)
        }
    }, encrypt: function (h, g, b, a, j) {
        var d, f = g.slice(0), i, k = sjcl.bitArray, c = k.bitLength(b) / 8, e = k.bitLength(f) / 8;
        j = j || 64;
        a = a || [];
        if (c < 7) {
            throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes")
        }
        for (d = 2; d < 4 && e >>> 8 * d; d++) {
        }
        if (d < 15 - c) {
            d = 15 - c
        }
        b = k.clamp(b, 8 * (15 - d));
        i = sjcl.mode.ccm._computeTag(h, g, b, a, j, d);
        f = sjcl.mode.ccm._ctrMode(h, f, b, i, j, d);
        return k.concat(f.data, f.tag)
    }, decrypt: function (h, b, c, a, k) {
        k = k || 64;
        a = a || [];
        var e, l = sjcl.bitArray, d = l.bitLength(c) / 8, f = l.bitLength(b), g = l.clamp(b, f - k),
            i = l.bitSlice(b, f - k), j;
        f = (f - k) / 8;
        if (d < 7) {
            throw new sjcl.exception.invalid("ccm: iv must be at least 7 bytes")
        }
        for (e = 2; e < 4 && f >>> 8 * e; e++) {
        }
        if (e < 15 - d) {
            e = 15 - d
        }
        c = l.clamp(c, 8 * (15 - e));
        g = sjcl.mode.ccm._ctrMode(h, g, c, i, k, e);
        j = sjcl.mode.ccm._computeTag(h, g.data, c, a, k, e);
        if (!l.equal(g.tag, j)) {
            throw new sjcl.exception.corrupt("ccm: tag doesn't match")
        }
        return g.data
    }, _macAdditionalData: function (h, a, c, j, g, d) {
        var e, k, b, f = [], l = sjcl.bitArray, m = l._xor4;
        e = [l.partial(8, (a.length ? 1 << 6 : 0) | (j - 2) << 2 | d - 1)];
        e = l.concat(e, c);
        e[3] |= g;
        e = h.encrypt(e);
        if (a.length) {
            k = l.bitLength(a) / 8;
            if (k <= 65279) {
                f = [l.partial(16, k)]
            } else {
                if (k <= 4294967295) {
                    f = l.concat([l.partial(16, 65534)], [k])
                }
            }
            f = l.concat(f, a);
            for (b = 0; b < f.length; b += 4) {
                e = h.encrypt(m(e, f.slice(b, b + 4).concat([0, 0, 0])))
            }
        }
        return e
    }, _computeTag: function (g, f, c, a, h, d) {
        var e, b, j = sjcl.bitArray, k = j._xor4;
        h /= 8;
        if (h % 2 || h < 4 || h > 16) {
            throw new sjcl.exception.invalid("ccm: invalid tag length")
        }
        if (a.length > 4294967295 || f.length > 4294967295) {
            throw new sjcl.exception.bug("ccm: can't deal with 4GiB or more data")
        }
        e = sjcl.mode.ccm._macAdditionalData(g, a, c, h, j.bitLength(f) / 8, d);
        for (b = 0; b < f.length; b += 4) {
            e = g.encrypt(k(e, f.slice(b, b + 4).concat([0, 0, 0])))
        }
        return j.clamp(e, h * 8)
    }, _ctrMode: function (d, m, r, e, f, a) {
        var o, q, g = sjcl.bitArray, h = g._xor4, k, s = m.length, j = g.bitLength(m), b = s / 50, c = b;
        k = g.concat([g.partial(8, a - 1)], r).concat([0, 0, 0]).slice(0, 4);
        e = g.bitSlice(h(e, d.encrypt(k)), 0, f);
        if (!s) {
            return {tag: e, data: []}
        }
        for (q = 0; q < s; q += 4) {
            if (q > b) {
                sjcl.mode.ccm._callProgressListener(q / s);
                b += c
            }
            k[3]++;
            o = d.encrypt(k);
            m[q] ^= o[0];
            m[q + 1] ^= o[1];
            m[q + 2] ^= o[2];
            m[q + 3] ^= o[3]
        }
        return {tag: e, data: g.clamp(m, j)}
    }
};
sjcl.mode.cbc = {
    name: "cbc", encrypt: function (h, g, e, a) {
        if (a && a.length) {
            throw new sjcl.exception.invalid("cbc can't authenticate data")
        }
        if (sjcl.bitArray.bitLength(e) !== 128) {
            throw new sjcl.exception.invalid("cbc iv must be 128 bits")
        }
        var d, j = sjcl.bitArray, k = j._xor4, b = j.bitLength(g), c = 0, f = [];
        if (b & 7) {
            throw new sjcl.exception.invalid("pkcs#5 padding only works for multiples of a byte")
        }
        for (d = 0; c + 128 <= b; d += 4, c += 128) {
            e = h.encrypt(k(e, g.slice(d, d + 4)));
            f.splice(d, 0, e[0], e[1], e[2], e[3])
        }
        b = (16 - ((b >> 3) & 15)) * 16843009;
        e = h.encrypt(k(e, j.concat(g, [b, b, b, b]).slice(d, d + 4)));
        f.splice(d, 0, e[0], e[1], e[2], e[3]);
        return f
    }, decrypt: function (h, d, f, a) {
        if (a && a.length) {
            throw new sjcl.exception.invalid("cbc can't authenticate data")
        }
        if (sjcl.bitArray.bitLength(f) !== 128) {
            throw new sjcl.exception.invalid("cbc iv must be 128 bits")
        }
        if ((sjcl.bitArray.bitLength(d) & 127) || !d.length) {
            throw new sjcl.exception.corrupt("cbc ciphertext must be a positive multiple of the block size")
        }
        var e, j = sjcl.bitArray, k = j._xor4, b, c, g = [];
        a = a || [];
        for (e = 0; e < d.length; e += 4) {
            b = d.slice(e, e + 4);
            c = k(f, h.decrypt(b));
            g.splice(e, 0, c[0], c[1], c[2], c[3]);
            f = b
        }
        b = g[e - 1] & 255;
        if (b === 0 || b > 16) {
            throw new sjcl.exception.corrupt("pkcs#5 padding corrupt")
        }
        c = b * 16843009;
        if (!j.equal(j.bitSlice([c, c, c, c], 0, b * 8), j.bitSlice(g, g.length * 32 - b * 8, g.length * 32))) {
            throw new sjcl.exception.corrupt("pkcs#5 padding corrupt")
        }
        return j.bitSlice(g, 0, g.length * 32 - b * 8)
    }
};
if (typeof module !== "undefined" && module.exports) {
    module.exports = sjcl
}
if (typeof define === "function") {
    define([], function () {
        return sjcl
    })
}
;