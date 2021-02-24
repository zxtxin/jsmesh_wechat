// 'use strict';
// const app = getApp();
// const context = wx.createCanvasContext('canvasline')
// const meshApi = app.getMeshApi();
// const Queue = require('../../Queue')

// Page({
//     data: {
//         touches: new Queue(32),
//         queue: new Queue(),
//         prv: -1,
//         gap: 0,
//         mesh_data: app.globalData.mesh_data,
//         tid: app.globalData.tid,
//         size: 32,
//         sum: 0

//     },
//     onMessageSendCallback: function (res) {
//         let that = this
//         if (res.state == 1) {
//             if (that.data.prv == -1) {
//                 let arr = that.data.queue.quere()
//                 let size = arr.length
//                 for (let i = 1; i <= size; i++) {
//                     that.turnOffLight(arr[size - i])
//                 }
//                 that.data.queue.clear();
//             }
//         } else if (res.state == 0) {
//             console.log("off.......")
//             that.data.touches.pop()

//         }
//         that.drawRect(true)
//         that.drawTrail(true)
//         context.draw(false)

//     }
//     ,
//     turnOnLight: function (dst) {
//         // meshApi.sendGenericMessage(meshApi.createOnOffUnackMessage(1, dst, this.data.tid++))
//         // if (this.data.tid >= 0xff) {
//         //     this.data.tid = 1;
//         // }
//     },

//     turnOffLight: function (dst) {
//         // meshApi.sendGenericMessage(meshApi.createOnOffUnackMessage(0, dst, this.data.tid++))
//         // if (this.data.tid >= 0xff) {
//         //     this.data.tid = 1;
//         // }
//     },
//     onShow: function () {
//         this.drawRect()
//     },
//     onHide: function () {
//         this.data.touches.clear()
//     },
//     onLoad: function () {
//         this.initScreenInfo()
//     },
//     initScreenInfo: function () {
//         let that = this;
//         wx.getSystemInfo({
//             //获取系统信息成功，将系统窗口的宽高赋给页面的宽高
//             success: function (res) {
//                 console.log(JSON.stringify(res))
//                 that.setData({
//                     width: res.windowWidth / 3,
//                     height: res.windowHeight,
//                     pixelRatio: res.pixelRatio
//                 })
//             }
//         })
//     },
//     onReady: function () {
//         app.setDataWriteCallback(this.onMessageSendCallback)
//     },
//     drawRect: function (bool) {
//         let that = this;
//         let size = that.data.size;
//         let gap = that.data.height / size
//         let react = {width: that.data.width - 10, height: gap}
//         let centerx = that.data.width / 2 - gap / 2
//         context.setFontSize(8)
//         context.setStrokeStyle('#CACBC6')
//         let index = 1;
//         for (let i = 1; i <= size; i++) {
//             context.strokeRect(0, (i - 1) * react.height, react.width, react.height)
//             let metrics = context.measureText(index)
//             let half_txt_width = metrics.width / 2
//             context.fillText(index, centerx + gap * 0.5 - half_txt_width, (react.height / 2 * 1.3) + (i - 1) * react.height)
//             index++;
//         }
//         if (!bool)
//             context.draw()
//     },


//     drawTrail: function (bool) {
//         let that = this;
//         let size = that.data.size;
//         let gap = that.data.height / size
//         let react = {width: that.data.width - 10, height: gap}
//         let centerx = that.data.width / 2 - gap / 2
//         that.data.touches.quere().map(function (item) {
//             // console.log('item:' + item)
//             context.setFillStyle('#cdd4cd')
//             context.fillRect(0, (item) * react.height, react.width, react.height)
//             context.setStrokeStyle('#959c97')
//             context.strokeRect(0, (item) * react.height, react.width, react.height)
//             context.setFontSize(8)
//             let metrics = context.measureText(item)
//             let half_txt_width = metrics.width / 2
//             context.setFillStyle('#414442')
//             context.fillText(item + 1, centerx + gap * 0.5 - half_txt_width, (react.height / 2 * 1.3) + (item) * react.height)

//         })
//         if (!bool)
//             context.draw(true)

//     },
//     onUnload: function () {
//         // clearInterval(this.interval)
//     }
//     ,
//     onToucthDown: function (e) {
//         let that = this
//         if (app.isBluetoothEnable())
//             if (app.isConnect()) {
//                 // console.log(JSON.stringify(e))
//                 let index = this.getIndexFromxy(e.touches[0].x, e.touches[0].y);
//                 if (index != this.data.prv) {
//                     that.data.prv = index
//                     that.turnLedOn(index)
//                     that.drawTrail()
//                 }
//             }
//     },

//     onToucthMove: function (e) {
//         let that = this
//         if (app.isBluetoothEnable())
//             if (app.isConnect()) {
//                 let index = this.getIndexFromxy(e.touches[0].x, e.touches[0].y);
//                 if (index != this.data.prv) {
//                     that.data.prv = index
//                     that.turnLedOn(index)
//                     that.drawTrail()
//                 }
//             }
//     },
//     onToucthUp: function (e) {
//         this.data.prv = -1
//         let that = this
//         // console.log(JSON.stringify(e))
//         // this.turnLedOn(index)
//         that.cleanUpQueue()
//     },
//     cleanUpQueue: function () {
//         let that = this
//         while (this.data.queue.size() > 0) {
//             that.turnOffLight(this.data.queue.pop())
//         }
//     },
//     turnLedOn: function (index) {
//         let that = this
//         that.data.touches.push(index)
//         let node = app.globalData.mesh_data.nodes[index + 100];
//         if (node) {
//             let dst = node.elements[0].elementAddress;
//             that.turnOnLight(dst)
//             that.data.queue.push(dst)
//             if (that.data.queue.size() > 4) {
//                 that.turnOffLight(that.data.queue.pop())
//             }
//         }
//     }
//     ,
//     getIndexFromxy: function (x, y) {
//         let that = this
//         let gap = that.data.height / that.data.size
//         let _y = Math.floor(y / gap)
//         // console.log('_y:' + _y)
//         return _y;
//     },

// })

