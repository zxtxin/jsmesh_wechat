function Queue(size) {
    let list=[]
    this.push = function(data) {
        if (data==null) {
            return false;
        }
        if (size != null && !isNaN(size)) {
            if (list.length == size) {
                this.pop();
            }
        }
        list.unshift(data);
        return true;
    }

    this.pop = function() {
        return list.pop();
    }
    this.shift = function() {
        return list.shift();
    }
    this.size = function() {
        return list.length;
    }

    this.quere = function() {
        return list;
    }
    this.clear=function () {
        list=[]
    }
}

module.exports= Queue;