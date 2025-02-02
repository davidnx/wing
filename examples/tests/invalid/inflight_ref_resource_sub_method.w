bring cloud;

resource Another {
  my_queue: cloud.Queue;

  init () {
    this.my_queue = new cloud.Queue();
  }

  inflight inflight_returns_resource(): cloud.Queue {
    return this.my_queue;
//              ^^^^^^^^ Cannot qualify which operations are performed on resource "this.my_queue"
  }
}

resource Test {
  another: Another;

  init() {
    this.another = new Another();
  }

  inflight test() {
    let q = this.another.inflight_returns_resource();
    q.push("push!");
  }
}

let f = new Test();
new cloud.Function(inflight () => { f.test(); }) as "test";