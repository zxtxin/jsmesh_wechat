// pages/test/test.js
const QRCode = require('../../utils/weapp-qrcode')
const rpx2px = require('../../utils/rpx2px.js')
const MeshController = require('../../mesh_core/MeshController');
let qrcode;
// 300rpx 在6s上为 150px
const qrcodeWidth = rpx2px(600)
const quality = 1
let qrcodeGenSuccess=false
const Loading = require('../../Loading');
Page({
    data: {
        text: 'https://github.com/tomfriwel/weapp-qrcode',
        image: '',
        // 用于设置wxml里canvas的width和height样式
        qrcodeWidth,
        imgsrc: '',
        quality,

    },
    onLoad: function (options) {

    },

    makeQrcode: function (openid) {
        Loading.showLoading('loading')
        qrcode.makeCode(JSON.stringify({openid: openid}), (res) => {
            if (res.errMsg==='drawCanvas:ok'){
                qrcodeGenSuccess=true
                Loading.hideLoading()
            }
        })
    },
    promiseOpenid:function(){
        let that = this
        try {
            MeshController.openid().then(res=>{
                if(res)
                    that.makeQrcode(res)
            })
        }catch (e) {

        }

    },
    onShow: function () {
        let that = this
        if (!qrcodeGenSuccess){
            if (qrcode){
                that.promiseOpenid();
            }else{
                that.initQrcode().then(res=>{ that.promiseOpenid();}).catch(reason => {});
            }
        }
        MeshController.isBound().then(isBound=>{
                that.setData({isBound:isBound});
            }

        ).catch(reason => {});


    },
    initQrcode:function(){
        return new Promise((resolve => {
            qrcode = new QRCode('canvas', {
                // usingIn: that, // usingIn 如果放到组件里使用需要加这个参数
                // text: "https://github.com/tomfriwel/weapp-qrcode",
                backgroundImage: null,
                logoImage: null,
                width: qrcodeWidth,
                height: qrcodeWidth,
                size: qrcodeWidth,
                // colorDark: "lightblue",
                // colorLight: "#ffffff",
                autoColor: true,
                // tempCanvasId: 'temp',
                margin: 10,
                quality,
                correctLevel: QRCode.CorrectLevel.H,
                // backgroundDimming: 'rgba(0,0,0,0)',  // 背景图片遮罩
            });
            resolve(qrcode)
        }))
    },
    onReady() {
        let that = this;
        MeshController.setUserConfigChangeListener(function () {
                that.initQrcode();

            }

        );



    },
    unbind:function(e){
        let that = this;
        MeshController.unbindUser().then(res=>{
            that.setData({isBound:false});
        }).catch(reason => {})
    },
    scanQrcode: function (e) {
        Loading.showLoading('loading')
        wx.scanCode({
            onlyFromCamera: true,
            scanType: ['qrCode']
            , success(res) {
                let obj = JSON.parse(res.result)
                if (obj.openid) {
                  MeshController.bindUser(obj.openid).then(res=>{
                      Loading.hideLoading();
                      getApp().switchTab('network')
                  }).catch(reason => {
                      console.error("bindUser err:"+JSON.stringify(reason))
                  })
                }

            }
        })

    }
})
