// pages/group/group.js

import {debounce} from "../../utils/util";
const MeshController = require('../../mesh_core/MeshController');
let route = debounce(skip2DeviceScan, 1000);
const loading=require('../../Loading');
let {
    GenericOnOffSetUnAck
} = require('../../mesh_core/MeshMessage')
Page({

    /**
     * 页面的初始数据
     */
    data: {
        showModals: false,
        show_tip_err_address: true,
        show_tip_err_name: true,
        addressName: null,
        address: null,
        groups: [],
        debug:false,
        errTip: {errAddress: "Empty Address!", errName: "Empty Name!"}
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {
        // MeshController=getApp().getMeshController();
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {
        let that = this

        function setGroups() {
            that.setData({
                showModals: false,
                show_tip_err_address: true,
                show_tip_err_name: true,
                addressName: null,
                address: null,
                errTip: {errAddress: "Empty Address!", errName: "Empty Name!"},
                groups: findGroupsDevice(MeshController.getGroups(), MeshController.nodes())
            })
            wx.stopPullDownRefresh();
        }

        setGroups();
        MeshController.groupDataObserver(function () {
            console.log('groups data changed');
            setGroups()

        });
       MeshController.seqNumObserver.set(function (res) {
           if (that.data.debug)
           wx.showModal({
               title: 'info',
               content:JSON.stringify(res),
               showCancel:false,
               confirmText: 'ok',
               success(res) {

               }
           })
       })

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {
        this.setData({
            debug:true
        })
        // if (groups && groups.length > 0 && groups !== this.data.groups) {
        //     this.setData({
        //         groups: findGroupsDevice(groups, nodes)
        //     })
        // }


    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide: function () {
        this.setData({
            debug:false
        })
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
        MeshController.reSelectGroups()
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

    },
    updateIvIndex:function(){
        if (MeshController.connected()) {
            MeshController.updateIvIndex()
        }
    },

    onAddGroupClick: function () {
        let that = this;
        let isShow = that.data.showModals;
        if (!isShow) {
            that.setData({showModals: true})
        }
    },

    hiddenModal: function () {
        // this.setData({showModals: false})
    },
    onCancel: function () {
        this.setData({showModals: false})
    },
    onOk: function () {
        let data = this.data
        if (this.data.show_tip_err_address == false && this.data.show_tip_err_name === false) {
            let curGroup = {addressName: data.addressName, address: data.address}
            if (!findGrop(this.data.groups, curGroup)) {
                MeshController.addGroup(curGroup)
                this.setData({showModals: false, errTip: {errAddress: "Empty Address!", errName: "Empty Name!"}})
            } else {
                let errInfo = modalTip(this.data.groups, curGroup)
                let show_tip_err_address = false, show_tip_err_name = false
                if (errInfo.errAddress) {
                    show_tip_err_address = true
                }
                if (errInfo.errName) {
                    show_tip_err_name = true
                }
                this.setData({errTip: errInfo, show_tip_err_address, show_tip_err_name})
            }
        }
    },

    setOnOffImage: function (on_off, address) {
        let that = this
        that.data.groups.map(item => {
            if (on_off) {
                if (item.address === address) {
                    item.image = '../../imags/light_on.svg'
                }
            } else {
                if (item.address === address) {
                    item.image = '../../imags/light_off.svg'
                }
            }

        })
        that.setData({
            groups: that.data.groups
        })
    },
    groupSendOn: function (e) {
        // let that = this
        let address = e.currentTarget.dataset.dst.address
        // this.setOnOffImage(1, address)
        sendMessage(new GenericOnOffSetUnAck(1, MeshController.getMeshConfig().seq_num, address));
    },
    groupSendOff: function (e) {
        // let that = this
        let address = e.currentTarget.dataset.dst.address
        // this.setOnOffImage(0, address)
        sendMessage(new GenericOnOffSetUnAck(0, MeshController.getMeshConfig().seq_num, address));


    },
  wacthNameChange: function (event) {
        let that = this
        let res = this.checkInput({name: event.detail.value, type: 0x00})
        if (res) {
            that.data.errTip.errName = res.errInfo
            this.setData({
                show_tip_err_name: res.tip_err_name,
                errTip: that.data.errTip,
                addressName: event.detail.value
            })
        }
    },
    wacthAddressChange: function (event) {
        let that = this
        let res = this.checkInput({address: event.detail.value, type: 0x01})
        if (res) {
            console.log(JSON.stringify(res))
            that.data.errTip.errAddress = res.errInfo
            this.setData({
                show_tip_err_address: res.tip_err_address,
                errTip: that.data.errTip,
                address: event.detail.value
            })
        }

    },
    checkInput: function (info) {
        switch (info.type) {
            case 0x00:
                if (info.name === '') {
                    return {tip_err_name: true, errInfo: 'Empty Name!'}
                } else {
                    return {tip_err_name: false, errInfo: ''}
                }
            case 0x01:
                let str = info.address
                let reg = new RegExp(/^[0-9a-fA-F]+$/)
                if (str === '') {
                    return {
                        tip_err_address: true,
                        errInfo: "Empty Address!"
                    }
                }
                if (reg.test(str)) {
                    let addres = parseInt(str, 16)
                    if (0xc000 <= addres && addres <= 0xfeff) {
                        return {
                            tip_err_address: false,
                            errInfo: ""
                        }
                    } else {
                        return {
                            tip_err_address: true,
                            errInfo: "input range from C000 to FEFF"
                        }
                    }

                } else {
                    return {
                        tip_err_address: true,
                        errInfo: "Invalidate Address! must be c000~FEFF"
                    }
                }
        }


        return null

    },
    longTap: function (e) {
        let group = e.currentTarget.dataset.data
        showModal(group)
    }

})

function sendMessage(message) {
    if (MeshController.connected()) {
        MeshController.sendMeshMessage(message).catch(res => {

        })
    } else {
       route();
    }
}

function findGrop(groups, group) {
    let bool = false
    groups.map(item => {
        if (item.address === group.address || item.addressName === group.addressName) {
            bool = true
        }
    })
    return bool
}

function modalTip(groups, group) {
    let modalTipInfo = {}
    groups.map(item => {
        if (item.address === group.address) {
            modalTipInfo.errAddress = 'address already exist!'
        }
        if (item.addressName === group.addressName) {
            modalTipInfo.errName = 'addressName already exist!'
        }
    })
    return modalTipInfo
}


function showModal(group) {
    wx.showModal({
        title: 'delete Group?',
        confirmText: 'sure',
        cancelText: 'cancel',
        success(res) {
            if (res.confirm) {
                MeshController.deleteGroup(group)
            }
        }
    })

}

function findGroupsDevice(groups, nodes) {
    // console.log(JSON.stringify(groups))
    // console.log(JSON.stringify(nodes))
    let sublist = (function findOnOffModelSublist() {
        let sublist = []
        nodes.map(node => {
            if (node.elements)
            node.elements.map((element, idx, self) => {
                if (element.models)
                element.models.map((model, idx, self) => {
                    if (parseInt(model.modelId, 16) === 0x1000) {
                        sublist.push(model.subscriptionList)
                    }
                })
            })
        })
        return sublist
    })();
    groups.map(function (group, idx, self) {
        groups[idx].deviceCount = 0
        sublist.map(addr => {
            if (parseInt(addr, 16) === parseInt(group.address, 16)) {
                ++groups[idx].deviceCount
            } else {
                groups[idx].deviceCount = 0
            }
        })
    })
    return groups

}


function skip2DeviceScan() {
    wx.navigateTo({
        url: '../scanner/scanner?auto_Connect=' + false + '&uuid=' + '00001828-0000-1000-8000-00805F9B34FB'
    })
}
