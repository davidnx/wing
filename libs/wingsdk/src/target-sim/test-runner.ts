import { Construct } from "constructs";
import { ISimulatorResource } from "./resource";
import { BaseResourceSchema } from "./schema";
import { TestRunnerSchema, TEST_RUNNER_TYPE } from "./schema-resources";
import { simulatorHandleToken } from "./tokens";
import { bindSimulatorResource, makeSimulatorJsClient } from "./util";
import * as cloud from "../cloud";
import * as core from "../core";

/**
 * Simulator implementation of `cloud.TestRunner`.
 *
 * @inflight `@winglang/sdk.cloud.ITestRunnerClient`
 */
export class TestRunner extends cloud.TestRunner implements ISimulatorResource {
  constructor(scope: Construct, id: string, props: cloud.TestRunnerProps = {}) {
    super(scope, id, props);
  }

  public toSimulator(): BaseResourceSchema {
    const tests = this.getTestFunctionHandles();
    const schema: TestRunnerSchema = {
      type: TEST_RUNNER_TYPE,
      path: this.node.path,
      props: {
        tests,
      },
      attrs: {} as any,
    };
    return schema;
  }

  /** @internal */
  public _bind(host: core.IInflightHost, ops: string[]): void {
    bindSimulatorResource("test-runner", this, host);
    super._bind(host, ops);
  }

  /** @internal */
  public _preSynthesize(): void {
    // add a dependency on each test function
    for (const fn of this.findTests()) {
      this.node.addDependency(fn);
    }

    super._preSynthesize();
  }

  private getTestFunctionHandles(): Record<string, string> {
    const handles: Record<string, string> = {};
    for (const fn of this.findTests()) {
      handles[fn.node.path] = simulatorHandleToken(fn);
    }
    return handles;
  }

  /** @internal */
  public _toInflight(): core.Code {
    return makeSimulatorJsClient("test-runner", this);
  }
}
