import { join } from "path";
import { LambdaEventSourceMapping } from "@cdktf/provider-aws/lib/lambda-event-source-mapping";
import { SqsQueue } from "@cdktf/provider-aws/lib/sqs-queue";
import { Construct } from "constructs";
import { Function } from "./function";
import * as cloud from "../cloud";
import * as core from "../core";
import { convertBetweenHandlers } from "../utils/convert";
import { NameOptions, ResourceNames } from "../utils/resource-names";

/**
 * Queue names are limited to 80 characters.
 * You can use alphanumeric characters, hyphens (-), and underscores (_).
 */
const NAME_OPTS: NameOptions = {
  maxLen: 80,
  disallowedRegex: /[^a-zA-Z0-9\_\-]+/g,
};

/**
 * AWS implementation of `cloud.Queue`.
 *
 * @inflight `@winglang/sdk.cloud.IQueueClient`
 */
export class Queue extends cloud.Queue {
  private readonly queue: SqsQueue;

  constructor(scope: Construct, id: string, props: cloud.QueueProps = {}) {
    super(scope, id, props);

    this.queue = new SqsQueue(this, "Default", {
      visibilityTimeoutSeconds: props.timeout?.seconds,
      name: ResourceNames.generateName(this, NAME_OPTS),
    });

    if ((props.initialMessages ?? []).length) {
      throw new Error(
        "initialMessages not supported yet for AWS target - https://github.com/winglang/wing/issues/281"
      );
    }
  }

  public onMessage(
    inflight: cloud.IQueueOnMessageHandler,
    props: cloud.QueueOnMessageProps = {}
  ): cloud.Function {
    const hash = inflight.node.addr.slice(-8);
    const functionHandler = convertBetweenHandlers(
      this.node.scope!, // ok since we're not a tree root
      `${this.node.id}-OnMessageHandler-${hash}`,
      inflight,
      join(
        __dirname
          .replace("target-tf-aws", "shared-aws")
          .replace("target-tf-aws", "shared-aws"),
        "queue.onmessage.inflight.js"
      ),
      "QueueOnMessageHandlerClient"
    );

    const fn = Function._newFunction(
      this.node.scope!, // ok since we're not a tree root
      `${this.node.id}-OnMessage-${hash}`,
      functionHandler,
      props
    );

    // TODO: remove this constraint by adding generic permission APIs to cloud.Function
    if (!(fn instanceof Function)) {
      throw new Error("Queue only supports creating tfaws.Function right now");
    }

    fn.addPolicyStatements({
      effect: "Allow",
      action: [
        "sqs:ReceiveMessage",
        "sqs:ChangeMessageVisibility",
        "sqs:GetQueueUrl",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes",
      ],
      resource: this.queue.arn,
    });

    new LambdaEventSourceMapping(this, "EventSourceMapping", {
      functionName: fn._functionName,
      eventSourceArn: this.queue.arn,
      batchSize: props.batchSize ?? 1,
    });

    core.Resource.addConnection({
      from: this,
      to: fn,
      relationship: "on_message",
    });

    return fn;
  }

  /** @internal */
  public _bind(host: core.IInflightHost, ops: string[]): void {
    if (!(host instanceof Function)) {
      throw new Error("queues can only be bound by tfaws.Function for now");
    }

    const env = this.envName();

    if (ops.includes(cloud.QueueInflightMethods.PUSH)) {
      host.addPolicyStatements({
        effect: "Allow",
        action: ["sqs:SendMessage"],
        resource: this.queue.arn,
      });
    }
    if (ops.includes(cloud.QueueInflightMethods.PURGE)) {
      host.addPolicyStatements({
        effect: "Allow",
        action: ["sqs:PurgeQueue"],
        resource: this.queue.arn,
      });
    }
    if (ops.includes(cloud.QueueInflightMethods.APPROX_SIZE)) {
      host.addPolicyStatements({
        effect: "Allow",
        action: ["sqs:GetQueueAttributes"],
        resource: this.queue.arn,
      });
    }

    // The queue url needs to be passed through an environment variable since
    // it may not be resolved until deployment time.
    host.addEnvironment(env, this.queue.url);

    super._bind(host, ops);
  }

  /** @internal */
  public _toInflight(): core.Code {
    return core.InflightClient.for(
      __dirname
        .replace("target-tf-aws", "shared-aws")
        .replace("target-tf-aws", "shared-aws"),
      __filename,
      "QueueClient",
      [`process.env["${this.envName()}"]`]
    );
  }

  private envName(): string {
    return `QUEUE_URL_${this.node.addr.slice(-8)}`;
  }
}

Queue._annotateInflight(cloud.QueueInflightMethods.PUSH, {});
Queue._annotateInflight(cloud.QueueInflightMethods.PURGE, {});
Queue._annotateInflight(cloud.QueueInflightMethods.APPROX_SIZE, {});
