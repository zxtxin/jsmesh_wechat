
const LoadingInstance = (function () {
    let instance;

    function getInstance() {
        if (instance === undefined) {
            instance = new Loading();
        }
        return instance;
    }

    return {
        getInstance: getInstance
    }

})()
function  Loading () {
    let isLoading=false;
    let that=this
    that.showLoading=function(title) {
        if (isLoading){
            that.hideLoading()
        }
        isLoading=true;
        wx.showLoading({
            title:title
        })
    }
    that. hideLoading=function() {
        isLoading=false;
        wx.hideLoading();
    }
    that.showToast=function (title) {
        wx.showToast({title,title})
    }
}

module.exports=LoadingInstance.getInstance();