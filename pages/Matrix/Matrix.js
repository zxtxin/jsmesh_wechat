// const app = getApp();
// const context = wx.createCanvasContext('canvas')
// const meshApi = app.getMeshApi();
// Page({
//     data: {
//         prv: 0,
//         mesh_data: app.globalData.mesh_data,
//         tid: app.globalData.tid,
//         isScroll: false,
//         disableScroll: true,
//         thouches: [],
//     },
//     onHide: function () {
//     },
//     onShow: function () {
//         this.drawRect()
//     },

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
//     onLoad: function () {
//         this.initScreenInfo()
//     },
//     initScreenInfo: function () {
//         let that = this;
//         wx.getSystemInfo({
//             //获取系统信息成功，将系统窗口的宽高赋给页面的宽高
//             success: function (res) {
//                 that.setData({
//                     width: res.windowWidth,
//                     height: res.windowWidth
//                 })
//             }
//         })
//     },
//     onReady: function () {
//     },
//     drawBase: function () {

//         // context.draw()
//     },
//     drawRect: function () {
//         let that = this;
//         context.setStrokeStyle('#CACBC6')
//         // let index = 1;
//         // for (let n = 1; n <= 100; n++) {
//         //     for (let i = 1; i <= 100; i++) {
//         //         let point = {x: 0, y: 0}
//         //         if (i % 10 == 0) {
//         //             point.x = 9
//         //             point.y = i / 10 - 1
//         //         } else {
//         //             point.x = (i % 10 - 1)
//         //             point.y = (Math.floor(i / 10))
//         //         }
//         //
//         //         context.strokeRect(point.x * gap, point.y * react.height, react.width, react.height)
//         //         let metrics = context.measureText(index)
//         //         let half_txt_width = metrics.width / 2
//         //         context.fillText(index, point.x * gap + react.width / 2 - half_txt_width, (react.height / 2 * 1.3) + point.y * react.height)
//         //         index++;
//         //     }
//         // }
//         context.beginPath();
//         context.setLineJoin('round')
//         context.setLineWidth(1)
//         context.moveTo(0, that.data.height / 2)
//         context.lineTo(that.data.width, that.data.height / 2)
//         context.stroke()

//         context.beginPath();
//         context.setLineJoin('round')
//         context.setLineWidth(1)
//         context.moveTo(that.data.width / 2, 0)
//         context.lineTo(that.data.width / 2, that.data.height)
//         context.stroke()

//         context.strokeRect(0, 0, that.data.width, that.data.height)
//         context.setLineDash([10, 20], 5)
//         context.beginPath();
//         context.moveTo(0, 0)
//         context.lineTo(that.data.width, that.data.height)
//         context.moveTo(that.data.width, 0)
//         context.lineTo(0, that.data.height)
//         context.stroke()
//         context.draw()
//     },
//     drawText: function () {
//         let that = this;
//         let gap = that.data.width / 10
//         context.setFontSize(12)
//         // that.data.thouches = that.uniq(that.data.thouches)
//         context.beginPath();
//         context.setLineJoin('round')
//         context.setStrokeStyle('#0f0707')
//         context.setLineDash([20, 0], 1)
//         context.setLineWidth(10)
//         let index=1;
//         that.data.thouches.map(function (item) {
//             let point =item;
//             // console.log(point)
//             if (index==1){
//                 context.moveTo(point.x,point.y)
//             }else {
//                 context.lineTo(point.x,point.y)
//             }

//             index++
//             // context.fillRect((point.x - 1) * react.width, (point.y - 1) * react.height, react.width, react.height)
//         })
//         context.stroke()
//         context.draw(true,function () {
//             // console.log('........................')
//         })
//     },
//     clear:function(){
//         let that=this
//         this.drawRect()
//         let groups=app.globalData.mesh_data.groups
//         groups.map(function (item) {
//             console.log(JSON.stringify(item))
//             that.turnOffLight(item)
//         })
//     },
//     onUnload: function () {
//         // clearInterval(this.interval)
//     }
//     ,
//     onToucthDown: function (e) {
//         if (app.isBluetoothEnable())
//             if (app.isConnectToMesh()) {
//             console.log(e)
//             let index = this.getIndexFromxy(e.touches[0].x, e.touches[0].y);
//             if (index != this.data.prv) {
//                 this.data.prv = index
//                 this.turnLedOn(index)
//                 this.data.thouches.push({x:e.touches[0].x,y:e.touches[0].y})
//                 this.drawText()

//             }
//         }

//     },
//     onToucthMove: function (e) {
//         if (app.isBluetoothEnable())
//             if (app.isConnect()) {
//             let index = this.getIndexFromxy(e.touches[0].x, e.touches[0].y);
//             if (index != this.data.prv) {
//                 this.data.prv = index
//                 this.turnLedOn(index)
//                 this.data.thouches.push({x:e.touches[0].x,y:e.touches[0].y})
//                 this.drawText()
//             }
//         }
//     },
//     onToucthUp: function (e) {
//         this.data.prv = 0
//         this.data.thouches = []
//     },
//     turnLedOn: function (index) {
//         let that = this
//         let node = app.globalData.mesh_data.nodes[index - 1];
//         if (node) {
//             that.turnOnLight(node.elements[0].elementAddress)
//         }
//     }
//     ,
//     getIndexFromxy: function (x, y) {
//         let that = this
//         let point = {
//             _x: x * 10 / that.data.width,
//             _y: y * 10 / that.data.height
//         }
//         let a = Math.floor(point._x + 1)
//         let b = Math.floor(point._y + 1)
//         return (b - 1) * 10 + a;
//     },
//     getpoint_from_index: function (idx) {
//         console.log(idx)
//         let y = 0
//         let x = 0
//         x = idx % 10
//         y = Math.floor(idx / 10) + 1
//         if (idx % 10 == 0) {
//             x = 10
//             y = idx / 10
//         }

//         // console.log('x:' + x, 'y:' + y)
//         return {x, y}
//     },
//     line:function () {
//         wx.navigateTo({
//             url:'../Line/line'
//         })
//     }

// })

