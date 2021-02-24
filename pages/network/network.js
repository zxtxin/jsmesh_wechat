// pages/network/network.js
const app = getApp();
let MeshController;
let Loading=app.LOADIND();
Page({


    skipNodeConfig(e) {
        MeshController.setCurNode(e.currentTarget.dataset.data.name);
            wx.navigateTo({
                url: '../nodeConfig/nodeConfig'
            })
    },
    scanProvisionedNode() {
        if (!this.data.connected) {
            wx.navigateTo({
                url: '../scanner/scanner?auto_Connect=' + false + '&uuid=' + '00001828-0000-1000-8000-00805F9B34FB'
            })
        } else {
            MeshController.disconnect().then(res => {
            }).catch(res => {
            })
        }
    }

    ,
    /**
     * 页面的初始数据
     */
    data: {
        connected: false,
        isStorage: false,
        conn_state_info: 'Connect',
        deviceName: '',
        connState: 'connect',
        devices:null,
    },


    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {
        let that = this
        MeshController=getApp().getMeshController()
        MeshController.nodeDataObserver(function () {
            let devices = MeshController.nodes()
            that.setData({devices})
            wx.stopPullDownRefresh()
            console.log('notify data changed')
        });
        MeshController._setConnStateChangelistener(function (res) {
            console.log('connected:'+JSON.stringify(res))
            if (res.connected) {
               Loading.showToast('connected');
                that.setData({
                    connected: true,
                    deviceName: res.name,
                    connState: 'disconnect'
                })
            } else {
                Loading.showToast('disconnected');
                that.setData({
                    connected: false,
                    deviceName: '',
                    connState: 'connect'
                })
            }
        });

    },

    scanUnprovisonedDevice: function () {
        wx.navigateTo({
            url: '../scanner/scanner?auto_Connect=' + false + '&uuid=' + '00001827-0000-1000-8000-00805F9B34FB'
        })

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {

    },


    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {
    },
    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function () {
        MeshController.reSlectNodes();
    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function () {

    },

    /**
     * 用户点击右上角分享
     */
    onShareAppMessage: function () {

    }

})

function getPageKey() {
    return 'network'
}