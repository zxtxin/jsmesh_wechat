//app.js

const MeshController = require('./mesh_core/MeshController');
const Loading = require('./Loading')
const log=console.log
App({
    onError: function (msg) {
        console.error('onError:' + msg.toString())
    },
    onLaunch: function () {
        let that=this;

      // // 登录
      // wx.login({
      //   success: res => {
      //       log(JSON.stringify(res))
      //     // 发送 res.code 到后台换取 openId, sessionKey, unionId
      //   }
      // })
      // 获取用户信息
      wx.getSetting({
        success: res => {
          if (res.authSetting['scope.userInfo']) {
            // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
            wx.getUserInfo({
              success: res => {
                // 可以将 res 发送给后台解码出 unionId
                this.globalData.userInfo = res.userInfo
                  if (!res.userInfo){
                      wx.reLaunch({
                          url:'../scope/scope'
                      })
                  }else {
                      that.setUserInfo(res.userInfo)
                  }
                // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
                // 所以此处加入 callback 以防止这种情况
                if (this.userInfoReadyCallback) {
                  this.userInfoReadyCallback(res)
                }
              }
            })
          }else {
              wx.reLaunch({
                  url:'../scope/scope'
              })
          }
        },fail(res) {
            that.showSettingToast('授权登录')
          }
      })

    },
  globalData: {
    userInfo: null
  },
    // 打开权限设置页提示框
    showSettingToast: function (e) {
        let that=this
        wx.showModal({
            title: '提示!',
            confirmText: '去设置',
            showCancel: false,
            content: e,
            success: function (res) {
                if (res.confirm) {
                    wx.openSetting({
                        success(res) {
                            // that.getUserInfo_()
                        }
                    })
                }
            }
        })
    },
  

    onUnlaunch: function () {
            MeshController.destroy()

    },


    LOADIND: function () {
        return Loading;
    },

    setUserInfo:function(userinfo){
        console.log('setUserInfo:'+JSON.stringify(userinfo))
        MeshController.setUserInfo(userinfo)
        MeshController.init()
        MeshController.setLogger({
            DEBUG: function (tag, info) {

                if (info!==''){
                    console.info(tag);
                    console.info({info})
                }

            },
            ERROR: function (tag, info) {
                console.error(tag + '\n' + info)
            }
        });
    },
    getMeshController: function () {
        return MeshController
    },
    switchTab: function (name) {
        switchTab(name)
    },
    switchMain: function () {
        switchTab('network')
    }
})

function switchTab(name) {
    if (name === 'network') {
        wx.switchTab({
            url: '../../pages/network/network'
        })
    }

}












