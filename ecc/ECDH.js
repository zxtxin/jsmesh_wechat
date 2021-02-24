function Curve() {
    let {secp256r1} = require('./sec')
    let {BigInteger} = require("./jsbn");
    let curve = new secp256r1()
    let SecureRandom = require('./rng')
    let {ECCurveFp, ECPointFp} = require("./ec");
    let gx = curve.getG().getX().toBigInteger().toString();
    let gy = curve.getG().getY().toBigInteger().toString();

    function get_curve() {
        return new ECCurveFp(new BigInteger(curve.getCurve().getQ().toString()),
            new BigInteger(curve.getCurve().getA().toBigInteger().toString()),
            new BigInteger(curve.getCurve().getB().toBigInteger().toString()));
    }

    this.pick_rand = function () {
        let n = new BigInteger(curve.getN().toString());
        let n1 = n.subtract(BigInteger.ONE);
        let r = new BigInteger(n.bitLength(), new SecureRandom());
        return r.mod(n1).add(BigInteger.ONE);
    }

    this.getPubkey = function (random) {
        let G = get_G(get_curve());
        let a = new BigInteger(random);
        let P = G.multiply(a);
        return P.getX().toBigInteger().toString(16) + P.getY().toBigInteger().toString(16);
    }

    function get_G(curve) {
        return new ECPointFp(curve,
            curve.fromBigInteger(new BigInteger(gx)),
            curve.fromBigInteger(new BigInteger(gy)));
    }

    this.derivedECDH = function (point, privateKey) {
        let curve = get_curve();
        let ecPointFp = new ECPointFp(curve,
            curve.fromBigInteger(new BigInteger(point.x, 16)),
            curve.fromBigInteger(new BigInteger(point.y, 16)))
        let P = ecPointFp;
        let a = new BigInteger(privateKey);
        let S = P.multiply(a);
        let x = S.getX().toBigInteger().toString(16);
        let y = S.getY().toBigInteger().toString(16);
        return x
    }
}

module.exports = Curve;