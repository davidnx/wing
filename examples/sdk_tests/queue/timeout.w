bring cloud;

let q = new cloud.Queue(cloud.QueueProps{timeout: 1s});

resource JSHelper {
  init() {}
  extern "helper.js" inflight sleep(milli: num);
}

let js = new JSHelper();

q.on_message(inflight () => {
  js.sleep(2000);
});


// TODO: this test fails sim due to issue: https://github.com/winglang/wing/issues/165
new cloud.Function(inflight ()=> {
  // each push should result in a timeout
  q.push("foo");
  q.push("foo");
  // TODO: replace this sleep with std.sleep: https://github.com/winglang/wing/issues/1535
  // wait for 3 seconds
  js.sleep(3000);
  // The queue should have 2 messages still due to timeout
  assert(q.approx_size() == 2);
}) as "test";

