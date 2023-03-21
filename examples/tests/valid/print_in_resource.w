bring cloud;

resource Test {
  init() { }
  inflight test() {
    print("i am inside a resource yey!");
  }
}

let t = new Test();
new cloud.Function(inflight () => { t.test(); }) as "test";
