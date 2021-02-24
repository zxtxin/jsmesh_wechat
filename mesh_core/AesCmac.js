const sjcl = require('./sjcl');
let AesCmac = function() {

  /**
   * This mostly follows the AES-128 CMAC algorithm found here.
   * 
   * @see http://tools.ietf.org/html/rfc4493
   * 
   * 
   * This module has a dependency on The Stanford Javascript Crypto Library. If using the
   * minified build, be sure to add sjcl.mode.cbc object into the namespace since I guess it's
   * too "dangerous" to include.
   * 
   * @see http://crypto.stanford.edu/sjcl/
   * 
   * 
   * In JavaScript, all numbers are 64 bit floating point. The bitwise operators treat numbers
   * as 32bit integers. But we're not guaranteed all 32 bits. ~0=-1 instead of 4,294,967,295.
   * So for most of these bit operations we're using sjcl.bitArray to do the dirty work.
   * 
   * @see http://www.hunlock.com/blogs/The_Complete_Javascript_Number_Reference
   * 
   * 
   * The padding function is described here.
   * @see http://www.cardwerk.com/smartcards/smartcard_standard_ISO7816-4_5_basic_organizations.aspx#chap5_6_3_1
   */

  this.const_Bsize = 128; // in bits! not octets (16)
  this.const_Zero = sjcl.codec.hex.toBits("0x00000000000000000000000000000000");
  this.const_Rb = sjcl.codec.hex.toBits("0x00000000000000000000000000000087");
  this.aesCipher = {};
};

AesCmac.prototype = {
  init: function(key) {
    var keyBits = sjcl.codec.hex.toBits(key);
    this.aesCipher = new sjcl.cipher.aes(keyBits);
  },

  xor4Words: function(x, y) {
    return [
      x[0] ^ y[0], x[1] ^ y[1], x[2] ^ y[2], x[3] ^ y[3]
    ];
  },

  simpleShiftLeft: function(a, shift) {
    return sjcl.bitArray.bitSlice(sjcl.bitArray.concat(a, [
      0
    ]), shift, this.const_Bsize + shift);
  },

  iso7816d4Padding: function(m) {
    var bitLength = sjcl.bitArray.bitLength(m);
    m = this.xor4Words(m, this.const_Zero);
    var gap = this.const_Bsize - bitLength;
    if (gap < 8)
      return m;
    var startWord = Math.floor(bitLength / 32);
    var startByte = Math.ceil((bitLength % 32) / 8); // 0,1,2,3,4
    if (startByte == 4) {
      console.log("rolled over into next word");
      startWord++;
      startByte = 0;
      if (startWord == 4) {
        // this should have been caught above on gap check
        console.warn("this shouldn't ever happen");
        return m;
      }
    }
    var last32 = m[startWord];
    // startByte: 0->2^31, 1->2^23, 2->2^15, 3->2^7
    var bitmask = Math.pow(2, (4 - startByte) * 8 - 1)
    last32 |= bitmask;
    m[startWord] = last32;
    return m;
  },

  _encrypt: function(m) {
    return sjcl.bitArray.clamp(sjcl.mode.cbc.encrypt(this.aesCipher, m, this.const_Zero),
      this.const_Bsize);
  },

  generateSubkeys: function() {
    // Step 1
    var L = this._encrypt(this.const_Zero);

    // Step 2
    var msbNeg = L[0] & 0x80000000;
    var K1 = this.simpleShiftLeft(L, 1, 0);
    if (msbNeg) {
      K1 = this.xor4Words(K1, this.const_Rb);
    }

    // Step 3
    msbNeg = K1[0] & 0x80000000;
    var K2 = this.simpleShiftLeft(K1, 1, 0);
    if (msbNeg) {
      K2 = this.xor4Words(K2, this.const_Rb);
    }

    // Step 4
    return {
      "K1": K1,
      "K2": K2
    };
  },

  generateCmac: function(plainText) {
    // Step 1
    var subkeys = this.generateSubkeys();

    // Step 2
    var M = sjcl.codec.hex.toBits(plainText);
    var len = sjcl.bitArray.bitLength(M); // in bits! not octets
    var n = Math.ceil(len / this.const_Bsize);

    // Step 3
    var lastBlockComplete;
    if (n == 0) {
      n = 1;
      lastBlockComplete = false;
    } else {
      if (len % this.const_Bsize == 0)
        lastBlockComplete = true;
      else
        lastBlockComplete = false;
    }

    // Step 4
    var lastStart = (n - 1) * this.const_Bsize;
    var M_last = sjcl.bitArray.bitSlice(M, lastStart);
    if (lastBlockComplete) {
      M_last = this.xor4Words(M_last, subkeys["K1"]);
    } else {
      M_last = this.iso7816d4Padding(M_last);
      M_last = this.xor4Words(M_last, subkeys["K2"]);
    }

    // Step 5
    var X = this.const_Zero;
    var Y;

    // Step 6
    for (var i = 1; i <= n - 1; i++) {
      var start = (i - 1) * this.const_Bsize;
      var end = i * this.const_Bsize;
      var M_i = sjcl.bitArray.bitSlice(M, start, end);
      Y = this.xor4Words(X, M_i);
      X = this._encrypt(Y);
    }
    Y = this.xor4Words(M_last, X);
    // Step 7
    return this._encrypt(Y);
  },
};
module.exports = AesCmac;