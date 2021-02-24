const rate = wx.getSystemInfoSync().windowWidth / 750
module.exports= function(rpx) {
    return rate * rpx
}